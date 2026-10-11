import { AppError } from './AppError';

/** Contact-detail rules for collection centres (phone and e-mail are optional, but must be valid when given). */
export function assertCentreContact(b: { phone?: unknown; email?: unknown; capacity_kg?: unknown }): void {
  const phone = typeof b.phone === 'string' ? b.phone.trim() : b.phone;
  if (phone !== undefined && phone !== null && phone !== '' && !/^0\d{9}$/.test(String(phone))) {
    throw new AppError('Phone number must be 10 digits starting with 0 (e.g. 0771234567)', 400);
  }
  const email = typeof b.email === 'string' ? b.email.trim() : b.email;
  if (email !== undefined && email !== null && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) {
    throw new AppError('Enter a valid e-mail address', 400);
  }
  if (b.capacity_kg !== undefined && b.capacity_kg !== null && b.capacity_kg !== '') {
    const n = Number(b.capacity_kg);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) throw new AppError('Capacity must be a number greater than zero', 400);
  }
}
