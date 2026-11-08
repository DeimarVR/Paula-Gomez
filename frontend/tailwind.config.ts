import type { Config } from 'tailwindcss';

/**
 * Los valores de color NO viven aquí: viven en `src/app/globals.css`, dentro
 * del bloque `:root`. Este archivo solo les pone nombre.
 *
 * ➜ Para cambiar la paleta, edita globals.css. Un solo archivo.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        /* Arena: acento decorativo. `sand` es el nombre nuevo; `accent`, el de siempre. */
        accent: {
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
        },
        sand: {
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
        },
        /* Pizarra: neutro con tono (antes era el verde lima). */
        leaf: {
          100: 'rgb(var(--leaf-100) / <alpha-value>)',
          300: 'rgb(var(--leaf-300) / <alpha-value>)',
          400: 'rgb(var(--leaf-400) / <alpha-value>)',
          600: 'rgb(var(--leaf-600) / <alpha-value>)',
          700: 'rgb(var(--leaf-700) / <alpha-value>)',
        },
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        cream: 'rgb(var(--cream) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        /* Texto legible sobre el azul profundo (brand-900). */
        'on-deep': 'rgb(var(--on-deep) / <alpha-value>)',
        'on-deep-muted': 'rgb(var(--on-deep-muted) / <alpha-value>)',
        /* Estados: siempre con icono y texto, nunca solo color. */
        ok: 'rgb(var(--ok) / <alpha-value>)',
        'ok-bg': 'rgb(var(--ok-bg) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-bg': 'rgb(var(--warn-bg) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
        'bad-bg': 'rgb(var(--bad-bg) / <alpha-value>)',
        /* Texto de lo que se imprime. */
        'paper-ink': 'rgb(var(--paper-ink) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        /* Las de la maqueta: sombras largas y muy tenues, teñidas de tinta. */
        soft: '0 1px 2px rgb(var(--ink) / 0.05), 0 10px 28px -14px rgb(var(--ink) / 0.22)',
        lift: '0 2px 4px rgb(var(--ink) / 0.04), 0 28px 56px -28px rgb(var(--ink) / 0.38)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        marquee: 'marquee 40s linear infinite',
        /* Manchas del hero: los keyframes viven en globals.css. */
        'float-a': 'float-a 9s ease-in-out infinite',
        'float-b': 'float-b 11s ease-in-out infinite',
        'float-c': 'float-c 10s ease-in-out infinite',
        /* Botón flotante de WhatsApp. */
        'wa-flotar': 'wa-flotar 2.4s ease-in-out infinite',
        'wa-aro': 'wa-aro 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
