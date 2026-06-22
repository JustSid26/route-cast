// Typed application error carrying an HTTP status and optional details.
// Thrown anywhere in services/repositories; translated to JSON by errorHandler.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, message, details);
  }
  static upstream(message: string, details?: unknown) {
    return new AppError(502, message, details);
  }
}
