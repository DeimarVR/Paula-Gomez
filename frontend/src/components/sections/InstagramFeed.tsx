import Image from 'next/image';
import { Instagram, Play } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { truncate } from '@/lib/format';
import type { InstagramFeed as Feed } from '@/lib/types';

interface InstagramFeedProps {
  feed: Feed;
}

/**
 * Feed de Instagram.
 *
 * Las publicaciones vienen de la copia que el backend guarda en base de datos,
 * no de una llamada directa a Meta: así el token nunca llega al navegador y la
 * sección sigue mostrando contenido aunque la API de Instagram esté caída.
 */
export function InstagramFeed({ feed }: InstagramFeedProps) {
  return (
    <Section
      eyebrow="Día a día"
      title="Lo último en nuestro Instagram"
      intro="Casos, consejos de cuidado y lo que pasa dentro del centro."
      aside={
        <a
          href={feed.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline group"
        >
          <Instagram className="h-4 w-4" strokeWidth={1.8} aria-hidden />@{feed.username}
        </a>
      }
    >
      {feed.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface px-8 py-14 text-center">
          <Instagram className="mx-auto h-8 w-8 text-brand-300" strokeWidth={1.5} aria-hidden />
          {/*
            Este bloque lo ve un paciente, no el equipo. Antes decía «conecta la
            cuenta desde el panel, en Integraciones»: una instrucción interna
            publicada en la portada, que al visitante no le dice nada y deja el
            sitio con cara de estar a medio montar.
          */}
          <p className="mt-4 font-display text-lg">Seguinos en Instagram</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Ahí publicamos casos, consejos de cuidado y novedades del centro.
          </p>
          <a
            href={feed.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6"
          >
            Ver el perfil en Instagram
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {feed.items.map((post, index) => (
            <Reveal key={post.id} delay={index * 50}>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-2xl bg-brand-100"
              >
                <Image
                  src={post.thumbnailUrl ?? post.mediaUrl}
                  alt={post.caption ? truncate(post.caption, 110) : 'Publicación de Instagram'}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {post.mediaType === 'VIDEO' && (
                  <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  </span>
                )}

                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-brand-900/85 via-brand-900/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {post.caption && (
                    <p className="text-xs leading-relaxed text-white">
                      {truncate(post.caption, 90)}
                    </p>
                  )}
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      )}
    </Section>
  );
}
