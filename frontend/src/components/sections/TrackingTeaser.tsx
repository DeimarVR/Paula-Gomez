import Link from 'next/link';
import { CalendarCheck, Camera, ClipboardList, MessageCircle } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';

const FEATURES = [
  {
    icon: Camera,
    title: 'Tus fotos, ordenadas',
    text: 'Cada sesión suma una toma del mismo ángulo. El comparador pone la primera junto a la más reciente.',
  },
  {
    icon: ClipboardList,
    title: 'Qué se te aplicó',
    text: 'Productos, activos y mediciones de cada visita, en lenguaje claro y sin jerga médica.',
  },
  {
    icon: CalendarCheck,
    title: 'Tu próxima cita',
    text: 'Fecha y hora de la siguiente sesión, con la opción de confirmar o reprogramar desde el mismo enlace.',
  },
  {
    icon: MessageCircle,
    title: 'Indicaciones para casa',
    text: 'Lo que debes hacer entre sesión y sesión, disponible cuando lo necesites y no solo el día de la cita.',
  },
];

/**
 * Presenta el portal de seguimiento del paciente.
 *
 * Es una diferencia frente a un consultorio corriente, así que ocupa una sección
 * propia en la landing y no un renglón perdido.
 */
export function TrackingTeaser() {
  return (
    <Section id="seguimiento" tone="tint">
      <Reveal variant="scale" className="overflow-hidden rounded-[2.5rem] border border-line bg-surface">
        <div className="grid lg:grid-cols-[1fr_1.05fr]">
          <div className="p-9 sm:p-12 lg:p-14">
            <p className="eyebrow mb-5">Seguimiento del paciente</p>
            <h2 className="text-3xl leading-tight sm:text-4xl">
              Tu tratamiento no termina cuando sales del consultorio
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              Después de cada sesión te llega por WhatsApp un enlace personal. Ahí está todo tu
              historial: fotos, mediciones, indicaciones y próxima cita. Sin cuentas, sin
              contraseñas, sin descargar nada.
            </p>

            <dl className="mt-10 grid gap-7 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div key={feature.title}>
                  <dt className="flex items-center gap-2.5 font-medium text-ink">
                    <feature.icon
                      className="h-4 w-4 shrink-0 text-brand-600"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    {feature.title}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{feature.text}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-10 rounded-2xl bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-800">
              ¿Ya eres paciente y perdiste tu enlace? Escríbenos por WhatsApp y te lo reenviamos al
              instante.
            </p>
          </div>

          {/* Vista previa del portal. */}
          <div className="relative bg-brand-900 p-9 sm:p-12 lg:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full border border-brand-700"
            />
            <div className="relative rounded-3xl bg-surface p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Plan activo</p>
                  <p className="mt-1 font-display text-lg">Tratamiento personalizado</p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  Sesión 5 de 8
                </span>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted">Avance del plan</span>
                  <span className="font-display text-xl text-brand-700">63%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
                  <div className="h-full w-[63%] rounded-full bg-brand-600" />
                </div>
              </div>

              <ul className="mt-7 space-y-3 border-t border-line pt-6 text-sm">
                {[
                  { label: 'Última sesión', value: '12 de agosto' },
                  { label: 'Próxima cita', value: '2 de septiembre, 9:00 a. m.' },
                  { label: 'Fotos registradas', value: '15 tomas · 3 ángulos' },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-muted">{row.label}</span>
                    <span className="text-right font-medium text-ink">{row.value}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {['Sesión 1', 'Sesión 3', 'Sesión 5'].map((label, index) => (
                  <div
                    key={label}
                    className="rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 px-2 py-6 text-center"
                    style={{ opacity: 0.6 + index * 0.2 }}
                  >
                    <span className="text-[0.65rem] font-medium uppercase tracking-wider text-brand-800">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="relative mt-7 text-sm leading-relaxed text-brand-200">
              Así se ve tu seguimiento. Solo tú y el equipo del centro tienen acceso a ese enlace.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
