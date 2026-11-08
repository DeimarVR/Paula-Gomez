'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Stethoscope,
  ClipboardList,
  FileSignature,
  Images,
  LayoutDashboard,
  Lock,
  Mails,
  Package,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Users,
  X,
} from 'lucide-react';
import { Asistente } from '@/components/admin/Asistente';
import { AuthGuard } from '@/components/admin/AuthGuard';
import { BuscadorRapido } from '@/components/admin/BuscadorRapido';
import { CampanaAvisos } from '@/components/admin/CampanaAvisos';
import { Logo, LogoMark } from '@/components/site/Logo';
import { api, clearToken } from '@/lib/apiClient';
import { FUNCIONES } from '@/lib/config';
import { iniciales } from '@/lib/format';
import type { Role } from '@/lib/types';

/**
 * Secciones del panel.
 *
 * `roles` limita quién ve el enlace. Sin `roles`, lo ve cualquiera con sesión.
 *
 * Esto NO es la seguridad: las rutas de la API ya exigen el rol por su cuenta
 * con `requireRole`, y ahí es donde de verdad se decide. Aquí se decide otra
 * cosa, que también importa: que quien atiende el mostrador no tenga delante
 * un botón que solo le va a devolver un error, ni la duda de si debería
 * tocarlo.
 */
interface Enlace {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  /** Qué número de pendientes lleva encima. */
  avisa?: 'mensajes' | 'agenda';
}

/**
 * Agrupadas como en la maqueta: lo del día, lo de los pacientes y lo que se
 * configura una vez. Con trece enlaces seguidos nadie encuentra nada; con
 * tres grupos con nombre, el ojo va directo.
 */
const GRUPOS: Array<{ titulo: string; enlaces: Enlace[] }> = [
  {
    titulo: 'Día a día',
    enlaces: [
      { href: '/admin', label: 'Hoy', icon: LayoutDashboard },
      { href: '/admin/citas', label: 'Agenda', icon: CalendarDays, avisa: 'agenda' },
      { href: '/admin/mensajes', label: 'Mensajes', icon: Mails, avisa: 'mensajes' },
    ],
  },
  {
    titulo: 'Pacientes',
    enlaces: [
      { href: '/admin/pacientes', label: 'Pacientes', icon: Users },
      // Las fichas del centro anterior. Ver FUNCIONES.fichasClinicas.
      ...(FUNCIONES.fichasClinicas
        ? [{ href: '/admin/control-pacientes', label: 'Control de pacientes', icon: ClipboardList }]
        : []),
      { href: '/admin/fotos', label: 'Fotos de pacientes', icon: Images },
      { href: '/admin/consentimientos', label: 'Consentimientos', icon: FileSignature },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { href: '/admin/inventario', label: 'Inventario', icon: Package },
      { href: '/admin/tratamientos', label: 'Tratamientos', icon: Stethoscope },
      { href: '/admin/horario', label: 'Horario', icon: Clock, roles: ['ADMIN'] },
      { href: '/admin/sitio', label: 'Sitio web', icon: Palette, roles: ['ADMIN'] },
      { href: '/admin/integraciones', label: 'Integraciones', icon: Plug, roles: ['ADMIN'] },
    ],
  },
];

const NAV = GRUPOS.flatMap((grupo) => grupo.enlaces);

/** Dónde queda anotado si la barra estaba plegada, para no repetir el gesto. */
const CLAVE_PLEGADA = 'clinica:barra-plegada';

/**
 * El ancho es fijo: 260 px, y 76 px plegada.
 *
 * Se probó dejarlo ajustable arrastrando el borde y se quitó a propósito: son
 * dos estados —ancha o de iconos— y con eso alcanza. Un ancho libre añade un
 * gesto que aprender y una forma más de que el panel se vea distinto en cada
 * computador, a cambio de nada que haga falta.
 */

/** La sección a la que pertenece una ruta, para saber qué rol pide. */
function seccionDe(pathname: string) {
  return NAV.find((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /**
   * El menú solo existe por debajo de `lg`. De ahí para arriba la barra
   * lateral es fija y este estado no pinta nada.
   */
  const [menuAbierto, setMenuAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  /**
   * La barra reducida a iconos, solo en escritorio.
   *
   * Empieza siempre desplegada y el valor guardado se lee ya montado: leerlo
   * durante el render daría un HTML distinto en el servidor y en el navegador,
   * que es de las pocas cosas que React no perdona. `listo` existe para eso:
   * hasta que no se ha leído no se anima el ancho, así que quien tenía la barra
   * plegada no ve cómo se encoge cada vez que entra.
   */
  const [plegada, setPlegada] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      setPlegada(window.localStorage.getItem(CLAVE_PLEGADA) === '1');
    } catch {
      // Navegador con el almacenamiento capado: se queda desplegada y ya.
    }
    setListo(true);
  }, []);

  function recordar(clave: string, valor: string) {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      // Si no se puede guardar, el cambio vale para esta sesión igual.
    }
  }

  function alternarPlegada() {
    setPlegada((estaba) => {
      const ahora = !estaba;
      recordar(CLAVE_PLEGADA, ahora ? '1' : '0');
      return ahora;
    });
  }

  // Al navegar se cierra solo: si no, quien toca un enlace se queda mirando el
  // menú encima de la página que acaba de pedir.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  /**
   * Cuántos mensajes de contacto quedan sin atender.
   *
   * Va en el menú porque nadie entra a mirar una bandeja por si acaso: si el
   * número no está a la vista, los mensajes se quedan ahí. Se vuelve a pedir al
   * cambiar de pantalla, que es cuando puede haber cambiado —justo después de
   * marcar uno como atendido, sin ir más lejos.
   */
  const [pendientes, setPendientes] = useState({ mensajes: 0, agenda: 0 });

  useEffect(() => {
    if (pathname === '/admin/login') return undefined;

    const control = new AbortController();
    const pedir = <T,>(url: string, sacar: (d: T) => number) =>
      api
        .get<T>(url, { signal: control.signal })
        .then(sacar)
        .catch(() => 0);

    /**
     * Mensajes: los de la web sin contestar más los recordatorios de mañana
     * sin mandar, porque los dos se atienden en esa pantalla.
     *
     * Agenda: lo que el WhatsApp automático no alcanzó a mandar y hay que
     * mandar a mano —disculpas por un día cerrado y huecos ofrecidos—. Sin el
     * número a la vista, esas personas se quedan sin saber nada.
     */
    void Promise.all([
      pedir<{ sinAtender: number }>('/api/contact-messages?handled=false&take=1', (d) => d.sinAtender ?? 0),
      pedir<{ pendientes: number }>('/api/appointments/recordatorios', (d) => d.pendientes ?? 0),
      pedir<{ pendientesDeAviso: unknown[] }>('/api/cierres', (d) => d.pendientesDeAviso?.length ?? 0),
      pedir<{ items: Array<{ invitaciones: Array<{ enlaceManual: string | null; enviadaEn: string | null }> }> }>(
        '/api/ofertas',
        (d) =>
          d.items.reduce(
            (total, oferta) =>
              total + oferta.invitaciones.filter((i) => i.enlaceManual && !i.enviadaEn).length,
            0,
          ),
      ),
    ]).then(([mensajes, recordatorios, avisos, ofertas]) =>
      setPendientes({ mensajes: mensajes + recordatorios, agenda: avisos + ofertas }),
    );

    return () => control.abort();
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return undefined;

    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAbierto(false);
    }

    window.addEventListener('keydown', alPulsar);
    botonCerrar.current?.focus();

    // El menú tapa la pantalla: sin esto el dedo arrastra la página de detrás.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuAbierto]);

  function cerrarMenu() {
    setMenuAbierto(false);
    // El foco vuelve de donde salió, o se pierde al principio de la página.
    botonMenu.current?.focus();
  }

  // El login no lleva barra lateral ni exige sesión.
  if (pathname === '/admin/login') return <>{children}</>;

  function logout() {
    clearToken();
    router.replace('/admin/login');
  }

  /**
   * Plegada solo tiene sentido de `lg` para arriba: en el celular el panel es
   * un cajón que se abre entero. Por eso todo lo que sigue va con `lg:`.
   */
  const soloAncha = plegada ? 'lg:hidden' : '';

  return (
    <AuthGuard>
      {(user) => {
        const seccion = seccionDe(pathname);
        const puedeVer = !seccion?.roles || seccion.roles.includes(user.role);

        return (
          <div className="flex min-h-screen flex-col bg-cream lg:flex-row">
            {/* ---- Barra superior: solo móvil y tablet ------------------ */}
            <header className="no-imprimir sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Link href="/admin" aria-label="Ir a Hoy">
                  <Logo size="sm" />
                </Link>

                <div className="flex items-center gap-2">
                  {/* La campana va aquí y no dentro del menú: un aviso que hay
                      que abrir un cajón para ver no avisa de nada. */}
                  <CampanaAvisos />

                  <button
                    ref={botonMenu}
                    type="button"
                    onClick={() => setMenuAbierto(true)}
                    aria-expanded={menuAbierto}
                    aria-controls="menu-panel"
                    className="icon-btn"
                  >
                    <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    <span className="sr-only">Abrir el menú</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 pb-3">
                <BuscadorRapido />
                <Link href="/admin/citas?nueva=1" className="btn-primary btn-sm shrink-0" aria-label="Nueva cita">
                  <CalendarPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                </Link>
              </div>
            </header>

            {/* Fondo oscuro. Solo existe con el menú abierto y solo en móvil. */}
            {menuAbierto && (
              <button
                type="button"
                onClick={cerrarMenu}
                aria-label="Cerrar el menú"
                className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
              />
            )}

            {/*
              Un solo panel para las dos formas: cajón que entra desde la
              izquierda en móvil, barra fija de siempre en escritorio.

              `invisible` cuando está cerrado no es decoración: sin eso los
              enlaces del cajón siguen recibiendo el tabulador aunque estén
              fuera de la pantalla, y quien navega con teclado se pierde en un
              menú que no ve.
            */}
            <aside
              id="menu-panel"
              aria-label="Menú del panel"
              className={`no-imprimir fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden border-r border-line bg-surface transition-[transform,visibility] duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-w-none lg:visible lg:translate-x-0 lg:overflow-visible ${
                listo ? 'lg:transition-[transform,visibility,width]' : ''
              } ${plegada ? 'lg:w-[76px]' : 'lg:w-[260px]'} ${
                menuAbierto ? 'visible translate-x-0' : 'invisible -translate-x-full'
              }`}
            >
              <div
                className={`flex shrink-0 items-center justify-between gap-3 px-6 pb-3 pt-5 ${
                  plegada ? 'lg:justify-center lg:px-2' : ''
                }`}
              >
                <Link href="/admin" aria-label="Ir a Hoy" className="min-w-0">
                  <Logo size="sm" className={soloAncha} />
                  {plegada && <LogoMark size={36} className="hidden lg:grid" />}
                </Link>

                <button
                  ref={botonCerrar}
                  type="button"
                  onClick={cerrarMenu}
                  className="icon-btn shrink-0 lg:hidden"
                >
                  <X className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                  <span className="sr-only">Cerrar el menú</span>
                </button>
              </div>

              {/*
                Lo único que se desplaza es la lista de secciones: la cuenta y
                el cierre de sesión quedan siempre a la vista abajo.
              */}
              <nav className={`flex flex-1 flex-col overflow-y-auto px-3.5 pb-3 ${plegada ? 'lg:px-2' : ''}`}>
                {GRUPOS.map((grupo, indice) => {
                  const visibles = grupo.enlaces.filter(
                    (item) => !item.roles || item.roles.includes(user.role),
                  );
                  if (visibles.length === 0) return null;

                  return (
                    <div
                      key={grupo.titulo}
                      className={`grid gap-0.5 pt-2.5 ${indice > 0 ? 'mt-1.5 border-t border-line' : ''}`}
                    >
                      <span className={`side-label ${soloAncha}`}>{grupo.titulo}</span>
                      {visibles.map((item) => {
                        const active =
                          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                        const cuenta = item.avisa ? pendientes[item.avisa] : 0;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            /* Plegada no se ve el nombre: el globito del
                               navegador es lo único que queda. */
                            title={item.label}
                            className={`side-link ${plegada ? 'lg:justify-center lg:px-0' : ''}`}
                          >
                            <span className="relative shrink-0">
                              <item.icon className="h-[19px] w-[19px]" strokeWidth={1.75} aria-hidden />
                              {/* Plegada no hay sitio para el número: queda el punto. */}
                              {cuenta > 0 && plegada && (
                                <span
                                  className="absolute -right-1.5 -top-1 hidden h-2 w-2 rounded-full bg-warn ring-2 ring-surface lg:block"
                                  aria-hidden
                                />
                              )}
                            </span>
                            <span className={`min-w-0 flex-1 truncate ${soloAncha}`}>{item.label}</span>
                            {cuenta > 0 && (
                              <span
                                className={`ml-auto grid h-[22px] min-w-6 shrink-0 place-items-center rounded-full bg-warn-bg px-[7px] text-xs font-semibold text-warn ${soloAncha}`}
                              >
                                {cuenta}
                                <span className="sr-only"> pendientes</span>
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>

              {/* La cuenta y el cierre de sesión, también en el celular. */}
              <div className={`shrink-0 border-t border-line p-3.5 ${plegada ? 'lg:px-2' : ''}`}>
                <Link
                  href="/admin/cuenta"
                  title={`${user.fullName} · ${user.role.toLowerCase()}`}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-cream ${
                    plegada ? 'lg:justify-center lg:px-0' : ''
                  }`}
                >
                  <span className="avatar" aria-hidden>
                    {iniciales(user.fullName)}
                  </span>
                  <span className={`min-w-0 ${soloAncha}`}>
                    <b className="block truncate text-sm font-semibold text-ink">{user.fullName}</b>
                    <span className="block truncate text-[12.5px] capitalize text-subtle">
                      {user.role.toLowerCase()}
                    </span>
                  </span>
                  <span className="sr-only">Mi cuenta</span>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  title={plegada ? 'Cerrar sesión' : undefined}
                  className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-bad-bg hover:text-bad ${
                    plegada ? 'lg:justify-center lg:px-0' : ''
                  }`}
                >
                  <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                  <span className={soloAncha}>Cerrar sesión</span>
                </button>
              </div>

              {/* Plegar la barra, a caballo sobre el borde derecho. Solo en escritorio. */}
              <button
                type="button"
                onClick={alternarPlegada}
                title={plegada ? 'Ampliar el menú' : 'Reducir el menú a iconos'}
                className="absolute right-0 top-1/2 hidden h-7 w-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 lg:grid"
              >
                {plegada ? (
                  <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                ) : (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                )}
                <span className="sr-only">{plegada ? 'Ampliar el menú' : 'Reducir el menú'}</span>
              </button>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* ---- Barra superior de escritorio ------------------------- */}
              <header className="no-imprimir sticky top-0 z-20 hidden h-[68px] items-center gap-4 border-b border-line bg-cream/90 px-7 backdrop-blur lg:flex">
                <BuscadorRapido />
                <div className="ml-auto flex items-center gap-2.5">
                  <CampanaAvisos />
                  <Link href="/admin/citas?nueva=1" className="btn-primary btn-sm">
                    <CalendarPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    Nueva cita
                  </Link>
                </div>
              </header>

              {/*
                El `pb-24` de abajo no es decoración: en el móvil la barra del
                navegador aparece y desaparece al desplazarse, y sin aire al
                final el último elemento queda debajo de ella.
              */}
              <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 pb-24 sm:px-6 lg:p-7 lg:pb-16">
                {/*
                  Ocultar el enlace no basta: la dirección se puede escribir a
                  mano. Mejor decirlo de frente y no montar nada.
                */}
                {puedeVer ? (
                  children
                ) : (
                  <div className="card mx-auto max-w-md px-6 py-16 text-center">
                    <Lock className="mx-auto h-7 w-7 text-brand-300" strokeWidth={1.5} aria-hidden />
                    <h1 className="mt-4 text-xl">Esta sección no está disponible para tu cuenta</h1>
                    <p className="mt-2 text-sm text-muted">
                      Solo un administrador puede entrar aquí. Si necesitas algo de esta parte,
                      pídeselo a quien administra el centro.
                    </p>
                    <Link href="/admin" className="btn-primary mt-8">
                      Volver a Hoy
                    </Link>
                  </div>
                )}
              </main>
            </div>

            {/*
              El asistente va fuera de `main`, para que siga abierto al cambiar
              de pantalla: la mitad de lo que hace es llevarte de una a otra.
            */}
            <Asistente />
          </div>
        );
      }}
    </AuthGuard>
  );
}
