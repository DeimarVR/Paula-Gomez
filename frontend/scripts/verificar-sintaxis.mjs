/**
 * Parsea TODOS los .ts/.tsx de src/ y reporta errores de sintaxis.
 *
 * No reemplaza a `tsc`: no sabe nada de tipos. Sirve para el caso en que el
 * cliente de Prisma todavía no se ha regenerado y `npm run typecheck` no puede
 * correr — ahí esto sigue detectando un paréntesis sin cerrar o un JSX mal
 * escrito, que es cuando más fácil se cuela uno.
 *
 * Uso: npm run check:sintaxis
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative } from 'node:path';
import ts from 'typescript';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function* recorrer(directorio) {
  for (const entrada of readdirSync(directorio)) {
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta);
    else if (['.ts', '.tsx'].includes(extname(ruta))) yield ruta;
  }
}

let revisados = 0;
let conErrores = 0;

for (const ruta of recorrer(join(raiz, 'src'))) {
  revisados += 1;
  const texto = readFileSync(ruta, 'utf8');
  /**
   * El tipo tiene que salir de la extensión.
   *
   * Parseando un .ts como TSX, un genérico de función flecha —`<T>(x: T) => T`,
   * que aparece por todo apiClient.ts— se lee como una etiqueta JSX abierta y
   * el archivo entero se reporta como roto. Es un falso positivo, y un chequeo
   * que grita en archivos sanos deja de mirarse a los dos días.
   */
  const clase = extname(ruta) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.ESNext, true, clase);
  const errores = fuente.parseDiagnostics ?? [];

  if (errores.length > 0) {
    conErrores += 1;
    console.error(`\n✗ ${relative(raiz, ruta)}`);
    for (const error of errores.slice(0, 5)) {
      const { line, character } = fuente.getLineAndCharacterOfPosition(error.start);
      const mensaje = ts.flattenDiagnosticMessageText(error.messageText, ' ');
      console.error(`   ${line + 1}:${character + 1}  ${mensaje}`);
    }
  }
}

if (conErrores > 0) {
  console.error(`\n${conErrores} archivo(s) con errores de sintaxis.\n`);
  process.exit(1);
}

console.log(`✓ ${revisados} archivos de src/ sin errores de sintaxis.`);
