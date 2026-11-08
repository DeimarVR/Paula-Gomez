import { Prisma, ProductKind, StockMoveReason, StockMoveType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';

/**
 * Inventario de medicamentos e insumos.
 *
 * La existencia NO se guarda en ningún campo: se calcula sumando los
 * movimientos. Un contador guardado encima del producto se desincroniza el día
 * que alguien escribe un movimiento sin pasar por aquí —una corrección a mano
 * en la base, un script de migración— y a partir de ese momento el inventario
 * miente sin que nadie lo note. Sumar cuesta una consulta más; a la escala de
 * un centro con unos cientos de productos no se siente.
 */

/** Cuánto suma o resta un movimiento. Es la única regla de signo del módulo. */
function signo(tipo: StockMoveType): 1 | -1 {
  return tipo === StockMoveType.SALIDA ? -1 : 1;
}

export interface ProductoEntrada {
  name: string;
  kind: ProductKind;
  sku?: string | null;
  unit: string;
  presentation?: string | null;
  /** Cómo lo agrupa el centro: MEDICAMENTO, SUPLEMENTO, INSUMO… */
  category?: string | null;
  /** Lo que se le cobra al paciente. El costo de compra va en cada entrada. */
  salePrice?: number | null;
  supplier?: string | null;
  minStock?: number;
  notes?: string | null;
  active?: boolean;
  /**
   * Lo que ya hay en el estante al dar de alta el producto.
   *
   * No es un campo del producto: se convierte en un movimiento de entrada, que
   * es la única forma de que exista una existencia. Está aquí por comodidad —
   * dar de alta un producto y tener que ir aparte a decir cuántos hay son dos
   * pasos para una sola idea— pero por debajo no rompe la regla.
   */
  cantidadInicial?: number | null;
}

/* ------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------ */

export async function crearProducto(datos: ProductoEntrada, usuarioId?: string) {
  const inicial = datos.cantidadInicial ?? 0;

  try {
    return await prisma.product.create({
      data: {
        name: datos.name.trim(),
        kind: datos.kind,
        sku: datos.sku?.trim() || null,
        unit: datos.unit.trim(),
        presentation: datos.presentation?.trim() || null,
        category: datos.category?.trim().toUpperCase() || null,
        salePrice: datos.salePrice ?? null,
        supplier: datos.supplier?.trim() || null,
        minStock: datos.minStock ?? 0,
        notes: datos.notes?.trim() || null,
        /**
         * La existencia inicial entra como movimiento, con motivo de conteo:
         * no fue una compra que se esté registrando, es lo que había cuando
         * empezaron a llevar el inventario. Así el historial cuenta la verdad
         * desde el primer día.
         */
        ...(inicial > 0
          ? {
              moves: {
                create: {
                  type: StockMoveType.ENTRADA,
                  reason: StockMoveReason.CONTEO,
                  quantity: inicial,
                  occurredAt: new Date(),
                  notes: 'Existencia inicial al dar de alta el producto',
                  createdById: usuarioId ?? null,
                },
              },
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw HttpError.conflict('Ya existe un producto con ese código.');
    }
    throw error;
  }
}

export async function actualizarProducto(id: string, datos: ProductoEntrada) {
  const existe = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw HttpError.notFound('Producto no encontrado');

  return prisma.product.update({
    where: { id },
    data: {
      name: datos.name.trim(),
      kind: datos.kind,
      sku: datos.sku?.trim() || null,
      unit: datos.unit.trim(),
      presentation: datos.presentation?.trim() || null,
      category: datos.category?.trim().toUpperCase() || null,
      salePrice: datos.salePrice ?? null,
      supplier: datos.supplier?.trim() || null,
      minStock: datos.minStock ?? 0,
      notes: datos.notes?.trim() || null,
      ...(datos.active === undefined ? {} : { active: datos.active }),
    },
  });
}

/**
 * Un producto con movimientos no se borra: se desactiva.
 *
 * Borrarlo se llevaría por delante el historial —la cascada del esquema— y con
 * él la respuesta a «qué se le puso a este paciente en marzo». Un producto que
 * ya no se usa se archiva; lo que pasó, pasó.
 */
/**
 * Un producto con historia NUNCA se borra: se archiva.
 *
 * Borrarlo se llevaría por delante sus movimientos —la relación es en
 * cascada—, y con ellos la explicación de todas las existencias que pasaron
 * por ese producto. Archivado deja de aparecer en el listado y no se le pueden
 * registrar entradas, pero su historial sigue entero y se puede reactivar.
 *
 * Solo se borra de verdad el producto que nunca tuvo un movimiento: ese no es
 * historia, es un alta equivocada de hace dos minutos.
 */
export async function archivarProducto(id: string, usuarioId?: string) {
  const producto = await prisma.product.findUnique({
    where: { id },
    select: { id: true, active: true },
  });
  if (!producto) throw HttpError.notFound('Producto no encontrado');

  const movimientos = await prisma.stockMove.count({ where: { productId: id } });

  if (movimientos === 0) {
    await prisma.product.delete({ where: { id } });
    return { borrado: true };
  }

  /**
   * Archivar con existencia deja un rastro.
   *
   * Si quedaban 4 en el estante y el producto desaparece del listado, el
   * inventario pasa a decir que no existen sin que nada explique adónde
   * fueron. La salida de conteo lo dice: se archivó con 4 encima.
   */
  const quedan = await stockDe(id);

  return prisma.$transaction(async (tx) => {
    if (quedan > 0 && producto.active) {
      await tx.stockMove.create({
        data: {
          productId: id,
          type: StockMoveType.SALIDA,
          reason: StockMoveReason.CONTEO,
          quantity: quedan,
          occurredAt: new Date(),
          notes: 'Se archivó el producto con existencia en cero',
          createdById: usuarioId ?? null,
        },
      });
    }

    await tx.product.update({ where: { id }, data: { active: false } });
    return { borrado: false, ajustado: quedan > 0 && producto.active, quedaban: quedan };
  });
}

/* ------------------------------------------------------------------ *
 * Existencias
 * ------------------------------------------------------------------ */

export interface ProductoConStock {
  id: string;
  name: string;
  kind: ProductKind;
  sku: string | null;
  unit: string;
  presentation: string | null;
  category: string | null;
  salePrice: number | null;
  supplier: string | null;
  minStock: number;
  notes: string | null;
  active: boolean;
  stock: number;
  /** `true` cuando hay un mínimo definido y la existencia no llega. */
  bajo: boolean;
  /**
   * Cuántos movimientos tiene. Viaja al panel para que el aviso de borrado
   * diga la verdad ANTES de pulsar: un producto con historial no se borra, se
   * archiva, y quien lo va a hacer merece saberlo antes y no después.
   */
  movimientos: number;
  /** La fecha del lote más próximo a vencer. `null` si nadie anotó ninguna. */
  venceEl: Date | null;
  /** Ya pasó la fecha. */
  vencido: boolean;
  /** Vence dentro de los próximos dos meses. */
  porVencer: boolean;
}

export interface ConsultaInventario {
  q?: string;
  kind?: ProductKind;
  /** Solo los que están por debajo de su mínimo. */
  soloBajos?: boolean;
  /** Los archivados ADEMÁS de los que están en uso. */
  incluirArchivados?: boolean;
  /**
   * SOLO los archivados, sin los que están en uso.
   *
   * No es lo mismo que el anterior y la diferencia importa: para revisar qué
   * se archivó hace falta ver esa lista sola. Mezclada con el catálogo entero
   * no se distingue nada, y lo que parece es que hay un montón de productos
   * archivados estorbando cuando en realidad son los de siempre.
   *
   * Manda sobre `incluirArchivados` si vienen los dos.
   */
  soloArchivados?: boolean;
  /** Solo los que tienen algún lote vencido o a punto de vencer. */
  soloPorVencer?: boolean;
  /**
   * Cómo se ordena la lista.
   *
   * Por defecto va alfabético, que es como se busca un producto concreto. Por
   * vencimiento es para lo contrario: no se busca uno, se quiere ver qué hay
   * que usar o sacar del estante antes de que se pierda. Los que no tienen
   * fecha van al final —no es que no venzan, es que nadie la anotó— y ahí
   * vuelven a ir alfabéticos.
   */
  orden?: 'nombre' | 'vencimiento';
}

/** Cuántos días adelante cuentan como «por vencer». */
const DIAS_POR_VENCER = 60;

export async function listarInventario(consulta: ConsultaInventario = {}): Promise<ProductoConStock[]> {
  const productos = await prisma.product.findMany({
    where: {
      ...(consulta.soloArchivados
        ? { active: false }
        : consulta.incluirArchivados
          ? {}
          : { active: true }),
      ...(consulta.kind ? { kind: consulta.kind } : {}),
      ...(consulta.q
        ? {
            OR: [
              { name: { contains: consulta.q, mode: 'insensitive' as const } },
              { sku: { contains: consulta.q, mode: 'insensitive' as const } },
              { presentation: { contains: consulta.q, mode: 'insensitive' as const } },
              { category: { contains: consulta.q, mode: 'insensitive' as const } },
              { supplier: { contains: consulta.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });

  if (productos.length === 0) return [];

  /**
   * Una sola agrupación para todos los productos, no una consulta por
   * producto: con cien productos, lo segundo son cien viajes a la base para
   * pintar una tabla.
   */
  const porTipo = await prisma.stockMove.groupBy({
    by: ['productId', 'type'],
    where: { productId: { in: productos.map((p) => p.id) } },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  const stock = new Map<string, number>();
  const movimientos = new Map<string, number>();

  for (const fila of porTipo) {
    const suma = (fila._sum.quantity ?? 0) * signo(fila.type);
    stock.set(fila.productId, (stock.get(fila.productId) ?? 0) + suma);
    movimientos.set(fila.productId, (movimientos.get(fila.productId) ?? 0) + fila._count._all);
  }

  /**
   * La fecha más próxima de cada producto, en una sola consulta.
   *
   * Sale de las ENTRADAS, que es donde se anota el lote y su vencimiento. No
   * hay trazabilidad por lote —el sistema no sabe de qué lote salió lo que se
   * usó— así que esto no dice «te quedan 3 del lote que vence»: dice «lo más
   * viejo que recibiste de esto vence tal día, andá a mirar el estante». Para
   * el tamaño del centro es justo lo que hace falta.
   */
  const vencimientos = await prisma.stockMove.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productos.map((p) => p.id) },
      type: StockMoveType.ENTRADA,
      expiresAt: { not: null },
    },
    _min: { expiresAt: true },
  });

  const venceEl = new Map<string, Date>();
  for (const fila of vencimientos) {
    if (fila._min.expiresAt) venceEl.set(fila.productId, fila._min.expiresAt);
  }

  const hoy = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_POR_VENCER);

  const conStock = productos.map((producto) => {
    const cantidad = stock.get(producto.id) ?? 0;
    const vence = venceEl.get(producto.id) ?? null;
    return {
      ...producto,
      stock: cantidad,
      /**
       * Bajo es estar POR DEBAJO del mínimo, no estar justo en él.
       *
       * Antes marcaba también al que tenía exactamente la cantidad que debía
       * tener, y con el inventario cargado desde el conteo eso dejaba a casi
       * todo el catálogo con el aviso encendido. Un aviso que nunca se apaga
       * no avisa de nada: se vuelve parte del fondo y el día que sí falta algo
       * nadie lo distingue del resto.
       */
      bajo: producto.minStock > 0 && cantidad < producto.minStock,
      movimientos: movimientos.get(producto.id) ?? 0,
      /** La fecha del lote más próximo a vencer. `null` si nadie anotó ninguna. */
      venceEl: vence,
      /** Ya pasó la fecha: no se puede usar. */
      vencido: vence !== null && vence < hoy,
      /** Vence dentro de los próximos dos meses. */
      porVencer: vence !== null && vence >= hoy && vence <= limite,
    };
  });

  const filtrados = conStock
    .filter((p) => (consulta.soloBajos ? p.bajo : true))
    .filter((p) => (consulta.soloPorVencer ? p.vencido || p.porVencer : true));

  if (consulta.orden !== 'vencimiento') return filtrados;

  /**
   * Lo que vence primero, primero. Los que no tienen fecha anotada van al
   * final: no es que no venzan, es que nadie la escribió, y mezclarlos arriba
   * escondería justo lo que se está buscando.
   */
  return [...filtrados].sort((a, b) => {
    if (a.venceEl && b.venceEl) return a.venceEl.getTime() - b.venceEl.getTime();
    if (a.venceEl) return -1;
    if (b.venceEl) return 1;
    return a.name.localeCompare(b.name, 'es');
  });
}

/** La existencia de un producto suelto. */
export async function stockDe(productId: string): Promise<number> {
  const porTipo = await prisma.stockMove.groupBy({
    by: ['type'],
    where: { productId },
    _sum: { quantity: true },
  });

  return porTipo.reduce((total, fila) => total + (fila._sum.quantity ?? 0) * signo(fila.type), 0);
}

/* ------------------------------------------------------------------ *
 * Movimientos
 * ------------------------------------------------------------------ */

export interface MovimientoEntrada {
  productId: string;
  type: StockMoveType;
  reason: StockMoveReason;
  quantity: number;
  occurredAt: Date;
  patientId?: string | null;
  lotNumber?: string | null;
  expiresAt?: Date | null;
  unitCost?: number | null;
  notes?: string | null;
}

export async function registrarMovimiento(datos: MovimientoEntrada, usuarioId?: string) {
  if (datos.quantity <= 0) {
    throw HttpError.unprocessable('La cantidad tiene que ser mayor que cero.');
  }

  const producto = await prisma.product.findUnique({
    where: { id: datos.productId },
    select: { id: true, name: true, unit: true, active: true },
  });
  if (!producto) throw HttpError.notFound('Producto no encontrado');

  if (!producto.active && datos.type === StockMoveType.ENTRADA) {
    throw HttpError.unprocessable(
      'Ese producto está archivado. Reactívalo antes de registrarle entradas.',
    );
  }

  /**
   * Una salida no puede dejar la existencia en negativo.
   *
   * No es purismo: un inventario en negativo significa que algo se registró
   * mal antes, y dejar pasar la salida entierra el error en vez de sacarlo a
   * la luz cuando todavía se recuerda qué pasó.
   */
  if (datos.type === StockMoveType.SALIDA) {
    const disponible = await stockDe(producto.id);
    if (datos.quantity > disponible) {
      throw HttpError.unprocessable(
        `Solo hay ${disponible} ${producto.unit} de ${producto.name}. ` +
          'Si el conteo real es otro, registra primero un ajuste.',
      );
    }
  }

  // El paciente solo tiene sentido cuando el producto se le aplicó a alguien.
  const paciente =
    datos.reason === StockMoveReason.USO_EN_PACIENTE ? (datos.patientId ?? null) : null;

  if (datos.reason === StockMoveReason.USO_EN_PACIENTE && !paciente) {
    throw HttpError.unprocessable('Elige a qué paciente se le aplicó.');
  }

  return prisma.stockMove.create({
    data: {
      productId: producto.id,
      type: datos.type,
      reason: datos.reason,
      quantity: datos.quantity,
      occurredAt: datos.occurredAt,
      patientId: paciente,
      lotNumber: datos.lotNumber?.trim() || null,
      expiresAt: datos.expiresAt ?? null,
      unitCost: datos.unitCost ?? null,
      notes: datos.notes?.trim() || null,
      createdById: usuarioId ?? null,
    },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      patient: { select: { id: true, fullName: true } },
      createdBy: { select: { fullName: true } },
    },
  });
}

export interface ConsultaMovimientos {
  productId?: string;
  patientId?: string;
  type?: StockMoveType;
  desde?: Date;
  hasta?: Date;
  take?: number;
}

export async function listarMovimientos(consulta: ConsultaMovimientos = {}) {
  const filas = await prisma.stockMove.findMany({
    where: {
      ...(consulta.productId ? { productId: consulta.productId } : {}),
      ...(consulta.patientId ? { patientId: consulta.patientId } : {}),
      ...(consulta.type ? { type: consulta.type } : {}),
      ...(consulta.desde || consulta.hasta
        ? {
            occurredAt: {
              ...(consulta.desde ? { gte: consulta.desde } : {}),
              ...(consulta.hasta ? { lt: consulta.hasta } : {}),
            },
          }
        : {}),
    },
    include: {
      product: { select: { id: true, name: true, unit: true, kind: true } },
      patient: { select: { id: true, fullName: true } },
      createdBy: { select: { fullName: true } },
      /**
       * Si alguien ya lo corrigió.
       *
       * Va en el listado para que la fila se pinte como corregida y no se
       * ofrezca corregirla otra vez. Sin esto, el botón invitaría a hacer algo
       * que el servidor va a rechazar, que es la peor clase de botón.
       */
      correction: { select: { id: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: consulta.take ?? 100,
  });

  return filas.map(({ correction, ...fila }) => ({
    ...fila,
    corregido: correction !== null,
  }));
}

/**
 * Un movimiento mal anotado se borra, no se edita.
 *
 * Igual que con los pagos: el movimiento es un hecho. Cambiarle la cantidad
 * dejaría el historial contando lo que se quiso que pasara. Como la existencia
 * se calcula, quitarlo la devuelve sola a su sitio.
 */
/**
 * Corrige un movimiento mal anotado SIN borrarlo.
 *
 * Un movimiento es un hecho: alguien contó algo un día y lo escribió. Borrarlo
 * no deshace el error, lo esconde — y al día siguiente nadie puede responder
 * «¿por qué el conteo no cuadra?» porque la pista ya no está. Así que se anota
 * otro movimiento en sentido contrario, con la misma cantidad, y la existencia
 * vuelve sola a su sitio porque se calcula sumando. En el historial quedan los
 * dos: lo que se anotó y la corrección.
 *
 * Es lo mismo que hace la contabilidad con un asiento equivocado, y por la
 * misma razón.
 *
 * Ojo: esto NO revive un movimiento corregido. Corregir dos veces el mismo
 * movimiento sumaría dos veces, así que se comprueba antes.
 */
export async function corregirMovimiento(id: string, motivo?: string, usuarioId?: string) {
  const original = await prisma.stockMove.findUnique({
    where: { id },
    select: {
      id: true, productId: true, type: true, quantity: true,
      occurredAt: true, reason: true, invoiceId: true,
    },
  });
  if (!original) throw HttpError.notFound('Movimiento no encontrado');

  const yaCorregido = await prisma.stockMove.count({
    where: { correctsId: id },
  });
  if (yaCorregido > 0) {
    throw HttpError.unprocessable('Ese movimiento ya está corregido.');
  }

  if (original.reason === StockMoveReason.CORRECCION) {
    throw HttpError.unprocessable(
      'Ese ya es un movimiento de corrección. Si quedó mal, registra el ajuste que falte.',
    );
  }

  const alReves =
    original.type === StockMoveType.ENTRADA ? StockMoveType.SALIDA : StockMoveType.ENTRADA;

  return prisma.stockMove.create({
    data: {
      productId: original.productId,
      type: alReves,
      reason: StockMoveReason.CORRECCION,
      quantity: original.quantity,
      // La corrección pasa HOY, no el día del original: es cuando alguien se
      // dio cuenta. Fechar la corrección hacia atrás cambiaría lo que decía el
      // inventario en un día que ya se cerró.
      occurredAt: new Date(),
      correctsId: original.id,
      notes: motivo?.trim() || 'Corrige un movimiento mal registrado',
      createdById: usuarioId ?? null,
    },
    include: {
      product: { select: { id: true, name: true, unit: true } },
      createdBy: { select: { fullName: true } },
    },
  });
}

/* ------------------------------------------------------------------ *
 * Avisos
 * ------------------------------------------------------------------ */

/**
 * Lotes que vencen pronto.
 *
 * Sale de las ENTRADAS, no de la existencia: el sistema no sigue el rastro de
 * qué lote se usó, así que esto no dice «te quedan 3 del lote que vence», dice
 * «recibiste este lote y vence pronto, andá a mirar el estante». Para un centro
 * pequeño es lo que hace falta; una trazabilidad real por lote es otro sistema.
 */
export function lotesPorVencer(dias = 60) {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  return prisma.stockMove.findMany({
    where: {
      type: StockMoveType.ENTRADA,
      expiresAt: { not: null, lte: limite },
      product: { active: true },
    },
    include: { product: { select: { id: true, name: true, unit: true } } },
    orderBy: { expiresAt: 'asc' },
    take: 50,
  });
}

/**
 * Productos activos a los que nadie les puso precio de venta.
 *
 * No es un detalle cosmético: sin precio, lo que sale como venta no deja
 * registrado cuánto valía, y el inventario no se puede valorar. Se descubre al
 * cuadrar el mes, que es el peor momento para ir a buscar precios.
 *
 * Va aparte del listado y sin filtros a propósito: el aviso habla del catálogo
 * entero, no de lo que haya quedado en pantalla después de buscar.
 */
export function productosSinPrecio() {
  return prisma.product.findMany({
    where: { active: true, salePrice: null },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });
}

/** Lo que se le aplicó a un paciente, para la ficha y para el historial. */
export function consumoDelPaciente(patientId: string, take = 100) {
  return prisma.stockMove.findMany({
    where: { patientId, type: StockMoveType.SALIDA },
    include: { product: { select: { id: true, name: true, unit: true, kind: true } } },
    orderBy: { occurredAt: 'desc' },
    take,
  });
}
