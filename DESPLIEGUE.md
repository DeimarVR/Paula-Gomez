# Despliegue — todo en Vercel, base en Railway

Una sola aplicación Next.js sirve el sitio, el panel y la API bajo `/api`.
De Railway solo queda PostgreSQL.

```
Vercel  ── sitio + panel + /api ──►  Railway ── PostgreSQL
```

El navegador nunca habla con la base ni con Google o Meta: todo eso ocurre en
el servidor, dentro de las funciones. Es la misma regla de siempre, solo que
ahora el servidor es Vercel en vez de un proceso Express.

---

## 1. Railway — solo la base

No hace falta ningún servicio de aplicación. Si quedó uno creado desde el
repositorio, bórralo: la carpeta `backend` ya no existe.

En el servicio **Postgres**:

- **Settings → Networking → TCP Proxy** activado. De ahí sale
  `DATABASE_PUBLIC_URL`, que es la cadena que usan Vercel y tu máquina.
  Ya no hay red privada que aprovechar, porque el consumidor está fuera.

---

## 2. Vercel — variables

**Settings → Environment Variables.** Root Directory del proyecto: `frontend`.

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la `DATABASE_PUBLIC_URL` de Railway **+ `?connection_limit=1&pool_timeout=20`** |
| `JWT_SECRET` | cadena aleatoria de 48 bytes |
| `CRON_SECRET` | otra cadena aleatoria |
| `PUBLIC_WEB_URL` | `https://tu-dominio.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | el mismo |
| `NEXT_PUBLIC_CLINIC_TIMEZONE` | `America/Bogota` |
| `CLINIC_NAME` | `[NOMBRE_CLÍNICA]` |
| `CLINIC_TIMEZONE` | `America/Bogota` |
| `CLINIC_ADDRESS` | `[DIRECCIÓN]` |
| `CLINIC_WHATSAPP` | `573000000000` |
| `S3_ENDPOINT` | `https://t3.storageapi.dev` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | el nombre del bucket |
| `S3_ACCESS_KEY_ID` | de la pestaña Credentials del bucket |
| `S3_SECRET_ACCESS_KEY` | de la misma pestaña |

Los secretos se generan así y se pegan directo en Vercel:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Por qué `connection_limit=1`

Cada función de Vercel que se activa abre su propio pool contra Postgres. Sin
límite, un pico de tráfico agota las conexiones del servidor y la web empieza
a fallar de forma intermitente y difícil de diagnosticar. Con el límite en 1,
cada instancia usa una conexión y las devuelve al reciclarse.

Si el sitio crece hasta notarlo, la salida es un pooler (Prisma Accelerate,
Supabase Pooler o PgBouncer delante de Railway), no subir el número.

---

## 2 bis. El bucket de archivos

**El bucket se queda privado.** No lo hagas público: las fotos de sesión son
datos clínicos y una dirección difícil de adivinar no es una protección. Todo
sale por `/api/archivos`, que decide caso por caso:

| Carpeta | Quién puede verla |
|---|---|
| `sitio/` | cualquiera |
| `galeria/` | cualquiera, pero solo si un caso **publicado y con consentimiento** la referencia |
| `sesiones/` | el equipo con sesión iniciada, o el paciente con su token —y solo las marcadas como visibles para él |

Una imagen subida y todavía no publicada no se ve, aunque se filtre el enlace.

### CORS, que es lo único que hay que configurar en el bucket

La subida va **del navegador directo al bucket**, con una URL firmada que dura
cinco minutos. Eso esquiva el límite de 4,5 MB por petición de las funciones de
Vercel, que una foto de celular supera sin esfuerzo — pero exige permitir el
origen en el bucket. En la pestaña **Settings** del bucket, la política CORS:

```json
[
  {
    "AllowedOrigins": ["https://tu-dominio.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3000
  }
]
```

Si al subir una foto el panel dice que *el bucket rechazó la subida*, es esto:
la API autorizó y el que dijo que no fue el bucket.

### Cómo se guarda

En la base no queda la URL del bucket sino una ruta interna,
`/api/archivos/galeria/2026-08/‹aleatorio›.jpg`. Así el proveedor de
almacenamiento se puede cambiar mañana sin reescribir una sola fila, y ninguna
dirección del bucket queda escrita en la base.

---

## 3. Migraciones

Ya no corren solas en cada despliegue: no hay proceso de arranque donde
engancharlas. Se aplican desde tu máquina cuando cambie el esquema.

```powershell
cd frontend
npx prisma migrate deploy
```

Toma `DATABASE_URL` de **`.env`**, no de `.env.local`. Esto tiene truco y ya
costó un rato: `.env.local` es una convención de Next y el CLI de Prisma no la
conoce —solo lee `.env`—, así que con las variables ahí la web arranca bien
pero `migrate deploy` falla con *"Environment variable not found:
DATABASE_URL"*. Next lee los dos archivos, de modo que `.env` sirve para ambos
sin duplicar el valor.

`migrate deploy` solo aplica lo pendiente y nunca reinicia la base, al
contrario que `migrate dev`.

Las migraciones nuevas son **idempotentes** (`IF NOT EXISTS` y bloques que
ignoran lo que ya existe): si el SQL ya se pegó a mano en la consola de
Railway, `migrate deploy` las vuelve a correr sin romper nada y solo las anota
como aplicadas.

---

## 4. El usuario del panel

La base arranca vacía; sin esto no hay con qué entrar a `/admin`.

```powershell
cd frontend
npx tsx prisma/seed.ts
```

Imprime la contraseña **una sola vez**. Guárdala antes de cerrar la terminal:
no queda escrita en ningún archivo, a propósito. Volver a correrlo no pisa la
contraseña de un usuario que ya existe.

---

## 5. La tarea diaria

`vercel.json` declara una sola tarea, a las 14:00 UTC (9:00 hora local), que
renueva el token de Instagram, sincroniza el feed, envía los recordatorios de
las citas del día siguiente y da por vencidas las ofertas de huecos que ya no
se pueden tomar. (Una oferta vencida también se detecta al abrir su enlace: la
tarea solo pone orden en el panel.)

**Van juntas porque el plan Hobby de Vercel solo permite una ejecución diaria
por tarea**, y una expresión más frecuente hace *fallar el despliegue*. En Pro
se pueden separar y devolverle al feed su cadencia horaria.

La tarea es idempotente: los recordatorios solo salen para citas sin marca de
envío, así que repetirla no duplica mensajes y saltarse un día no pierde nada,
que es justo lo que pide Vercel —avisa de que una tarea puede ejecutarse dos
veces o ninguna.

Para probarla a mano:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  https://tu-dominio.vercel.app/api/cron/diario
```

---

## 6. Comprobar

```bash
# El catálogo sale de la base
curl https://tu-dominio.vercel.app/api/public/services

# El panel autentica
curl -X POST https://tu-dominio.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","password":"LA-DEL-SEED"}'
```

Si el login devuelve un token, la base, las migraciones, el usuario y la
autenticación están bien.

---

## 7. Integraciones

Ninguna es obligatoria: el sistema arranca sin ellas y cada módulo se degrada
con elegancia. Se conectan desde `/admin/integraciones`, pulsando "Conectar":
el panel pide la URL de consentimiento, tú autorizas, y el token vuelve y se
guarda en la base. No hay que pegar ningún token a mano.

El `state` de OAuth se guarda en la tabla `settings`, no en memoria: la
petición que pide el enlace y la que vuelve desde Google caen en instancias
distintas de la función, y con un valor en memoria ninguna conexión llegaría a
completarse.

### Google Calendar

1. [console.cloud.google.com](https://console.cloud.google.com/) → crear proyecto.
2. **APIs y servicios → Biblioteca** → habilitar **Google Calendar API**.
3. **Pantalla de consentimiento OAuth** → tipo **Externo**.
4. **⚠️ Pulsa "Publish app" (Publicar aplicación).** Este paso no es opcional
   ni cosmético: mientras la app siga en *Testing*, Google caduca el refresh
   token **a los 7 días** y la sincronización con la agenda se rompe cada
   semana. Publicar no exige verificación; como el scope de Calendar es
   sensible, saldrá una pantalla de advertencia al autorizar y un tope de 100
   usuarios, que para un centro sobra.
5. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación
   web.** En *URI de redirección autorizados*, exactamente:

   ```
   http://localhost:3000/api/integrations/google/callback     (para probar en local)
   https://tu-dominio.vercel.app/api/integrations/google/callback
   ```

   Pueden convivir las dos. Tienen que coincidir carácter por carácter con
   `GOOGLE_REDIRECT_URI`: Google compara la cadena completa, y una barra final
   de más es motivo de rechazo.
6. Copia el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, y
   pon `GOOGLE_REDIRECT_URI` con el valor del entorno correspondiente.
7. Reinicia y entra a `/admin/integraciones` → **Conectar Google Calendar**.

El refresh token se guarda solo en la base. Si algún día hay que rehacerlo, se
vuelve a pulsar Conectar.

**`GOOGLE_CALENDAR_ID` se deja en `primary` salvo que sepas muy bien lo que
haces.** Significa «el calendario principal de la cuenta conectada» y es lo que
funciona siempre. Si se pone ahí el identificador de un calendario secundario
—esos largos que acaban en `@group.calendar.google.com`— y la cuenta que
autorizó no es la dueña de ese calendario, la integración dice **Conectado**,
las citas se guardan bien en la base, y en Google no aparece ninguna: la API
contesta un escueto `Not Found` que no señala a nada. Pasó, y costó encontrarlo.
El botón **Revisar el calendario** de Integraciones lista los calendarios que la
cuenta conectada ve de verdad, y dice si el configurado está entre ellos.

**La cuenta importa más de lo que parece.** El sistema conecta UNA sola: la
agenda del centro, de la que salen los horarios libres. Conviene que sea la
cuenta del centro y no la personal de quien despliega, porque los eventos ya
creados no se mueven al cambiar de cuenta. El resto del equipo no conecta nada:
comparte ese calendario desde Google o lo agrega en su teléfono
(`docs/calendario-apple.html`).

> **Para quien usa el Calendario de Apple:** `docs/calendario-apple.html`. Apple
> no ofrece API de calendario para terceros, así que no hay nada que integrar
> por ese lado: se agrega esta misma cuenta de Google dentro de la app
> Calendario del iPhone o del Mac y las citas aparecen ahí. Esa hoja es el paso
> a paso, escrito para alguien no técnico.

### Instagram

> **Para quien va a la clínica a sacar los tokens y no es técnico:**
> `docs/sacar-tokens-meta.html`. Se abre con doble clic en cualquier navegador y
> se puede imprimir. Cubre solo la parte de conseguir las llaves en Meta; la
> conexión de aquí abajo la hace después quien despliega.

**No se puede conectar desde localhost:** Meta exige HTTPS en la URI de
redirección. Esta hay que hacerla contra el dominio de Vercel.

1. [developers.facebook.com](https://developers.facebook.com/) → crear app tipo
   **Empresa**.
2. Agregar el producto **Instagram** → *Configuración de la API con inicio de
   sesión de Instagram*.
3. La cuenta **La cuenta de Instagram tiene que ser Profesional** (Empresa o
   Creador). Con una cuenta personal el flujo no termina.
4. En *URI de redireccionamiento de OAuth*, exactamente:

   ```
   https://tu-dominio.vercel.app/api/integrations/instagram/callback
   ```

5. Copia el identificador y el secreto de la app de Instagram a
   `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` **en Vercel**, y
   `INSTAGRAM_REDIRECT_URI` con esa misma URL.
6. Vuelve a desplegar y entra a `/admin/integraciones` → **Conectar Instagram**.

#### El token de 60 días

Es el punto delicado de toda la integración. El token de larga duración de Meta
dura 60 días; si nadie lo renueva, el feed muere en silencio.

La tarea diaria lo revisa y lo renueva cuando le quedan 30 días o menos. Meta
rechaza renovar un token con menos de 24 h de vida, y el código respeta ese
límite. Por eso el token vive en la tabla `integration_tokens` y no en una
variable de entorno: si viviera en el entorno, cada despliegue restauraría el
token viejo y el feed se caería igual a los 60 días.

**Y esa tarea solo corre si `CRON_SECRET` está configurado en Vercel** — sin
esa variable la ruta responde 401. El panel de integraciones lo avisa: si dice
"Desactivada", el token no se está renovando.

### WhatsApp

Los enlaces `wa.me` —botón flotante, "escríbenos", enviar seguimiento—
funcionan siempre, sin token ni configuración.

Las variables de WhatsApp solo hacen falta para los envíos **automáticos**.
Fuera de la ventana de 24 h Meta exige plantillas aprobadas (idioma `es`,
categoría *Utilidad*), y sus nombres van en estas variables:

| Variable | Cuándo sale | Variables del cuerpo |
|---|---|---|
| `WHATSAPP_TEMPLATE_CONFIRMATION` | Al reservar o cambiar la hora | {{1}} nombre · {{2}} «Consulta» · {{3}} fecha y hora |
| `WHATSAPP_TEMPLATE_REMINDER` | El día anterior | {{1}} nombre · {{2}} «Consulta» · {{3}} fecha y hora |
| `WHATSAPP_TEMPLATE_HUECO` | Se liberó un hueco y se ofrece a quienes van después | {{1}} el hueco · {{2}} su cita actual · {{3}} el enlace |
| `WHATSAPP_TEMPLATE_DIA_CERRADO` | La especialista cerró un día con citas | {{1}} la cita cancelada · {{2}} el enlace para reagendar |

Sin plantilla, o sin Cloud API, cada envío queda en el panel con un enlace
`wa.me` ya escrito para que recepción lo mande a mano: los huecos ofrecidos y
las disculpas aparecen en *Agenda*, con su botón «Enviar». Nada se pierde.

**No lo conectes hasta que `PUBLIC_WEB_URL` tenga el dominio real.** Con el
valor por defecto, los enlaces de seguimiento que reciben los pacientes
apuntarían a `localhost`.

## Lo que se perdió al salir de un servidor propio

Conviene tenerlo escrito, porque son decisiones con consecuencia:

- **El feed de Instagram se sincroniza una vez al día**, no cada hora. Límite
  del plan Hobby.
- **El freno de fuerza bruta del login es best effort.** El contador vive en
  memoria de la instancia y en serverless hay varias a la vez, así que frena
  al script tonto pero no a un atacante decidido. Un límite de verdad necesita
  almacenamiento compartido (Vercel KV, Upstash).
- **Las migraciones son manuales.** Antes corrían en cada arranque.
- **Vercel Hobby prohíbe el uso comercial.** Está en su documentación. Para un
  sitio de clínica que agenda citas, lo correcto es Pro.

---

## Notas

- **El volumen de Railway es la base real.** Borrar ese servicio borra los
  datos de los pacientes. No hay papelera.
- **Copias de seguridad:** Railway no hace respaldos automáticos en todos los
  planes. Con datos clínicos reales, programa un `pg_dump` periódico antes de
  abrir el sistema al público.
