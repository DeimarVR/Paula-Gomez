/**
 * Buscar sin escribir las tildes.
 *
 * Vive aparte del servicio porque es una función pura —texto entra, texto
 * sale— y así se puede probar sola, sin levantar la base.
 */

/**
 * Las variantes con y sin tilde de una palabra.
 *
 * Nadie escribe los acentos en el buscador, y la base los tiene: buscar
 * «rodriguez bolanos» no encontraba a «Rodríguez Bolaños» y la pantalla salía
 * vacía como si el paciente no existiera. Postgres sabe ignorar mayúsculas,
 * pero no tildes, y arreglarlo de raíz pide instalar `unaccent` en la base.
 *
 * Esto lo resuelve sin tocar la base: cada vocal se prueba en sus dos formas.
 * «rodriguez» genera también «rodríguez», «rodrigüez», etc. Se corta en 32
 * variantes —una palabra con más de cinco vocales— porque a partir de ahí la
 * lista crece al doble por vocal y deja de valer la pena; en ese caso se busca
 * la palabra tal como se escribió, que es lo que se hacía antes.
 */
const CON_TILDE: Record<string, string[]> = {
  a: ['a', 'á'], e: ['e', 'é'], i: ['i', 'í'],
  o: ['o', 'ó'], u: ['u', 'ú', 'ü'], n: ['n', 'ñ'],
};

const TOPE_DE_VARIANTES = 32;

export function variantesDeAcento(palabra: string): string[] {
  const base = palabra
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  let cuantas = 1;
  for (const letra of base) cuantas *= (CON_TILDE[letra]?.length ?? 1);
  if (cuantas > TOPE_DE_VARIANTES) return [palabra];

  let variantes = [''];
  for (const letra of base) {
    const opciones = CON_TILDE[letra] ?? [letra];
    variantes = variantes.flatMap((previa) => opciones.map((o) => previa + o));
  }
  return variantes;
}
