/**
 * Busca componentes de React definidos DENTRO de otro componente.
 *
 * Es un error silencioso y caro: la función se vuelve a crear en cada render,
 * así que React la ve como un componente distinto, desmonta el subárbol y lo
 * monta de nuevo. En un formulario eso se siente como que el campo pierde el
 * foco a cada tecla y hay que volver a hacer clic. Nada revienta, no sale en
 * la consola, y el chequeo de sintaxis lo da por bueno.
 *
 * Ya pasó una vez en `FichaHoja`. Por eso está aquí.
 *
 * La regla: si una línea SANGRADA declara `function Mayuscula(`, está dentro
 * de algo. Los ayudantes en minúscula no cuentan: no son componentes.
 *
 * Uso: npm run check:componentes
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function* recorrer(directorio) {
  for (const entrada of readdirSync(directorio)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta);
    else if (extname(ruta) === '.tsx') yield ruta;
  }
}

const problemas = [];
let revisados = 0;

for (const ruta of recorrer(join(raiz, 'src'))) {
  revisados += 1;
  const lineas = readFileSync(ruta, 'utf8').split('\n');

  lineas.forEach((linea, indice) => {
    const anidado = /^\s+(?:function|const)\s+([A-Z]\w*)\s*(?:\(|=\s*(?:\(|function))/.exec(linea);
    if (anidado) problemas.push(`${relative(raiz, ruta)}:${indice + 1}  ${anidado[1]}`);
  });
}

if (problemas.length > 0) {
  console.error(`\n✗ ${problemas.length} componente(s) definido(s) dentro de otro:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error(
    '\nSácalos al nivel del módulo y pásales por props lo que tomaban del cierre.\n' +
      'Si no, React los remonta en cada render y los campos pierden el foco al escribir.\n',
  );
  process.exit(1);
}

console.log(`✓ ${revisados} componentes: ninguno definido dentro de otro.`);
