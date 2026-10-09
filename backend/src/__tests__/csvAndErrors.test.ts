import { csvCell, toCsv } from '../utils/csv';
import { rpcToAppError } from '../utils/rpcError';
import { registerSchema, loginSchema } from '../schemas/validationSchemas';

describe('CSV export safety (E4-US9)', () => {
  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe(`'+1+1`);
    expect(csvCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
  });
  it('keeps real negative numbers and plain text intact', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('Tomato')).toBe('Tomato');
    expect(csvCell(null)).toBe('');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('builds header + rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"');
  });
});

describe('rpcToAppError – database exception mapping', () => {
  it('maps insufficient stock / excessive reservation / invalid state to 409', () => {
    expect(rpcToAppError({ message: 'INSUFFICIENT_STOCK: Tomato requested 500 kg' }).statusCode).toBe(409);
    expect(rpcToAppError({ message: 'EXCESSIVE_RESERVATION: too much' }).statusCode).toBe(409);
    expect(rpcToAppError({ message: 'INVALID_STATE: already paid' }).statusCode).toBe(409);
  });
  it('maps not found to 404 and invalid quantity to 400', () => {
    expect(rpcToAppError({ message: 'NOT_FOUND: invoice not found' }).statusCode).toBe(404);
    expect(rpcToAppError({ message: 'INVALID_QTY: must be > 0' }).statusCode).toBe(400);
  });
  it('keeps the human readable detail', () => {
    expect(rpcToAppError({ message: 'INVALID_QTY: accepted + rejected must equal net weight' }).message).toBe('accepted + rejected must equal net weight');
  });
  it('treats unknown errors as 500', () => {
    expect(rpcToAppError({ message: 'deadlock detected' }).statusCode).toBe(500);
    expect(rpcToAppError(null).statusCode).toBe(500);
  });
});

describe('auth schemas', () => {
  const base = { email: 'a@b.lk', password: 'Passw0rd!', full_name: 'Kamal Perera' };
  it('allows farmer and buyer self-registration', () => {
    expect(registerSchema.safeParse({ body: { ...base, role: 'farmer' } }).success).toBe(true);
    expect(registerSchema.safeParse({ body: { ...base, role: 'buyer' } }).success).toBe(true);
  });
  it('defaults to farmer', () => {
    const r = registerSchema.parse({ body: base });
    expect(r.body.role).toBe('farmer');
  });
  it('rejects privilege escalation through the public endpoint', () => {
    for (const role of ['administrator', 'manager', 'finance_officer', 'inventory_manager'])
      expect(registerSchema.safeParse({ body: { ...base, role } }).success).toBe(false);
  });
  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ body: { ...base, password: 'password' } }).success).toBe(false);
  });
  it('requires email and password on login', () => {
    expect(loginSchema.safeParse({ body: { email: 'x' } }).success).toBe(false);
  });
});
