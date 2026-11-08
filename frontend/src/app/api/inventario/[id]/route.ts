import { Role } from '@prisma/client';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { body, requireRole, route } from '@/server/http';
import { productoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Editar la ficha del producto: nombre, presentación, precio, mínimo.
 *
 * Recepción no. Antes bastaba con estar dentro del sistema, y eso incluía
 * cambiarle el precio de venta a un producto o bajarle el mínimo hasta que
 * dejara de avisar. Registrar movimientos sí es de todos —es el trabajo del
 * día—; decidir qué dice el catálogo, no.
 */
export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  return inventario.actualizarProducto(params.id, await body(req, productoSchema));
});

/**
 * Archiva el producto. Solo el administrador.
 *
 * Un producto con historial no se borra: la cascada del esquema se llevaría por
 * delante sus movimientos, y con ellos la respuesta a «qué se le aplicó a este
 * paciente en marzo». Se archiva, y si tenía existencia queda un movimiento que
 * dice cuánta se archivó, para que el estante no se vacíe en silencio.
 */
export const DELETE = route(async (req, { params }: { params: { id: string } }) => {
  const sesion = requireRole(req, Role.ADMIN);
  return inventario.archivarProducto(params.id, sesion.sub);
});
