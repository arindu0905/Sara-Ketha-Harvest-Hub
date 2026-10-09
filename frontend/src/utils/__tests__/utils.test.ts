import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from '../apiError';
import { formatLKR, gradeLabel } from '../lkrFormat';

describe('apiErrorMessage', () => {
  it('prefers the server message', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Insufficient stock' } } })).toBe('Insufficient stock');
  });
  it('falls back to error.message then the fallback text', () => {
    expect(apiErrorMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(apiErrorMessage(undefined, 'Oops')).toBe('Oops');
  });
});

describe('lkrFormat', () => {
  it('formats rupees and handles null', () => {
    expect(formatLKR(1500, 0)).toContain('1,500');
    expect(formatLKR(null)).toBe('N/A');
  });
  it('labels grades', () => {
    expect(gradeLabel('grade_a').label).toBe('Grade A');
    expect(gradeLabel('weird').label).toBe('weird');
  });
});
