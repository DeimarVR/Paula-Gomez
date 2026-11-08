'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, Mail, MessageCircle, Trash2, Undo2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { RecordatoriosDeManana } from '@/components/admin/RecordatoriosDeManana';
import { buildWhatsAppLink, formatPhone } from '@/lib/format';
import type { AdminUser } from '@/lib/types';

/**
 * Los mensajes del formulario de contacto de la web.
 *
 * Esta pantalla no existía. El formulario guardaba en la base y nadie los leía
 * nunca, mientras la web prometía «te respondemos dentro del horario de
 * atención». Alguien preguntando por un tratamiento se quedaba esperando una
 * respuesta que no iba a llegar, y el centro ni sabía que había preguntado.
 *
 * La lista arranca en «Sin atender» porque una bandeja se abre para vaciarla,
 * no para contemplarla.
 */

interface Mensaje {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  handled: boolean;
  createdAt: string;
}

/** «hace 2 h», «hace 3 días»: lo que importa de un mensaje es si es reciente. */
function desdeCuando(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 31) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;

  return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long' });
}

/** «María Fernanda Rosero» -> «María»: para saludar sin sonar a formulario. */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

export default function MensajesPage() {
  const [items, setItems] = useState<Mensaje[]>([]);
  const [verTodos, setVerTodos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AdminUser | null>(null);

  /**
   * Dos cosas distintas viven en esta pantalla, y por eso van en pestañas y no
   * mezcladas: la BANDEJA es lo que la gente escribe desde la web hacia el
   * centro, y los RECORDATORIOS son lo que el centro escribe hacia sus
   * pacientes. Comparten el sitio porque las dos son «mensajes con personas»,
   * pero una se vacía contestando y la otra se vacía escribiendo.
   */
  const [pestana, setPestana] = useState<'bandeja' | 'recordatorios'>('bandeja');
  const [pendientesRecordatorio, setPendientesRecordatorio] = useState(0);

  const contarRecordatorios = useCallback(async () => {
    try {
      const r = await api.get<{ pendientes: number }>('/api/appointments/recordatorios');
      setPendientesRecordatorio(r.pendientes ?? 0);
    } catch {
      // Un contador que no carga no puede romper la pantalla.
    }
  }, []);

  useEffect(() => {
    void contarRecordatorios();
  }, [contarRecordatorios]);

  // «Recordatorios de mañana» en Hoy llega con ?ver=recordatorios. Se lee del
  // navegador y no con useSearchParams, que obligaría a envolver la página.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ver') === 'recordatorios') {
      setPestana('recordatorios');
    }
  }, []);

  // Quién es, para saber si puede borrar. El candado de verdad está en la API.
  useEffect(() => {
    void api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((r) => setUsuario(r.user))
      .catch(() => setUsuario(null));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.get<{ items: Mensaje[] }>(
        `/api/contact-messages${verTodos ? '' : '?handled=false'}`,
      );
      setItems(datos?.items ?? []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar los mensajes');
    } finally {
      setCargando(false);
    }
  }, [verTodos]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * Tirar la publicidad.
   *
   * Un formulario público recibe ofertas de servicios y correos automáticos, y
   * eso no se atiende: se bota. Se pregunta antes porque no hay papelera: entre
   * la publicidad y una paciente que escribe raro no siempre hay tanta
   * distancia, y esto no se puede deshacer.
   */
  async function borrar(mensaje: Mensaje) {
    const seguro = window.confirm(
      `¿Borrar el mensaje de ${mensaje.name}? No se puede recuperar.`,
    );
    if (!seguro) return;

    setTrabajando(mensaje.id);
    try {
      await api.delete(`/api/contact-messages/${mensaje.id}`);
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrar el mensaje');
    } finally {
      setTrabajando(null);
    }
  }

  async function marcar(mensaje: Mensaje, handled: boolean) {
    setTrabajando(mensaje.id);
    try {
      await api.patch(`/api/contact-messages/${mensaje.id}`, { handled });
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos actualizar el mensaje');
    } finally {
      setTrabajando(null);
    }
  }

  const enBandeja = pestana === 'bandeja';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl">Mensajes</h1>
      <p className="mt-1 text-sm text-muted">
        {enBandeja
          ? 'Lo que escribe la gente desde el formulario de contacto de la web.'
          : 'Avisarle hoy a quien tiene cita mañana.'}
      </p>

      {/* Las dos pestañas, con su propio número de pendientes cada una. */}
      <div className="mt-6 flex gap-1 border-b border-line">
        {(
          [
            ['bandeja', 'Bandeja', items.filter((m) => !m.handled).length],
            ['recordatorios', 'Recordatorios', pendientesRecordatorio],
          ] as const
        ).map(([valor, etiqueta, cuantos]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPestana(valor)}
            aria-current={pestana === valor ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              pestana === valor
                ? 'border-brand-700 text-brand-800'
                : 'border-transparent text-ink/60 hover:text-brand-800'
            }`}
          >
            {etiqueta}
            {cuantos > 0 && (
              <span className="rounded-full bg-bad-bg0 px-2 py-0.5 text-xs font-semibold text-white">
                {cuantos}
              </span>
            )}
          </button>
        ))}
      </div>

      {!enBandeja && (
        <div className="mt-6">
          <RecordatoriosDeManana onCambio={contarRecordatorios} />
        </div>
      )}

      {enBandeja && (
      <>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-4">
        <div className="flex rounded-xl border border-line p-1">
          {(
            [
              [false, 'Sin atender'],
              [true, 'Todos'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={etiqueta}
              type="button"
              onClick={() => setVerTodos(valor)}
              aria-pressed={verTodos === valor}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                verTodos === valor ? 'bg-brand-700 text-white' : 'text-ink/70 hover:bg-brand-50'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {cargando && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Cargando…
        </p>
      )}

      {!cargando && items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-8 py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-brand-300" strokeWidth={1.5} aria-hidden />
          <p className="mt-4 font-display text-lg">
            {verTodos ? 'Todavía no ha escrito nadie' : 'No queda nada por atender'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {verTodos
              ? 'Cuando alguien use el formulario de contacto de la web, aparecerá aquí.'
              : 'Los mensajes ya atendidos siguen guardados: míralos en «Todos».'}
          </p>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {items.map((mensaje) => (
          <li
            key={mensaje.id}
            className={`rounded-2xl border p-6 ${
              mensaje.handled ? 'border-line bg-surface/60' : 'border-brand-200 bg-surface'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg">
                  {mensaje.name}
                  {mensaje.handled && (
                    <span className="ml-2 rounded-full bg-line/60 px-2.5 py-0.5 text-[0.65rem] font-normal text-ink/60">
                      Atendido
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {formatPhone(mensaje.phone)}
                  {mensaje.email && ` · ${mensaje.email}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">{desdeCuando(mensaje.createdAt)}</span>
            </div>

            {mensaje.subject && (
              <p className="mt-4 text-sm font-medium text-brand-800">{mensaje.subject}</p>
            )}

            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/85">
              {mensaje.message}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {/*
                La respuesta sale escrita: cita su consulta para que la persona
                sepa de qué le hablan tres días después de haber preguntado.
              */}
              <a
                href={buildWhatsAppLink(
                  mensaje.phone,
                  `Hola ${primerNombre(mensaje.name)}, te escribimos de [NOMBRE_CLÍNICA] sobre tu consulta: «${mensaje.message.slice(0, 120)}${mensaje.message.length > 120 ? '…' : ''}»`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-4 py-2 text-sm"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Responder por WhatsApp
              </a>

              {mensaje.email && (
                <a
                  href={`mailto:${mensaje.email}?subject=${encodeURIComponent(
                    mensaje.subject || 'Tu consulta en [NOMBRE_CLÍNICA]',
                  )}`}
                  className="btn-outline px-4 py-2 text-sm"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Responder por correo
                </a>
              )}

              {/* Borrar solo lo ve quien administra, igual que en el resto del
                  panel: se puede trabajar sin permiso, deshacer no. */}
              {usuario?.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => void borrar(mensaje)}
                  disabled={trabajando === mensaje.id}
                  title="Borrar el mensaje"
                  className="btn-outline px-4 py-2 text-sm text-bad hover:bg-bad-bg sm:ml-auto"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Borrar
                </button>
              )}

              <button
                type="button"
                onClick={() => void marcar(mensaje, !mensaje.handled)}
                disabled={trabajando === mensaje.id}
                /* `ml-auto` solo de tablet para arriba: en el celular los
                   botones van uno debajo de otro y ese margen dejaba el
                   último descolgado a la derecha, sin alinear con nada. */
                className={`btn-outline px-4 py-2 text-sm ${
                  usuario?.role === 'ADMIN' ? '' : 'sm:ml-auto'
                }`}
              >
                {trabajando === mensaje.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : mensaje.handled ? (
                  <Undo2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                )}
                {mensaje.handled ? 'Devolver a pendientes' : 'Marcar como atendido'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      </>
      )}
    </div>
  );
}
