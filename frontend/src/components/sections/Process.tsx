import { CheckCheck } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { PASOS_DE_LA_CITA, SITE } from '@/lib/config';
import { iniciales } from '@/lib/format';

/**
 * «Su cita, paso a paso», sobre el azul profundo.
 *
 * A la izquierda los pasos; a la derecha, cómo se ve la conversación en el
 * celular del paciente. Es el argumento de la sección: sin llamadas de ida y
 * vuelta, todo llega por WhatsApp.
 */
export function Process() {
  return (
    <section
      id="su-cita"
      aria-labelledby="pasos-titulo"
      className="grain relative overflow-hidden bg-brand-900 py-[clamp(72px,9vw,120px)] text-on-deep"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(700px_500px_at_0%_0%,rgb(var(--brand-600)/0.55),transparent_60%),radial-gradient(560px_460px_at_100%_100%,rgb(var(--accent-400)/0.16),transparent_60%)]"
      />
      <div className="shell relative grid grid-cols-[minmax(0,1fr)] items-center gap-[clamp(40px,6vw,96px)] lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <span className="eyebrow-deep">Su cita, paso a paso</span>
          <h2 id="pasos-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12] text-white">
            Sin llamadas <em className="font-normal italic text-accent-400">de ida y vuelta</em>
          </h2>
          <p className="lead mt-4 max-w-[520px] !text-on-deep-muted">
            Desde que agenda hasta que llega, sabe exactamente cuándo y dónde es su cita.
          </p>
          <ol className="mt-11">
            {PASOS_DE_LA_CITA.map((paso, indice) => (
              <li key={paso.titulo} className="relative grid grid-cols-[52px_minmax(0,1fr)] gap-5 pb-[34px] last:pb-0">
                {indice < PASOS_DE_LA_CITA.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-1.5 left-[25.5px] top-[60px] w-px bg-gradient-to-b from-accent-400/70 to-accent-400/[0.08]"
                  />
                )}
                <span className="grid h-[52px] w-[52px] place-items-center rounded-full border border-accent-400/45 bg-accent-400/[0.07] font-display text-[1.3rem] text-accent-400">
                  {indice + 1}
                </span>
                <div>
                  <h3 className="mt-[11px] text-[1.4rem] text-white">{paso.titulo}</h3>
                  <p className="mt-1.5 max-w-[440px] text-[15.5px] text-on-deep-muted">{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={180}>
          <div className="relative grid place-items-center py-5">
            <span
              aria-hidden
              className="absolute h-[340px] w-[340px] rounded-full border border-accent-400/[0.22] shadow-[0_0_0_60px_rgb(var(--accent-400)/0.035),0_0_0_120px_rgb(var(--accent-400)/0.02)] lg:h-[420px] lg:w-[420px]"
            />
            <div
              className="relative w-full max-w-[340px] rounded-[28px] border border-white/10 bg-[#0E1A2C] p-3 shadow-[0_50px_90px_-40px_rgb(0_0_0/0.8)]"
              role="img"
              aria-label="Ejemplo de la conversación por WhatsApp con el centro"
            >
              <div className="overflow-hidden rounded-[20px] bg-[#ECE5DA]">
                <div className="flex items-center gap-2.5 bg-[#1F2C3D] px-3.5 py-3 text-white">
                  <span className="avatar h-[34px] w-[34px] bg-white text-xs text-brand-700">{iniciales(SITE.name.replace(/[[\]]/g, ''))}</span>
                  <div>
                    <b className="block text-sm">{SITE.name}</b>
                    <span className="text-xs text-[#B9C4D2]">Cuenta de empresa</span>
                  </div>
                </div>
                <div className="grid min-h-[430px] content-start gap-2.5 bg-[radial-gradient(circle_at_1px_1px,rgb(var(--ink)/0.06)_1px,transparent_0)] bg-[length:16px_16px] px-3 pb-[18px] pt-4">
                  <span className="justify-self-center rounded-md bg-white/85 px-2.5 py-1 text-[11.5px] text-muted">Lunes</span>
                  <Mensaje hora="9:41">
                    Le confirmamos su cita el <b>jueves a las 9:15 am</b>, en nuestra sede. Si necesita cambiarla, use el enlace de su cita.
                  </Mensaje>
                  <span className="justify-self-center rounded-md bg-white/85 px-2.5 py-1 text-[11.5px] text-muted">Miércoles</span>
                  <Mensaje hora="10:00">
                    Le recordamos su cita de mañana a las <b>9:15 am</b>. ¿Nos confirma si podrá asistir?
                  </Mensaje>
                  <Mensaje hora="10:12" entrante>
                    Sí, ahí estaré. Muchas gracias.
                  </Mensaje>
                  <Mensaje hora="10:15">Con gusto. La esperamos.</Mensaje>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Mensaje({ children, hora, entrante = false }: { children: React.ReactNode; hora: string; entrante?: boolean }) {
  return (
    <div
      className={`max-w-[88%] rounded-[10px] px-3 pb-1.5 pt-2.5 text-[13.5px] leading-normal text-[#1F2A37] shadow-[0_1px_1px_rgb(0_0_0/0.08)] ${
        entrante ? 'justify-self-start rounded-tl-[3px] bg-white' : 'justify-self-end rounded-tr-[3px] bg-[#DDF4D4]'
      }`}
    >
      {children}
      <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#6B7280]">
        {hora}
        {!entrante && <CheckCheck className="h-3.5 w-3.5 text-[#3B82C4]" strokeWidth={2.2} aria-hidden />}
      </span>
    </div>
  );
}
