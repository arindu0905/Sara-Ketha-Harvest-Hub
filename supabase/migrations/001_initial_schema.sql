-- ============================================================
-- HarvestHub Database Migration 001: Initial Schema
-- Agricultural Collection Centre Management System
-- Currency: LKR | Weight: kg
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'farmer',
  'collection_centre_officer',
  'quality_inspector',
  'inventory_manager',
  'buyer',
  'finance_officer',
  'transport_coordinator',
  'administrator'
);

CREATE TYPE account_status AS ENUM ('active', 'inactive', 'suspended', 'pending');

CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TYPE collection_status AS ENUM (
  'scheduled', 'arrived', 'weighed', 'under_inspection',
  'accepted', 'partially_accepted', 'rejected',
  'added_to_inventory', 'payment_pending', 'completed'
);

CREATE TYPE quality_grade AS ENUM ('grade_a', 'grade_b', 'grade_c', 'rejected');

CREATE TYPE batch_status AS ENUM (
  'available', 'reserved', 'partially_sold', 'sold', 'expired', 'damaged', 'disposed'
);

CREATE TYPE order_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'rejected',
  'stock_reserved', 'payment_pending', 'paid', 'preparing',
  'dispatched', 'delivered', 'completed', 'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending_calculation', 'calculated', 'pending_approval',
  'approved', 'processing', 'paid', 'failed', 'disputed'
);

CREATE TYPE complaint_status AS ENUM (
  'submitted', 'under_review', 'assigned', 'in_progress',
  'resolved', 'rejected', 'closed'
);

CREATE TYPE complaint_category AS ENUM (
  'incorrect_weight', 'incorrect_grade', 'incorrect_payment',
  'delayed_payment', 'delivery_issue', 'product_quality_issue',
  'system_issue', 'other'
);

CREATE TYPE notification_type AS ENUM (
  'account_approval', 'new_price', 'appointment_confirmation',
  'weighing_completed', 'inspection_completed', 'produce_rejection',
  'payment_approval', 'payment_completed', 'new_order', 'low_stock',
  'near_expiry', 'order_approval', 'invoice_generated',
  'payment_confirmed', 'delivery_dispatched', 'delivery_completed',
  'complaint_update', 'general'
);

CREATE TYPE price_status AS ENUM ('active', 'inactive', 'superseded');

CREATE TYPE farming_method AS ENUM ('organic', 'conventional', 'hydroponic', 'mixed');

CREATE TYPE rejection_reason AS ENUM (
  'damaged', 'overripe', 'underripe', 'pest_damage',
  'contamination', 'incorrect_size', 'excessive_moisture',
  'poor_appearance', 'other'
);

CREATE TYPE delivery_status AS ENUM (
  'scheduled', 'in_transit', 'arrived', 'delivered', 'failed', 'cancelled'
);

-- ============================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'farmer',
  account_status  account_status NOT NULL DEFAULT 'pending',
  assigned_centre UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: collection_centres
-- ============================================================

CREATE TABLE IF NOT EXISTS public.collection_centres (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  address         TEXT NOT NULL,
  district        TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  manager_id      UUID REFERENCES public.profiles(id),
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

-- Add FK from profiles to collection_centres
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_centre
  FOREIGN KEY (assigned_centre) REFERENCES public.collection_centres(id);

-- ============================================================
-- TABLE: farmers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id            UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  farmer_code           TEXT UNIQUE NOT NULL,
  nic_number            TEXT UNIQUE NOT NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT NOT NULL,
  address               TEXT NOT NULL,
  district              TEXT NOT NULL,
  divisional_secretariat TEXT,
  farm_name             TEXT,
  farm_location         TEXT,
  farm_size_acres       DECIMAL(10, 2),
  bank_name             TEXT,
  bank_branch           TEXT,
  account_holder_name   TEXT,
  account_number_masked TEXT,  -- store masked version only
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  verification_status   verification_status NOT NULL DEFAULT 'unverified',
  account_status        account_status NOT NULL DEFAULT 'active',
  verified_by           UUID REFERENCES public.profiles(id),
  verified_at           TIMESTAMPTZ,
  assigned_centre_id    UUID REFERENCES public.collection_centres(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES public.profiles(id),
  updated_by            UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_farm_size_positive CHECK (farm_size_acres IS NULL OR farm_size_acres > 0)
);

-- ============================================================
-- TABLE: farmer_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmer_documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id    UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size    INTEGER,
  mime_type    TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by  UUID REFERENCES public.profiles(id),
  is_verified  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- TABLE: crop_categories
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crop_categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT UNIQUE NOT NULL,
  name_sinhala TEXT,
  name_tamil   TEXT,
  description  TEXT,
  image_url    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: crop_varieties
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crop_varieties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.crop_categories(id),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id),

  CONSTRAINT uq_variety_per_category UNIQUE (category_id, name)
);

-- ============================================================
-- TABLE: farmer_crops
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmer_crops (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id             UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  category_id           UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id            UUID REFERENCES public.crop_varieties(id),
  cultivated_area_acres DECIMAL(10, 2),
  planting_date         DATE,
  expected_harvest_date DATE,
  expected_quantity_kg  DECIMAL(12, 2),
  farming_method        farming_method NOT NULL DEFAULT 'conventional',
  certification_status  TEXT,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_expected_quantity_positive CHECK (expected_quantity_kg IS NULL OR expected_quantity_kg > 0),
  CONSTRAINT ck_cultivated_area_positive CHECK (cultivated_area_acres IS NULL OR cultivated_area_acres > 0)
);

-- ============================================================
-- TABLE: crop_prices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crop_prices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id       UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id        UUID REFERENCES public.crop_varieties(id),
  centre_id         UUID REFERENCES public.collection_centres(id),
  grade             quality_grade NOT NULL,
  purchase_price    DECIMAL(12, 2) NOT NULL,
  selling_price     DECIMAL(12, 2) NOT NULL,
  unit              TEXT NOT NULL DEFAULT 'kg',
  effective_from    DATE NOT NULL,
  effective_until   DATE,
  status            price_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES public.profiles(id),
  approved_by       UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_purchase_price_positive CHECK (purchase_price > 0),
  CONSTRAINT ck_selling_price_positive CHECK (selling_price > 0),
  CONSTRAINT ck_price_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- ============================================================
-- TABLE: delivery_appointments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_no    TEXT UNIQUE NOT NULL,
  farmer_id       UUID NOT NULL REFERENCES public.farmers(id),
  centre_id       UUID NOT NULL REFERENCES public.collection_centres(id),
  category_id     UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id      UUID REFERENCES public.crop_varieties(id),
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME,
  estimated_qty_kg DECIMAL(12, 2),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: produce_collections
-- ============================================================

CREATE TABLE IF NOT EXISTS public.produce_collections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_no       TEXT UNIQUE NOT NULL,
  appointment_id      UUID REFERENCES public.delivery_appointments(id),
  farmer_id           UUID NOT NULL REFERENCES public.farmers(id),
  centre_id           UUID NOT NULL REFERENCES public.collection_centres(id),
  category_id         UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id          UUID REFERENCES public.crop_varieties(id),
  vehicle_number      TEXT,
  driver_name         TEXT,
  gross_weight_kg     DECIMAL(12, 3),
  container_weight_kg DECIMAL(12, 3) DEFAULT 0,
  net_weight_kg       DECIMAL(12, 3) GENERATED ALWAYS AS (
                        CASE WHEN gross_weight_kg IS NOT NULL
                        THEN gross_weight_kg - COALESCE(container_weight_kg, 0)
                        ELSE NULL END
                      ) STORED,
  status              collection_status NOT NULL DEFAULT 'scheduled',
  arrived_at          TIMESTAMPTZ,
  weighed_at          TIMESTAMPTZ,
  officer_id          UUID REFERENCES public.profiles(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id),
  updated_by          UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_gross_weight_positive CHECK (gross_weight_kg IS NULL OR gross_weight_kg > 0),
  CONSTRAINT ck_container_weight_nonneg CHECK (container_weight_kg IS NULL OR container_weight_kg >= 0),
  CONSTRAINT ck_net_weight_positive CHECK (
    gross_weight_kg IS NULL OR container_weight_kg IS NULL OR
    gross_weight_kg > container_weight_kg
  )
);

-- ============================================================
-- TABLE: quality_inspections
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id       UUID UNIQUE NOT NULL REFERENCES public.produce_collections(id),
  inspector_id        UUID NOT NULL REFERENCES public.profiles(id),
  grade               quality_grade NOT NULL,
  accepted_qty_kg     DECIMAL(12, 3) NOT NULL,
  rejected_qty_kg     DECIMAL(12, 3) NOT NULL DEFAULT 0,
  inspection_notes    TEXT,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_accepted_nonneg CHECK (accepted_qty_kg >= 0),
  CONSTRAINT ck_rejected_nonneg CHECK (rejected_qty_kg >= 0)
);

-- ============================================================
-- TABLE: collection_rejections (rejection detail records)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.collection_rejections (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id  UUID NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  reason         rejection_reason NOT NULL,
  quantity_kg    DECIMAL(12, 3),
  notes          TEXT,
  image_url      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: warehouses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centre_id   UUID NOT NULL REFERENCES public.collection_centres(id),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE NOT NULL,
  capacity_kg DECIMAL(15, 2),
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: storage_locations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id  UUID NOT NULL REFERENCES public.warehouses(id),
  code          TEXT NOT NULL,
  description   TEXT,
  capacity_kg   DECIMAL(12, 2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_location_per_warehouse UNIQUE (warehouse_id, code)
);

-- ============================================================
-- TABLE: inventory_batches
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_no            TEXT UNIQUE NOT NULL,
  qr_code_value       TEXT UNIQUE NOT NULL,
  collection_id       UUID NOT NULL REFERENCES public.produce_collections(id),
  farmer_id           UUID NOT NULL REFERENCES public.farmers(id),
  category_id         UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id          UUID REFERENCES public.crop_varieties(id),
  grade               quality_grade NOT NULL,
  initial_qty_kg      DECIMAL(12, 3) NOT NULL,
  available_qty_kg    DECIMAL(12, 3) NOT NULL,
  reserved_qty_kg     DECIMAL(12, 3) NOT NULL DEFAULT 0,
  sold_qty_kg         DECIMAL(12, 3) NOT NULL DEFAULT 0,
  wasted_qty_kg       DECIMAL(12, 3) NOT NULL DEFAULT 0,
  unit                TEXT NOT NULL DEFAULT 'kg',
  purchase_price_lkr  DECIMAL(12, 2) NOT NULL,
  selling_price_lkr   DECIMAL(12, 2) NOT NULL,
  received_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_expiry_date DATE,
  warehouse_id        UUID REFERENCES public.warehouses(id),
  storage_location_id UUID REFERENCES public.storage_locations(id),
  status              batch_status NOT NULL DEFAULT 'available',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES public.profiles(id),

  CONSTRAINT ck_initial_qty_positive CHECK (initial_qty_kg > 0),
  CONSTRAINT ck_available_qty_nonneg CHECK (available_qty_kg >= 0),
  CONSTRAINT ck_reserved_qty_nonneg CHECK (reserved_qty_kg >= 0),
  CONSTRAINT ck_sold_qty_nonneg CHECK (sold_qty_kg >= 0),
  CONSTRAINT ck_wasted_qty_nonneg CHECK (wasted_qty_kg >= 0)
);

-- ============================================================
-- TABLE: inventory_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id      UUID NOT NULL REFERENCES public.inventory_batches(id),
  transaction_type TEXT NOT NULL, -- 'received','reserved','sold','wasted','adjusted','transferred'
  quantity_kg   DECIMAL(12, 3) NOT NULL,
  balance_kg    DECIMAL(12, 3) NOT NULL,
  reference_id  UUID,
  reference_type TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: buyers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id        UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_code        TEXT UNIQUE NOT NULL,
  company_name      TEXT NOT NULL,
  business_reg_no   TEXT UNIQUE,
  contact_person    TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  address           TEXT NOT NULL,
  district          TEXT NOT NULL,
  buyer_type        TEXT NOT NULL DEFAULT 'retail', -- retail, wholesale, export
  credit_limit_lkr  DECIMAL(15, 2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  account_status    account_status NOT NULL DEFAULT 'active',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: buyer_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id     UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size    INTEGER,
  mime_type    TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by  UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: purchase_orders
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no        TEXT UNIQUE NOT NULL,
  buyer_id        UUID NOT NULL REFERENCES public.buyers(id),
  centre_id       UUID REFERENCES public.collection_centres(id),
  status          order_status NOT NULL DEFAULT 'draft',
  requested_date  DATE,
  delivery_address TEXT,
  total_amount_lkr DECIMAL(15, 2),
  notes           TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES public.profiles(id),
  approved_at     TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: purchase_order_items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.crop_categories(id),
  variety_id      UUID REFERENCES public.crop_varieties(id),
  grade           quality_grade,
  requested_qty_kg DECIMAL(12, 3) NOT NULL,
  unit_price_lkr  DECIMAL(12, 2),
  total_price_lkr DECIMAL(15, 2),
  notes           TEXT,

  CONSTRAINT ck_requested_qty_positive CHECK (requested_qty_kg > 0)
);

-- ============================================================
-- TABLE: stock_allocations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_allocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES public.purchase_orders(id),
  order_item_id   UUID NOT NULL REFERENCES public.purchase_order_items(id),
  batch_id        UUID NOT NULL REFERENCES public.inventory_batches(id),
  allocated_qty_kg DECIMAL(12, 3) NOT NULL,
  allocated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by    UUID REFERENCES public.profiles(id),
  status          TEXT NOT NULL DEFAULT 'reserved', -- reserved, dispatched, returned

  CONSTRAINT ck_allocated_qty_positive CHECK (allocated_qty_kg > 0),
  CONSTRAINT uq_allocation UNIQUE (order_item_id, batch_id)
);

-- ============================================================
-- TABLE: invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no        TEXT UNIQUE NOT NULL,
  order_id          UUID NOT NULL REFERENCES public.purchase_orders(id),
  buyer_id          UUID NOT NULL REFERENCES public.buyers(id),
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  subtotal_lkr      DECIMAL(15, 2) NOT NULL,
  tax_amount_lkr    DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_lkr      DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount_lkr  DECIMAL(15, 2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'issued', -- issued, paid, overdue, cancelled
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: invoice_items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity_kg     DECIMAL(12, 3),
  unit_price_lkr  DECIMAL(12, 2),
  total_lkr       DECIMAL(15, 2) NOT NULL
);

-- ============================================================
-- TABLE: buyer_payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.buyer_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id),
  buyer_id        UUID NOT NULL REFERENCES public.buyers(id),
  amount_lkr      DECIMAL(15, 2) NOT NULL,
  payment_method  TEXT NOT NULL, -- bank_transfer, cash, cheque
  payment_date    DATE NOT NULL,
  reference_no    TEXT,
  notes           TEXT,
  recorded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_buyer_payment_positive CHECK (amount_lkr > 0)
);

-- ============================================================
-- TABLE: farmer_payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmer_payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_no          TEXT UNIQUE NOT NULL,
  collection_id       UUID NOT NULL REFERENCES public.produce_collections(id),
  farmer_id           UUID NOT NULL REFERENCES public.farmers(id),
  grade               quality_grade NOT NULL,
  accepted_qty_kg     DECIMAL(12, 3) NOT NULL,
  price_per_kg_lkr    DECIMAL(12, 2) NOT NULL,
  gross_amount_lkr    DECIMAL(15, 2) NOT NULL,
  total_deductions_lkr DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_amount_lkr      DECIMAL(15, 2) NOT NULL,
  status              payment_status NOT NULL DEFAULT 'pending_calculation',
  payment_method      TEXT,
  payment_date        DATE,
  calculated_by       UUID REFERENCES public.profiles(id),
  calculated_at       TIMESTAMPTZ,
  approved_by         UUID REFERENCES public.profiles(id),
  approved_at         TIMESTAMPTZ,
  paid_by             UUID REFERENCES public.profiles(id),
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_gross_amount_positive CHECK (gross_amount_lkr > 0),
  CONSTRAINT ck_net_amount_nonneg CHECK (net_amount_lkr >= 0),
  CONSTRAINT ck_deductions_nonneg CHECK (total_deductions_lkr >= 0)
);

-- ============================================================
-- TABLE: farmer_payment_deductions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmer_payment_deductions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES public.farmer_payments(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  amount_lkr      DECIMAL(12, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ck_deduction_positive CHECK (amount_lkr >= 0)
);

-- ============================================================
-- TABLE: transport_vehicles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.transport_vehicles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centre_id      UUID REFERENCES public.collection_centres(id),
  plate_number   TEXT UNIQUE NOT NULL,
  vehicle_type   TEXT NOT NULL, -- truck, van, pickup, refrigerated
  capacity_kg    DECIMAL(12, 2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: drivers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.drivers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centre_id      UUID REFERENCES public.collection_centres(id),
  full_name      TEXT NOT NULL,
  nic_number     TEXT UNIQUE NOT NULL,
  phone          TEXT NOT NULL,
  license_no     TEXT UNIQUE NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: delivery_schedules
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_no     TEXT UNIQUE NOT NULL,
  order_id        UUID REFERENCES public.purchase_orders(id),
  vehicle_id      UUID REFERENCES public.transport_vehicles(id),
  driver_id       UUID REFERENCES public.drivers(id),
  coordinator_id  UUID REFERENCES public.profiles(id),
  pickup_address  TEXT,
  delivery_address TEXT NOT NULL,
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME,
  status          delivery_status NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: delivery_tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id     UUID NOT NULL REFERENCES public.delivery_schedules(id),
  status          delivery_status NOT NULL,
  location        TEXT,
  notes           TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by     UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: complaints
-- ============================================================

CREATE TABLE IF NOT EXISTS public.complaints (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_no    TEXT UNIQUE NOT NULL,
  submitted_by    UUID NOT NULL REFERENCES public.profiles(id),
  category        complaint_category NOT NULL,
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  evidence_url    TEXT,
  status          complaint_status NOT NULL DEFAULT 'submitted',
  assigned_to     UUID REFERENCES public.profiles(id),
  resolution      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: complaint_comments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.profiles(id),
  comment      TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            notification_type NOT NULL DEFAULT 'general',
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id),
  document_type   TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID REFERENCES public.profiles(id),
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: system_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- INDEXES for performance
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(account_status);

-- farmers
CREATE INDEX idx_farmers_district ON public.farmers(district);
CREATE INDEX idx_farmers_verification ON public.farmers(verification_status);
CREATE INDEX idx_farmers_centre ON public.farmers(assigned_centre_id);
CREATE INDEX idx_farmers_profile ON public.farmers(profile_id);

-- farmer_crops
CREATE INDEX idx_farmer_crops_farmer ON public.farmer_crops(farmer_id);
CREATE INDEX idx_farmer_crops_category ON public.farmer_crops(category_id);

-- crop_prices
CREATE INDEX idx_crop_prices_category ON public.crop_prices(category_id);
CREATE INDEX idx_crop_prices_effective ON public.crop_prices(effective_from, effective_until);
CREATE INDEX idx_crop_prices_status ON public.crop_prices(status);

-- produce_collections
CREATE INDEX idx_collections_farmer ON public.produce_collections(farmer_id);
CREATE INDEX idx_collections_centre ON public.produce_collections(centre_id);
CREATE INDEX idx_collections_status ON public.produce_collections(status);
CREATE INDEX idx_collections_date ON public.produce_collections(created_at);

-- quality_inspections
CREATE INDEX idx_inspections_collection ON public.quality_inspections(collection_id);
CREATE INDEX idx_inspections_inspector ON public.quality_inspections(inspector_id);
CREATE INDEX idx_inspections_grade ON public.quality_inspections(grade);

-- inventory_batches
CREATE INDEX idx_batches_category ON public.inventory_batches(category_id);
CREATE INDEX idx_batches_status ON public.inventory_batches(status);
CREATE INDEX idx_batches_expiry ON public.inventory_batches(expected_expiry_date);
CREATE INDEX idx_batches_warehouse ON public.inventory_batches(warehouse_id);
CREATE INDEX idx_batches_farmer ON public.inventory_batches(farmer_id);

-- purchase_orders
CREATE INDEX idx_orders_buyer ON public.purchase_orders(buyer_id);
CREATE INDEX idx_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_orders_centre ON public.purchase_orders(centre_id);

-- farmer_payments
CREATE INDEX idx_fpayments_farmer ON public.farmer_payments(farmer_id);
CREATE INDEX idx_fpayments_status ON public.farmer_payments(status);
CREATE INDEX idx_fpayments_collection ON public.farmer_payments(collection_id);

-- notifications
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);

-- audit_logs
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at);

-- complaints
CREATE INDEX idx_complaints_submitter ON public.complaints(submitted_by);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_assigned ON public.complaints(assigned_to);

-- delivery_schedules
CREATE INDEX idx_deliveries_status ON public.delivery_schedules(status);
CREATE INDEX idx_deliveries_date ON public.delivery_schedules(scheduled_date);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_farmers_updated_at
  BEFORE UPDATE ON public.farmers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_centres_updated_at
  BEFORE UPDATE ON public.collection_centres
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_farmer_crops_updated_at
  BEFORE UPDATE ON public.farmer_crops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_crop_prices_updated_at
  BEFORE UPDATE ON public.crop_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.produce_collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_inspections_updated_at
  BEFORE UPDATE ON public.quality_inspections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_batches_updated_at
  BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fpayments_updated_at
  BEFORE UPDATE ON public.farmer_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
