'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/site/Logo';
import { api, setToken } from '@/lib/apiClient';
import { SITE } from '@/lib/config';
import type { AdminUser } from '@/lib/types';

/**
 * Acceso al panel del centro.
 *
 * Dos mitades en escritorio: a la izquierda el azul profundo con la marca, a
 * la derecha el formulario y nada más. En el celular queda solo el
 * formulario: es una pantalla de paso, no un lugar donde nadie se detiene a
 * leer.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.post<{ token: string; user: AdminUser }>(
        '/api/auth/login',
        { email, password },
        { auth: false },
      );
      setToken(data.token);
      router.replace('/admin');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="grain relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-on-deep lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-400)/0.28),transparent_70%)]"
        />
        <Logo variant="light" conLema />
        <div className="relative max-w-sm">
          <p className="eyebrow-deep">Panel del centro</p>
          <p className="mt-5 font-display text-[2.2rem] leading-[1.15] text-white">
            La agenda, los expedientes y los mensajes, <em className="text-accent-300">en un solo lugar.</em>
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-on-deep-muted">
          <ShieldCheck className="h-4 w-4 text-accent-400" strokeWidth={1.8} aria-hidden />
          Los datos de los pacientes solo se ven con sesión iniciada.
        </p>
      </aside>

      <main className="grid place-items-center px-5 py-12">
        <div className="w-full max-w-[24rem]">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-8 lg:mt-0">
            <h1 className="text-[2rem] leading-tight">Ingresar</h1>
            <p className="mt-2 text-[15px] text-muted">Con el correo y la contraseña de tu cuenta.</p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="field-label">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="field pl-11"
                  placeholder="nombre@correo.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field pl-11 pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Entrando…
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <p className="mt-6 text-[13px] leading-relaxed text-subtle">
            ¿Olvidaste tu contraseña? Pídele a quien administra el panel que te la restablezca.
          </p>

          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Volver al sitio de {SITE.name}
          </Link>
        </div>
      </main>
    </div>
  );
}
