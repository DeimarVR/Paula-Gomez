import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, Lock, MessageCircle, Target } from 'lucide-react';
import { BeforeAfterSlider } from '@/components/ui/BeforeAfterSlider';
import { ProgressTimeline } from '@/components/tracking/ProgressTimeline';
import { getPatientProgress } from '@/lib/api';
import { buildWhatsAppLink, formatDateShort } from '@/lib/format';
import { FUNCIONES } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Tu seguimiento',
  description: 'Avance de su tratamiento en [NOMBRE_CLÍNICA].',
  // Es información clínica personal: fuera de los buscadores.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function SeguimientoPage({ params }: { params: { token: string } }) {
  /*
   * Con la función apagada la página no existe.
   *
   * No basta con quitar los enlaces: el token va en la URL y alguien podría
   * tener uno guardado de antes. Mostrarle una página vacía sería peor que
   * decirle que no está.
   */
  if (!FUNCIONES.seguimientoPaciente) notFound();

  const progress = await getPatientProgress(params.token);

  if (!progress) {
    return (
      <div className="pb-24 pt-10 sm:pt-14">
        <div className="shell mx-auto max-w-lg text-center">
          <Lock className="mx-auto h-9 w-9 text-brand-300" strokeWidth={1.5} aria-hidden />
          <h1 className="mt-6 text-3xl">Este enlace no es válido</h1>
          <p className="mt-4 leading-relaxed text-muted">
            Puede que esté incompleto o que lo hayamos regenerado por seguridad. Escríbenos por
            WhatsApp y te enviamos el enlace actualizado de tu seguimiento.
          </p>
          <Link href="/contacto" className="btn-primary mt-8">
            Ir a contacto
          </Link>
        </div>
      </div>
    );
  }

  const { patient, summary, plans, upcomingAppointments, clinic } = progress;

  const whatsappLink = buildWhatsAppLink(
    clinic.whatsapp,
    `Hola, soy ${patient.fullName}. Tengo una duda sobre mi tratamiento.`,
  );

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell">
        {/* Encabezado */}
        <header className="max-w-3xl">
          <p className="eyebrow mb-5">Seguimiento personal</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Hola, {patient.firstName}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Este es el registro completo de tu tratamiento. Se actualiza después de cada sesión.
          </p>
        </header>

        {/* Resumen */}
        <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line lg:grid-cols-4">
          {[
            { label: 'Avance general', value: `${summary.overallProgress}%` },
            { label: 'Sesiones completadas', value: String(summary.completedSessions) },
            { label: 'Sesiones del plan', value: String(summary.plannedSessions) },
            { label: 'Paciente desde', value: formatDateShort(patient.memberSince) },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface px-6 py-7">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="mt-1.5 font-display text-2xl text-brand-800">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {/* Próximas citas */}
        {upcomingAppointments.length > 0 && (
          <section className="mt-12">
            <h2 className="flex items-center gap-2.5 font-display text-xl">
              <CalendarClock className="h-5 w-5 text-brand-600" strokeWidth={1.8} aria-hidden />
              Tus próximas citas
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {upcomingAppointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{appointment.serviceName}</p>
                    <p className="mt-1 text-sm text-muted">{appointment.formattedDate}</p>
                  </div>
                  <Link
                    href={`/cita/${appointment.manageToken}`}
                    className="shrink-0 text-sm font-medium text-brand-700 underline underline-offset-4"
                  >
                    Gestionar
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Planes */}
        {plans.length === 0 ? (
          <div className="mt-14 rounded-3xl border border-dashed border-line bg-surface px-8 py-16 text-center">
            <p className="font-display text-xl">Todavía no tienes sesiones registradas</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              En cuanto hagamos tu primera sesión, aquí aparecerá todo tu historial con fotos y
              mediciones.
            </p>
          </div>
        ) : (
          plans.map((plan) => (
            <section key={plan.id} className="mt-16">
              <div className="rounded-3xl border border-line bg-surface p-8 sm:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-xl">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                      {plan.service.name}
                    </span>
                    <h2 className="mt-4 text-2xl sm:text-3xl">{plan.title}</h2>
                    {plan.goal && (
                      <p className="mt-3 flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                        <Target
                          className="mt-0.5 h-4 w-4 shrink-0 text-accent-500"
                          strokeWidth={1.8}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium text-ink">Objetivo: </span>
                          {plan.goal}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="min-w-[13rem] flex-1 sm:max-w-xs">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted">
                        {plan.completedSessions} de {plan.totalSessions} sesiones
                      </span>
                      <span className="font-display text-2xl text-brand-700">
                        {plan.progressPercent}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-100"
                      role="progressbar"
                      aria-valuenow={plan.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Avance de ${plan.title}`}
                    >
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all duration-700"
                        style={{ width: `${plan.progressPercent}%` }}
                      />
                    </div>
                    {plan.nextSession && (
                      <p className="mt-3 text-sm text-muted">
                        Próxima sesión ({plan.nextSession.sessionNumber}):{' '}
                        <span className="font-medium text-ink">
                          {plan.nextSession.formattedDate}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Comparaciones antes/después del propio paciente */}
                {plan.comparisons.length > 0 && (
                  <div className="mt-10 border-t border-line pt-8">
                    <h3 className="font-display text-lg">Tu avance en imágenes</h3>
                    <p className="mt-2 text-sm text-muted">
                      Primera y última toma de cada ángulo. Arrastra el control para comparar.
                    </p>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {plan.comparisons.map((comparison) => (
                        <figure key={comparison.angle}>
                          <BeforeAfterSlider
                            beforeUrl={comparison.before.url}
                            afterUrl={comparison.after.url}
                            beforeAlt={`Vista ${comparison.angle} al inicio`}
                            afterAlt={`Vista ${comparison.angle} actualmente`}
                          />
                          <figcaption className="mt-3 text-sm">
                            <span className="font-medium capitalize">{comparison.angle}</span>
                            <span className="ml-2 text-muted">
                              {formatDateShort(comparison.before.takenAt)} →{' '}
                              {formatDateShort(comparison.after.takenAt)}
                            </span>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 border-t border-line pt-8">
                  <h3 className="mb-6 font-display text-lg">Historial de sesiones</h3>
                  <ProgressTimeline sessions={plan.sessions} />
                </div>
              </div>
            </section>
          ))
        )}

        {/* Ayuda */}
        <div className="mt-14 flex flex-col items-center gap-4 rounded-3xl bg-brand-900 px-8 py-10 text-center text-brand-100 sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-xl text-white">¿Tienes alguna duda?</p>
            <p className="mt-2 text-sm text-brand-200">
              Escríbenos y te respondemos dentro del horario de atención.
            </p>
          </div>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent shrink-0"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Escribir por WhatsApp
          </a>
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          Este enlace es personal. No lo compartas: quien lo tenga puede ver tu historial.
        </p>
      </div>
    </div>
  );
}
