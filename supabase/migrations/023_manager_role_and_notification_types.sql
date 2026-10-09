-- Migration 023: Management stakeholder role + new notification types
-- (E4-US6..US9 "As a Manager"; E2-US8 receipts; E3-US4 wastage; E3-US14 bid results)
-- NOTE: ALTER TYPE ... ADD VALUE must be committed before the new values are used,
-- so this migration is intentionally separate from 024/025.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bid_result';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'collection_receipt';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wastage_alert';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_receipt';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reservation_released';
