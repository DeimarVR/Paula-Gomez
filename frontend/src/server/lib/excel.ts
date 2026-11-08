/**
 * Descargas en Excel, compartidas por cualquier módulo que exporte.
 *
 * Vivía dentro de facturación; se movió aquí cuando ese módulo salió del
 * proyecto, porque el inventario también descarga su lista con esto.
 */
import { NextResponse } from 'next/server';
import writeXlsxFile from 'write-excel-file/node';

/**
 * Una celda tal como la espera `write-excel-file`.
 *
 * Una celda vacía es `null` a secas y NO `{ type: String, value: null }`: la
 * librería acepta el nulo suelto y rechaza el objeto con valor nulo, que es
 * además lo correcto — una celda sin dato no tiene tipo.
 */
export type Celda =
  | null
  | { value: string; fontWeight: 'bold' }
  | { type: StringConstructor; value: string }
  | { type: NumberConstructor; value: number; format: string }
  | { type: DateConstructor; value: Date; format: string };

export interface Hoja {
  nombre: string;
  /** Anchos de columna, en el orden de los encabezados. */
  anchos: number[];
  filas: Celda[][];
}


/**
 * Convierte las hojas en un .xlsx de verdad.
 *
 * Se genera en el SERVIDOR y no en el navegador por dos razones. La primera es
 * que los datos ya están aquí: el navegador tendría que volver a pedirlos, y
 * pedir «todo el inventario» solo para armar un archivo es traerse la
 * base entera a un celular. La segunda es que el formato de una celda —que
 * 180.000 sea un número y no el texto «180.000»— depende de cómo se escriba el
 * archivo, y eso conviene tenerlo en un solo sitio.
 *
 * `write-excel-file` y no `exceljs`: hace lo mismo para este caso con 2
 * paquetes en vez de 85, y sin dependencias deprecadas dentro.
 */
export async function armarExcel(hojas: Hoja[]): Promise<Buffer> {
  /*
   * Las opciones de cada hoja van al mismo nivel que `data`, NO anidadas en un
   * `options`. Anidadas se aceptan sin chistar y se ignoran: las hojas salen
   * llamándose «Sheet1» y «Sheet2» y los anchos no se aplican. Lo cazó el
   * compilador; la prueba a mano lo había dado por bueno.
   *
   * Y no lleva `{ buffer: true }`: en la entrada de Node esta función SIEMPRE
   * devuelve un objeto con `toBuffer`, `toStream` y `toFile`, y esa opción es
   * de la versión del navegador.
   */
  const salida = await writeXlsxFile(
    hojas.map((hoja) => ({
      data: hoja.filas,
      sheet: hoja.nombre,
      columns: hoja.anchos.map((width) => ({ width })),
    })),
  );

  return salida.toBuffer();
}

/**
 * La respuesta de descarga, con el nombre del archivo.
 *
 * Tiene que ser un `NextResponse` y NO un `Response` a secas: el envoltorio
 * `route()` solo deja pasar tal cual lo que sea `instanceof NextResponse`, y
 * cualquier otra cosa la serializa como JSON. Devolviendo un `Response` normal,
 * el Excel salía convertido en `{}` con encabezados de JSON — Excel lo abría y
 * decía que el archivo estaba dañado, que es exactamente lo que pasó.
 *
 * `Content-Disposition` con `attachment` es lo que hace que el navegador guarde
 * en vez de intentar mostrar. El nombre va también en `filename*` en UTF-8 por
 * si algún día lleva caracteres fuera de ASCII.
 */
export function respuestaDeDescarga(archivo: Buffer, nombre: string): NextResponse {
  const escapado = encodeURIComponent(nombre);

  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${escapado}`,
      'Content-Length': String(archivo.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
