import type { Metadata } from 'next';
import Link from 'next/link';
import { ManageAppointment } from '@/components/booking/ManageAppointment';
import { getAppointmentByToken } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Su cita',
  description: 'Confirme, cambie la hora o cancele su cita.',
  robots: { index: false, follow: false },
};

/** Contiene datos de una cita concreta: nunca se cachea ni se indexa. */
export const dynamic = 'force-dynamic';

export default async function CitaPage({ params }: { params: { token: string } }) {
  const appointment = await getAppointmentByToken(params.token);

  if (!appointment) {
    return (
      <div className="pb-24 pt-10 sm:pt-14">
        <div className="shell mx-auto max-w-lg text-center">
          <h1 className="text-3xl">No encontramos esa cita</h1>
          <p className="mt-4 leading-relaxed text-muted">
            El enlace puede estar incompleto o la cita pudo haber sido eliminada. Escríbanos por
            WhatsApp y la revisamos con usted.
          </p>
          <Link href="/reservar" className="btn-primary mt-8">
            Agendar una cita
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell">
        <ManageAppointment appointment={appointment} token={params.token} />
      </div>
    </div>
  );
}
