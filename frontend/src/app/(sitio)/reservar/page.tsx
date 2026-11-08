import type { Metadata } from 'next';
import { BookingWizard } from '@/components/booking/BookingWizard';
import { getClinic, getService } from '@/lib/api';
import { CITA } from '@/lib/agenda';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Reservar cita',
  description: `Reserve su consulta en ${SITE.name}, ${SITE.city}. Elija día y hora en línea entre los horarios libres.`,
};

/** La disponibilidad cambia a cada minuto: esta página nunca se cachea. */
export const dynamic = 'force-dynamic';

export default async function ReservarPage({
  searchParams,
}: {
  /** `inicio`: hora elegida en la portada. `tratamiento`: llegó desde la página de un servicio. */
  searchParams: { inicio?: string; tratamiento?: string };
}) {
  const [clinic, servicio] = await Promise.all([
    getClinic(),
    searchParams.tratamiento ? getService(searchParams.tratamiento) : Promise.resolve(null),
  ]);
  const inicio =
    searchParams.inicio && !Number.isNaN(Date.parse(searchParams.inicio)) ? searchParams.inicio : undefined;

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <span className="eyebrow justify-center">Reserva en línea</span>
          <h1 className="mt-4 text-[clamp(2.3rem,4.6vw,3.4rem)] leading-[1.06]">
            Reserve su <em className="font-normal italic text-brand-600">consulta</em>
          </h1>
          <p className="lead mt-4">
            {CITA.nombre} de {CITA.duracionMin} minutos. Los horarios que ve son los que están libres de
            verdad en la agenda del centro.
          </p>
        </div>
        <BookingWizard whatsappLink={clinic.whatsappLink} inicio={inicio} interesadoEn={servicio?.name} />
      </div>
    </div>
  );
}
