import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { WhatsAppFab } from '@/components/site/WhatsAppFab';
import { AvisoCookies } from '@/components/site/AvisoCookies';
import { PageTransition } from '@/components/ui/PageTransition';
import { getClinic, getHorarioPublico } from '@/lib/api';

/**
 * El pie lleva el horario de atención, que sale de la base. Sin esto, las
 * páginas que no se regeneran solas (contacto, textos legales) mostrarían
 * para siempre el horario que había el día del despliegue.
 */
export const revalidate = 600;

/**
 * Envoltura de todas las páginas públicas: cabecera, pie y botón de WhatsApp.
 * El panel (/admin) usa su propio layout y no incluye nada de esto.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [clinic, horario] = await Promise.all([getClinic(), getHorarioPublico()]);

  return (
    <>
      <Header whatsappLink={clinic.whatsappLink} />
      <main id="contenido">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer clinic={clinic} horario={horario} />
      <WhatsAppFab href={clinic.whatsappLink} />
      <AvisoCookies />
    </>
  );
}
