'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, clearToken, getToken } from '@/lib/apiClient';
import type { AdminUser } from '@/lib/types';

interface AuthGuardProps {
  children: (user: AdminUser) => React.ReactNode;
}

/**
 * Verifica la sesión contra la API antes de renderizar el panel.
 *
 * No basta con que exista un token en `localStorage`: puede estar vencido o
 * pertenecer a un usuario desactivado. Por eso se valida siempre con /auth/me.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!getToken()) {
        router.replace('/admin/login');
        return;
      }

      try {
        const data = await api.get<{ user: AdminUser }>('/api/auth/me');
        if (!cancelled) {
          setUser(data.user);
          setChecking(false);
        }
      } catch {
        clearToken();
        router.replace('/admin/login');
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden />
        <span className="sr-only">Verificando sesión…</span>
      </div>
    );
  }

  return <>{children(user)}</>;
}
