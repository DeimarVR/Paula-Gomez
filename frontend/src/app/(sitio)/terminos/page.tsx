import type { Metadata } from 'next';
import Link from 'next/link';
import { getClinic } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { LEGAL, SITE, legalCompleto } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Condiciones de uso del sitio de [NOMBRE_CLÍNICA] y de la reserva de citas en línea: cancelaciones, alcance de la información publicada y propiedad del contenido.',
};

/**
 * Términos y condiciones.
 *
 * Cubre lo que la política de datos no cubre: qué es y qué no es este sitio,
 * en qué queda comprometido el centro cuando alguien reserva por aquí, y qué
 * pasa si esa cita no se cumple.
 *
 * Los plazos concretos —cuánta antelación para cancelar, cuántos minutos de
 * tolerancia— están escritos como los aplica hoy el centro. Si cambian, se
 * cambian aquí: es el documento al que se remite un paciente que reclama.
 */
export default async function TerminosPage() {
  const clinic = await getClinic();

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell mx-auto max-w-3xl">
        <h1 className="text-4xl leading-tight sm:text-5xl">Términos y condiciones</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Condiciones de uso de este sitio y de la reserva de citas en línea.
        </p>

        <div className="mt-12 space-y-10 leading-relaxed text-ink/90">
          <section>
            <h2 className="font-display text-2xl">1. Quiénes somos</h2>
            <p className="mt-3">
              Este sitio pertenece a{' '}
              {legalCompleto ? (
                <>
                  <strong>{LEGAL.razonSocial}</strong>, identificada con NIT {LEGAL.nit},
                </>
              ) : (
                <strong>{clinic.name}</strong>
              )}{' '}
              con domicilio en {clinic.address}. A lo largo de este documento se le llama «el
              centro». El nombre comercial con el que opera es {SITE.name}.
            </p>
            <p className="mt-3">
              Cualquier consulta sobre estas condiciones puede dirigirse al{' '}
              {formatPhone(clinic.whatsapp)}.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">2. Para qué sirve este sitio</h2>
            <p className="mt-3">
              Este sitio informa sobre los tratamientos del centro y permite solicitar una cita. No
              presta atención médica ni la sustituye.
            </p>
            <p className="mt-3">
              <strong>
                La información publicada es orientativa y no constituye un diagnóstico ni una
                prescripción.
              </strong>{' '}
              Cada caso tiene causas distintas, y ninguna se determina leyendo una página web. Cualquier decisión sobre un tratamiento nace de una
              valoración presencial.
            </p>
            <p className="mt-3">
              Los casos de antes y después que se muestran corresponden a pacientes reales que
              autorizaron su publicación por escrito. Los resultados varían según la causa, el
              tiempo de evolución y la constancia con el tratamiento: no son una promesa de
              lo que se obtendrá en otro caso.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">3. Reserva de citas</h2>
            <p className="mt-3">
              Al reservar por este sitio se solicita un horario. La reserva queda registrada de
              inmediato y el centro la confirma por WhatsApp al número que se haya dejado. Mientras
              no llegue esa confirmación, la cita está pedida pero no confirmada.
            </p>
            <p className="mt-3">
              Para reservar hay que ser mayor de edad. La cita de un menor la agenda su padre, madre
              o representante legal, que además debe acompañarlo a la consulta.
            </p>
            <p className="mt-3">
              El centro puede reprogramar o cancelar una cita cuando ocurra algo que se lo impida
              —una urgencia, una falla del equipo—. En ese caso avisa por WhatsApp lo antes posible y
              ofrece otro horario.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">4. Cancelaciones e inasistencia</h2>
            <p className="mt-3">
              Para cancelar o mover una cita basta con escribir al {formatPhone(clinic.whatsapp)}, o
              usar el enlace que llega en el mensaje de confirmación.
            </p>
            <p className="mt-3">
              Se agradece avisar con al menos <strong>cuatro horas</strong> de anticipación: ese
              espacio se le puede ofrecer a otro paciente que está esperando turno.
            </p>
            <p className="mt-3">
              Quien llegue con más de <strong>quince minutos</strong> de retraso puede encontrar que
              su cita ya no alcanza a realizarse completa, porque detrás hay otro paciente citado. En
              ese caso se atiende lo que el tiempo permita o se reprograma.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">5. Precios y pagos</h2>
            <p className="mt-3">
              Los precios publicados están en pesos colombianos e incluyen los impuestos aplicables.
              Sirven de referencia: el valor final de un tratamiento depende de lo que se determine
              en la valoración, y se informa al paciente antes de iniciarlo.
            </p>
            <p className="mt-3">
              El pago se realiza en el centro. Este sitio no recibe pagos ni almacena datos de
              tarjetas.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">6. Contenido del sitio</h2>
            <p className="mt-3">
              Los textos, las fotografías, el logo y el diseño de este sitio son del centro o se usan
              con autorización. Pueden citarse mencionando la fuente, pero no reproducirse con fines
              comerciales sin permiso escrito.
            </p>
            <p className="mt-3">
              Las fotografías clínicas de pacientes no se publican salvo autorización específica y
              separada, revocable en cualquier momento. Está detallado en la{' '}
              <Link href="/politica-de-datos" className="underline underline-offset-2">
                política de tratamiento de datos
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">7. Datos personales y cookies</h2>
            <p className="mt-3">
              El manejo de los datos que se recogen al reservar está descrito en la{' '}
              <Link href="/politica-de-datos" className="underline underline-offset-2">
                política de tratamiento de datos
              </Link>
              , y el uso de cookies en la{' '}
              <Link href="/cookies" className="underline underline-offset-2">
                política de cookies
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">8. Cambios y ley aplicable</h2>
            <p className="mt-3">
              El centro puede modificar estas condiciones. La versión vigente es siempre la publicada
              en esta página, con su fecha de actualización al pie.
            </p>
            <p className="mt-3">
              Estas condiciones se rigen por la ley colombiana. Las diferencias que no se resuelvan
              directamente se someten a los jueces de la República de Colombia.
            </p>
          </section>
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm text-muted">
          Última actualización: {new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}
        </p>
      </div>
    </div>
  );
}
