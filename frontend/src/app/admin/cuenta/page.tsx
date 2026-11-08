'use client';

import { useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, PenLine, UserRound } from 'lucide-react';
import { FirmaPad } from '@/components/admin/FirmaPad';
import { api, ApiError } from '@/lib/apiClient';

interface Cuenta {
  id: string;
  email: string;
  fullName: string;
  role: string;
  signature: string | null;
}

/**
 * Mi cuenta: la firma del profesional y la contraseña.
 *
 * La firma se guarda una sola vez y de aquí sale para todos los documentos que
 * la piden —la factura y cada sesión del control de pacientes—. El centro tiene
 * un solo profesional, así que redibujarla cada vez era trabajo repetido.
 *
 * La del PACIENTE no se guarda nunca: esa se dibuja en el momento, en el
 * teléfono o la tablet, porque es su consentimiento de ese día y no puede
 * quedar precargada.
 */
export default function CuentaPage() {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [nombre, setNombre] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ user: Cuenta }>('/api/auth/me')
      .then((datos) => {
        setCuenta(datos.user);
        setNombre(datos.user.fullName);
        setFirma(datos.user.signature);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar tu cuenta'),
      );
  }, []);

  async function guardar() {
    setError(null);
    setGuardado(false);

    if (nombre.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      const datos = await api.put<{ user: Cuenta }>('/api/auth/me', {
        fullName: nombre.trim(),
        signature: firma,
      });
      setCuenta(datos.user);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  if (!cuenta) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">Mi cuenta</h1>
      <p className="mt-2 text-muted">
        {cuenta.email} · <span className="capitalize">{cuenta.role.toLowerCase()}</span>
      </p>

      {error && <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>}

      {/* ---- Nombre ------------------------------------------------------ */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <UserRound className="mt-1 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
          <div>
            <h2 className="font-display text-lg">Nombre</h2>
            <p className="mt-1 text-sm text-muted">
              Es el que aparece bajo tu firma en los documentos y el que ve el resto del panel.
            </p>
          </div>
        </div>

        <div className="mt-4 max-w-md">
          <label htmlFor="nombre" className="sr-only">Nombre completo</label>
          <input
            id="nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
          />
        </div>

        <p className="mt-3 text-xs text-muted">
          El correo y el rol no se cambian desde aquí: con el correo se entra, y el rol es el
          permiso. Eso lo ajusta un administrador.
        </p>
      </section>

      {/* ---- Firma ------------------------------------------------------ */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <PenLine className="mt-1 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
          <div>
            <h2 className="font-display text-lg">Mi firma</h2>
            <p className="mt-1 text-sm text-muted">
              Se guarda una vez y sale sola en los consentimientos y en cada nota del
              expediente. Lo mejor es subir una foto de tu firma en papel: dibujada con el mouse
              siempre sale torcida.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <FirmaPad valor={firma} onCambio={setFirma} />
        </div>

      </section>

      {/* Un solo botón para nombre y firma: son la misma pantalla y guardar
          por separado obliga a acordarse de darle dos veces. */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="btn-primary disabled:pointer-events-none disabled:opacity-60"
        >
          {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Guardar cambios
        </button>
        {guardado && (
          <span className="flex items-center gap-1.5 text-sm text-ok">
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Guardado
          </span>
        )}
      </div>

      <CambiarContrasena />
    </div>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const casilla =
    'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25';

  async function cambiar() {
    setError(null);
    setListo(false);

    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: actual,
        newPassword: nueva,
      });
      setListo(true);
      setActual('');
      setNueva('');
      setRepetida('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'No pudimos cambiar la contraseña.',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-1 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
        <div>
          <h2 className="font-display text-lg">Cambiar contraseña</h2>
          <p className="mt-1 text-sm text-muted">Mínimo 8 caracteres.</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>}
      {listo && (
        <p className="mt-4 rounded-xl bg-ok-bg px-4 py-3 text-sm text-ok">
          Contraseña actualizada.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="pass-actual" className="mb-1.5 block text-sm font-medium">Actual</label>
          <input id="pass-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} className={casilla} />
        </div>
        <div>
          <label htmlFor="pass-nueva" className="mb-1.5 block text-sm font-medium">Nueva</label>
          <input id="pass-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={casilla} />
        </div>
        <div>
          <label htmlFor="pass-rep" className="mb-1.5 block text-sm font-medium">Repetir</label>
          <input id="pass-rep" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} className={casilla} />
        </div>
      </div>

      <button
        type="button"
        onClick={cambiar}
        disabled={guardando}
        className="btn-primary mt-5 disabled:pointer-events-none disabled:opacity-60"
      >
        {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Cambiar contraseña
      </button>
    </section>
  );
}
