import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { config } from '../config/config';

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    error: err,
    body: req.body,
    params: req.params,
    query: req.query,
    userId: (req as any).user?.id,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
    } satisfies ErrorResponse);
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      message: err.message,
    };

    if (config.nodeEnv === 'development') {
      response.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Supabase errors (unique constraint violations etc.)
  if (err.message?.includes('duplicate key value')) {
    res.status(409).json({
      success: false,
      message: 'A record with this information already exists.',
    } satisfies ErrorResponse);
    return;
  }

  // Default 500 error — never expose internals in production
  const response: ErrorResponse = {
    success: false,
    message: config.nodeEnv === 'production'
      ? 'An internal server error occurred. Please try again later.'
      : err.message,
  };

  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
