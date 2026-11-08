'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { hoyEnClinica } from '@/lib/format';
import { SelectorHueco } from '@/components/admin/SelectorHueco';
import { BuscadorPaciente } from '@/components/admin/BuscadorPaciente';
import { PacienteDialog } from '@/components/admin/PacienteDialog';

interface PacienteVinculado {
  id: string;
  fullName: string;
  phone: string;
  documentId: string | null;
  email?: string | null;
}

/**
 * Alta de cita desde el panel.
 *
 * Existe para no tener que salir al formulario público —y hacerse pasar por
 * paciente— cada vez que alguien agenda por teléfono o en el mostrador.
 *
 * La hora sale de la agenda, no de un reloj en blanco: se elige un bloque de la
 * grilla —la misma de reagendar y la de la web—, los ocupados se ven tachados
 * y el horario de atención se respeta igual que en la reserva pública.
 *
 * No se elige tratamiento: hay un solo tipo de cita, de 75 minutos. Lo que se
 * haga se decide en la consulta.
 *
 * Lo que el panel sí se salta son los márgenes pensados para desconocidos: se
 * puede agendar para dentro de un rato y para dentro de medio año, cosas
 * normales en el mostrador y que por internet no tendrían sentido.
 *
 * La fecha se manda partida (`fecha` + `hora`) y no como instante: convertirla
 * aquí usaría la zona del navegador, y basta un portátil con la zona mal
 * puesta para agendar a una hora distinta de la que se escribió.
 */

interface Props {
  onCerrar: () => void;
  onCreada: () => void;
  /** Día y hora ya elegidos, cuando se abre desde un bloque libre de la agenda. */
  fechaInicial?: string;
  horaInicial?: string;
  /** Lo que entendió el asistente: el nombre que dijeron y el motivo. */
  nombreInicial?: string;
  notaInicial?: string;
}

/** Campos que se pueden marcar en rojo, en el orden en que se ven. */
const CAMPOS_EN_ORDEN = ['contactName', 'contactPhone', 'contactEmail', 'fecha', 'hora'] as const;
type Campo = (typeof CAMPOS_EN_ORDEN)[number];

function validar(form: {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  fecha: string;
  hora: string;
}): Partial<Record<Campo, string>> {
  const errores: Partial<Record<Campo, string>> = {};

  if (form.contactName.trim().length < 2) errores.contactName = 'Escribe el nombre del paciente.';

  // Se cuentan los dígitos, no los caracteres: «300 111 2233» está bien.
  const digitos = form.contactPhone.replace(/\D/g, '');
  if (digitos.length === 0) {
    errores.contactPhone = 'Necesitamos un número para confirmar la cita.';
  } else if (digitos.length < 7) {
    errores.contactPhone = 'Ese número está incompleto. Un celular en Colombia tiene 10 dígitos.';
  } else if (digitos.length > 15) {
    errores.contactPhone = 'Ese número tiene demasiados dígitos.';
  }

  const correo = form.contactEmail.trim();
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    errores.contactEmail = 'Ese correo no parece estar bien escrito.';
  }

  if (!form.fecha) errores.fecha = 'Elige la fecha.';
  if (!form.hora) errores.hora = 'Elige la hora.';

  return errores;
}

function enfocarPrimerError(errores: Partial<Record<Campo, string>>): void {
  const campo = CAMPOS_EN_ORDEN.find((nombre) => errores[nombre]);
  if (!campo) return;
  const elemento = document.getElementById(`cita-${campo}`);
  if (!elemento) return;
  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  elemento.focus({ preventScroll: true });
}

export function NuevaCitaDialog({
  onCerrar,
  onCreada,
  fechaInicial,
  horaInicial,
  nombreInicial,
  notaInicial,
}: Props) {
  const [form, setForm] = useState({
    patientId: '',
    contactName: nombreInicial ?? '',
    contactPhone: '',
    contactEmail: '',
    fecha: fechaInicial ?? hoyEnClinica(),
    hora: horaInicial ?? '',
    message: notaInicial ?? '',
  });

  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editandoPaciente, setEditandoPaciente] = useState(false);
  /** Ficha vinculada, si se eligió una. */
  const [paciente, setPaciente] = useState<PacienteVinculado | null>(null);

  /**
   * La hora se suelta al cambiar de día.
   *
   * Conservar la hora anterior dejaría elegido un bloque que en el día nuevo
   * puede estar ocupado, sin que nadie lo vea, y la cita se guardaría con él.
   * La primera pasada no cuenta: si se abrió desde un bloque de la agenda, esa
   * hora es justo la que se quiere.
   */
  const [fechaAnterior, setFechaAnterior] = useState(form.fecha);
  useEffect(() => {
    if (form.fecha === fechaAnterior) return;
    setFechaAnterior(form.fecha);
    setForm((actual) => (actual.hora ? { ...actual, hora: '' } : actual));
  }, [form.fecha, fechaAnterior]);

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actuales) => {
      if (!(campo in actuales)) return actuales;
      const resto = { ...actuales };
      delete resto[campo as Campo];
      return resto;
    });
  }

  /**
   * Al elegir un paciente ya registrado se copian sus datos de contacto.
   * Quedan editables: el teléfono de la ficha puede estar viejo y quien
   * atiende tiene al paciente delante para corregirlo.
   */
  function vincular(elegido: PacienteVinculado) {
    setPaciente(elegido);
    setForm((actual) => ({
      ...actual,
      patientId: elegido.id,
      contactName: elegido.fullName,
      contactPhone: elegido.phone,
      contactEmail: elegido.email ?? '',
    }));
    setErrores({});
  }

  /**
   * Se suelta la ficha pero se dejan los datos ya escritos: casi siempre se
   * desvincula para corregir un nombre, no para empezar de cero.
   */
  function desvincular() {
    setPaciente(null);
    setForm((actual) => ({ ...actual, patientId: '' }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const problemas = validar(form);
    if (Object.keys(problemas).length > 0) {
      setErrores(problemas);
      setError(null);
      enfocarPrimerError(problemas);
      return;
    }

    setGuardando(true);
    setError(null);
    setErrores({});

    try {
      await api.post('/api/appointments', {
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail || undefined,
        message: form.message || undefined,
        fecha: form.fecha,
        hora: form.hora,
        patientId: form.patientId || undefined,
      });
      onCreada();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos crear la cita');

      // El servidor dice qué campo falló; se marca igual que la validación
      // local, para que un rechazo suyo no se vea distinto.
      if (caught instanceof ApiError && caught.details) {
        const delServidor: Partial<Record<Campo, string>> = {};
        for (const detalle of caught.details) {
          if ((CAMPOS_EN_ORDEN as readonly string[]).includes(detalle.field)) {
            delServidor[detalle.field as Campo] = detalle.message;
          }
        }
        if (Object.keys(delServidor).length > 0) {
          setErrores(delServidor);
          enfocarPrimerError(delServidor);
        }
      }

      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4 backdrop-blur-sm sm:p-5">
      <form
        onSubmit={enviar}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="nueva-cita-titulo"
        className="max-h-[92vh] w-full min-w-0 max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="nueva-cita-titulo" className="text-2xl">Nueva cita</h2>
            <p className="mt-1 text-sm text-muted">
              {CITA.nombre} de {CITA.duracionMin} minutos, por teléfono o en el mostrador.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="icon-btn shrink-0"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <>
            <div className="mt-7 space-y-5">
              <div>
                <span className="field-label">
                  Paciente registrado <span className="font-normal text-muted">(opcional)</span>
                </span>
                <BuscadorPaciente
                  seleccionado={paciente}
                  onSeleccionar={(encontrado) => vincular(encontrado)}
                  onQuitar={desvincular}
                />
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-xs text-muted">
                    Búscalo por nombre, cédula o teléfono. Si lo eliges, la cita queda ligada a su
                    ficha y a su historial.
                  </p>
                  {form.patientId && (
                    <button
                      type="button"
                      onClick={() => setEditandoPaciente(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-brand-700 underline underline-offset-2"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                      Corregir sus datos
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="cita-contactName" className="field-label">
                  Nombre *
                </label>
                <input
                  id="cita-contactName"
                  value={form.contactName}
                  onChange={(evento) => cambiar('contactName', evento.target.value)}
                  aria-invalid={Boolean(errores.contactName)}
                  className={`field ${errores.contactName ? 'field-invalid' : ''}`}
                  placeholder="María Fernanda Rosero"
                />
                {errores.contactName && <p className="field-error">{errores.contactName}</p>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="cita-contactPhone" className="field-label">
                    Celular / WhatsApp *
                  </label>
                  <input
                    id="cita-contactPhone"
                    inputMode="tel"
                    value={form.contactPhone}
                    onChange={(evento) => cambiar('contactPhone', evento.target.value)}
                    aria-invalid={Boolean(errores.contactPhone)}
                    className={`field ${errores.contactPhone ? 'field-invalid' : ''}`}
                    placeholder="300 111 2233"
                  />
                  {errores.contactPhone && <p className="field-error">{errores.contactPhone}</p>}
                </div>

                <div>
                  <label htmlFor="cita-contactEmail" className="field-label">
                    Correo <span className="font-normal text-muted">(opcional)</span>
                  </label>
                  <input
                    id="cita-contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(evento) => cambiar('contactEmail', evento.target.value)}
                    aria-invalid={Boolean(errores.contactEmail)}
                    className={`field ${errores.contactEmail ? 'field-invalid' : ''}`}
                    placeholder="paciente@correo.com"
                  />
                  {errores.contactEmail && <p className="field-error">{errores.contactEmail}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="cita-fecha" className="field-label">
                  Fecha *
                </label>
                <input
                  id="cita-fecha"
                  type="date"
                  value={form.fecha}
                  min={hoyEnClinica()}
                  onChange={(evento) => cambiar('fecha', evento.target.value)}
                  aria-invalid={Boolean(errores.fecha)}
                  className={`field sm:max-w-[16rem] ${errores.fecha ? 'field-invalid' : ''}`}
                />
                {errores.fecha && <p className="field-error">{errores.fecha}</p>}
              </div>

              <div>
                <span className="field-label">Hora *</span>
                <SelectorHueco
                  id="cita-hora"
                  fecha={form.fecha}
                  valor={form.hora}
                  onElegir={(hora) => cambiar('hora', hora)}
                  invalido={Boolean(errores.hora)}
                />
                {errores.hora && <p className="field-error">{errores.hora}</p>}
              </div>

              <div>
                <label htmlFor="cita-message" className="field-label">
                  Nota <span className="font-normal text-muted">(opcional)</span>
                </label>
                <textarea
                  id="cita-message"
                  rows={2}
                  maxLength={1000}
                  value={form.message}
                  onChange={(evento) => cambiar('message', evento.target.value)}
                  className="field resize-none"
                  placeholder="Viene remitida, alergias, algo a tener en cuenta…"
                />
              </div>
            </div>

            {/* El aviso general se guarda para lo que no es de un campo:
                el cruce con otra cita, la red caída, un fallo del servidor. */}
            {error && Object.keys(errores).length === 0 && (
              <p role="alert" className="mt-6 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Agendando…
                  </>
                ) : (
                  'Agendar cita'
                )}
              </button>
              <button type="button" onClick={onCerrar} className="btn-outline px-6">
                Cancelar
              </button>
            </div>

            {/*
              Decía que la confirmación «se envía», y no se envía sola: hace
              falta tocar el botón de WhatsApp en el listado. Quien agenda tiene
              que saberlo, porque es quien va a tener que mandarla.
            */}
            <p className="mt-4 text-xs leading-relaxed text-muted">
              La confirmación por WhatsApp sale sola si la integración está activa; si no, se manda
              desde la agenda con un toque en el icono de WhatsApp: el mensaje sale ya escrito.
            </p>
        </>
      </form>

      {/*
        Editar sin salir del alta: si al agendar por teléfono el paciente dicta
        un celular nuevo, corregirlo aquí evita tener que cerrar, ir a la ficha,
        volver y empezar la cita otra vez. Al guardar se refrescan la lista y
        los campos de contacto de esta cita.
      */}
      {editandoPaciente && form.patientId && (
        <PacienteDialog
          pacienteId={form.patientId}
          onCerrar={() => setEditandoPaciente(false)}
          onGuardado={(guardado) => {
            setEditandoPaciente(false);
            vincular(guardado);
          }}
        />
      )}
    </div>
  );
}
