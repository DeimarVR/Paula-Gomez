'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, X } from 'lucide-react';
import { FichaHoja } from './FichaHoja';
import { FirmaPad } from './FirmaPad';
import { api, ApiError } from '@/lib/apiClient';
import { hoyEnClinica, claveFecha, telefonoLocal } from '@/lib/format';
import {
  edadCumplida,
  etiquetaControl,
  etiquetaZona,
  type AvisoAgenda,
  type DatosHoja,
  type Ficha,
  type LineaControl,
  type TipoAtencion,
} from '@/lib/controlEvolutivo';
import type { Service } from '@/lib/types';

/**
 * Fila nueva, con lo que el sistema ya sabe.
 *
 * `numero` es la posición que va a ocupar: de ahí sale la etiqueta de control.
 * `zonas` son las que estén marcadas en los diagramas, que es la mejor
 * suposición de qué se trató. Ambos quedan editables.
 */
function lineaVacia(numero: number, zonas: string[] = [], firma: string | null = null): LineaControl {
  return {
    sessionDate: hoyEnClinica(),
    controlLabel: etiquetaControl(numero),
    alopeciaType: null,
    treatment: null,
    treatedZone: zonas.length > 0 ? zonas.map(etiquetaZona).join(' · ') : null,
    oralMedication: null,
    topicalMedication: null,
    shampoo: null,
    findings: null,
    nextControl: null,
    nextControlTime: null,
    nextControlServiceId: null,
    // La del profesional viene de su firma guardada; la del PACIENTE no se
    // precarga nunca: es su consentimiento de ese día y la dibuja él.
    professionalSignature: firma,
    patientSignature: null,
  };
}

/**
 * La sesión siguiente, copiando el tratamiento de la anterior.
 *
 * Entre una sesión y la siguiente casi nada cambia: el mismo diagnóstico, el
 * mismo tratamiento, la misma zona, la misma medicación. Volver a escribirlo
 * todo cada mes es lo que hace lenta la ficha.
 *
 * Lo que SÍ se copia es el plan: qué se le está haciendo al paciente.
 *
 * Lo que NO se copia, y es lo importante: los HALLAZGOS y el PRÓXIMO CONTROL.
 * Un hallazgo es lo que se vio ese día concreto; arrastrarlo dejaría escrito en
 * la historia clínica que se observó una foliculitis en una fecha en la que
 * nadie la miró. Eso no es ahorrar tiempo, es inventar un dato médico. La firma
 * del paciente tampoco viaja: es su consentimiento de ese día y la dibuja él.
 */
function lineaRepetida(
  anterior: LineaControl,
  numero: number,
  firma: string | null,
): LineaControl {
  return {
    ...lineaVacia(numero, [], firma),
    alopeciaType: anterior.alopeciaType,
    treatment: anterior.treatment,
    treatedZone: anterior.treatedZone,
    oralMedication: anterior.oralMedication,
    topicalMedication: anterior.topicalMedication,
    shampoo: anterior.shampoo,
  };
}


/**
 * `tipoInicial` viene del botón con el que se abrió la ficha.
 *
 * La hoja es la misma para los dos tipos; lo único que cambia es con cuál
 * empieza marcada. Se sigue pudiendo cambiar dentro del formulario: esto ahorra
 * el paso, no lo bloquea.
 */
function fichaVacia(tipoInicial: TipoAtencion = 'TERAPIAS_CAPILARES'): DatosHoja {
  return {
    procedureDate: hoyEnClinica(),
    patientName: '',
    patientDocument: null,
    patientAge: null,
    patientPhone: null,
    careType: tipoInicial,
    totalSessions: null,
    transplantBeard: false,
    transplantEyebrows: false,
    transplantScalp: false,
    transplantZones: [],
    follicles: null,
    folliclesLost: null,
    warranty: null,
    markedZones: [],
    notes: null,
    entries: [lineaVacia(1)],
  };
}

/** Qué firma se está capturando en el panel emergente. */
type FirmaAbierta = { fila: number; quien: 'professional' | 'patient' } | null;

/**
 * Llenar la ficha ES la hoja.
 *
 * Este componente no dibuja nada del documento: solo guarda el estado, pone
 * arriba el buscador de paciente y abajo el botón de guardar. Todo lo visual
 * lo pinta `FichaHoja`, la misma que se imprime.
 */
export function FichaForm({
  ficha,
  tipoInicial = 'TERAPIAS_CAPILARES',
}: {
  ficha?: Ficha;
  tipoInicial?: TipoAtencion;
}) {
  const router = useRouter();
  const editando = Boolean(ficha);

  const [paciente, setPaciente] = useState<{ id: string; fullName: string } | null>(
    ficha?.patient ?? null,
  );

  const [datos, setDatos] = useState<DatosHoja>(() => {
    if (!ficha) return fichaVacia(tipoInicial);
    return {
      ...ficha,
      procedureDate: claveFecha(ficha.procedureDate),
      patientPhone: telefonoLocal(ficha.patientPhone) || null,
      entries:
        ficha.entries.length > 0
          ? ficha.entries.map((entrada) => ({
              ...entrada,
              sessionDate: claveFecha(entrada.sessionDate),
              nextControl: entrada.nextControl ? claveFecha(entrada.nextControl) : null,
            }))
          : [lineaVacia(1)],
    };
  });

  const [servicios, setServicios] = useState<Service[]>([]);
  /** Nombres del inventario, para sugerir la medicación sin escribirla. */
  const [productos, setProductos] = useState<string[]>([]);
  const [firmaProfesional, setFirmaProfesional] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<AvisoAgenda[]>([]);
  const [firmaAbierta, setFirmaAbierta] = useState<FirmaAbierta>(null);

  /**
   * Firma guardada del profesional.
   *
   * Al llegar, se pone en las filas que aún no tienen firma, y solo en fichas
   * NUEVAS: en una ya guardada, cada sesión conserva la firma con la que se
   * cerró.
   */
  useEffect(() => {
    api
      .get<{ user: { signature: string | null } }>('/api/auth/me')
      .then((datos) => {
        const guardada = datos.user.signature;
        if (!guardada) return;
        setFirmaProfesional(guardada);
        if (editando) return;

        setDatos((actual) => ({
          ...actual,
          entries: actual.entries.map((linea) =>
            linea.professionalSignature ? linea : { ...linea, professionalSignature: guardada },
          ),
        }));
      })
      .catch(() => {
        // Sin firma guardada se dibuja a mano en cada sesión.
      });
  }, [editando]);

  // El catálogo se necesita para elegir el tratamiento del próximo control.
  useEffect(() => {
    api
      .get<{ items: Service[] }>('/api/treatments')
      .then((datos) => setServicios(datos.items.filter((s) => s.active)))
      .catch(() => {
        // Sin catálogo el resto de la ficha se llena igual; solo no se puede
        // agendar desde aquí.
      });
  }, []);

  /**
   * Lo que hay en inventario, para sugerirlo en medicación y shampoo.
   *
   * Son sugerencias, no una lista cerrada: el médico sigue pudiendo escribir
   * algo que el centro no vende. Que falle esta llamada no rompe nada.
   */
  useEffect(() => {
    api
      .get<{ items: Array<{ name: string }> }>('/api/inventario')
      .then((datos) => setProductos(datos.items.map((item) => item.name)))
      .catch(() => {});
  }, []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * El paciente vinculado no tiene fecha de nacimiento guardada.
   *
   * La edad se calcula desde ella, así que sin fecha el campo se queda vacío.
   * Antes eso no se distinguía de un fallo: se elegía el paciente, la edad no
   * aparecía, y no había forma de saber si era que el dato faltaba o que algo
   * se había roto. Ahora se dice, y se dice dónde arreglarlo.
   */
  const [sinNacimiento, setSinNacimiento] = useState(false);

  const parchear = (parche: Partial<DatosHoja>) =>
    setDatos((actual) => ({ ...actual, ...parche }));

  const parchearLinea = (indice: number, parche: Partial<LineaControl>) =>
    setDatos((actual) => ({
      ...actual,
      entries: actual.entries.map((linea, i) => (i === indice ? { ...linea, ...parche } : linea)),
    }));

  async function guardar() {
    setError(null);

    if (!paciente) {
      setError('Selecciona el paciente al que pertenece la ficha.');
      return;
    }
    if (datos.patientName.trim().length < 2) {
      setError('Falta el nombre del paciente.');
      return;
    }

    // Una fila sin nada escrito es una fila que quedó abierta sin llenar: se
    // descarta en vez de rechazar el guardado entero.
    const utiles = datos.entries.filter((linea) =>
      [
        linea.controlLabel,
        linea.alopeciaType,
        linea.treatment,
        linea.treatedZone,
        linea.oralMedication,
        linea.topicalMedication,
        linea.shampoo,
        linea.findings,
      ].some((campo) => campo && campo.trim().length > 0),
    );

    const cuerpo = {
      ...datos,
      patientId: paciente.id,
      patientName: datos.patientName.trim(),
      entries: utiles,
    };

    setGuardando(true);
    try {
      const guardada = editando
        ? await api.put<Ficha>(`/api/clinical-records/${ficha!.id}`, cuerpo)
        : await api.post<Ficha>('/api/clinical-records', cuerpo);

      // Si la agenda se quejó, la ficha SÍ quedó guardada: se muestra el aviso
      // aquí en vez de navegar, para que puedan corregir la hora al momento.
      if (guardada.avisos && guardada.avisos.length > 0) {
        setAvisos(guardada.avisos);
        setGuardando(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      router.push(`/admin/control-pacientes/${guardada.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No pudimos guardar la ficha. Revisa los datos e intenta de nuevo.',
      );
      setGuardando(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-5 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {/*
        Solo se avisa; no se manda a ningún lado.
        La edad se escribe aquí, en su casilla, que es donde está la mano. El
        aviso existe únicamente para que un campo vacío no se confunda con algo
        roto: sin fecha de nacimiento guardada no hay nada que calcular.
      */}
      {sinNacimiento && (
        <p className="mb-5 rounded-2xl bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900">
          Ese paciente no tiene fecha de nacimiento guardada, así que la edad no se calcula sola:
          escríbela en su casilla.
        </p>
      )}

      {avisos.length > 0 && (
        <div className="mb-5 rounded-2xl bg-warn-bg px-5 py-4 text-sm text-warn">
          <p className="font-semibold">La ficha quedó guardada, pero la agenda no:</p>
          <ul className="mt-2 space-y-1">
            {avisos.map((aviso) => (
              <li key={aviso.sesion}>
                Sesión {aviso.sesion}: {aviso.mensaje}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Corrige la hora del próximo control y vuelve a guardar; no se duplica nada.
          </p>
        </div>
      )}

      {/* La hoja, escribible. */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-2 shadow-soft">
        <FichaHoja
          datos={datos}
          servicios={servicios}
          productos={productos}
          pacienteVinculado={Boolean(paciente)}
          onElegirPaciente={(encontrado) => {
            setPaciente({ id: encontrado.id, fullName: encontrado.fullName });
            const calculada = edadCumplida(encontrado.birthDate);
            setSinNacimiento(calculada === null);
            parchear({
              patientName: encontrado.fullName,
              patientDocument: encontrado.documentId ?? null,
              patientPhone: telefonoLocal(encontrado.phone) || null,
              ...(calculada !== null ? { patientAge: calculada } : {}),
            });
          }}
          onNuevoTratamiento={(servicio) => setServicios((actual) => [...actual, servicio])}
          editable
          onCambio={parchear}
          onCambioLinea={parchearLinea}
          onAgregarLinea={() =>
            setDatos((actual) => ({
              ...actual,
              entries: [
                ...actual.entries,
                lineaVacia(actual.entries.length + 1, actual.markedZones, firmaProfesional),
              ],
            }))
          }
          onRepetirLinea={() =>
            setDatos((actual) => {
              const anterior = actual.entries[actual.entries.length - 1];
              if (!anterior) return actual;
              return {
                ...actual,
                entries: [
                  ...actual.entries,
                  lineaRepetida(anterior, actual.entries.length + 1, firmaProfesional),
                ],
              };
            })
          }
          onQuitarLinea={(indice) =>
            setDatos((actual) => ({
              ...actual,
              entries: actual.entries.filter((_, i) => i !== indice),
            }))
          }
          onFirmar={(fila, quien) => setFirmaAbierta({ fila, quien })}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium transition-colors hover:bg-cream"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="btn-primary disabled:pointer-events-none disabled:opacity-60"
        >
          {guardando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
          )}
          {editando ? 'Guardar cambios' : 'Crear ficha'}
        </button>
      </div>

      {/* ---- Panel de firma ---------------------------------------------- */}
      {firmaAbierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Capturar firma"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(evento) => {
            // Solo cierra al tocar el fondo, no al soltar el trazo dentro.
            if (evento.target === evento.currentTarget) setFirmaAbierta(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg">
                {firmaAbierta.quien === 'professional'
                  ? 'Firma del profesional'
                  : 'Firma del paciente'}
                <span className="ml-2 text-sm font-normal text-muted">
                  · Sesión {firmaAbierta.fila + 1}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setFirmaAbierta(null)}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-cream"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <FirmaPad
              valor={
                firmaAbierta.quien === 'professional'
                  ? (datos.entries[firmaAbierta.fila].professionalSignature ?? null)
                  : (datos.entries[firmaAbierta.fila].patientSignature ?? null)
              }
              onCambio={(firma) =>
                parchearLinea(firmaAbierta.fila, {
                  [firmaAbierta.quien === 'professional'
                    ? 'professionalSignature'
                    : 'patientSignature']: firma,
                } as Partial<LineaControl>)
              }
            />

            <button
              type="button"
              onClick={() => setFirmaAbierta(null)}
              className="btn-primary mt-5 w-full justify-center"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
