import { AppError } from './AppError';

/**
 * Translate a Postgres RAISE EXCEPTION from our inventory RPCs
 * (e.g. "INSUFFICIENT_STOCK: Tomato requested 500kg ...") into an AppError.
 */
export function rpcToAppError(err: { message?: string } | null | undefined): AppError {
  const msg = err?.message || 'Database operation failed';
  const m = msg.match(/^(INSUFFICIENT_STOCK|EXCESSIVE_RESERVATION|INVALID_STATE|INVALID_QTY|ORDER_NOT_FOUND|BATCH_NOT_FOUND|NOT_FOUND)(?::\s*(.*))?$/s);
  if (!m) return new AppError(msg, 500);
  const [, code, detail] = m;
  switch (code) {
    case 'NOT_FOUND':
      return new AppError(detail || 'Not found', 404);
    case 'ORDER_NOT_FOUND':
    case 'BATCH_NOT_FOUND':
      return new AppError(code === 'ORDER_NOT_FOUND' ? 'Order not found' : 'Batch not found', 404);
    case 'INVALID_QTY':
      return new AppError(detail || 'Invalid quantity', 400);
    default:
      return new AppError(detail || msg, 409);
  }
}
