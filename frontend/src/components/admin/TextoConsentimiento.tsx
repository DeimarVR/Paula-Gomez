/**
 * El texto de un consentimiento, con el mismo formato que tendrá impreso.
 *
 * Existe para que lo que se lee en pantalla y lo que sale en el PDF sean la
 * misma cosa. Antes había que abrir el PDF en otra pestaña para leerlo, y en
 * el momento de firmar eso significaba dejar al paciente mirando un visor de
 * archivos mientras alguien buscaba la pestaña correcta.
 *
 * Las convenciones son las dos que entiende el generador del PDF, y ninguna
 * hay que aprenderla: una línea entera en mayúsculas es un título, y una que
 * empieza por «-», «*» o «•» es una viñeta.
 */
export function TextoConsentimiento({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink/85">
      {lineas.map((cruda, indice) => {
        const linea = cruda.trim();
        const clave = `${indice}-${linea.slice(0, 24)}`;

        if (!linea) return <div key={clave} className="h-2" aria-hidden />;

        if (/^[-*•]\s+/.test(linea)) {
          return (
            <div key={clave} className="flex gap-2 pl-1">
              <span className="text-muted" aria-hidden>
                •
              </span>
              <span>{linea.replace(/^[-*•]\s+/, '')}</span>
            </div>
          );
        }

        const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
        const esTitulo = letras.length >= 3 && letras === letras.toUpperCase() && linea.length <= 90;

        if (esTitulo) {
          return (
            <h3 key={clave} className="pt-3 font-display text-sm tracking-wide text-brand-800">
              {linea}
            </h3>
          );
        }

        return <p key={clave}>{linea}</p>;
      })}
    </div>
  );
}
