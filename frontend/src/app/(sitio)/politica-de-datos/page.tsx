import type { Metadata } from 'next';
import Link from 'next/link';
import { getClinic } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { FUNCIONES, LEGAL, legalCompleto } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Política de tratamiento de datos',
  description:
    'Cómo [NOMBRE_CLÍNICA] recolecta, usa y protege los datos personales de sus pacientes, conforme a la Ley 1581 de 2012.',
};

export default async function PoliticaPage() {
  const clinic = await getClinic();

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell mx-auto max-w-3xl">
        <h1 className="text-4xl leading-tight sm:text-5xl">
          Política de tratamiento de datos personales
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          En cumplimiento de la Ley 1581 de 2012 y el Decreto 1074 de 2015 de la República de
          Colombia.
        </p>

        <div className="mt-12 space-y-10 leading-relaxed text-ink/90">
          <section>
            <h2 className="font-display text-2xl">1. Responsable del tratamiento</h2>
            <p className="mt-3">
              {legalCompleto ? (
                <>
                  <strong>{LEGAL.razonSocial}</strong>, identificada con NIT {LEGAL.nit}, que opera
                  bajo el nombre comercial {clinic.name},
                </>
              ) : (
                <>{clinic.name}</>
              )}{' '}
              con domicilio en {clinic.address}, es responsable del tratamiento de los datos
              personales recolectados a través de este sitio web, de WhatsApp y de la atención
              presencial.
            </p>
            <p className="mt-3">
              Canales de contacto: {formatPhone(clinic.whatsapp)} y {LEGAL.correoDatos}.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">2. Datos que recolectamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Datos de contacto:</strong> nombre, número de celular, correo electrónico y
                ciudad.
              </li>
              <li>
                <strong>Datos de la cita:</strong> tratamiento seleccionado, fecha, hora y las
                observaciones que nos compartas al agendar.
              </li>
              <li>
                <strong>Datos sensibles de salud:</strong> antecedentes clínicos, diagnóstico,
                medicación, tratamientos aplicados, notas de evolución y, cuando aplique, registro
                fotográfico. Estos datos son de naturaleza sensible y solo se tratan con tu
                autorización previa, expresa e informada.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl">3. Finalidades</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Agendar, confirmar, recordar y reprogramar tus citas.</li>
              <li>Elaborar tu historia clínica y hacer seguimiento del tratamiento.</li>
              <li>
                Enviarte por WhatsApp la confirmación de tu cita y los recordatorios
                {FUNCIONES.seguimientoPaciente ? ', y el enlace a tu seguimiento personal' : ''}.
              </li>
              <li>
                Publicar imágenes de antes y después <strong>únicamente</strong> si firmaste una
                autorización específica y separada para ello. Esa autorización es revocable en
                cualquier momento.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl">4. Encargados y transferencias</h2>
            <p className="mt-3">
              Para operar utilizamos servicios de terceros que actúan como encargados del
              tratamiento: Google (Google Calendar, para la gestión de la agenda) y Meta Platforms
              (WhatsApp Business, para las comunicaciones). Estos proveedores acceden a los datos
              estrictamente necesarios para prestar el servicio. No vendemos ni cedemos tus datos a
              terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">5. Tus derechos</h2>
            <p className="mt-3">
              Como titular puedes conocer, actualizar y rectificar tus datos; solicitar prueba de la
              autorización otorgada; ser informado sobre el uso que les damos; presentar quejas ante
              la Superintendencia de Industria y Comercio; y revocar la autorización o solicitar la
              supresión de tus datos cuando no exista un deber legal o contractual que lo impida.
            </p>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos escríbenos a {formatPhone(clinic.whatsapp)}.
              Responderemos dentro de los plazos que fija la ley: quince (15) días hábiles para
              consultas y quince (15) días hábiles para reclamos.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">6. Seguridad y conservación</h2>
            <p className="mt-3">
              Aplicamos medidas técnicas y administrativas para proteger tus datos. Las fotografías
              clínicas se guardan en almacenamiento privado y solo se entregan a quien tiene sesión
              iniciada en el centro: no quedan en direcciones públicas.
              {FUNCIONES.seguimientoPaciente
                ? ' El enlace a tu seguimiento personal es único, no está indexado en buscadores y puede regenerarse a petición tuya.'
                : ''}{' '}
              La historia clínica se conserva por el término que exige la normativa colombiana en
              materia de historias clínicas.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted">
          Sobre lo que se guarda en tu navegador, consulta la{' '}
          <Link href="/cookies" className="underline underline-offset-2">
            política de cookies
          </Link>
          . Las condiciones de uso del sitio y de la reserva están en los{' '}
          <Link href="/terminos" className="underline underline-offset-2">
            términos y condiciones
          </Link>
          .
        </p>

        <p className="mt-14 border-t border-line pt-6 text-sm text-muted">
          Última actualización: {new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}
        </p>
      </div>
    </div>
  );
}
