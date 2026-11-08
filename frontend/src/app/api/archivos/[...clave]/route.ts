import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { leerObjeto, rutaPublica } from '@/server/storage';
import { fail, sesionParaArchivos } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sirve los archivos del bucket, que es privado.
 *
 * Quién puede ver qué, según la carpeta:
 *
 *   sitio/      cualquiera. Son imágenes del sitio público.
 *   galeria/    cualquiera, PERO solo si algún caso publicado y con
 *               consentimiento firmado la referencia. Una imagen subida y aún
 *               no publicada no se ve, aunque se filtre la dirección.
 *   sesiones/   fotos clínicas. Solo el equipo con sesión iniciada, o el
 *               propio paciente con su token de seguimiento, y únicamente si
 *               la foto está marcada como visible para él.
 *   expedientes/ hojas en papel fotografiadas. Solo el equipo con sesión: el
 *               token del paciente no abre nada aquí, porque ninguna foto de
 *               sesión apunta a estos archivos.
 *
 * El bucket nunca se expone: aquí se leen los bytes y se devuelven. Una URL
 * firmada de descarga seguiría siendo una dirección pública mientras dure, y
 * para una foto clínica eso no alcanza.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { clave: string[] } },
): Promise<NextResponse> {
  try {
    const clave = params.clave.join('/');
    const carpeta = params.clave[0];

    /**
     * `sitio` es la ÚNICA carpeta que se sirve sin sesión.
     *
     * `galeria` lo era hasta que el módulo dejó de ser una vitrina: antes una
     * foto salía sin sesión si algún caso publicado la referenciaba. Ahora ahí
     * dentro hay fotos clínicas de pacientes, así que esa excepción se retiró
     * entera. Los casos que se muestran en el sitio ya no salen de aquí: están
     * escritos a mano en `config.ts`, con sus imágenes en `public/`.
     */
    const publica = carpeta === 'sitio';

    if (!publica) {
      const sesion = sesionParaArchivos(req);

      if (!sesion) {
        // Sin sesión del panel, la única llave válida es el token del paciente.
        const token = req.nextUrl.searchParams.get('t');
        const autorizado = token
          ? await prisma.sessionPhoto.findFirst({
              where: {
                url: rutaPublica(clave),
                visibleToPatient: true,
                session: { plan: { patient: { publicToken: token } } },
              },
              select: { id: true },
            })
          : null;

        if (!autorizado) {
          return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }
      }
    }

    const objeto = await leerObjeto(clave);

    return new NextResponse(objeto.cuerpo, {
      headers: {
        'Content-Type': objeto.contentType,
        ...(objeto.tamano ? { 'Content-Length': String(objeto.tamano) } : {}),
        ...(objeto.etag ? { ETag: objeto.etag } : {}),
        // Las claves llevan un aleatorio y no se reescriben, así que lo
        // público se puede cachear para siempre. Lo clínico, nunca: ni en la
        // CDN ni en el navegador de un consultorio compartido.
        'Cache-Control': publica
          ? 'public, max-age=31536000, immutable'
          : 'private, no-store, max-age=0',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
