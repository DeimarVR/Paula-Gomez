import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-20">
      <div className="max-w-md text-center">
        <p className="font-display text-6xl text-brand-300">404</p>
        <h1 className="mt-6 text-3xl">Esta página no existe</h1>
        <p className="mt-4 leading-relaxed text-muted">
          Puede que el enlace esté incompleto o que la página se haya movido.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">
            Volver al inicio
          </Link>
          <Link href="/reservar" className="btn-outline">
            Reservar una cita
          </Link>
        </div>
      </div>
    </div>
  );
}
