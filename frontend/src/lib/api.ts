import type {
  Clinic,
  InstagramFeed,
  ManagedAppointment,
  PatientProgress,
  Service,
} from './types';
import type { Testimonial } from './types';
import * as appointments from '@/server/modules/appointments/appointments.service';
import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { getAvailability, horarioPorDia } from '@/server/services/availability';
import { env } from '@/server/config/env';
import { toZonedDateKey } from '@/server/lib/datetime';
import { aHora, aMinutos, tramosDelDia, type HorarioDelDia } from './agenda';
import { getPatientProgress as leerSeguimiento } from '@/server/modules/public/tracking.service';
import * as consultas from '@/server/consultas';
import { SITE } from './config';

/**
 * Lectura de datos desde componentes de servidor.
 *
 * SOLO PARA EL SERVIDOR. Importar esto desde un componente cliente arrastraría
 * Prisma al paquete del navegador: las páginas que lo usan son todas
 * componentes de servidor, y así debe seguir.
 *
 * Ya no hay una llamada HTTP de por medio. Antes el sitio pedía los datos a la
 * API por red; ahora comparten proceso, así que se consulta la base directo y
 * se ahorra una vuelta completa por petición.
 *
 * Cada función conserva su valor de respaldo: la portada tiene que renderizar
 * aunque la base no responda. Un centro médico sin web es peor que un centro
 * médico con la web sin el feed de Instagram.
 */

/**
 * Deja el resultado en el mismo JSON que antes viajaba por HTTP.
 *
 * Prisma devuelve objetos `Date`; la API los serializaba a texto ISO al
 * responder, y los componentes están escritos contra eso. Al consultar la base
 * directo desaparecía esa conversión y las fechas llegaban como `Date` a un
 * código que espera cadenas. El build lo cazó en el feed de Instagram, pero el
 * mismo desajuste está en citas, sesiones y seguimiento.
 *
 * La ida y vuelta por JSON reproduce exactamente lo que hacía la respuesta
 * HTTP, así que el contrato con las páginas queda igual que antes. Para estos
 * tamaños de datos el costo no se nota.
 */
function comoJson<T>(valor: unknown): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

async function seguro<T>(consulta: () => Promise<unknown>, respaldo: T): Promise<T> {
  try {
    return comoJson<T>(await consulta());
  } catch {
    return respaldo;
  }
}

const FALLBACK_CLINIC: Clinic = {
  name: SITE.name,
  address: SITE.addressFallback,
  timezone: 'America/Bogota',
  whatsapp: SITE.whatsappFallback,
  whatsappLink: `https://wa.me/${SITE.whatsappFallback}`,
  instagram: SITE.instagramUrl,
  instagramUser: SITE.instagram,
};

export async function getClinic(): Promise<Clinic> {
  try {
    return consultas.clinicInfo();
  } catch {
    return FALLBACK_CLINIC;
  }
}

/**
 * Imágenes del inicio, si el centro subió alguna desde el panel.
 *
 * Si falla la consulta devuelve todo en `null` y las secciones caen en sus
 * marcadores: que la base no responda no puede dejar la portada en blanco.
 */
export async function getImagenesDelSitio(): Promise<{
  hero: string | null;
  nosotros: string | null;
}> {
  return seguro(() => consultas.imagenesDelSitio(), { hero: null, nosotros: null });
}

export async function getServices(): Promise<Service[]> {
  return seguro(() => consultas.listServices(), []);
}

export async function getService(slug: string): Promise<Service | null> {
  return seguro(() => consultas.getServiceBySlug(slug), null);
}

export async function getInstagramFeed(take = 8): Promise<InstagramFeed> {
  return seguro<InstagramFeed>(() => consultas.instagramFeed(take), {
    username: SITE.instagram,
    profileUrl: SITE.instagramUrl,
    items: [],
  });
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return seguro(() => consultas.listTestimonials(), []);
}

export async function getAppointmentByToken(token: string): Promise<ManagedAppointment | null> {
  return seguro(() => appointments.getByManageToken(token), null);
}

export async function getPatientProgress(token: string): Promise<PatientProgress | null> {
  return seguro(() => leerSeguimiento(token), null);
}

export interface FilaDeHorario {
  /** «Lunes a viernes», «Sábado», «Domingo». */
  dias: string;
  /** Días de la semana que cubre, 0 = domingo. Para marcar «hoy». */
  numeros: number[];
  /** «8:00 am – 6:00 pm», o null si ese día no se atiende. */
  horas: string | null;
  /** «Almuerzo 1:00 – 2:00 pm», si lo hay. */
  pausa: string | null;
}

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function horaBonita(hhmm: string): string {
  const total = aMinutos(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const sufijo = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/**
 * El horario de atención, agrupado como se escribe en una puerta: «Lunes a
 * viernes · 8:00 am – 6:00 pm». Sale de la misma tabla que decide la agenda,
 * así que el sitio nunca dice un horario distinto del que se puede reservar.
 */
export async function getHorarioPublico(): Promise<FilaDeHorario[]> {
  return seguro(async () => {
    const porDia = await horarioPorDia();
    const firma = (h: HorarioDelDia | undefined) =>
      h ? `${h.open}-${h.close}-${h.breakStart ?? ''}-${h.breakEnd ?? ''}` : 'cerrado';

    const filas: Array<{ numeros: number[]; h: HorarioDelDia | undefined }> = [];
    for (const dia of [1, 2, 3, 4, 5, 6, 0]) {
      const ultima = filas[filas.length - 1];
      if (ultima && firma(ultima.h) === firma(porDia[dia])) ultima.numeros.push(dia);
      else filas.push({ numeros: [dia], h: porDia[dia] });
    }

    return filas.map(({ numeros, h }) => {
      const primero = NOMBRES_DIA[numeros[0]];
      const ultimo = NOMBRES_DIA[numeros[numeros.length - 1]].toLowerCase();
      const tramos = h ? tramosDelDia(h) : [];
      return {
        dias:
          numeros.length === 1
            ? primero
            : numeros.length === 2
              ? `${primero} y ${ultimo}`
              : `${primero} a ${ultimo}`,
        numeros,
        horas: h ? `${horaBonita(h.open)} – ${horaBonita(h.close)}` : null,
        pausa:
          tramos.length === 2
            ? `Almuerzo ${horaBonita(aHora(tramos[0][1]))} – ${horaBonita(aHora(tramos[1][0]))}`
            : null,
      };
    });
  }, []);
}

/** Cuántos horarios quedan libres en los próximos siete días, para la portada. */
export async function getHuecosDeLaSemana(): Promise<number | null> {
  return seguro(async () => {
    const dias = await getAvailability({
      fromDate: toZonedDateKey(new Date(), env.CLINIC_TIMEZONE),
      days: 7,
    });
    return dias.reduce((total, dia) => total + dia.availableCount, 0);
  }, null);
}

/** La oferta de un hueco liberado, para la página /oferta/<token>. */
export async function getOferta(token: string) {
  return seguro(() => ofertas.verOferta(token), null as Awaited<ReturnType<typeof ofertas.verOferta>> | null);
}

