/**
 * Texto de arranque para un consentimiento informado nuevo.
 *
 * No es «el» consentimiento del centro: es un punto de partida para que la
 * pantalla no empiece en blanco, con la estructura que suelen pedir estos
 * documentos. Se edita entero desde el panel, y debería revisarlo el abogado
 * del centro antes de usarlo con pacientes: el contenido clínico y las
 * declaraciones legales son responsabilidad de quien firma como prestador, no
 * del software.
 *
 * El formato es el mismo que entiende el generador del PDF, y son solo dos
 * reglas: una línea entera EN MAYÚSCULAS sale como título de sección, y una
 * línea que empieza por «-» sale como viñeta.
 */
export const CONSENTIMIENTO_BASE = `NATURALEZA DEL PROCEDIMIENTO
Describa aquí en qué consiste el procedimiento, cómo se realiza, cuánto dura y cuántas sesiones suelen necesitarse.

BENEFICIOS ESPERADOS
Explique qué resultados se buscan y en qué plazo suelen verse. Deje claro que los resultados varían de una persona a otra y que ningún resultado puede garantizarse.

RIESGOS Y COMPLICACIONES POSIBLES
Enumere los riesgos propios del procedimiento. Por ejemplo:
- Enrojecimiento, inflamación o sensibilidad en la zona tratada durante los primeros días.
- Pequeños hematomas o costras que ceden de forma espontánea.
- Reacción alérgica a alguno de los productos utilizados.
- Infección local, poco frecuente cuando se siguen los cuidados indicados.
- Resultado por debajo de lo esperado, que puede requerir sesiones adicionales.

ALTERNATIVAS
Indique qué otras opciones existen, incluida la de no realizar ningún procedimiento, y qué consecuencias tiene cada una.

CUIDADOS ANTES Y DESPUÉS
Anote las indicaciones que el paciente debe seguir antes y después de la sesión, y las señales por las que debería comunicarse con el centro.

REGISTRO FOTOGRÁFICO
Autorizo al centro a tomar fotografías clínicas de la zona tratada, antes y después del procedimiento, con el fin de hacer seguimiento de mi evolución. Estas imágenes forman parte de mi historia clínica y son confidenciales.

Su uso con cualquier otra finalidad —académica, científica o de divulgación— requiere una autorización adicional, escrita y separada de este documento.

TRATAMIENTO DE DATOS PERSONALES
Autorizo el tratamiento de mis datos personales y de mis datos sensibles de salud conforme a la Ley 1581 de 2012 y sus normas reglamentarias, con la finalidad de recibir atención, hacer seguimiento clínico, gestionar mis citas y cumplir las obligaciones legales del prestador.

Conozco que puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta autorización, escribiendo al centro.

DECLARACIONES DEL PACIENTE
- He leído este documento en su totalidad y lo he comprendido.
- Se me explicó el procedimiento en un lenguaje que entiendo, y pude hacer todas las preguntas que quise.
- Informé de forma veraz sobre mis antecedentes médicos, alergias, medicamentos que tomo y tratamientos previos.
- Entiendo que la medicina no es una ciencia exacta y que no se me ha garantizado ningún resultado concreto.
- Sé que puedo revocar este consentimiento en cualquier momento, antes de que el procedimiento se realice, sin que ello afecte la atención que recibo.

REVOCACIÓN
La revocación debe manifestarse al equipo del centro y quedará registrada en mi historia clínica.`;
