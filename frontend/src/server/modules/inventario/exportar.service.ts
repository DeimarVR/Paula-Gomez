import { ProductKind } from '@prisma/client';
import {
  listarInventario,
  type ConsultaInventario,
  type ProductoConStock,
} from './inventario.service';
import type { Celda, Hoja } from '../../lib/excel';

/**
 * El inventario en Excel.
 *
 * Nació para poder COMPARAR: cuando llega una lista nueva desde el papel o
 * desde otro Excel, lo primero que hace falta es ver qué tiene el sistema hoy,
 * y leer ochenta productos de una pantalla no es forma. Después queda para lo
 * de siempre: llevárselo al proveedor, hacer el conteo físico con una hoja
 * impresa, o pasárselo al contador.
 *
 * Trae los ARCHIVADOS también, marcados en su columna. Para comparar listas hay
 * que poder ver que un producto no desapareció sino que alguien lo archivó; sin
 * eso se vuelve a crear repetido, que es justo el enredo que se quiere evitar.
 */

const PESOS = '#,##0';
const FECHA = 'dd/mm/yyyy';

const texto = (value: string | null | undefined): Celda => {
  const limpio = value?.trim();
  return limpio ? { type: String, value: limpio } : null;
};
const numero = (value: number | null | undefined, formato = '0'): Celda =>
  value === null || value === undefined ? null : { type: Number, value, format: formato };
const plata = (value: number | null | undefined): Celda => numero(value, PESOS);
/**
 * El vencimiento, como día y nada más.
 *
 * Los vencimientos se guardan al mediodía de la clínica —o sea las 17:00 UTC—
 * y Excel mide las fechas en días desde 1900 contando el instante completo. Se
 * reconstruye a medianoche UTC para que el número quede entero: así la celda
 * cae en el día que corresponde sea cual sea la zona del servidor, y no en el
 * de al lado porque sobraron unas horas.
 */
const dia = (value: Date | null): Celda =>
  value
    ? {
        type: Date,
        value: new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())),
        format: FECHA,
      }
    : null;
const titulo = (value: string): Celda => ({ value, fontWeight: 'bold' });

const TIPOS: Record<ProductKind, string> = {
  MEDICAMENTO: 'Medicamento',
  INSUMO: 'Insumo',
};

/** Lo que dice la columna «Estado»: lo accionable primero. */
function estadoDe(producto: ProductoConStock): string {
  if (!producto.active) return 'Archivado';
  if (producto.vencido) return 'Vencido';
  if (producto.stock <= 0) return 'Agotado';
  if (producto.bajo) return 'Bajo mínimo';
  if (producto.porVencer) return 'Por vencer';
  return 'OK';
}

export async function hojaDeInventario(consulta: ConsultaInventario = {}): Promise<Hoja[]> {
  /*
   * Se piden los archivados siempre, pase lo que pase en los filtros de la
   * pantalla: un Excel de inventario que esconde productos es un Excel que
   * lleva a crearlos de nuevo.
   *
   * La excepción es cuando la pantalla está mirando SOLO los archivados: ahí
   * el archivo tiene que traer eso mismo y no el catálogo entero. Por eso
   * `soloArchivados` viaja en la consulta y manda sobre esta línea.
   */
  const productos = await listarInventario({ ...consulta, incluirArchivados: true });

  const filas: Celda[][] = [
    [
      titulo('Producto'),
      titulo('Presentación'),
      titulo('Categoría'),
      titulo('Tipo'),
      titulo('Código'),
      titulo('Unidad'),
      titulo('Existencia'),
      titulo('Mínimo'),
      titulo('Estado'),
      titulo('Precio venta'),
      titulo('Proveedor'),
      titulo('Vence'),
      titulo('Movimientos'),
      titulo('Notas'),
    ],
  ];

  for (const producto of productos) {
    filas.push([
      texto(producto.name),
      texto(producto.presentation),
      texto(producto.category),
      texto(TIPOS[producto.kind]),
      texto(producto.sku),
      texto(producto.unit),
      numero(producto.stock),
      numero(producto.minStock),
      texto(estadoDe(producto)),
      plata(producto.salePrice),
      texto(producto.supplier),
      dia(producto.venceEl),
      numero(producto.movimientos),
      texto(producto.notes),
    ]);
  }

  return [
    {
      nombre: 'Inventario',
      anchos: [34, 20, 20, 12, 14, 11, 12, 10, 13, 13, 22, 12, 13, 32],
      filas,
    },
  ];
}
