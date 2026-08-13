/**
 * Standard API response helpers.
 */

import { Response } from 'express';

interface SuccessResponseOptions<T> {
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  statusCode?: number;
}

interface ErrorResponseOptions {
  message: string;
  errors?: Array<{ field?: string; message: string }>;
  statusCode?: number;
}

export const sendSuccess = <T>(
  res: Response,
  options: SuccessResponseOptions<T> = {}
): Response => {
  const { message = 'Operation completed successfully', data, meta, statusCode = 200 } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  });
};

export const sendError = (
  res: Response,
  options: ErrorResponseOptions
): Response => {
  const { message, errors, statusCode = 400 } = options;

  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && errors.length > 0 && { errors }),
  });
};

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  options: {
    message?: string;
    page: number;
    limit: number;
    total: number;
  }
): Response => {
  const { message = 'Data retrieved successfully', page, limit, total } = options;

  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
};
