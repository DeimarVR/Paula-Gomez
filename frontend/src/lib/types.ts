/** Contratos compartidos con la API. Reflejan lo que devuelve el backend. */

export type Gender = 'FEMENINO' | 'MASCULINO' | 'OTRO' | 'NO_DECLARA';
export type PlanStatus = 'ACTIVO' | 'PAUSADO' | 'FINALIZADO' | 'CANCELADO';
export type SessionStatus =
  | 'PROGRAMADA'
  | 'COMPLETADA'
  | 'REPROGRAMADA'
  | 'CANCELADA'
  | 'NO_ASISTIO';
export type AppointmentStatus =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'CANCELADA'
  | 'COMPLETADA'
  | 'NO_ASISTIO';
export type PhotoType = 'ANTES' | 'PROGRESO' | 'DESPUES';
export type Role = 'ADMIN' | 'PROFESIONAL' | 'RECEPCION';

export interface Clinic {
  name: string;
  address: string;
  timezone: string;
  whatsapp: string;
  whatsappLink: string;
  instagram: string;
  instagramUser: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  durationMin: number;
  priceCop: number | null;
  sessionsAdvice: number | null;
  category: string;
  imageUrl: string | null;
  icon: string;
  benefits: string[];
  featured: boolean;
  active: boolean;
  /** Sale en la web. Los creados a las volandas nacen sin publicar. */
  published: boolean;
  sortOrder: number;
}

export interface InstagramItem {
  id: string;
  caption: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  postedAt: string;
}

export interface InstagramFeed {
  username: string;
  profileUrl: string;
  items: InstagramItem[];
}

export interface Testimonial {
  id: string;
  authorName: string;
  city: string | null;
  quote: string;
  rating: number;
}

/**
 * Por qué un horario no se puede reservar.
 *
 * No es lo mismo «ya lo tomaron» que «cierra a esa hora». El primero se
 * muestra en la grilla, tachado, para que el paciente vea que ese espacio
 * existe pero está tomado; los demás simplemente no se dibujan. `suya` es la
 * hora que el paciente ya tiene cuando la está cambiando.
 */
export type MotivoNoDisponible = 'ocupado' | 'bloqueado' | 'muy-pronto' | 'muy-lejos' | 'suya';

export interface TimeSlot {
  time: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  /** Solo viene cuando `available` es false. */
  motivo?: MotivoNoDisponible;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  /** Hay horario de atención ese día de la semana. */
  open: boolean;
  /** La especialista cerró ese día desde el panel. */
  cerrado: { motivo: string | null } | null;
  slots: TimeSlot[];
  availableCount: number;
}

export interface AvailabilityResponse {
  cita: { nombre: string; duracionMin: number };
  timezone: string;
  maxAdvanceDays: number;
  days: DayAvailability[];
}

export interface BookingResponse {
  message: string;
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
  };
  manageToken: string;
  manageUrl: string;
  whatsappLink: string;
  notifications: { whatsappSent: boolean; calendarSynced: boolean };
}

export interface ManagedAppointment {
  id: string;
  contactName: string;
  service: { name: string; durationMin: number; slug: string };
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  /** La canceló el centro al cerrar el día y espera que elija otra hora. */
  needsReschedule: boolean;
  /** Puede elegir otra hora desde el enlace. */
  puedeReagendar: boolean;
  formattedDate: string;
  clinic: { name: string; address: string; whatsapp: string };
}

// --- Seguimiento del paciente ----------------------------------------------

export interface ProgressPhoto {
  id: string;
  url: string;
  type: PhotoType;
  angle: string;
  caption: string | null;
}

export interface ProgressSession {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  scheduledAt: string;
  performedAt: string | null;
  formattedDate: string;
  summary: string | null;
  homeCare: string | null;
  productsUsed: string[];
  metrics: Record<string, string | number | boolean> | null;
  professional: string | null;
  photos: ProgressPhoto[];
}

export interface ProgressComparison {
  angle: string;
  before: ProgressPhoto & { takenAt: string };
  after: ProgressPhoto & { takenAt: string };
}

export interface ProgressPlan {
  id: string;
  title: string;
  goal: string | null;
  status: PlanStatus;
  service: { name: string; slug: string; shortDesc: string; icon: string };
  startDate: string;
  totalSessions: number;
  completedSessions: number;
  progressPercent: number;
  nextSession: {
    id: string;
    sessionNumber: number;
    scheduledAt: string;
    formattedDate: string;
  } | null;
  sessions: ProgressSession[];
  comparisons: ProgressComparison[];
}

export interface PatientProgress {
  patient: { firstName: string; fullName: string; memberSince: string };
  summary: {
    activePlans: number;
    completedSessions: number;
    plannedSessions: number;
    overallProgress: number;
  };
  plans: ProgressPlan[];
  upcomingAppointments: Array<{
    id: string;
    serviceName: string;
    startsAt: string;
    status: AppointmentStatus;
    formattedDate: string;
    manageToken: string;
  }>;
  clinic: { name: string; whatsapp: string; address: string };
}

// --- Panel -----------------------------------------------------------------

/**
 * Una entrada del historial del paciente.
 *
 * Vive aquí y no en la ruta porque Next solo admite exportaciones con nombres
 * conocidos en un archivo de ruta, y tanto el servidor como el panel necesitan
 * esta forma.
 */
export type TipoHecho =
  | 'ficha-capilar'
  | 'ficha-facial'
  | 'consentimiento'
  | 'fotos'
  | 'producto'
  | 'cita';

export interface Hecho {
  id: string;
  tipo: TipoHecho;
  /** ISO. Es la única clave con la que se ordena todo. */
  fecha: string;
  titulo: string;
  detalle?: string | null;
  /** A dónde lleva al pulsarlo, si lleva a algún sitio. */
  enlace?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface PatientListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  documentId: string | null;
  city: string | null;
  active: boolean;
  updatedAt: string;
  publicToken: string;
  _count: { plans: number; appointments: number };
  plans: Array<{
    id: string;
    title: string;
    totalSessions: number;
    _count: { sessions: number };
  }>;
}

export interface AppointmentListItem {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: string;
  message: string | null;
  googleHtmlLink: string | null;
  manageToken: string;
  /** Cuándo cambió por última vez. Sirve para ver si el paciente ya respondió. */
  updatedAt: string;
  /** La canceló el centro al cerrar el día y espera que el paciente elija otra hora. */
  needsReschedule: boolean;
  service: { id: string; name: string; slug: string; durationMin: number };
  patient: { id: string; fullName: string; publicToken: string } | null;
}

/** Un día cerrado, con su motivo. */
export interface DiaCerrado {
  fecha: string;
  motivo: string | null;
}

/** Una cita afectada por un cierre o un hueco, con su enlace para mandar a mano. */
export interface AvisoPendiente {
  id: string;
  nombre: string;
  telefono: string;
  startsAt: string;
  avisoEnviadoEn?: string | null;
  avisoEnviado?: boolean;
  enlaceManual: string | null;
}

export interface EstadoCierres {
  dias: DiaCerrado[];
  pendientesDeAviso: AvisoPendiente[];
  pendientesDeReagendar: AvisoPendiente[];
}

export type EstadoOferta = 'ABIERTA' | 'TOMADA' | 'VENCIDA' | 'ANULADA';

export interface OfertaHueco {
  id: string;
  startsAt: string;
  endsAt: string;
  estado: EstadoOferta;
  creadaEn: string;
  tomadaPor: string | null;
  invitaciones: Array<{
    id: string;
    citaId: string;
    nombre: string;
    telefono: string;
    citaActual: string;
    enviadaEn: string | null;
    aceptadaEn: string | null;
    rechazadaEn: string | null;
    enlaceManual: string | null;
  }>;
}

export interface IntegrationsStatus {
  instagram: {
    configured: boolean;
    connected: boolean;
    /** Hay token con el que pedir el feed: guardado o en el entorno. */
    usable: boolean;
    username: string;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    lastRefreshedAt: string | null;
    refreshCount: number;
    lastError: string | null;
    postCount: number;
    lastSyncedAt: string | null;
    autoRefresh: { enabled: boolean; cron: string; renewsWhenDaysLeft: number };
  };
  googleCalendar: {
    configured: boolean;
    connected: boolean;
    calendarId: string;
    timezone: string;
    lastRefreshedAt: string | null;
    lastError: string | null;
  };
  whatsapp: {
    configured: boolean;
    /** Lo último que respondió Meta cuando un envío falló. */
    lastError: string | null;
    clinicNumber: string;
    apiVersion: string;
    templates: {
      confirmation: string | null;
      reminder: string | null;
      /** Oferta de un hueco liberado. */
      hueco: string | null;
      /** Disculpa por un día cerrado. */
      diaCerrado: string | null;
    };
    deepLinksAvailable: boolean;
  };
}

// --- Expediente general ------------------------------------------------------

export interface Medicamento {
  id: string;
  name: string;
  dose: string | null;
  notes: string | null;
  startedOn: string | null;
  active: boolean;
  endedOn: string | null;
  createdBy: string | null;
}

export interface NotaEvolucion {
  id: string;
  body: string;
  noteDate: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface HojaEnPapel {
  id: string;
  title: string;
  sheetDate: string | null;
  fileUrl: string;
  mimeType: string;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface Expediente {
  tratamiento: {
    motivo: string | null;
    diagnostico: string | null;
    plan: string | null;
    controlesPrevistos: number | null;
    controlesHechos: number | null;
  };
  antecedentes: {
    alergias: string | null;
    personales: string | null;
    quirurgicos: string | null;
    familiares: string | null;
  };
  medicamentos: Medicamento[];
  notas: NotaEvolucion[];
  hojas: HojaEnPapel[];
  actualizado: { en: string; por: string | null } | null;
  proximaCita: { id: string; startsAt: string; status: AppointmentStatus } | null;
  primeraAtencion: string | null;
}
