import { registerSchema, farmerSchema, farmerUpdateSchema, cropSchema, cropUpdateSchema, todayInSriLanka } from '../schemas/validationSchemas';
import { parseSoilPh } from '../services/cropAdvisor';

const uuid = '11111111-1111-4111-8111-111111111111';
const ok = (schema: any, body: unknown) => schema.safeParse({ body }).success;
const msg = (schema: any, body: unknown) => JSON.stringify(schema.safeParse({ body }).error?.errors ?? []);
const addDays = (n: number) => { const d = new Date(todayInSriLanka() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

describe('E1-US1 registration', () => {
  const valid = { email: 'kamal@example.lk', password: 'Abcdef12', full_name: 'Kamal Perera' };
  it('accepts a valid farmer registration and defaults the role to farmer', () => {
    const r = registerSchema.parse({ body: valid });
    expect(r.body.role).toBe('farmer');
  });
  it.each([
    ['password without an uppercase letter', { password: 'abcdef12' }],
    ['password without a lowercase letter', { password: 'ABCDEF12' }],
    ['password without a number', { password: 'Abcdefgh' }],
    ['password shorter than 8 characters', { password: 'Ab1' }],
    ['invalid e-mail', { email: 'not-an-email' }],
    ['name shorter than 2 characters', { full_name: 'K' }],
    ['phone that is not 10 digits starting with 0', { phone: '12345' }],
  ])('rejects %s', (_n, patch) => expect(ok(registerSchema, { ...valid, ...patch })).toBe(false));
  it.each(['administrator', 'inventory_manager', 'finance_officer', 'manager'])('does not allow self-registering as %s', role =>
    expect(ok(registerSchema, { ...valid, role })).toBe(false));
  it('allows farmer and buyer, and a valid phone', () => {
    expect(ok(registerSchema, { ...valid, role: 'buyer', phone: '0771234567' })).toBe(true);
  });
});

describe('E1-US3 officer registers a farmer (Sri Lankan formats)', () => {
  const base = { nic_number: '781234567V', full_name: 'Kamal Perera', phone: '0771234567', address: '12 Main Street', district: 'Kandy' };
  it('accepts old and new NIC formats', () => {
    expect(ok(farmerSchema, base)).toBe(true);
    expect(ok(farmerSchema, { ...base, nic_number: '198012345678' })).toBe(true);
    expect(ok(farmerSchema, { ...base, nic_number: '781234567x' })).toBe(true);
  });
  it.each(['12345', '78123456V', '7812345678V', '19801234567', 'abcdefghijkl'])('rejects NIC %s', nic =>
    expect(ok(farmerSchema, { ...base, nic_number: nic })).toBe(false));
  it.each(['771234567', '07712345678', '+94771234567', 'abcdefghij'])('rejects phone %s', phone =>
    expect(ok(farmerSchema, { ...base, phone })).toBe(false));
  it('validates the emergency contact phone and bank account number', () => {
    expect(ok(farmerSchema, { ...base, emergency_contact_phone: 'abc' })).toBe(false);
    expect(ok(farmerSchema, { ...base, emergency_contact_phone: '0712345678' })).toBe(true);
    expect(ok(farmerSchema, { ...base, account_number: 'ABC123' })).toBe(false);
    expect(ok(farmerSchema, { ...base, account_number: '12345' })).toBe(false);
    expect(ok(farmerSchema, { ...base, account_number: '1234567890' })).toBe(true);
  });
  it('requires address (5+ chars), district and a positive farm size', () => {
    expect(ok(farmerSchema, { ...base, address: 'ab' })).toBe(false);
    expect(ok(farmerSchema, { ...base, district: '' })).toBe(false);
    expect(ok(farmerSchema, { ...base, farm_size_acres: -1 })).toBe(false);
  });
  it('applies the same formats when a profile is updated, and accepts blanks', () => {
    expect(ok(farmerUpdateSchema, { phone: '123' })).toBe(false);
    expect(ok(farmerUpdateSchema, { nic_number: 'bad' })).toBe(false);
    expect(ok(farmerUpdateSchema, { emergency_contact_phone: '' })).toBe(true);
    expect(ok(farmerUpdateSchema, { account_number: '' })).toBe(true);
  });
});

describe('E1-US6 crop registration', () => {
  const base = { farmer_id: uuid, category_id: uuid };
  it('accepts the payload the form sends, including empty optional fields as null', () => {
    expect(ok(cropSchema, { ...base, variety_id: null, cultivated_area_acres: null, planting_date: null, expected_harvest_date: null, expected_quantity_kg: null, notes: null })).toBe(true);
  });
  it('rejects non-positive numbers, unknown farming methods and bad ids', () => {
    expect(ok(cropSchema, { ...base, cultivated_area_acres: 0 })).toBe(false);
    expect(ok(cropSchema, { ...base, expected_quantity_kg: -5 })).toBe(false);
    expect(ok(cropSchema, { ...base, farming_method: 'magic' })).toBe(false);
    expect(ok(cropSchema, { ...base, category_id: 'nope' })).toBe(false);
  });
  it('does not allow a planting date in the past, nor a harvest before planting', () => {
    expect(msg(cropSchema, { ...base, planting_date: addDays(-1) })).toContain('Planting date cannot be in the past');
    expect(ok(cropSchema, { ...base, planting_date: addDays(0) })).toBe(true);
    expect(msg(cropSchema, { ...base, planting_date: addDays(10), expected_harvest_date: addDays(5) })).toContain('cannot be before the planting date');
    expect(msg(cropSchema, { ...base, expected_harvest_date: addDays(-2) })).toContain('Expected harvest date cannot be in the past');
    expect(ok(cropSchema, { ...base, planting_date: '12/04/2026' })).toBe(false);
  });
  it('lets an existing crop keep an old planting date when edited', () => {
    expect(ok(cropUpdateSchema, { planting_date: addDays(-30), expected_harvest_date: addDays(20) })).toBe(true);
  });
});

describe('E1-US10 soil pH from the advisor chat', () => {
  it('accepts 3 to 10, treats blank as "not provided", and flags anything else', () => {
    expect(parseSoilPh(6.5)).toBe(6.5);
    expect(parseSoilPh('5')).toBe(5);
    expect(parseSoilPh('')).toBeNull();
    expect(parseSoilPh(undefined)).toBeNull();
    for (const bad of [2.9, 10.1, 'abc', NaN]) expect(Number.isNaN(parseSoilPh(bad))).toBe(true);
  });
});
