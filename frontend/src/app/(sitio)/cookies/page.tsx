import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Política de cookies',
  description:
    'Qué cookies usa el sitio de [NOMBRE_CLÍNICA]: solo una cookie técnica de sesión para el panel del centro. Sin analítica ni publicidad.',
};

/**
 * Política de cookies.
 *
 * El sitio usa UNA cookie y es técnica. Este documento existe para poder
 * afirmarlo por escrito, no para pedir un consentimiento que aquí no hace
 * falta: la normativa exime a las cookies estrictamente necesarias para
 * prestar el servicio, y no hay ninguna otra.
 *
 * Si algún día se agrega analítica, publicidad o un vídeo incrustado, esto
 * deja de ser cierto y entonces sí hay que pedir consentimiento antes de
 * cargarlas. La lista de abajo es el sitio donde se nota.
 */
export default function CookiesPage() {
  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell mx-auto max-w-3xl">
        <h1 className="text-4xl leading-tight sm:text-5xl">Política de cookies</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Qué se guarda en tu navegador cuando visitas {SITE.name}, y por qué.
        </p>

        <div className="mt-12 space-y-10 leading-relaxed text-ink/90">
          <section className="rounded-2xl bg-brand-50 p-6 sm:p-8">
            <h2 className="font-display text-2xl">En resumen</h2>
            <p className="mt-3">
              Este sitio <strong>no usa cookies de analítica, de publicidad ni de seguimiento</strong>
              . No hay Google Analytics, no hay píxel de Meta, no compartimos tu navegación con
              nadie. La única cookie que existe es técnica y solo aparece si trabajas en el centro y
              entras al panel de administración.
            </p>
            <p className="mt-3">
              Por eso no verás un aviso de cookies pidiéndote permiso: no hay nada que consentir.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">1. Qué es una cookie</h2>
            <p className="mt-3">
              Un archivo pequeño que un sitio guarda en tu navegador y que puede volver a leer
              después. Sirve para recordar cosas entre una página y la siguiente —por ejemplo, que ya
              iniciaste sesión— y también, en muchos sitios, para seguir a los visitantes por
              internet. Aquí solo se usa para lo primero.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">2. La única cookie que usamos</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="py-3 pr-4 font-medium text-muted">Nombre</th>
                    <th scope="col" className="py-3 pr-4 font-medium text-muted">Para qué</th>
                    <th scope="col" className="py-3 pr-4 font-medium text-muted">Cuánto dura</th>
                    <th scope="col" className="py-3 font-medium text-muted">Quién la pone</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line/60 align-top">
                    <td className="py-4 pr-4 font-mono text-xs">token</td>
                    <td className="py-4 pr-4">
                      Mantiene la sesión de quien trabaja en el centro y permite que el panel muestre
                      las fotos clínicas, que están protegidas.
                    </td>
                    <td className="py-4 pr-4">8 horas</td>
                    <td className="py-4">Este sitio</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Se crea al iniciar sesión en el panel y se borra al cerrarla. Si solo visitas el sitio
              como paciente, nunca llega a existir.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">3. Contenido de terceros</h2>
            <p className="mt-3">
              En la portada se muestran las últimas publicaciones de nuestro Instagram. Las traemos
              desde nuestro propio servidor y mostramos únicamente las imágenes: no se carga ningún
              componente de Instagram que pueda leer o escribir cookies en tu navegador.
            </p>
            <p className="mt-3">
              Si pulsas un enlace a Instagram, a WhatsApp o a Google Maps, sales de este sitio y a
              partir de ahí se aplican las políticas de esos servicios, que sí usan cookies propias.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">4. Cómo controlarlas</h2>
            <p className="mt-3">
              Todos los navegadores permiten ver, bloquear y borrar cookies desde sus ajustes de
              privacidad. Bloquear la de este sitio no afecta a la navegación como paciente; solo
              impediría iniciar sesión en el panel del centro.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl">5. Si esto cambia</h2>
            <p className="mt-3">
              Si en el futuro añadimos analítica o cualquier herramienta que use cookies no
              esenciales, actualizaremos esta página y pediremos tu consentimiento antes de
              activarlas, no después.
            </p>
            <p className="mt-3">
              Sobre el resto de tus datos —los que nos dejas al reservar y los de tu historia
              clínica— está la{' '}
              <Link href="/politica-de-datos" className="underline underline-offset-2">
                política de tratamiento de datos
              </Link>
              .
            </p>
          </section>
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm text-muted">
          Última actualización: {new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}
        </p>
      </div>
    </div>
  );
}
