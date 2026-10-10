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

  // Database errors that really mean "bad input" or "no such record" (instead of a 500)
  const msg = err.message || '';
  const isGeneric500 = !(err instanceof AppError) || err.statusCode === 500;
  if (isGeneric500 && msg.includes('Cannot coerce the result to a single JSON object')) {
    res.status(404).json({ success: false, message: 'Record not found' } satisfies ErrorResponse);
    return;
  }
  const notNull = msg.match(/null value in column "(\w+)"/);
  if (isGeneric500 && notNull) {
    res.status(400).json({ success: false, message: `${notNull[1].replace(/_/g, ' ')} is required` } satisfies ErrorResponse);
    return;
  }
  if (isGeneric500 && msg.includes('violates foreign key constraint')) {
    res.status(404).json({ success: false, message: 'A referenced record does not exist' } satisfies ErrorResponse);
    return;
  }
  if (isGeneric500 && msg.includes('invalid input syntax')) {
    res.status(400).json({ success: false, message: 'Invalid value supplied' } satisfies ErrorResponse);
    return;
  }

  // Browser origin not on the CORS allow-list
  if (msg.startsWith('CORS: Origin')) {
    res.status(403).json({ success: false, message: 'This website is not allowed to use the API' } satisfies ErrorResponse);
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
