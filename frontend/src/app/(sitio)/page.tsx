import { Hero } from '@/components/sections/Hero';
import { Valores } from '@/components/sections/Valores';
import { Treatments } from '@/components/sections/Treatments';
import { About } from '@/components/sections/About';
import { Process } from '@/components/sections/Process';
import { ReservaRapida } from '@/components/sections/ReservaRapida';
import { Testimonials } from '@/components/sections/Testimonials';
import { Visitenos } from '@/components/sections/Visitenos';
import { Preguntas } from '@/components/sections/Preguntas';
import { CallToAction } from '@/components/sections/CallToAction';
import { TrackingTeaser } from '@/components/sections/TrackingTeaser';
import { FUNCIONES, SITE, SOCIAL } from '@/lib/config';
import {
  getClinic,
  getHorarioPublico,
  getHuecosDeLaSemana,
  getImagenesDelSitio,
  getServices,
  getTestimonials,
} from '@/lib/api';

/** La portada se regenera cada 5 minutos: lo justo para que «horarios libres» no envejezca. */
export const revalidate = 300;

/** Día de la semana de hoy en la zona del centro, para resaltar el horario de hoy. */
function diaDeHoy(): number {
  const nombre = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.CLINIC_TIMEZONE || 'America/Bogota',
    weekday: 'short',
  }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nombre);
}

/**
 * La portada, en el orden de la maqueta «Sereno clínico»: qué promete el
 * centro, qué ofrece, quién atiende, cómo funciona la cita, reservar, qué dicen
 * los pacientes, dónde queda y las dudas de siempre.
 */
export default async function HomePage() {
  const [clinic, services, testimonials, imagenes, horario, huecos] = await Promise.all([
    getClinic(),
    getServices(),
    getTestimonials(),
    getImagenesDelSitio(),
    getHorarioPublico(),
    getHuecosDeLaSemana(),
  ]);

  // Datos estructurados para que Google entienda que es un centro médico local.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.name,
    description: SITE.description,
    url: SITE.url,
    telephone: `+${clinic.whatsapp}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.city,
      addressCountry: 'CO',
      streetAddress: clinic.address,
    },
    sameAs: SOCIAL.map((red) => red.url).filter((url) => url.startsWith('http')),
    availableService: services.map((service) => ({
      '@type': 'MedicalProcedure',
      name: service.name,
      description: service.shortDesc,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Hero whatsappLink={clinic.whatsappLink} imageUrl={imagenes.hero ?? undefined} huecosDeLaSemana={huecos} />
      <Valores />
      <Treatments services={services} />
      <About imageUrl={imagenes.nosotros ?? undefined} />
      <Process />
      {FUNCIONES.seguimientoPaciente && <TrackingTeaser />}
      <ReservaRapida />
      <Testimonials testimonials={testimonials} />
      <Visitenos clinic={clinic} horario={horario} hoy={diaDeHoy()} />
      <Preguntas whatsappLink={clinic.whatsappLink} />
      <CallToAction whatsappLink={clinic.whatsappLink} />
    </>
  );
}
