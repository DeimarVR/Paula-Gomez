import { revalidatePath } from 'next/cache';
import * as instagram from '@/server/services/instagram';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  requireAuth(req);
  const resultado = await instagram.syncPosts(12);

  /**
   * La portada se regenera sola cada 5 minutos (`revalidate = 300`), así que
   * hasta ahora sincronizar y abrir la landing enseguida no mostraba nada, sin
   * ninguna señal de que solo había que esperar. Parecía un fallo. Se invalida
   * aquí para que las publicaciones se vean al recargar.
   */
  if (resultado.ok && resultado.saved > 0) revalidatePath('/');

  return resultado;
});
