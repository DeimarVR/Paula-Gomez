/** Error con código HTTP que el middleware de errores sabe serializar. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Solicitud inválida', details?: unknown) {
    return new HttpError(400, message, 'bad_request', details);
  }

  static unauthorized(message = 'No autenticado') {
    return new HttpError(401, message, 'unauthorized');
  }

  static forbidden(message = 'No autorizado') {
    return new HttpError(403, message, 'forbidden');
  }

  static notFound(message = 'Recurso no encontrado') {
    return new HttpError(404, message, 'not_found');
  }

  static conflict(message = 'Conflicto con el estado actual') {
    return new HttpError(409, message, 'conflict');
  }

  static unprocessable(message: string, details?: unknown) {
    return new HttpError(422, message, 'unprocessable', details);
  }

  static serviceUnavailable(message = 'Servicio no disponible') {
    return new HttpError(503, message, 'service_unavailable');
  }
}
