import {
  CreateAuctionSchema, UpdateAuctionSchema, CreateLotSchema, PlaceBidSchema, CancelAuctionSchema
} from '../schemas/auctionSchemas';

describe('Produce Auction Module – Validation Schemas Unit Tests', () => {

  const validUuid1 = 'a1111111-1111-4111-a111-111111111111';
  const validUuid2 = 'b2222222-2222-4222-b222-222222222222';
  const validUuid3 = 'c3333333-3333-4333-c333-333333333333';

  // ─── CreateAuctionSchema ───────────────────────────────────────────────────

  describe('CreateAuctionSchema', () => {
    // dates are relative to "now" because past dates are rejected
    const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
    const validAuctionData = {
      collection_centre_id:   validUuid1,
      auction_type:           'open_ascending',
      title:                  'Colombo Grade A Tomato Auction',
      description:            'Fresh morning harvest tomatoes from Dambulla collection centre.',
      start_at:               hoursFromNow(24),
      end_at:                 hoursFromNow(28),
      starting_price:         150.00,
      reserve_price:          180.00,
      minimum_increment:      5.00,
      payment_deadline_hours: 48,
      auto_extension_enabled: true,
      extension_minutes:      5,
    };

    it('validates a correct auction creation payload', () => {
      const result = CreateAuctionSchema.safeParse(validAuctionData);
      expect(result.success).toBe(true);
    });

    it('rejects invalid collection_centre_id (not a UUID)', () => {
      const result = CreateAuctionSchema.safeParse({
        ...validAuctionData,
        collection_centre_id: 'invalid-uuid-123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects start_at after end_at', () => {
      const result = CreateAuctionSchema.safeParse({
        ...validAuctionData,
        start_at: hoursFromNow(30),
        end_at:   hoursFromNow(28),
      });
      expect(result.success).toBe(false);
    });

    it('rejects a start date and time in the past', () => {
      const result = CreateAuctionSchema.safeParse({ ...validAuctionData, start_at: hoursFromNow(-5), end_at: hoursFromNow(4) });
      expect(result.success).toBe(false);
      expect(JSON.stringify((result as any).error.errors)).toContain('Start date and time cannot be in the past');
    });

    it('rejects an end date and time in the past', () => {
      const result = CreateAuctionSchema.safeParse({ ...validAuctionData, start_at: hoursFromNow(-10), end_at: hoursFromNow(-5) });
      expect(result.success).toBe(false);
      expect(JSON.stringify((result as any).error.errors)).toContain('cannot be in the past');
    });

    it('accepts an auction that starts right now (grace period)', () => {
      const result = CreateAuctionSchema.safeParse({ ...validAuctionData, start_at: hoursFromNow(0), end_at: hoursFromNow(3) });
      expect(result.success).toBe(true);
    });

    it('rejects reserve price lower than starting price', () => {
      const result = CreateAuctionSchema.safeParse({
        ...validAuctionData,
        starting_price: 200.00,
        reserve_price:  150.00,
      });
      expect(result.success).toBe(false);
    });

    it('allows null or missing reserve_price (no reserve)', () => {
      const { reserve_price, ...noReserve } = validAuctionData;
      const result = CreateAuctionSchema.safeParse(noReserve);
      expect(result.success).toBe(true);
    });

    it('defaults minimum_increment to 100 if omitted', () => {
      const { minimum_increment, ...data } = validAuctionData;
      const parsed = CreateAuctionSchema.parse(data);
      expect(parsed.minimum_increment).toBe(100);
    });
  });

  // ─── UpdateAuctionSchema ───────────────────────────────────────────────────

  describe('UpdateAuctionSchema', () => {
    it('allows partial update of title and status', () => {
      const result = UpdateAuctionSchema.safeParse({
        title:  'Updated Colombo Tomato Auction',
        status: 'open',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status value', () => {
      const result = UpdateAuctionSchema.safeParse({
        status: 'gambling_active',  // Invalid status
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── CreateLotSchema ───────────────────────────────────────────────────────

  describe('CreateLotSchema', () => {
    const validLotData = {
      auction_id:              validUuid1,
      inventory_batch_id:      validUuid2,
      crop_category_id:        validUuid3,
      quality_grade:           'grade_a',
      lot_quantity:            500.0,
      unit:                    'kg',
      starting_price_per_unit: 140.00,
      reserve_price_per_unit:  160.00,
      origin_district:         'Anuradhapura',
      harvest_season:          'Yala 2026',
    };

    it('validates a correct lot creation payload', () => {
      const result = CreateLotSchema.safeParse(validLotData);
      expect(result.success).toBe(true);
    });

    it('rejects negative lot quantity', () => {
      const result = CreateLotSchema.safeParse({
        ...validLotData,
        lot_quantity: -50,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid quality grade', () => {
      const result = CreateLotSchema.safeParse({
        ...validLotData,
        quality_grade: 'ultra_premium',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── PlaceBidSchema ────────────────────────────────────────────────────────

  describe('PlaceBidSchema', () => {
    it('validates a valid bid placement', () => {
      const result = PlaceBidSchema.safeParse({
        bid_amount_per_unit: 185.50,
        bid_quantity:        500.0,
      });
      expect(result.success).toBe(true);
    });

    it('rejects zero or negative bid amount', () => {
      const result = PlaceBidSchema.safeParse({
        bid_amount_per_unit: 0,
        bid_quantity:        100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric bid amount', () => {
      const result = PlaceBidSchema.safeParse({
        bid_amount_per_unit: 'one hundred',
        bid_quantity:        100,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── CancelAuctionSchema ───────────────────────────────────────────────────

  describe('CancelAuctionSchema', () => {
    it('accepts valid cancellation reason (>= 10 chars)', () => {
      const result = CancelAuctionSchema.safeParse({
        cancellation_reason: 'Collection centre power outage – rescheduled to tomorrow.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects overly short cancellation reason', () => {
      const result = CancelAuctionSchema.safeParse({
        cancellation_reason: 'Rain',
      });
      expect(result.success).toBe(false);
    });
  });
});
