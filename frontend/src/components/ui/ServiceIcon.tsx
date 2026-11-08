import {
  Droplet,
  Microscope,
  Shield,
  Sparkles,
  Syringe,
  Wind,
  Activity,
  HeartPulse,
  type LucideIcon,
} from 'lucide-react';

/**
 * Traduce el campo `icon` del catálogo de tratamientos a un icono real.
 * Si llega un nombre desconocido, se usa el genérico en lugar de romper.
 */
const ICONS: Record<string, LucideIcon> = {
  syringe: Syringe,
  droplet: Droplet,
  microscope: Microscope,
  wind: Wind,
  shield: Shield,
  sparkles: Sparkles,
  activity: Activity,
  heart: HeartPulse,
};

interface ServiceIconProps {
  name: string;
  className?: string;
}

export function ServiceIcon({ name, className = 'h-5 w-5' }: ServiceIconProps) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.6} aria-hidden />;
}
