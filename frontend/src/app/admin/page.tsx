'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { EstadoCita } from '@/components/admin/EstadoCita';
import { api } from '@/lib/apiClient';
import {
  diaDeClave,
  formatPhone,
  formatRelative,
  horaCorta,
  iniciales,
  saludoSegunHora,
} from '@/lib/format';
import type { AppointmentStatus } from '@/lib/types';

interface CitaDelDia {
  id: string;
  contactName: string;
  contactPhone: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  needsReschedule: boolean;
  patientId: string | null;
}

interface Resumen {
  saludoA: string;
  fecha: string;
  cerrado: { motivo: string | null } | null;
  citas: CitaDelDia[];
  ahora: CitaDelDia | null;
  siguiente: CitaDelDia | null;
  cuentas: {
    hoy: number;
    confirmadas: number;
    porConfirmar: number;
    atendidas: number;
    canceladas: number;
    semana: number;
  };
  recientes: Array<{
    id: string;
    fullName: string;
    clinicalUpdatedAt: string;
    clinicalUpdatedBy: string | null;
  }>;
}

interface Manana {
  fecha: string;
  pendientes: number;
  items: Array<{
    id: string;
    contactName: string;
    startsAt: string;
    status: AppointmentStatus;
    whatsappReminderSentAt: string | null;
  }>;
}

interface Pendientes {
  avisos: number;
  ofertas: number;
}

/** Primer nombre, o «Dra. Apellido» si así se llama la cuenta. */
function nombreCorto(completo: string) {
  const partes = completo.trim().split(/\s+/);
  if (/^dr(a)?\.?$/i.test(partes[0] ?? '') && partes[1]) return `${partes[0]} ${partes[1]}`;
  return partes[0] ?? completo;
}

/**
 * «Hoy»: lo primero que se ve al entrar al panel.
 *
 * Responde, de arriba abajo, a lo que se pregunta quien llega al consultorio:
 * a quién estoy atendiendo y quién sigue, cómo pinta el día, qué hay que
 * hacer por mañana y qué quedó pendiente de mandar. Todo lo demás está a un
 * clic en el menú.
 */
export default function Hoy() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [manana, setManana] = useState<Manana | null>(null);
  const [pendientes, setPendientes] = useState<Pendientes>({ avisos: 0, ofertas: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const control = new AbortController();
    const opciones = { signal: control.signal };

    void (async () => {
      try {
        const [hoy, deManana] = await Promise.all([
          api.get<Resumen>('/api/appointments/summary', opciones),
          api.get<Manana>('/api/appointments/recordatorios', opciones),
        ]);
        setResumen(hoy);
        setManana(deManana);
      } catch (caught) {
        if (!control.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'No pudimos cargar el día');
        }
      }
    })();

    // Lo pendiente de mandar a mano. Si falla, la tarjeta simplemente no sale.
    void Promise.all([
      api
        .get<{ pendientesDeAviso: unknown[] }>('/api/cierres', opciones)
        .then((d) => d.pendientesDeAviso.length)
        .catch(() => 0),
      api
        .get<{ items: Array<{ invitaciones: Array<{ enlaceManual: string | null; enviadaEn: string | null }> }> }>(
          '/api/ofertas',
          opciones,
        )
        .then((d) =>
          d.items.reduce(
            (n, o) => n + o.invitaciones.filter((i) => i.enlaceManual && !i.enviadaEn).length,
            0,
          ),
        )
        .catch(() => 0),
    ]).then(([avisos, ofertas]) => setPendientes({ avisos, ofertas }));

    return () => control.abort();
  }, []);

  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-bad-bg px-5 py-4 text-sm text-bad">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        {error}
      </p>
    );
  }

  if (!resumen) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando el día…
      </div>
    );
  }

  const porMandar = pendientes.avisos + pendientes.ofertas;

  return (
    <div className="mx-auto grid max-w-[76rem] gap-6">
      <div className="page-head">
        <div>
          <h1>
            {saludoSegunHora()}, {nombreCorto(resumen.saludoA)}
          </h1>
          <p className="first-letter:uppercase">{diaDeClave(resumen.fecha)}</p>
        </div>
        <div className="page-actions">
          <Link href="/admin/mensajes?ver=recordatorios" className="btn-outline btn-sm">
            <BellRing className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Recordatorios de mañana
          </Link>
        </div>
      </div>

      {resumen.cerrado ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-warn/30 bg-warn-bg px-6 py-5 text-warn">
          <CalendarX className="h-6 w-6 shrink-0" strokeWidth={1.8} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Hoy está cerrado</p>
            <p className="text-sm">
              {resumen.cerrado.motivo ? `${resumen.cerrado.motivo}. ` : ''}No se aceptan citas hoy.
            </p>
          </div>
          <Link href="/admin/citas" className="btn-outline btn-sm">
            Ver en la agenda
          </Link>
        </div>
      ) : (
        <TarjetaAhora ahora={resumen.ahora} siguiente={resumen.siguiente} />
      )}

      <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Indicador
          titulo="Citas de hoy"
          valor={resumen.cuentas.hoy}
          detalle={resumen.cuentas.canceladas ? `${resumen.cuentas.canceladas} cancelada${resumen.cuentas.canceladas === 1 ? '' : 's'}` : `${resumen.cuentas.semana} en los próximos 7 días`}
          tono="tone-info"
          Icono={CalendarClock}
        />
        <Indicador
          titulo="Confirmadas"
          valor={resumen.cuentas.confirmadas}
          detalle={
            resumen.cuentas.hoy === 0
              ? 'Sin citas hoy'
              : resumen.cuentas.atendidas
                ? `${resumen.cuentas.atendidas} ya atendida${resumen.cuentas.atendidas === 1 ? '' : 's'}`
                : 'De las citas de hoy'
          }
          tono="tone-ok"
          Icono={CalendarCheck}
        />
        <Indicador
          titulo="Por confirmar"
          valor={resumen.cuentas.porConfirmar}
          detalle={
            resumen.cuentas.hoy === 0
              ? 'Sin citas hoy'
              : resumen.cuentas.porConfirmar
                ? 'Vale la pena escribirles'
                : 'Todas respondieron'
          }
          tono="tone-warn"
          Icono={MessageCircle}
        />
        <Indicador
          titulo="Recordatorios"
          valor={manana?.pendientes ?? 0}
          detalle="Para mañana, sin mandar"
          tono="tone-sand"
          Icono={Send}
        />
      </dl>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel-card" aria-labelledby="agenda-hoy">
          <div className="card-head">
            <div>
              <h2 id="agenda-hoy">Agenda de hoy</h2>
              <p>Toque «Abrir» para ver el expediente</p>
            </div>
            <Link href="/admin/citas" className="btn-text">
              Ver agenda <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </Link>
          </div>

          {resumen.citas.length === 0 ? (
            <p className="px-[22px] py-12 text-center text-sm text-muted">
              No hay citas hoy. La agenda de los próximos días está en «Agenda».
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.citas.map((cita) => {
                    const enCurso = resumen.ahora?.id === cita.id;
                    return (
                      <tr key={cita.id} className={enCurso ? '!bg-brand-50' : undefined}>
                        <td className={`hora ${enCurso ? 'text-brand-700' : ''}`}>{horaCorta(cita.startsAt)}</td>
                        <td>
                          <div className="persona">
                            <span className="avatar" aria-hidden>
                              {iniciales(cita.contactName)}
                            </span>
                            <div className="min-w-0">
                              <b className="truncate">{cita.contactName}</b>
                              <span className="meta">{enCurso ? 'En consulta ahora' : formatPhone(cita.contactPhone)}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <EstadoCita estado={cita.status} porReagendar={cita.needsReschedule} />
                        </td>
                        <td>
                          {cita.patientId ? (
                            <Link href={`/admin/pacientes/${cita.patientId}`} className="btn-text">
                              Abrir
                            </Link>
                          ) : (
                            <Link href="/admin/citas" className="btn-text">
                              Ver
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid gap-6">
          {porMandar > 0 && (
            <section className="panel-card border-warn/30" aria-labelledby="por-mandar">
              <div className="card-head">
                <div>
                  <h2 id="por-mandar">Mensajes por mandar a mano</h2>
                  <p>El WhatsApp automático no los alcanzó a enviar</p>
                </div>
                <span className="badge-warn">{porMandar}</span>
              </div>
              <ul className="lista">
                {pendientes.avisos > 0 && (
                  <li>
                    <span className="icon-box tone-warn h-9 w-9 rounded-[9px]">
                      <CalendarX className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b>Disculpas por día cerrado</b>
                      <span className="meta">
                        {pendientes.avisos} paciente{pendientes.avisos === 1 ? '' : 's'} sin avisar
                      </span>
                    </div>
                  </li>
                )}
                {pendientes.ofertas > 0 && (
                  <li>
                    <span className="icon-box tone-info h-9 w-9 rounded-[9px]">
                      <CalendarClock className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b>Huecos ofrecidos</b>
                      <span className="meta">
                        {pendientes.ofertas} invitaci{pendientes.ofertas === 1 ? 'ón' : 'ones'} sin mandar
                      </span>
                    </div>
                  </li>
                )}
              </ul>
              <div className="card-foot">
                <Link href="/admin/citas#pendientes" className="btn-primary btn-sm w-full">
                  Revisar y enviar
                </Link>
              </div>
            </section>
          )}

          <section className="panel-card" aria-labelledby="manana">
            <div className="card-head">
              <div>
                <h2 id="manana">Mañana</h2>
                <p className="first-letter:uppercase">
                  {manana ? `${diaDeClave(manana.fecha)} · ${manana.items.length} cita${manana.items.length === 1 ? '' : 's'}` : '…'}
                </p>
              </div>
              {manana && manana.pendientes > 0 && <span className="badge-warn">{manana.pendientes} por enviar</span>}
            </div>
            {manana && manana.items.length > 0 ? (
              <ul className="lista">
                {manana.items.slice(0, 5).map((cita) => (
                  <li key={cita.id}>
                    <span className="w-[72px] flex-none text-[14.5px] font-semibold tabular-nums">
                      {horaCorta(cita.startsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="truncate">{cita.contactName}</b>
                    </div>
                    {cita.whatsappReminderSentAt ? (
                      <span className="badge-ok">Avisado</span>
                    ) : (
                      <span className="badge-neutral">Sin avisar</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-[22px] py-6 text-sm text-muted">Mañana no hay citas.</p>
            )}
            {manana && manana.items.length > 0 && (
              <div className="card-foot">
                <Link href="/admin/mensajes?ver=recordatorios" className="btn-primary btn-sm w-full">
                  <Send className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Revisar y enviar
                </Link>
              </div>
            )}
          </section>

          <section className="panel-card" aria-labelledby="recientes">
            <div className="card-head">
              <div>
                <h2 id="recientes">Expedientes recientes</h2>
              </div>
            </div>
            {resumen.recientes.length === 0 ? (
              <p className="px-[22px] py-6 text-sm text-muted">
                Aquí aparecen los expedientes que se actualicen, para volver a ellos rápido.
              </p>
            ) : (
              <ul className="lista">
                {resumen.recientes.map((p) => (
                  <li key={p.id}>
                    <span className="avatar" aria-hidden>
                      {iniciales(p.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="truncate">{p.fullName}</b>
                      <span className="meta">
                        {formatRelative(p.clinicalUpdatedAt)}
                        {p.clinicalUpdatedBy ? ` · ${p.clinicalUpdatedBy}` : ''}
                      </span>
                    </div>
                    <Link href={`/admin/pacientes/${p.id}`} className="btn-text">
                      <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Abrir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalle,
  tono,
  Icono,
}: {
  titulo: string;
  valor: number;
  detalle: string;
  tono: string;
  Icono: typeof CalendarClock;
}) {
  return (
    <div className="kpi">
      <dt className="kpi-top">
        {titulo}
        <span className={`icon-box h-9 w-9 rounded-[9px] ${tono}`}>
          <Icono className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
      </dt>
      <dd className="grid gap-2.5">
        <span className="kpi-value">{valor}</span>
        <span className="kpi-sub">{detalle}</span>
      </dd>
    </div>
  );
}

/**
 * La tarjeta azul de arriba: quién está en consulta y quién sigue.
 *
 * Es lo que la especialista mira entre paciente y paciente. Si no hay nadie
 * ahora, la siguiente pasa a primer plano; si ya no queda nadie, lo dice.
 */
function TarjetaAhora({ ahora, siguiente }: { ahora: CitaDelDia | null; siguiente: CitaDelDia | null }) {
  const principal = ahora ?? siguiente;
  const despues = ahora ? siguiente : null;

  return (
    <div className="grain relative grid items-center gap-6 overflow-hidden rounded-[20px] px-6 py-6 text-on-deep shadow-[0_24px_48px_-32px_rgb(var(--brand-900)/0.8)] sm:px-7 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] [background:linear-gradient(120deg,#2a5181_0%,rgb(var(--brand-700))_45%,rgb(var(--brand-900))_100%)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-400)/0.35),transparent_70%)]"
      />
      <div className="relative min-w-0">
        <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-accent-400">
          {ahora && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-400" aria-hidden />}
          {ahora
            ? `En consulta ahora · ${horaCorta(ahora.startsAt)}`
            : siguiente
              ? `Próxima cita · ${horaCorta(siguiente.startsAt)}`
              : 'Hoy'}
        </p>
        {principal ? (
          <div className="mt-3 flex items-center gap-3.5">
            <span className="avatar h-12 w-12 bg-white/15 text-[15px] text-white ring-[3px] ring-white/15" aria-hidden>
              {iniciales(principal.contactName)}
            </span>
            <div className="min-w-0">
              <b className="block truncate font-display text-[1.55rem] font-medium leading-tight text-white">
                {principal.contactName}
              </b>
              <span className="text-sm text-on-deep-muted">
                {principal.status === 'CONFIRMADA' ? 'Confirmada' : 'Sin confirmar'} · {formatPhone(principal.contactPhone)}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-3 font-display text-[1.55rem] leading-tight text-white">No quedan citas por hoy.</p>
        )}
      </div>

      <div className="relative grid gap-0.5 border-t border-white/15 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <small className="text-xs font-semibold uppercase tracking-[0.09em] text-on-deep-muted">Sigue</small>
        {despues ? (
          <>
            <b className="text-[15px] text-white">
              {horaCorta(despues.startsAt)} · {despues.contactName}
            </b>
            <span className="text-[13.5px] text-on-deep-muted">
              {despues.status === 'CONFIRMADA' ? 'Confirmada' : 'Por confirmar'}
            </span>
          </>
        ) : (
          <span className="text-[13.5px] text-on-deep-muted">
            {ahora ? 'Es la última del día' : 'Nadie más por ahora'}
          </span>
        )}
      </div>

      {principal?.patientId ? (
        <Link href={`/admin/pacientes/${principal.patientId}`} className="btn-on-dark btn-sm relative">
          <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Abrir expediente
        </Link>
      ) : (
        <Link href="/admin/citas" className="btn-on-dark btn-sm relative">
          Ver agenda
        </Link>
      )}
    </div>
  );
}
