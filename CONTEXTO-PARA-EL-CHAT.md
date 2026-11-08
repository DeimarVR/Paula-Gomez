# Contexto del proyecto

Pégale esto al chat nuevo antes de empezar. Es lo que ya sabemos y no
conviene volver a descubrir a los golpes.

---

## Qué es

Sistema para el consultorio de **una sola especialista** (identidad aún
por definir; todo lo propio va con marcadores como `[NOMBRE_CLÍNICA]`):
sitio público + panel de administración. Nació como bifurcación de otro
proyecto en producción y ya no comparte nada con él. Lee `ADAPTAR.md`
para saber qué falta llenar.

**Las tres reglas del cliente**, que mandan sobre todo lo demás:

1. **Un solo tipo de cita: 75 minutos, una persona a la vez.** Los
   bloques salen seguidos desde la apertura y saltan el almuerzo. El
   paciente no elige servicio, solo día y hora.
2. **Hueco liberado se ofrece.** Si alguien cancela (por su enlace o
   desde el panel), lo marcan «no asistirá» o lo cambian de hora, se
   ofrece por WhatsApp a quienes tienen cita **después**, el más cercano
   primero, máximo 5. El primero que lo toma se lo queda (con cerrojo);
   los demás ven «ya fue tomado». Con menos de 3 h para el hueco no se
   ofrece. La hora vieja de quien adelantó se ofrece otra vez, en cadena.
3. **«Cerrar este día».** Pide confirmación, motivo opcional, bloquea
   reservas web y del panel, y a cada paciente afectado le llega una
   disculpa en nombre de la doctora con enlace para elegir otra hora él
   mismo. El día se puede reabrir.

**Stack:** Next.js 14 App Router (front y API en el mismo despliegue),
Prisma 6 + PostgreSQL en Railway, desplegado en Vercel. Interfaz en
español. Roles: `ADMIN`, `PROFESIONAL`, `RECEPCION`.

---

## Cómo trabajo

Reglas que ya están acordadas y no hay que volver a preguntar:

- **Nunca subas nada a git.** Ni commit ni push, ni siquiera comandos de
  lectura sobre el repo. Yo lo hago a mano.
- **Secretos jamás por el chat.** Las claves las escribo yo directo en
  Vercel o en el `.env`. No me las pidas ni me las pases.
- **El SQL va en el chat, no en archivos.** Yo copio y pego; las
  carpetas se saturan.
- **Nada de trabajos pesados en mi PC.**
- **Verifica que los archivos llegaron de verdad**, no solo que se
  enviaron.
- **Critícame.** Si digo que algo ya está hecho y ves que no, dímelo en
  vez de darme la razón.

---

## Lo que ya está construido

Agenda de bloques de 75 min con Google Calendar · Ofertas de huecos
liberados · Cierre de días con disculpa y reagendado por el paciente ·
Editor del horario semanal · **Expediente** del paciente (qué se trata,
medicación actual, antecedentes y alergias, notas de evolución, fotos de
las hojas en papel) · Pacientes · Fotos de seguimiento · Inventario ·
Consentimientos firmados · Asistente de IA en el panel (Groq con
tool-calling y un intérprete por reglas de respaldo) · Instagram y
WhatsApp Cloud API (solo envío; **no hay webhook de recepción**).

**Se quitaron** Facturación, Caja y Por cobrar (código y pantallas). Sus
tablas siguen en el esquema sin uso: borrar tablas no se deshace.

**Apagados sin borrar**, en `FUNCIONES` de `src/lib/config.ts`: las
fichas capilar y facial («Control de pacientes») y el portal de
seguimiento. El expediente general las reemplaza.

**Diseño:** «Sereno clínico» (azul marino + arena, Newsreader y
Figtree). La maqueta aprobada está en `docs/maqueta-clinica.html`.
El sitio público le habla al paciente de **usted**; el panel, al
equipo, de tú.

---

## Trampas que ya nos costaron tiempo

Esto es lo más valioso de este archivo.

**El envoltorio `route()` solo deja pasar `NextResponse`.** Cualquier
otra cosa la serializa como JSON. Una ruta que devolvía un `Response`
normal convertía un Excel en `{}`. Si una ruta devuelve un archivo,
tiene que ser `NextResponse`.

**Chromium descarta el nombre de descarga si lleva un solo carácter
fuera de ASCII** y guarda el archivo como «download», sin extensión.
Comprobado: `Facturacion.xlsx` baja bien, `Facturación.xlsx` no. Los
nombres de archivo van sin tildes.

**La consola SQL de Railway le pega un `LIMIT` al script** si aparece la
palabra SELECT, incluso dentro de un comentario. Solución: que el script
termine en un `SELECT`, así el `LIMIT` cae en una consulta que lo
acepta.

**La existencia del inventario NO se guarda**, se calcula sumando
`StockMove`. Un `AJUSTE` suma; para bajar hay que registrar una
`SALIDA`. Y `StockMove.productId` es `Cascade`: borrar un producto
destruye su historial entero.

**Las fechas no son todas iguales.** `Invoice.issueDate` se guarda a
medianoche UTC (es una fecha, no un instante); `Payment.paidAt` es un
instante real medido en la zona de la clínica. Mezclar los dos rangos
produce un corrimiento de un día. Ya pasó dos veces.

**Leer y escribir dentro de una transacción no es atómico.** En el nivel
de aislamiento por defecto de Postgres, veinte peticiones simultáneas se
pisan: lo medimos y veinte reservas se contaron como tres. Si hay que
contar algo bajo concurrencia, usa `pg_advisory_xact_lock`.

**`prettier` sin configuración reformatea a comillas dobles.** El
proyecto usa comillas simples y ancho 100:
`npx prettier --single-quote --print-width 100`. Correrlo sin flags
genera un diff de cientos de líneas que no cambia nada.

**`write-excel-file/node`**: las opciones de varias hojas son planas
(`{data, sheet, columns}`), no anidadas bajo `options`. Anidadas se
ignoran en silencio y las hojas salen como Sheet1, Sheet2.

**Todo lo que toca la agenda pasa por `conCerrojoDeAgenda`**
(`src/server/lib/cerrojo.ts`). Dentro, todo con `tx`, nunca con
`prisma`: una consulta fuera de la transacción no ve lo que el cerrojo
protege. Lo de Google (huecos ocupados) se pide **antes** de entrar,
para no tener el cerrojo tomado esperando una red. Sin cerrojo, de diez
reservas simultáneas al mismo bloque entraron nueve; con él, una.

**Los eventos que crea el sistema en Google son `transparent`.** Así la
consulta de ocupado de Google solo devuelve lo que la doctora puso a
mano, y una cita no se bloquea a sí misma al moverla.

**Al cambiar una cita de hora se excluye a sí misma** (`excluirCitaId`)
de la comprobación; si no, su propia hora sale ocupada. En el enlace del
paciente esa hora se muestra marcada como «la suya» y no se puede volver
a elegir (moverla a la misma hora reenviaría la confirmación).

**Las migraciones nuevas evitan la palabra que la consola de Railway
caza** y son idempotentes, así que pegarlas en la consola y después
correr `migrate deploy` funciona.

**El pie y Contacto leen el horario de la base.** El layout público se
regenera cada 10 minutos y guardar el horario lo fuerza al momento. Un
horario escrito a mano en una página tarde o temprano miente.

---

## Estilo del código

- **Todo en español**: nombres de funciones, variables, comentarios.
- **Los comentarios explican el PORQUÉ**, no el qué. Si una decisión
  parece rara, el comentario dice qué pasó cuando se hizo de la otra
  forma.
- Comillas simples, ancho 100.
- Los colores viven **solo** en `globals.css`; `tailwind.config.ts`
  nada más les pone nombre.
- La seguridad está en las rutas (`requireAuth`, `requireRole`), no en
  esconder botones. Esconderlos es cortesía, no protección.

---

## Cómo se prueba aquí

No hay framework de pruebas montado. Lo que funcionó fue:
levantar un Postgres local, aplicar las migraciones con `psql`,
compilar el código real con esbuild sustituyendo solo el cliente de
Prisma y la configuración, y **llamar a las rutas de verdad** con un
`NextRequest` y un JWT firmado.

La lección que lo justifica: una vez probé el servicio por un lado y el
navegador por otro, con la ruta simulada en medio. El fallo estaba justo
en la ruta y ninguna de las dos pruebas lo podía ver.

Para las tres reglas hubo además una prueba de punta a punta con el
navegador contra `next start`: reservar desde la portada, cambiar la
hora y cancelar desde el enlace, tomar el hueco ofrecido, cerrar y
reabrir un día, y escribir en el expediente.

**Ojo con `next start` viejo:** si se recompila con un servidor
encendido, este regenera páginas con los nombres de archivo de la
compilación anterior y el sitio carga sin estilos ni JavaScript. Se
apaga el servidor antes de compilar.

---

## Lo que esta copia NO trae

Sin `.env`, sin `.git`, sin `node_modules`. Credenciales, base de datos,
app de Meta, Instagram y Google Calendar: todo nuevo para el cliente
nuevo. Detalle en `ADAPTAR.md`.
