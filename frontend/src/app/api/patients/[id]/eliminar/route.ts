import { requireAuth, route } from '@/server/http';
import {
  archivarPaciente,
  borrarPaciente,
  queTieneElPaciente,
} from '@/server/modules/patients/borrado.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * Borrar un paciente de verdad.
 *
 * Va en su propia ruta y no en el `DELETE` de `/api/patients/[id]`, que hace
 * otra cosa: aquel marca inactivo. Dos borrados distintos detrás del mismo
 * verbo es como se termina borrando lo que no era.
 */

/** Qué tiene el paciente. Lo pide el diálogo antes de preguntar nada. */
export const GET = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  return queTieneElPaciente(params.id);
});

/**
 * Lo borra, si está vacío. Cualquiera con sesión.
 *
 * No se pide rol de administrador a propósito, y no es un descuido: lo que
 * protege aquí no es el rol, es que el paciente esté vacío. Un duplicado sin
 * una sola cita no tiene nada que perder, y el que sí tiene algo no lo borra
 * nadie —tampoco el administrador—, porque `borrarPaciente` lo rechaza en la
 * base con la fila bloqueada.
 *
 * Y quien se encuentra el duplicado es justamente quien atiende el mostrador:
 * lo crea sin querer y lo ve ahí repetido en la lista. Obligarla a esperar a
 * que llegue la doctora para quitar una ficha en blanco es trabajo de más para
 * proteger algo que no existe.
 */
export const DELETE = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const { nombre } = await borrarPaciente(params.id);
  return { message: `Se borró a ${nombre}.` };
});

/**
 * La alternativa cuando no procede borrar: dejarlo inactivo.
 *
 * También sin exigir rol: no destruye nada, se deshace editando el paciente y
 * es la salida que el diálogo ofrece cuando el borrado se rechaza. Si solo el
 * administrador pudiera archivarlo, la auxiliar se quedaría con un callejón
 * sin salida delante.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const { nombre } = await archivarPaciente(params.id);
  return { message: `${nombre} quedó marcado como inactivo.` };
});
