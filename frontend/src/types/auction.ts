// ─── Auction Module TypeScript Interfaces ────────────────────────────────────
// Sri Lankan Agricultural Produce Auction & Competitive Bidding

export type AuctionStatus =
  | 'draft' | 'scheduled' | 'open' | 'paused' | 'closed'
  | 'reserve_not_met' | 'awaiting_award' | 'awarded' | 'payment_pending'
  | 'paid' | 'stock_allocated' | 'preparing' | 'dispatched' | 'delivered'
  | 'completed' | 'cancelled' | 'payment_defaulted' | 'disputed';

export type AuctionLotStatus =
  | 'draft' | 'published' | 'open' | 'closed' | 'awarded' | 'cancelled' | 're_offered';

export type AuctionBidStatus =
  | 'pending' | 'accepted' | 'rejected' | 'outbid' | 'withdrawn_system' | 'winning';

export type AuctionType = 'open_ascending' | 'sealed_bid';

export type AuctionUnit = 'kg' | 'metric_ton' | 'bag' | 'crate' | 'piece';

export type AuctionDisputeStatus = 'submitted' | 'under_review' | 'resolved' | 'rejected';

export type AuctionPaymentMethod = 'bank_transfer' | 'lanka_qr' | 'card' | 'cash' | 'buyer_credit';

export interface CollectionCentreSummary {
  id:       string;
  name:     string;
  district: string;
  address?: string;
  phone?:   string;
}

export interface CropCategorySummary {
  id:           string;
  name:         string;
  name_sinhala?: string;
  name_tamil?:  string;
}

export interface CropVarietySummary {
  id:   string;
  name: string;
}

export interface LotImage {
  id:           string;
  storage_path: string;
  file_name:    string;
  mime_type?:   string;
  sort_order:   number;
}

export interface AuctionLot {
  id:                       string;
  auction_id:               string;
  lot_number:               number;
  inventory_batch_id:       string;
  crop_category_id:         string;
  crop_variety_id?:         string;
  quality_grade:            'grade_a' | 'grade_b' | 'grade_c' | 'rejected';
  lot_quantity:             number;
  unit:                     AuctionUnit;
  starting_price_per_unit:  number;
  reserve_price_per_unit?:  number;
  has_reserve?:             boolean;  // from view (never exposes actual reserve value to public)
  current_price_per_unit:   number;
  warehouse_id?:            string;
  storage_location_id?:     string;
  expiry_date?:             string;
  harvest_season?:          string;
  farming_method?:          string;
  origin_district?:         string;
  origin_divisional_secretariat?: string;
  traceability_notes?:      string;
  lot_status:               AuctionLotStatus;
  winning_price_per_unit?:  number;
  total_winning_amount?:    number;
  bid_count?:               number;
  // Joined
  crop_categories?:         CropCategorySummary;
  crop_varieties?:          CropVarietySummary;
  warehouses?:              { name: string; code: string };
  auction_lot_images?:      LotImage[];
  created_at:               string;
  updated_at:               string;
}

export interface Auction {
  id:                      string;
  auction_number:          string;
  collection_centre_id:    string;
  auction_type:            AuctionType;
  title:                   string;
  title_sinhala?:          string;
  title_tamil?:            string;
  description?:            string;
  description_sinhala?:    string;
  description_tamil?:      string;
  start_at:                string;
  end_at:                  string;
  original_end_at:         string;
  currency:                string;
  starting_price:          number;
  reserve_price?:          number;
  has_reserve?:            boolean;
  minimum_increment:       number;
  payment_deadline_hours:  number;
  auto_extension_enabled:  boolean;
  extension_minutes:       number;
  status:                  AuctionStatus;
  created_by:              string;
  approved_by?:            string;
  cancellation_reason?:    string;
  // Aggregates (from view)
  total_lots?:             number;
  open_lots?:              number;
  total_bids?:             number;
  centre_name?:            string;
  centre_district?:        string;
  // Joined
  collection_centres?:     CollectionCentreSummary;
  auction_lots?:           AuctionLot[];
  created_at:              string;
  updated_at:              string;
}

export interface AuctionBid {
  id:                  string;
  auction_id:          string;
  auction_lot_id:      string;
  buyer_id:            string;
  bid_amount_per_unit: number;
  bid_quantity:        number;
  total_bid_amount:    number;
  bid_sequence:        number;
  bid_time:            string;
  status:              AuctionBidStatus;
  rejection_reason?:   string;
  // Joined (when viewing own bids)
  auctions?:           Pick<Auction, 'id' | 'auction_number' | 'title' | 'status' | 'end_at'>;
  auction_lots?:       Pick<AuctionLot, 'id' | 'lot_number' | 'quality_grade' | 'lot_status' | 'current_price_per_unit'>;
  created_at:          string;
}

export interface AuctionWinner {
  id:                    string;
  auction_id:            string;
  auction_lot_id:        string;
  winning_bid_id:        string;
  buyer_id:              string;
  winning_price_per_unit: number;
  awarded_quantity:      number;
  total_award_amount:    number;
  payment_deadline_at:   string;
  payment_status:        'pending' | 'paid' | 'defaulted';
  payment_confirmed_at?: string;
  purchase_order_id?:    string;
  invoice_id?:           string;
  offer_round:           number;
  awarded_at:            string;
  // Joined
  auctions?:             Pick<Auction, 'id' | 'auction_number' | 'title' | 'status' | 'end_at'>;
  auction_lots?:         Pick<AuctionLot, 'id' | 'lot_number' | 'quality_grade' | 'lot_quantity' | 'unit'>;
  invoices?:             { id: string; invoice_no: string; status: string; due_date: string; total_amount_lkr: number };
  purchase_orders?:      { id: string; order_no: string; status: string };
  created_at:            string;
  updated_at:            string;
}

export interface AuctionWatchlistItem {
  id:         string;
  auction_id: string;
  buyer_id:   string;
  created_at: string;
  auctions?:  Pick<Auction, 'id' | 'auction_number' | 'title' | 'status' | 'start_at' | 'end_at' | 'starting_price'>;
}

export interface AuctionEvent {
  id:             string;
  auction_id:     string;
  auction_lot_id?: string;
  event_type:     string;
  event_data?:    Record<string, unknown>;
  actor_id?:      string;
  created_at:     string;
}

export interface AuctionDispute {
  id:             string;
  auction_id:     string;
  auction_lot_id?: string;
  submitted_by:   string;
  dispute_type:   'bid_dispute' | 'payment_dispute' | 'quality_dispute' | 'other';
  description:    string;
  evidence_urls?: string[];
  status:         AuctionDisputeStatus;
  assigned_to?:   string;
  resolution?:    string;
  resolved_by?:   string;
  resolved_at?:   string;
  // Joined
  auctions?:      Pick<Auction, 'auction_number' | 'title'>;
  profiles?:      { full_name: string; email: string };
  created_at:     string;
  updated_at:     string;
}

export interface AuctionSettlement {
  id:                     string;
  auction_id:             string;
  auction_lot_id:         string;
  farmer_id:              string;
  winning_price_per_unit: number;
  awarded_quantity:       number;
  gross_amount_lkr:       number;
  service_charge_pct:     number;
  service_charge_lkr:     number;
  other_deductions_lkr:   number;
  net_amount_lkr:         number;
  status:                 string;
  payment_method?:        string;
  payment_date?:          string;
  payment_reference?:     string;
  notes?:                 string;
  // Joined
  auctions?:              Pick<Auction, 'id' | 'auction_number' | 'title' | 'end_at'>;
  auction_lots?:          {
    id: string; lot_number: number; lot_quantity: number; unit: AuctionUnit; quality_grade: string;
    crop_categories: CropCategorySummary;
  };
  created_at:             string;
  updated_at:             string;
}

export interface BuyerCreditLimit {
  id:               string;
  buyer_id:         string;
  credit_limit_lkr: number;
  utilised_lkr:     number;
  available_lkr:    number;
  notes?:           string;
  set_by?:          string;
  buyers?:          { buyer_code: string; company_name: string; verification_status: string };
  created_at:       string;
  updated_at:       string;
}

export interface BuyerDeposit {
  id:                  string;
  buyer_id:            string;
  auction_winner_id?:  string;
  payment_provider:    string;
  provider_reference?: string;
  provider_status:     string;
  amount_lkr:          number;
  currency:            string;
  receipt_storage_path?: string;
  payment_initiated_at?: string;
  payment_completed_at?: string;
  created_at:          string;
  updated_at:          string;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface PlaceBidResult {
  success:           boolean;
  bid_id?:           string;
  bid_sequence?:     number;
  bid_amount_per_unit?: number;
  bid_time?:         string;
  extension_applied?: boolean;
  new_end_at?:       string;
  current_price?:    number;
  code?:             string;
  message?:          string;
  minimum_bid?:      number;
}

export interface AuctionReportSummary {
  period:                 { from: string; to: string };
  total_auctions:         number;
  successful_auctions:    number;
  success_rate_pct:       number;
  total_revenue_lkr:      number;
  total_bids:             number;
  avg_bids_per_auction:   number;
  payment_defaults:       number;
  default_rate_pct:       number;
}

// ─── Form input types (for React Hook Form) ───────────────────────────────────

export interface CreateAuctionFormData {
  collection_centre_id:   string;
  auction_type:           AuctionType;
  title:                  string;
  title_sinhala?:         string;
  title_tamil?:           string;
  description?:           string;
  start_at:               string;
  end_at:                 string;
  starting_price:         number;
  reserve_price?:         number;
  minimum_increment:      number;
  payment_deadline_hours: number;
  auto_extension_enabled: boolean;
  extension_minutes:      number;
}

export interface CreateLotFormData {
  inventory_batch_id:       string;
  crop_category_id:         string;
  crop_variety_id?:         string;
  quality_grade:            'grade_a' | 'grade_b' | 'grade_c';
  lot_quantity:             number;
  unit:                     AuctionUnit;
  starting_price_per_unit:  number;
  reserve_price_per_unit?:  number;
  expiry_date?:             string;
  harvest_season?:          string;
  farming_method?:          string;
  origin_district?:         string;
  traceability_notes?:      string;
}

export interface PlaceBidFormData {
  bid_amount_per_unit: number;
  bid_quantity:        number;
}

export interface ConfirmPaymentFormData {
  winner_id:      string;
  payment_method: AuctionPaymentMethod;
  payment_ref:    string;
  amount_lkr:     number;
}
