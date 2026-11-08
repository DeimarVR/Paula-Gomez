/**
 * Comprueba el schema de Prisma SIN necesitar red ni base de datos.
 *
 * Existe porque `prisma validate` descarga su motor de binaries.prisma.sh, y
 * en un entorno sin salida a internet eso no corre. Sin una alternativa, la
 * tentación es editar el schema a ciegas y descubrir el error en el deploy.
 *
 * Hoy detecta el fallo que ya nos costó un despliegue: una relación cuyo lado
 * opuesto quedó en el modelo equivocado. Prisma lo reporta como P1012 y no
 * deja migrar.
 *
 * Uso: npm run check:schema
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const texto = readFileSync(join(raiz, 'prisma/schema.prisma'), 'utf8');

/** Cuerpo de cada `model X { ... }`. */
const modelos = new Map();
for (const m of texto.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  modelos.set(m[1], m[2]);
}

/** Campos cuyo tipo es otro modelo: cada uno es un lado de una relación. */
const relaciones = new Map();
for (const [modelo, cuerpo] of modelos) {
  const campos = [];
  for (const linea of cuerpo.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('//') || limpia.startsWith('@@')) continue;

    const [nombre, tipo] = limpia.split(/\s+/);
    if (!tipo) continue;

    const base = tipo.replace(/[[\]?]/g, '');
    if (modelos.has(base)) campos.push({ nombre, destino: base, lista: tipo.endsWith('[]') });
  }
  relaciones.set(modelo, campos);
}

const problemas = [];
for (const [modelo, campos] of relaciones) {
  for (const campo of campos) {
    const opuestos = relaciones.get(campo.destino).filter((otro) => otro.destino === modelo);

    if (opuestos.length === 0) {
      problemas.push(
        `${modelo}.${campo.nombre} apunta a ${campo.destino}, pero ${campo.destino} no tiene ` +
          `ningún campo de vuelta hacia ${modelo}.`,
      );
      continue;
    }

    // Con más de un par entre los mismos dos modelos, Prisma exige nombrar la
    // relación para saber cuál va con cuál.
    if (opuestos.length > 1 && !cuerpoDeCampo(modelo, campo.nombre).includes('@relation("')) {
      problemas.push(
        `${modelo}.${campo.nombre}: hay ${opuestos.length} campos en ${campo.destino} que ` +
          `apuntan a ${modelo}. Cada pareja necesita @relation("nombre").`,
      );
    }
  }
}

function cuerpoDeCampo(modelo, nombre) {
  const linea = modelos
    .get(modelo)
    .split('\n')
    .find((l) => l.trim().split(/\s+/)[0] === nombre);
  return linea ?? '';
}

if (problemas.length > 0) {
  console.error(`\n✗ ${problemas.length} problema(s) de relaciones en el schema:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('\nPrisma va a rechazar la migración con el código P1012.\n');
  process.exit(1);
}

console.log(`✓ ${modelos.size} modelos, todas las relaciones con su lado opuesto.`);
