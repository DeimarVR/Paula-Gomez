import type { Metadata } from 'next';
import Link from 'next/link';
import { OfertaDeHueco, type DatosOferta } from '@/components/booking/OfertaDeHueco';
import { getOferta } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Espacio disponible',
  description: 'Se liberó un espacio en la agenda.',
  robots: { index: false, follow: false },
};

/** Cambia con cada clic de cualquiera de los invitados: nunca se cachea. */
export const dynamic = 'force-dynamic';

export default async function OfertaPage({ params }: { params: { token: string } }) {
  const oferta = (await getOferta(params.token)) as DatosOferta | null;

  return (
    <div className="pb-24 pt-10 sm:pt-16">
      <div className="shell">
        <div className="mx-auto max-w-xl rounded-[22px] border border-line bg-surface p-6 shadow-[0_2px_4px_rgb(var(--ink)/0.04),0_36px_64px_-32px_rgb(var(--ink)/0.4)] sm:p-9">
          {oferta ? (
            <OfertaDeHueco token={params.token} oferta={oferta} />
          ) : (
            <div className="text-center">
              <h1 className="text-[clamp(1.9rem,4vw,2.4rem)]">Este enlace no es válido</h1>
              <p className="lead mt-3">Puede estar incompleto. Si tenía una cita, sigue igual.</p>
              <Link href="/" className="btn-outline mt-7">
                Ir al inicio
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
