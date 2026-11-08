# [NOMBRE_CLÍNICA]

Sitio web y sistema de gestión para el consultorio de **[NOMBRE_ESPECIALISTA]** ([CIUDAD]).
Una sola especialista, un solo tipo de cita: **75 minutos, una persona a la vez**.

Todo vive en un proyecto Next.js 14 (App Router): sitio, panel y API en el mismo despliegue.

```
frontend/   Next.js 14 + TypeScript + Tailwind + Prisma 6 (PostgreSQL)
docs/       Maqueta de diseño aprobada (maqueta-clinica.html)
```

Google, Meta y la base de datos solo se tocan desde las rutas del servidor: ningún token llega al
navegador.

---

## Qué incluye

**Sitio público** (le habla al paciente de usted)
- Portada con reserva rápida (día y hora en la misma pantalla, con los huecos libres de verdad),
  servicios, «Quién le atiende», cómo es la cita, testimonios, ubicación y preguntas frecuentes.
- Reserva en dos pasos: horario y datos. Confirmación por WhatsApp.
- Enlace personal de la cita para confirmar, **cambiar la hora** o cancelar sin llamar.
- Página de oferta de hueco: «se liberó un espacio antes que el suyo, ¿lo quiere?».

**Agenda**
- Bloques de 75 min seguidos desde la apertura, saltando el almuerzo. El horario semanal se edita
  desde el panel y los bloques salen solos.
- **Huecos liberados**: si una cita se cancela, se marca «no asistirá» o se mueve, el hueco se
  ofrece por WhatsApp a los (máximo 5) pacientes con cita más adelante, el más cercano primero.
  El primero que lo toma se lo queda; los demás ven «ya fue tomado». Con menos de 3 h no se
  ofrece. La hora que deja libre quien adelantó se ofrece otra vez.
- **Cerrar un día**: confirma, motivo opcional, bloquea reservas, cancela las citas de ese día y
  manda a cada paciente una disculpa en nombre de la especialista con enlace para elegir otra
  hora. Se puede reabrir.
- Google Calendar en las dos direcciones: cada cita crea su evento y lo que la especialista
  agende a mano en Google bloquea la agenda.

**Panel** (`/admin`)
- *Hoy*: la cita en curso, la siguiente, el día completo y lo que queda por mandar a mano.
- *Agenda* por día (con «Agendar aquí» en cada bloque libre) y lista con búsqueda.
- **Expediente** del paciente: qué se le trata y cuántos controles lleva, medicación actual,
  antecedentes y alergias, notas de evolución con autor, y fotos de las hojas en papel.
- Mensajes, fotos, consentimientos firmados, inventario, tratamientos, contenido del sitio,
  integraciones y un asistente de IA (Groq, con respaldo por reglas).

Facturación, caja y cartera **no** están en este proyecto. Las fichas capilar/facial y el portal
de seguimiento existen en el código pero están apagados en `FUNCIONES` (`src/lib/config.ts`).

---

## Puesta en marcha

Requisitos: **Node.js 20+** y **PostgreSQL 14+** (o Docker: `docker compose up -d db`).

```bash
cd frontend
cp .env.example .env          # DATABASE_URL, JWT_SECRET y lo demás
npm install
npx prisma migrate deploy     # crea o actualiza las tablas
npm run seed                  # usuario admin, horario y catálogo inicial
npm run dev                   # http://localhost:3000  ·  panel en /admin
```

El seed crea el administrador con una **contraseña aleatoria que imprime una sola vez**. Para
fijarla, define `SEED_ADMIN_PASSWORD` antes de correrlo. Es idempotente: solo agrega lo que falta
y no pisa lo que el centro ya editó.

---

## Identidad

Mientras no exista la del cliente, la marca es provisional y sobria:

- **Logo**: un cuadro azul con una cruz y el nombre en texto, en
  `frontend/src/components/site/Logo.tsx`. Es el único archivo que cambia cuando llegue el logo.
- **Colores**: viven solo en `frontend/src/app/globals.css` (bloque `:root`), con los contrastes
  auditados en los comentarios. `brand` es el azul marino (`#1F3A5F` en botones), `accent` el
  arena (`#C9AE85`, solo detalles o texto sobre oscuro).
- **Tipografías**: Newsreader (títulos) y Figtree (texto), servidas desde el propio proyecto.
- **Textos**: `frontend/src/lib/config.ts` (`SITE`, `ESPECIALISTA`, `PORTADA`, `FAQS`, `LEGAL`).

Qué falta llenar y dónde: `ADAPTAR.md`.

---

## Integraciones

Todas son **opcionales** y se conectan desde `/admin/integraciones`. Una reserva nunca se pierde
porque Google o Meta no respondan: la cita se guarda primero.

**WhatsApp.** Sin token, los enlaces `wa.me` funcionan siempre y cada mensaje automático queda en
el panel con su botón «Enviar» ya escrito. Con Cloud API salen solos: confirmación, recordatorio,
oferta de hueco y disculpa por día cerrado. Fuera de la ventana de 24 h Meta exige plantillas
aprobadas; sus nombres y variables están en `DESPLIEGUE.md`.

**Google Calendar.** Credenciales OAuth web en Google Cloud Console y *Conectar calendario* en el
panel.

**Instagram.** El token de 60 días vive en la base y la tarea diaria lo renueva.

---

## Comandos

Todos dentro de `frontend/`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilar y ejecutar en producción |
| `npm run seed` | Datos iniciales (idempotente) |
| `npm run check` | Schema, sintaxis, exports, componentes y tipos |
| `npm run lint` | ESLint |
| `npx prisma migrate deploy` | Aplicar migraciones pendientes |

---

## Decisiones que conviene conocer

**La agenda tiene un cerrojo.** Reservar, mover, cancelar, tomar un hueco y cerrar un día pasan
por `pg_advisory_xact_lock`. Sin él, de diez reservas simultáneas al mismo bloque entraban nueve.

**El horario se vuelve a verificar al guardar.** Entre que la persona ve la grilla y pulsa
«reservar» pueden pasar minutos; si otro tomó el espacio, la API responde `409`.

**El sitio nunca dice un horario distinto del que se puede reservar.** El pie y Contacto leen la
misma tabla que la agenda, y guardar el horario regenera las páginas públicas.

**Las fechas se guardan en UTC y se muestran en `CLINIC_TIMEZONE`.**

**El expediente no sale del panel.** Ninguna ruta pública lo lee. Borrar una nota es solo de su
autor o de administración; borrar una hoja escaneada, solo de administración.

---

## Producción

Vercel para la aplicación y Railway para la base. Paso a paso, variables, plantillas de WhatsApp
y la tarea diaria: `DESPLIEGUE.md`.

**Antes de abrir al público:** ajustar con el cliente los textos legales (`/politica-de-datos`,
`/terminos`, `/cookies`). Son una plantilla basada en la Ley 1581 de 2012, no un documento
validado por un abogado.
