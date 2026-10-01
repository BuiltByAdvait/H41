import { z } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized', details?: Record<string, unknown>) {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message = 'Forbidden', details?: Record<string, unknown>) {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }

  static notFound(message = 'Resource not found', details?: Record<string, unknown>) {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static conflict(message: string, details?: Record<string, unknown>) {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError(message, 422, 'VALIDATION_ERROR', details);
  }

  static internal(message = 'Internal server error', details?: Record<string, unknown>) {
    const error = new AppError(message, 500, 'INTERNAL_ERROR', details);
    Object.defineProperty(error, 'isOperational', { value: false });
    return error;
  }

  static tooManyRequests(message = 'Too many requests', details?: Record<string, unknown>) {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export class ZodValidationError extends AppError {
  public readonly errors: z.ZodError;

  constructor(zodError: z.ZodError) {
    const message = zodError.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = zodError;
    Object.setPrototypeOf(this, ZodValidationError.prototype);
  }
}
