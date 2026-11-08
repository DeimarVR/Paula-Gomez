/**
 * Vocabulario de la ficha facial.
 *
 * Vive aparte del capilar (`controlEvolutivo.ts`) porque son dos documentos
 * distintos: lo que se registra en una sesión de botox no se parece a lo que se
 * registra en una de mesoterapia capilar, y forzarlos al mismo esquema
 * terminaría con la mitad de las casillas vacías en cada ficha.
 */

export const TITULO_MODULO = 'Ficha facial';

/** Fototipos de Fitzpatrick, con lo que significa cada uno en la práctica. */
export const FOTOTIPOS = [
  { id: 'FITZ_I', etiqueta: 'I', descripcion: 'Muy clara, siempre se quema, nunca broncea' },
  { id: 'FITZ_II', etiqueta: 'II', descripcion: 'Clara, se quema fácil, broncea poco' },
  { id: 'FITZ_III', etiqueta: 'III', descripcion: 'Media, a veces se quema, broncea gradual' },
  { id: 'FITZ_IV', etiqueta: 'IV', descripcion: 'Morena clara, rara vez se quema' },
  { id: 'FITZ_V', etiqueta: 'V', descripcion: 'Morena oscura, casi nunca se quema' },
  { id: 'FITZ_VI', etiqueta: 'VI', descripcion: 'Negra, nunca se quema' },
] as const;

export type FototipoId = (typeof FOTOTIPOS)[number]['id'];

export function etiquetaFototipo(id: string | null | undefined): string {
  const encontrado = FOTOTIPOS.find((f) => f.id === id);
  return encontrado ? `Fototipo ${encontrado.etiqueta}` : '—';
}

/**
 * Zonas del rostro y el cuello.
 *
 * En el orden en que se recorren en una valoración, de arriba abajo: así quien
 * llena la ficha va marcando en el mismo orden en que mira al paciente.
 */
export const ZONAS_FACIALES = [
  { id: 'frente', etiqueta: 'Frente' },
  { id: 'entrecejo', etiqueta: 'Entrecejo' },
  { id: 'patas-gallo', etiqueta: 'Patas de gallo' },
  { id: 'contorno-ojos', etiqueta: 'Contorno de ojos' },
  { id: 'ojeras', etiqueta: 'Ojeras' },
  { id: 'nariz', etiqueta: 'Nariz' },
  { id: 'pomulos', etiqueta: 'Pómulos' },
  { id: 'mejillas', etiqueta: 'Mejillas' },
  { id: 'nasogenianos', etiqueta: 'Surcos nasogenianos' },
  { id: 'labios', etiqueta: 'Labios' },
  { id: 'codigo-barras', etiqueta: 'Código de barras' },
  { id: 'menton', etiqueta: 'Mentón' },
  { id: 'mandibula', etiqueta: 'Línea mandibular' },
  { id: 'cuello', etiqueta: 'Cuello' },
  { id: 'escote', etiqueta: 'Escote' },
] as const;

export type ZonaFacialId = (typeof ZONAS_FACIALES)[number]['id'];

export function etiquetaZonaFacial(id: string): string {
  return ZONAS_FACIALES.find((z) => z.id === id)?.etiqueta ?? id;
}

/** Motivos de consulta habituales. La lista es una ayuda, no un candado. */
export const MOTIVOS_CONSULTA = [
  'Arrugas de expresión',
  'Flacidez',
  'Manchas',
  'Acné activo',
  'Cicatrices de acné',
  'Poro dilatado',
  'Textura irregular',
  'Ojeras',
  'Piel apagada',
  'Rosácea',
  'Hidratación',
] as const;

/**
 * Unidades en que se mide lo aplicado.
 *
 * El botox se cuenta en unidades y los rellenos en mililitros; hay
 * procedimientos que no se miden y para esos está «sesión». Sin esta distinción,
 * un «3» en la ficha no dice nada dentro de un año.
 */
export const UNIDADES_APLICACION = ['U', 'ml', 'mg', 'sesión'] as const;

/** Columnas de la tabla de sesiones. */
export const COLUMNAS_FACIALES = [
  { clave: 'sessionDate', titulo: 'Fecha' },
  { clave: 'sessionLabel', titulo: 'Sesión' },
  { clave: 'serviceId', titulo: 'Procedimiento' },
  { clave: 'zones', titulo: 'Zonas' },
  { clave: 'producto', titulo: 'Producto y lote' },
  { clave: 'quantity', titulo: 'Cantidad' },
  { clave: 'findings', titulo: 'Observaciones' },
  { clave: 'nextControl', titulo: 'Próximo control' },
] as const;

export interface LineaFacial {
  id?: string;
  sessionDate: string;
  sessionLabel: string;
  serviceId: string;
  zones: string[];
  productId: string;
  productName: string;
  lotNumber: string;
  quantity: string;
  quantityUnit: string;
  technique: string;
  findings: string;
  homeCare: string;
  nextControl: string;
  nextControlTime: string;
  nextControlServiceId: string;
  professionalSignature: string | null;
  patientSignature: string | null;
}

export interface FichaFacial {
  id?: string;
  patientId: string;
  openedAt: string;
  patientName: string;
  patientDocument: string;
  patientAge: string;
  patientPhone: string;
  skinType: string;
  skinCondition: string;
  concerns: string[];
  allergies: string;
  contraindications: string;
  notes: string;
  entries: LineaFacial[];
}

/** Una línea vacía, lista para llenar. */
export function lineaVacia(fecha: string): LineaFacial {
  return {
    sessionDate: fecha,
    sessionLabel: '',
    serviceId: '',
    zones: [],
    productId: '',
    productName: '',
    lotNumber: '',
    quantity: '',
    quantityUnit: 'U',
    technique: '',
    findings: '',
    homeCare: '',
    nextControl: '',
    nextControlTime: '',
    nextControlServiceId: '',
    professionalSignature: null,
    patientSignature: null,
  };
}
