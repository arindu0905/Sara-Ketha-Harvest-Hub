import { z } from 'zod';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const lkrAmount = () =>
  z.number({ invalid_type_error: 'Must be a number' }).positive('Must be positive');

const uuidField = (label = 'ID') =>
  z.string({ required_error: `${label} is required` }).uuid(`${label} must be a valid UUID`);

const optionalUuid = () => z.string().uuid().optional().nullable();

// ─── Auction Schemas ──────────────────────────────────────────────────────────

// Base object (needed for .partial() / .extend() chaining)
const CreateAuctionBase = z.object({
  collection_centre_id:   uuidField('Collection centre'),
  auction_type:           z.enum(['open_ascending', 'sealed_bid']).default('open_ascending'),
  title:                  z.string().min(5, 'Title must be at least 5 characters').max(200),
  title_sinhala:          z.string().max(200).optional().nullable(),
  title_tamil:            z.string().max(200).optional().nullable(),
  description:            z.string().max(2000).optional().nullable(),
  description_sinhala:    z.string().max(2000).optional().nullable(),
  description_tamil:      z.string().max(2000).optional().nullable(),
  start_at:               z.string().datetime({ message: 'start_at must be ISO 8601 datetime' }),
  end_at:                 z.string().datetime({ message: 'end_at must be ISO 8601 datetime' }),
  starting_price:         lkrAmount(),
  reserve_price:          z.number().positive().optional().nullable(),
  minimum_increment:      z.number().positive().default(100),
  payment_deadline_hours: z.number().int().positive().default(48),
  auto_extension_enabled: z.boolean().default(true),
  extension_minutes:      z.number().int().positive().default(5),
});

/** A small grace period so an auction created "right now" is not rejected by clock drift or typing time. */
const GRACE_MS = 2 * 60 * 1000;

export const CreateAuctionSchema = CreateAuctionBase.refine(
  (d) => new Date(d.start_at).getTime() >= Date.now() - GRACE_MS,
  { message: 'Start date and time cannot be in the past', path: ['start_at'] }
).refine(
  (d) => new Date(d.end_at).getTime() > Date.now(),
  { message: 'End date and time cannot be in the past', path: ['end_at'] }
).refine(
  (d) => new Date(d.start_at) < new Date(d.end_at),
  { message: 'start_at must be before end_at', path: ['start_at'] }
).refine(
  (d) => d.reserve_price == null || d.reserve_price >= d.starting_price,
  { message: 'Reserve price must be ≥ starting price', path: ['reserve_price'] }
);

export const UpdateAuctionSchema = CreateAuctionBase.partial().extend({
  status: z.enum([
    'draft', 'scheduled', 'open', 'paused', 'closed',
    'reserve_not_met', 'awaiting_award', 'awarded', 'payment_pending',
    'paid', 'stock_allocated', 'preparing', 'dispatched', 'delivered',
    'completed', 'cancelled', 'payment_defaulted', 'disputed',
  ]).optional(),
});

export const CancelAuctionSchema = z.object({
  cancellation_reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

// ─── Auction Lot Schemas ──────────────────────────────────────────────────────

// Base object for .omit()/.partial() usage
const CreateLotBase = z.object({
  auction_id:                uuidField('Auction'),
  inventory_batch_id:        uuidField('Inventory batch'),
  crop_category_id:          uuidField('Crop category'),
  crop_variety_id:           optionalUuid(),
  quality_grade:             z.enum(['grade_a', 'grade_b', 'grade_c', 'rejected']),
  lot_quantity:              z.number().positive('Quantity must be positive'),
  unit:                      z.enum(['kg', 'metric_ton', 'bag', 'crate', 'piece']).default('kg'),
  starting_price_per_unit:   lkrAmount(),
  reserve_price_per_unit:    z.number().positive().optional().nullable(),
  warehouse_id:              optionalUuid(),
  storage_location_id:       optionalUuid(),
  expiry_date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional().nullable(),
  harvest_season:            z.string().max(50).optional().nullable(),
  farming_method:            z.enum(['organic', 'conventional', 'hydroponic', 'mixed']).optional().nullable(),
  origin_district:           z.string().max(100).optional().nullable(),
  origin_divisional_secretariat: z.string().max(100).optional().nullable(),
  traceability_notes:        z.string().max(1000).optional().nullable(),
  images:                    z.array(z.object({
    storage_path: z.string(),
    file_name: z.string(),
    sort_order: z.number().int().optional(),
  })).optional(),
});

export const CreateLotSchema = CreateLotBase.refine(
  (d) => d.reserve_price_per_unit == null || d.reserve_price_per_unit >= d.starting_price_per_unit,
  { message: 'Reserve price must be ≥ starting price per unit', path: ['reserve_price_per_unit'] }
);

export const UpdateLotSchema = CreateLotBase.omit({
  auction_id: true,
  inventory_batch_id: true,
}).partial();


// ─── Bid Schemas ──────────────────────────────────────────────────────────────

export const PlaceBidSchema = z.object({
  bid_amount_per_unit: lkrAmount(),
  bid_quantity:        z.number().positive('Quantity must be positive'),
  // device_reference is optional client hint; hashed server-side
  device_reference:    z.string().max(500).optional(),
});

// ─── Award & Payment Schemas ──────────────────────────────────────────────────

export const ConfirmPaymentSchema = z.object({
  winner_id:       uuidField('Winner record'),
  payment_method:  z.enum(['bank_transfer', 'lanka_qr', 'card', 'cash', 'buyer_credit']),
  payment_ref:     z.string().min(3, 'Payment reference is required').max(200),
  amount_lkr:      lkrAmount(),
  receipt_note:    z.string().max(500).optional(),
});

export const PaymentDefaultSchema = z.object({
  winner_id: uuidField('Winner record'),
  reason:    z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

// ─── Dispute Schemas ──────────────────────────────────────────────────────────

export const SubmitDisputeSchema = z.object({
  auction_id:     uuidField('Auction'),
  auction_lot_id: optionalUuid(),
  dispute_type:   z.enum(['bid_dispute', 'payment_dispute', 'quality_dispute', 'other']),
  description:    z.string().min(20, 'Describe the issue in at least 20 characters').max(2000),
  evidence_urls:  z.array(z.string().url()).max(5).optional(),
});

export const ResolveDisputeSchema = z.object({
  status:     z.enum(['under_review', 'resolved', 'rejected']),
  resolution: z.string().min(10, 'Resolution must be at least 10 characters').max(1000).optional(),
});

// ─── Credit Limit Schema ──────────────────────────────────────────────────────

export const CreditLimitSchema = z.object({
  credit_limit_lkr: z.number().nonnegative('Credit limit cannot be negative'),
  notes:            z.string().max(500).optional(),
});

// ─── List / Filter Schemas ────────────────────────────────────────────────────

export const AuctionListQuerySchema = z.object({
  status:      z.string().optional(),
  centre_id:   z.string().uuid().optional(),
  crop:        z.string().optional(),
  grade:       z.string().optional(),
  page:        z.string().regex(/^\d+$/).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  limit:       z.string().regex(/^\d+$/).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
}).transform((d) => ({
  ...d,
  page:  d.page  ?? 1,
  limit: Math.min(d.limit ?? 20, 100),
}));

// ─── Exported types ───────────────────────────────────────────────────────────

export type CreateAuctionInput  = z.infer<typeof CreateAuctionSchema>;
export type UpdateAuctionInput  = z.infer<typeof UpdateAuctionSchema>;
export type CreateLotInput      = z.infer<typeof CreateLotSchema>;
export type PlaceBidInput       = z.infer<typeof PlaceBidSchema>;
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;
export type PaymentDefaultInput = z.infer<typeof PaymentDefaultSchema>;
export type SubmitDisputeInput  = z.infer<typeof SubmitDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;
export type CreditLimitInput    = z.infer<typeof CreditLimitSchema>;
export type AuctionListQuery    = z.infer<typeof AuctionListQuerySchema>;
