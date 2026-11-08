# Adaptar esta base al cliente

Consultorio de una sola especialista, con la identidad todavía por
definir. Todo lo propio del centro está como marcador (`[NOMBRE_CLÍNICA]`,
`[CIUDAD]`, `[NOMBRE_ESPECIALISTA]`…): el sitio se ve terminado y deja
claro qué falta.

Es una **bifurcación, no un espejo**: no comparte código, datos ni
credenciales con el proyecto del que salió.

---

## Antes de nada

```
cd frontend
npm install              # obligatorio: cambiaron las fuentes (Newsreader y Figtree)
cp .env.example .env     # y llenarlo con lo del cliente
npx prisma migrate deploy
npx prisma db seed
```

Base de datos, Google Calendar, WhatsApp, Instagram y el `JWT_SECRET`:
todo nuevo para este cliente.

---

## Lo que hay que llenar, por orden de importancia

### 1. Identidad — `frontend/src/lib/config.ts`
- `SITE`: nombre, eslogan, ciudad, descripción.
- `ESPECIALISTA`: nombre, especialidad, presentación (párrafos), cargos y
  una frase suya. Es lo que decide la sección «Quién le atiende».
- `PORTADA`, `VALORES`, `PASOS_DE_LA_CITA` y `FAQS`: textos de la portada,
  hoy genéricos.
- `LEGAL`: razón social, NIT y datos del responsable del tratamiento.
- `FUNCIONES`: qué módulos están encendidos. Las fichas capilar/facial y
  el seguimiento del paciente están apagados a propósito.

### 2. Valores por defecto — `frontend/src/server/config/env.ts`
`CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_WHATSAPP`, `CLINIC_TIMEZONE`.
Son los que se usan si falta la variable de entorno.

### 3. Logo — `frontend/src/components/site/Logo.tsx`
Hoy dibuja un isotipo genérico (`brand-mark`) y el nombre en texto. Con
el logo real se cambia ahí y en `frontend/public/` (favicon e iconos).

### 4. Horario — desde el panel, *Administración → Horario*
El seed deja lunes a viernes 8:00–18:00 con almuerzo 13–14 y sábado
8:00–13:00. Los bloques de 75 min salen solos de ese horario.

### 5. Textos legales — `frontend/src/app/(sitio)/`
`politica-de-datos`, `terminos` y `cookies` son una **plantilla**
neutra, todavía en tuteo. **Antes de publicar** hay que ajustarlos con el
cliente (y, si se puede, con un abogado): es su documento legal, no un
cambio de nombre.

### 6. Mensajes a pacientes — `frontend/src/lib/mensajesCita.ts`
Confirmación, recordatorio, oferta de hueco y disculpa por día cerrado,
todos de usted y con la firma del centro.

### 7. Plantillas de WhatsApp — en WhatsApp Manager
Cuatro, idioma `es`, categoría *Utilidad*. Las variables de cada una
están en `DESPLIEGUE.md`. Mientras no estén aprobadas, los mensajes que
no salen solos quedan en el panel con su botón «Enviar».

### 8. Catálogo — desde el panel, *Tratamientos*
El seed crea cinco servicios neutros (valoración, tratamientos,
procedimientos, controles, revisión de medicación). Testimonios no
siembra ninguno: van los de pacientes reales con su permiso.

---

## Dónde queda el nombre suelto

```
grep -rnE "\[NOMBRE_CLÍNICA\]|\[CIUDAD\]|\[DIRECCIÓN\]|\[CORREO|\[NIT\]|\[TEL|\[INSTAGRAM\]|\[FACEBOOK\]|\[TIKTOK\]|\[REDES\]|\[REGIÓN\]|\[ESLOGAN\]|\[NOMBRE_ESPECIALISTA\]|\[ESPECIALIDAD\]" frontend/src frontend/prisma docs
```

Cámbialos leyendo, no con un reemplazo masivo: en los textos legales y
en los mensajes el nombre va dentro de frases que también hay que
ajustar.

---

## Lo que no se reutiliza de otro proyecto

- **La app de Meta.** Portafolio comercial, app, número de WhatsApp e
  Instagram propios.
- **Google Calendar.** Otro proyecto, otro OAuth, otro calendario.
- **La base de datos.** Una base por consultorio.
- **La clave de Groq**, si se activa el asistente.
