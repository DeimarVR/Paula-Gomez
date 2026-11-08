import type { Metadata, Viewport } from 'next';
/**
 * Newsreader para titulares y Figtree para el resto, como en la maqueta
 * «Sereno clínico».
 *
 * Se sirven desde el propio dominio (paquetes @fontsource) en vez de pedirlas
 * a Google. Es la misma regla que rige el resto del proyecto: el navegador no
 * habla con terceros. De paso, el build no depende de que la red alcance
 * fonts.gstatic.com.
 *
 * Solo el subconjunto latino (cubre tildes y eñes) y solo los pesos que se
 * usan: cada archivo de más es tiempo de carga en el celular de un paciente.
 *
 * Los nombres de familia se declaran en `globals.css` (--font-sans y
 * --font-display) y Tailwind los consume desde `fontFamily`.
 */
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import './globals.css';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline} en ${SITE.city}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    // Ajustar a la especialidad cuando se conozca.
    'consulta médica [CIUDAD]',
    '[ESPECIALIDAD] [CIUDAD]',
    'cita médica en línea [CIUDAD]',
    '[NOMBRE_CLÍNICA]',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: SITE.name,
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1F3A5F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        {/*
          Marca el documento como "con JavaScript" antes del primer pintado.
          Las animaciones de entrada dependen de esta clase, de modo que si el
          script no corre el contenido se ve igual, sin animación.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-800 focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
