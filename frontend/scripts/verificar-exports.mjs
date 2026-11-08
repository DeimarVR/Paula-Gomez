/**
 * Comprueba que todo lo que se importa de un módulo del proyecto exista.
 *
 * Nace de un error real: al mover unos ayudantes de un archivo a otro por
 * posición, la tajada se llevó una función vecina. El archivo seguía siendo
 * TypeScript válido, así que ni el chequeo de sintaxis ni una lectura por
 * encima lo veían; solo reventaba al abrir la página.
 *
 * `tsc` lo detecta, pero no siempre se puede correr —el cliente de Prisma
 * puede no estar regenerado— y ahí este chequeo sigue sirviendo.
 *
 * Uso: npm run check:exports
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative, resolve } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(raiz, 'src');

function* recorrer(directorio) {
  for (const entrada of readdirSync(directorio)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta);
    else if (['.ts', '.tsx'].includes(extname(ruta))) yield ruta;
  }
}

/** Resuelve "@/lib/format" al archivo real, probando las extensiones. */
function resolver(especificador, desde) {
  let base;
  if (especificador.startsWith('@/')) base = join(src, especificador.slice(2));
  else if (especificador.startsWith('.')) base = resolve(dirname(desde), especificador);
  else return null; // paquete de node_modules: fuera de alcance

  for (const candidato of [
    `${base}.ts`, `${base}.tsx`,
    join(base, 'index.ts'), join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidato)) return candidato;
  }
  return null;
}

/**
 * Nombres exportados de un archivo.
 *
 * Se cubren las formas que usa el proyecto: `export function|const|class|
 * interface|type|enum X`, `export { a, b }` y `export { a } from './x'`. Un
 * `export *` hace que el archivo se dé por bueno entero, porque seguir la
 * cadena aquí sería reimplementar el resolvedor de módulos.
 */
function exportacionesDe(archivo, vistos = new Set()) {
  if (vistos.has(archivo)) return { nombres: new Set(), comodin: false };
  vistos.add(archivo);

  const texto = readFileSync(archivo, 'utf8');
  const nombres = new Set();
  let comodin = /export\s+\*\s+from/.test(texto);

  for (const m of texto.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    nombres.add(m[1]);
  }

  // export { a, b as c } [from '...']
  for (const m of texto.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g)) {
    for (const parte of m[1].split(',')) {
      const limpio = parte.trim().replace(/^type\s+/, '');
      if (!limpio) continue;
      const alias = limpio.split(/\s+as\s+/);
      nombres.add((alias[1] ?? alias[0]).trim());
    }
  }

  if (/export\s+default/.test(texto)) nombres.add('default');
  return { nombres, comodin };
}

const cache = new Map();
const problemas = [];

for (const archivo of recorrer(src)) {
  const texto = readFileSync(archivo, 'utf8');

  for (const m of texto.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const destino = resolver(m[2], archivo);
    if (!destino) continue;

    if (!cache.has(destino)) cache.set(destino, exportacionesDe(destino));
    const { nombres, comodin } = cache.get(destino);
    if (comodin) continue;

    for (const parte of m[1].split(',')) {
      const limpio = parte.trim().replace(/^type\s+/, '');
      if (!limpio) continue;
      const pedido = limpio.split(/\s+as\s+/)[0].trim();

      if (!nombres.has(pedido)) {
        problemas.push(
          `${relative(raiz, archivo)} importa "${pedido}" de "${m[2]}", ` +
            `pero ${relative(raiz, destino)} no lo exporta.`,
        );
      }
    }
  }
}

if (problemas.length > 0) {
  console.error(`\n✗ ${problemas.length} importación(es) rota(s):\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`✓ ${cache.size} módulos internos: todas las importaciones existen.`);
