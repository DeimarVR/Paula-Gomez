import { prisma } from '../lib/prisma';
import * as inventario from '../modules/inventario/inventario.service';

/**
 * Lo que hay que mirar hoy, y qué parte de eso ya se vio.
 *
 * ── Por qué esto no se resuelve con un «leído» y ya ──────────────────────
 *
 * Estos avisos no son mensajes: son ESTADOS. «60 productos están en el mínimo»
 * no pasa una vez, es verdad todos los días hasta que alguien compre. Un
 * contador que nunca baja se vuelve parte del decorado en una semana, y el día
 * que de verdad importe nadie lo va a mirar.
 *
 * Pero marcarlo como leído a secas tampoco sirve: escondería el aviso mientras
 * sigue siendo cierto, y el producto número 61 que caiga al mínimo entraría en
 * silencio.
 *
 * Así que lo que se guarda no es «leí el aviso», es QUÉ se vio: la lista de
 * productos concretos que estaban en cada situación. El contador solo cuenta lo
 * que no está en esa lista. Si mañana cae otro producto, aparece él solo. Si uno
 * se repone y sale de la lista, no se avisa de nada — es una buena noticia y no
 * necesita interrumpir.
 *
 * Se guarda por usuario, en `settings`, porque cada quien mira su campana. No
 * hace falta una tabla para esto: es una lista corta de texto por persona.
 */

export type Gravedad = 'alta' | 'media';

export interface Aviso {
  id: string;
  gravedad: Gravedad;
  titulo: string;
  detalle: string;
  /** Dónde se arregla. */
  href: string;
  /**
   * Una clave por cosa concreta: `agotado:prod_x`. Es lo que se marca como
   * visto, y lo que permite distinguir «esto ya lo sabía» de «esto es nuevo».
   */
  claves: string[];
  /** Cuántas de esas claves no se habían visto antes. */
  nuevos: number;
}

export interface Avisos {
  items: Aviso[];
  /** El número de la campana: solo lo que no se ha visto. */
  sinLeer: number;
  /** Si hay algo que mirar aunque ya se haya visto. */
  total: number;
}

/** Dónde se guarda lo que vio cada persona. */
const clave = (usuarioId: string) => `avisos_vistos:${usuarioId}`;

async function loQueYaVio(usuarioId: string): Promise<Set<string>> {
  const fila = await prisma.setting.findUnique({ where: { key: clave(usuarioId) } });
  if (!fila?.value) return new Set();
  try {
    const lista = JSON.parse(fila.value) as unknown;
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    // Un valor corrupto no puede tumbar la campana: se trata como «no vio nada».
    return new Set();
  }
}

/**
 * «Minoxidil, Shampoo y 3 más». Sin el corte, un aviso con sesenta productos
 * ocupa la campana entera y no se lee ninguno.
 */
function nombres(lista: string[], tope = 3): string {
  if (lista.length <= tope) return lista.join(', ');
  return `${lista.slice(0, tope).join(', ')} y ${lista.length - tope} más`;
}

export async function avisosDe(usuarioId: string): Promise<Avisos> {
  const [productos, lotes, vistos] = await Promise.all([
    inventario.listarInventario(),
    inventario.lotesPorVencer(),
    loQueYaVio(usuarioId),
  ]);

  const items: Aviso[] = [];

  /** Arma un aviso a partir de una lista de cosas, o no lo arma si está vacía. */
  function agregar(
    id: string,
    gravedad: Gravedad,
    prefijo: string,
    titulo: (cuantos: number) => string,
    cosas: Array<{ id: string; texto: string }>,
  ) {
    if (cosas.length === 0) return;
    const claves = cosas.map((c) => `${prefijo}:${c.id}`);
    items.push({
      id,
      gravedad,
      titulo: titulo(cosas.length),
      detalle: nombres(cosas.map((c) => c.texto)),
      href: '/admin/inventario',
      claves,
      nuevos: claves.filter((c) => !vistos.has(c)).length,
    });
  }

  /**
   * El orden es el de la urgencia real, no el de la tabla. Lo que ya no está es
   * lo primero: es lo único que frena una atención hoy.
   */
  agregar(
    'inventario-agotados',
    'alta',
    'agotado',
    (n) => (n === 1 ? 'Un producto se agotó' : `${n} productos se agotaron`),
    productos.filter((p) => p.stock === 0).map((p) => ({ id: p.id, texto: p.name })),
  );

  agregar(
    'inventario-vencidos',
    'alta',
    'vencido',
    (n) => (n === 1 ? 'Un producto está vencido' : `${n} productos están vencidos`),
    productos.filter((p) => p.vencido).map((p) => ({ id: p.id, texto: p.name })),
  );

  agregar(
    'inventario-bajos',
    'media',
    'bajo',
    (n) => (n === 1 ? 'Un producto está en el mínimo' : `${n} productos están en el mínimo`),
    productos
      .filter((p) => p.bajo && p.stock > 0)
      .map((p) => ({ id: p.id, texto: `${p.name} (${p.stock})` })),
  );

  agregar(
    'inventario-por-vencer',
    'media',
    'porvencer',
    (n) => (n === 1 ? 'Un lote vence pronto' : `${n} lotes vencen pronto`),
    lotes.map((l) => ({ id: l.id, texto: l.product.name })),
  );

  agregar(
    'inventario-negativos',
    'media',
    'negativo',
    (n) =>
      n === 1 ? 'Un producto quedó en negativo' : `${n} productos quedaron en negativo`,
    productos.filter((p) => p.stock < 0).map((p) => ({ id: p.id, texto: `${p.name} (${p.stock})` })),
  );

  /**
   * Se olvida lo que ya no está pasando.
   *
   * Sin esto, un producto que se agota, se repone y se vuelve a agotar NO
   * avisaba la segunda vez: su clave seguía guardada de la primera. Y era el
   * caso normal —los productos se acaban y se compran todo el tiempo—, así que
   * la campana se iba quedando muda sola.
   *
   * Al limpiar, cuando el producto vuelve a caer su clave ya no está en la
   * lista y cuenta como nuevo, que es lo que uno espera. Solo se escribe si de
   * verdad sobraba algo: esto se consulta cada cinco minutos y no tiene sentido
   * tocar la base para guardar lo mismo.
   */
  const presentes = new Set(items.flatMap((aviso) => aviso.claves));
  if ([...vistos].some((c) => !presentes.has(c))) {
    const limpio = [...vistos].filter((c) => presentes.has(c));
    await prisma.setting.upsert({
      where: { key: clave(usuarioId) },
      create: { key: clave(usuarioId), value: JSON.stringify(limpio) },
      update: { value: JSON.stringify(limpio) },
    });
  }

  return {
    items,
    sinLeer: items.reduce((suma, aviso) => suma + aviso.nuevos, 0),
    total: items.reduce((suma, aviso) => suma + aviso.claves.length, 0),
  };
}

/**
 * Marca como visto. Sin `claves`, marca todo lo que hay ahora mismo.
 *
 * Lo que se guarda es EXACTAMENTE lo que está pasando hoy, no lo de antes más
 * lo de hoy: así la lista no crece para siempre y un producto que se agotó,
 * se repuso y se vuelve a agotar avisa otra vez, que es lo correcto.
 */
export async function marcarVistos(usuarioId: string, claves?: string[]): Promise<Avisos> {
  const actuales = await avisosDe(usuarioId);
  const todas = actuales.items.flatMap((aviso) => aviso.claves);

  const aGuardar = claves?.length
    ? // Marcar solo un aviso: se conserva lo que ya estaba visto de los demás,
      // limitado a lo que sigue existiendo hoy.
      [...new Set([...(await loQueYaVio(usuarioId)), ...claves])].filter((c) => todas.includes(c))
    : todas;

  await prisma.setting.upsert({
    where: { key: clave(usuarioId) },
    create: { key: clave(usuarioId), value: JSON.stringify(aGuardar) },
    update: { value: JSON.stringify(aGuardar) },
  });

  return avisosDe(usuarioId);
}
