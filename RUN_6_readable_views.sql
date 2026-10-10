-- RUN_6: human-readable views of every table (schema "readable")
-- Each view replaces UUID references by names (farmer, batch, user ...), turns codes like "in_transit" into "In Transit",
-- formats dates in Sri Lanka time and shows true/false as Yes/No.  Safe to re-run.  Read-only: it changes no data.

CREATE SCHEMA IF NOT EXISTS readable;

CREATE OR REPLACE VIEW readable.auction_bids AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.lot_number AS "Auction Lot",
  j3.company_name::text AS "Buyer",
  s.bid_amount_per_unit AS "Bid Amount Per Unit",
  s.bid_quantity AS "Bid Quantity",
  s.total_bid_amount AS "Total Bid Amount",
  s.bid_sequence AS "Bid Sequence",
  to_char(s.bid_time AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Bid Time",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.rejection_reason AS "Rejection Reason",
  s.bidder_ip_hash AS "Bidder Ip Hash",
  s.bidder_device_reference AS "Bidder Device Reference",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.auction_bids s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.auction_lots j2 ON j2.id = s.auction_lot_id
LEFT JOIN public.buyers j3 ON j3.id = s.buyer_id
;

CREATE OR REPLACE VIEW readable.auction_disputes AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.lot_number AS "Auction Lot",
  COALESCE(j3.full_name, j3.email) AS "Submitted By",
  initcap(replace(s.dispute_type::text, '_', ' ')) AS "Dispute Type",
  s.description AS "Description",
  s.evidence_urls AS "Evidence Urls",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  COALESCE(j4.full_name, j4.email) AS "Assigned To",
  s.resolution AS "Resolution",
  COALESCE(j5.full_name, j5.email) AS "Resolved By",
  to_char(s.resolved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Resolved At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.auction_disputes s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.auction_lots j2 ON j2.id = s.auction_lot_id
LEFT JOIN public.profiles j3 ON j3.id = s.submitted_by
LEFT JOIN public.profiles j4 ON j4.id = s.assigned_to
LEFT JOIN public.profiles j5 ON j5.id = s.resolved_by
;

CREATE OR REPLACE VIEW readable.auction_events AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.lot_number AS "Auction Lot",
  initcap(replace(s.event_type::text, '_', ' ')) AS "Event Type",
  s.event_data::text AS "Event Data",
  COALESCE(j3.full_name, j3.email) AS "Actor",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.auction_events s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.auction_lots j2 ON j2.id = s.auction_lot_id
LEFT JOIN public.profiles j3 ON j3.id = s.actor_id
;

CREATE OR REPLACE VIEW readable.auction_lot_images AS
SELECT
  j1.lot_number AS "Lot",
  s.storage_path AS "Storage Path",
  s.file_name AS "File Name",
  initcap(replace(s.mime_type::text, '_', ' ')) AS "Mime Type",
  s.sort_order AS "Sort Order",
  to_char(s.uploaded_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Uploaded At",
  COALESCE(j2.full_name, j2.email) AS "Uploaded By"
FROM public.auction_lot_images s
LEFT JOIN public.auction_lots j1 ON j1.id = s.lot_id
LEFT JOIN public.profiles j2 ON j2.id = s.uploaded_by
;

CREATE OR REPLACE VIEW readable.auction_lots AS
SELECT
  j1.auction_number::text AS "Auction",
  s.lot_number AS "Lot Number",
  j2.batch_no::text AS "Inventory Batch",
  j3.name::text AS "Crop Category",
  j4.name::text AS "Crop Variety",
  initcap(replace(s.quality_grade::text, '_', ' ')) AS "Quality Grade",
  s.lot_quantity AS "Lot Quantity",
  initcap(replace(s.unit::text, '_', ' ')) AS "Unit",
  s.starting_price_per_unit AS "Starting Price Per Unit",
  s.reserve_price_per_unit AS "Reserve Price Per Unit",
  s.current_price_per_unit AS "Current Price Per Unit",
  COALESCE(j5.name::text, j5.code::text) AS "Warehouse",
  j6.code::text AS "Storage Location",
  to_char(s.expiry_date, 'YYYY-MM-DD') AS "Expiry Date",
  s.harvest_season AS "Harvest Season",
  initcap(replace(s.farming_method::text, '_', ' ')) AS "Farming Method",
  s.origin_district AS "Origin District",
  s.origin_divisional_secretariat AS "Origin Divisional Secretariat",
  s.traceability_notes AS "Traceability Notes",
  initcap(replace(s.lot_status::text, '_', ' ')) AS "Lot Status",
  s.winning_bid_id AS "Winning Bid",
  j7.company_name::text AS "Winning Buyer",
  s.winning_price_per_unit AS "Winning Price Per Unit",
  s.total_winning_amount AS "Total Winning Amount",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j8.full_name, j8.email) AS "Created By"
FROM public.auction_lots s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.inventory_batches j2 ON j2.id = s.inventory_batch_id
LEFT JOIN public.crop_categories j3 ON j3.id = s.crop_category_id
LEFT JOIN public.crop_varieties j4 ON j4.id = s.crop_variety_id
LEFT JOIN public.warehouses j5 ON j5.id = s.warehouse_id
LEFT JOIN public.storage_locations j6 ON j6.id = s.storage_location_id
LEFT JOIN public.buyers j7 ON j7.id = s.winning_buyer_id
LEFT JOIN public.profiles j8 ON j8.id = s.created_by
;

CREATE OR REPLACE VIEW readable.auction_notification_prefs AS
SELECT
  j1.company_name::text AS "Buyer",
  CASE WHEN s.notify_outbid THEN 'Yes' WHEN s.notify_outbid IS NULL THEN NULL ELSE 'No' END AS "Notify Outbid",
  CASE WHEN s.notify_won THEN 'Yes' WHEN s.notify_won IS NULL THEN NULL ELSE 'No' END AS "Notify Won",
  CASE WHEN s.notify_deadline THEN 'Yes' WHEN s.notify_deadline IS NULL THEN NULL ELSE 'No' END AS "Notify Deadline",
  CASE WHEN s.notify_new_lot THEN 'Yes' WHEN s.notify_new_lot IS NULL THEN NULL ELSE 'No' END AS "Notify New Lot",
  CASE WHEN s.sms_enabled THEN 'Yes' WHEN s.sms_enabled IS NULL THEN NULL ELSE 'No' END AS "Sms Enabled",
  s.sms_phone AS "Sms Phone",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.auction_notification_prefs s
LEFT JOIN public.buyers j1 ON j1.id = s.buyer_id
;

CREATE OR REPLACE VIEW readable.auction_settlements AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.lot_number AS "Auction Lot",
  j3.full_name::text AS "Farmer",
  s.winning_price_per_unit AS "Winning Price Per Unit",
  s.awarded_quantity AS "Awarded Quantity",
  s.gross_amount_lkr AS "Gross Amount Lkr",
  s.service_charge_pct AS "Service Charge Pct",
  s.service_charge_lkr AS "Service Charge Lkr",
  s.other_deductions_lkr AS "Other Deductions Lkr",
  s.net_amount_lkr AS "Net Amount Lkr",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.payment_method AS "Payment Method",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  s.payment_reference AS "Payment Reference",
  COALESCE(j4.full_name, j4.email) AS "Calculated By",
  to_char(s.calculated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Calculated At",
  COALESCE(j5.full_name, j5.email) AS "Approved By",
  to_char(s.approved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Approved At",
  COALESCE(j6.full_name, j6.email) AS "Paid By",
  to_char(s.paid_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Paid At",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.auction_settlements s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.auction_lots j2 ON j2.id = s.auction_lot_id
LEFT JOIN public.farmers j3 ON j3.id = s.farmer_id
LEFT JOIN public.profiles j4 ON j4.id = s.calculated_by
LEFT JOIN public.profiles j5 ON j5.id = s.approved_by
LEFT JOIN public.profiles j6 ON j6.id = s.paid_by
;

CREATE OR REPLACE VIEW readable.auction_watchlists AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.company_name::text AS "Buyer",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.auction_watchlists s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.buyers j2 ON j2.id = s.buyer_id
;

CREATE OR REPLACE VIEW readable.auction_winners AS
SELECT
  j1.auction_number::text AS "Auction",
  j2.lot_number AS "Auction Lot",
  s.winning_bid_id AS "Winning Bid",
  j3.company_name::text AS "Buyer",
  s.winning_price_per_unit AS "Winning Price Per Unit",
  s.awarded_quantity AS "Awarded Quantity",
  s.total_award_amount AS "Total Award Amount",
  to_char(s.payment_deadline_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Payment Deadline At",
  initcap(replace(s.payment_status::text, '_', ' ')) AS "Payment Status",
  to_char(s.payment_confirmed_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Payment Confirmed At",
  COALESCE(j4.full_name, j4.email) AS "Payment Confirmed By",
  j5.order_no::text AS "Purchase Order",
  j6.invoice_no::text AS "Invoice",
  s.offer_round AS "Offer Round",
  COALESCE(j7.full_name, j7.email) AS "Awarded By",
  to_char(s.awarded_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Awarded At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.auction_winners s
LEFT JOIN public.auctions j1 ON j1.id = s.auction_id
LEFT JOIN public.auction_lots j2 ON j2.id = s.auction_lot_id
LEFT JOIN public.buyers j3 ON j3.id = s.buyer_id
LEFT JOIN public.profiles j4 ON j4.id = s.payment_confirmed_by
LEFT JOIN public.purchase_orders j5 ON j5.id = s.purchase_order_id
LEFT JOIN public.invoices j6 ON j6.id = s.invoice_id
LEFT JOIN public.profiles j7 ON j7.id = s.awarded_by
;

CREATE OR REPLACE VIEW readable.auctions AS
SELECT
  s.auction_number AS "Auction Number",
  COALESCE(j1.name::text, j1.code::text) AS "Collection Centre",
  initcap(replace(s.auction_type::text, '_', ' ')) AS "Auction Type",
  s.title AS "Title",
  s.title_sinhala AS "Title Sinhala",
  s.title_tamil AS "Title Tamil",
  s.description AS "Description",
  s.description_sinhala AS "Description Sinhala",
  s.description_tamil AS "Description Tamil",
  to_char(s.start_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Start At",
  to_char(s.end_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "End At",
  to_char(s.original_end_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Original End At",
  s.currency AS "Currency",
  s.starting_price AS "Starting Price",
  s.reserve_price AS "Reserve Price",
  s.minimum_increment AS "Minimum Increment",
  s.payment_deadline_hours AS "Payment Deadline Hours",
  CASE WHEN s.auto_extension_enabled THEN 'Yes' WHEN s.auto_extension_enabled IS NULL THEN NULL ELSE 'No' END AS "Auto Extension Enabled",
  s.extension_minutes AS "Extension Minutes",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  COALESCE(j2.full_name, j2.email) AS "Created By",
  COALESCE(j3.full_name, j3.email) AS "Submitted By",
  to_char(s.submitted_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Submitted At",
  COALESCE(j4.full_name, j4.email) AS "Approved By",
  to_char(s.approved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Approved At",
  COALESCE(j5.full_name, j5.email) AS "Published By",
  to_char(s.published_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Published At",
  COALESCE(j6.full_name, j6.email) AS "Cancelled By",
  to_char(s.cancelled_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Cancelled At",
  s.cancellation_reason AS "Cancellation Reason",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j7.full_name, j7.email) AS "Updated By"
FROM public.auctions s
LEFT JOIN public.collection_centres j1 ON j1.id = s.collection_centre_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
LEFT JOIN public.profiles j3 ON j3.id = s.submitted_by
LEFT JOIN public.profiles j4 ON j4.id = s.approved_by
LEFT JOIN public.profiles j5 ON j5.id = s.published_by
LEFT JOIN public.profiles j6 ON j6.id = s.cancelled_by
LEFT JOIN public.profiles j7 ON j7.id = s.updated_by
;

CREATE OR REPLACE VIEW readable.audit_logs AS
SELECT
  COALESCE(j1.full_name, j1.email) AS "Actor",
  s.action AS "Action",
  initcap(replace(s.entity_type::text, '_', ' ')) AS "Entity Type",
  s.entity_id AS "Entity",
  s.old_values::text AS "Old Values",
  s.new_values::text AS "New Values",
  s.ip_address AS "Ip Address",
  s.user_agent AS "User Agent",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.audit_logs s
LEFT JOIN public.profiles j1 ON j1.id = s.actor_id
;

CREATE OR REPLACE VIEW readable.buyer_credit_limits AS
SELECT
  j1.company_name::text AS "Buyer",
  s.credit_limit_lkr AS "Credit Limit Lkr",
  s.utilised_lkr AS "Utilised Lkr",
  s.available_lkr AS "Available Lkr",
  s.notes AS "Notes",
  COALESCE(j2.full_name, j2.email) AS "Set By",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.buyer_credit_limits s
LEFT JOIN public.buyers j1 ON j1.id = s.buyer_id
LEFT JOIN public.profiles j2 ON j2.id = s.set_by
;

CREATE OR REPLACE VIEW readable.buyer_deposits AS
SELECT
  j1.company_name::text AS "Buyer",
  s.auction_winner_id AS "Auction Winner",
  s.payment_provider AS "Payment Provider",
  s.provider_reference AS "Provider Reference",
  initcap(replace(s.provider_status::text, '_', ' ')) AS "Provider Status",
  s.amount_lkr AS "Amount Lkr",
  s.currency AS "Currency",
  s.receipt_storage_path AS "Receipt Storage Path",
  COALESCE(j2.full_name, j2.email) AS "Recorded By",
  COALESCE(j3.full_name, j3.email) AS "Verified By",
  to_char(s.verified_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Verified At",
  to_char(s.payment_initiated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Payment Initiated At",
  to_char(s.payment_completed_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Payment Completed At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.buyer_deposits s
LEFT JOIN public.buyers j1 ON j1.id = s.buyer_id
LEFT JOIN public.profiles j2 ON j2.id = s.recorded_by
LEFT JOIN public.profiles j3 ON j3.id = s.verified_by
;

CREATE OR REPLACE VIEW readable.buyer_documents AS
SELECT
  j1.company_name::text AS "Buyer",
  initcap(replace(s.document_type::text, '_', ' ')) AS "Document Type",
  s.file_name AS "File Name",
  s.storage_path AS "Storage Path",
  s.file_size AS "File Size",
  initcap(replace(s.mime_type::text, '_', ' ')) AS "Mime Type",
  to_char(s.uploaded_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Uploaded At",
  COALESCE(j2.full_name, j2.email) AS "Uploaded By"
FROM public.buyer_documents s
LEFT JOIN public.buyers j1 ON j1.id = s.buyer_id
LEFT JOIN public.profiles j2 ON j2.id = s.uploaded_by
;

CREATE OR REPLACE VIEW readable.buyer_invoices AS
SELECT
  s.invoice_no AS "Invoice No",
  j1.order_no::text AS "Order",
  j2.company_name::text AS "Buyer",
  to_char(s.issue_date, 'YYYY-MM-DD') AS "Issue Date",
  to_char(s.due_date, 'YYYY-MM-DD') AS "Due Date",
  s.subtotal_lkr AS "Subtotal Lkr",
  s.tax_amount_lkr AS "Tax Amount Lkr",
  s.discount_lkr AS "Discount Lkr",
  s.total_amount_lkr AS "Total Amount Lkr",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.payment_method AS "Payment Method",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  s.reference_no AS "Reference No",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j3.full_name, j3.email) AS "Created By",
  s.amount_paid_lkr AS "Amount Paid Lkr"
FROM public.buyer_invoices s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.buyers j2 ON j2.id = s.buyer_id
LEFT JOIN public.profiles j3 ON j3.id = s.created_by
;

CREATE OR REPLACE VIEW readable.buyer_payments AS
SELECT
  j1.invoice_no::text AS "Invoice",
  j2.company_name::text AS "Buyer",
  s.amount_lkr AS "Amount Lkr",
  s.payment_method AS "Payment Method",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  s.reference_no AS "Reference No",
  s.notes AS "Notes",
  COALESCE(j3.full_name, j3.email) AS "Recorded By",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.buyer_payments s
LEFT JOIN public.invoices j1 ON j1.id = s.invoice_id
LEFT JOIN public.buyers j2 ON j2.id = s.buyer_id
LEFT JOIN public.profiles j3 ON j3.id = s.recorded_by
;

CREATE OR REPLACE VIEW readable.buyers AS
SELECT
  COALESCE(j1.full_name, j1.email) AS "Profile",
  s.buyer_code AS "Buyer Code",
  s.company_name AS "Company Name",
  s.business_reg_no AS "Business Reg No",
  s.contact_person AS "Contact Person",
  s.email AS "Email",
  s.phone AS "Phone",
  s.address AS "Address",
  s.district AS "District",
  initcap(replace(s.buyer_type::text, '_', ' ')) AS "Buyer Type",
  s.credit_limit_lkr AS "Credit Limit Lkr",
  s.payment_terms_days AS "Payment Terms Days",
  initcap(replace(s.verification_status::text, '_', ' ')) AS "Verification Status",
  initcap(replace(s.account_status::text, '_', ' ')) AS "Account Status",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.buyers s
LEFT JOIN public.profiles j1 ON j1.id = s.profile_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.collection_centres AS
SELECT
  s.name AS "Name",
  s.code AS "Code",
  s.address AS "Address",
  s.district AS "District",
  s.phone AS "Phone",
  s.email AS "Email",
  COALESCE(j1.full_name, j1.email) AS "Manager",
  s.latitude AS "Latitude",
  s.longitude AS "Longitude",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j2.full_name, j2.email) AS "Created By",
  s.capacity_kg AS "Capacity Kg"
FROM public.collection_centres s
LEFT JOIN public.profiles j1 ON j1.id = s.manager_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.collection_receipts AS
SELECT
  s.receipt_no AS "Receipt No",
  j1.collection_no::text AS "Collection",
  j2.full_name::text AS "Farmer",
  COALESCE(j3.name::text, j3.code::text) AS "Centre",
  s.gross_weight_kg AS "Gross Weight Kg",
  s.container_weight_kg AS "Container Weight Kg",
  s.net_weight_kg AS "Net Weight Kg",
  s.accepted_qty_kg AS "Accepted Qty Kg",
  s.rejected_qty_kg AS "Rejected Qty Kg",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.batch_no AS "Batch No",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  COALESCE(j4.full_name, j4.email) AS "Issued By",
  to_char(s.issued_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Issued At",
  to_char(s.farmer_confirmed_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Farmer Confirmed At",
  s.farmer_note AS "Farmer Note"
FROM public.collection_receipts s
LEFT JOIN public.produce_collections j1 ON j1.id = s.collection_id
LEFT JOIN public.farmers j2 ON j2.id = s.farmer_id
LEFT JOIN public.collection_centres j3 ON j3.id = s.centre_id
LEFT JOIN public.profiles j4 ON j4.id = s.issued_by
;

CREATE OR REPLACE VIEW readable.collection_rejections AS
SELECT
  s.inspection_id AS "Inspection",
  initcap(replace(s.reason::text, '_', ' ')) AS "Reason",
  s.quantity_kg AS "Quantity Kg",
  s.notes AS "Notes",
  s.image_url AS "Image Url",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.collection_rejections s
;

CREATE OR REPLACE VIEW readable.complaint_comments AS
SELECT
  j1.complaint_no::text AS "Complaint",
  COALESCE(j2.full_name, j2.email) AS "Author",
  s.comment AS "Comment",
  CASE WHEN s.is_internal THEN 'Yes' WHEN s.is_internal IS NULL THEN NULL ELSE 'No' END AS "Is Internal",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.complaint_comments s
LEFT JOIN public.complaints j1 ON j1.id = s.complaint_id
LEFT JOIN public.profiles j2 ON j2.id = s.author_id
;

CREATE OR REPLACE VIEW readable.complaints AS
SELECT
  s.complaint_no AS "Complaint No",
  COALESCE(j1.full_name, j1.email) AS "Submitted By",
  initcap(replace(s.category::text, '_', ' ')) AS "Category",
  s.subject AS "Subject",
  s.description AS "Description",
  s.evidence_url AS "Evidence Url",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  COALESCE(j2.full_name, j2.email) AS "Assigned To",
  s.resolution AS "Resolution",
  to_char(s.resolved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Resolved At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.complaints s
LEFT JOIN public.profiles j1 ON j1.id = s.submitted_by
LEFT JOIN public.profiles j2 ON j2.id = s.assigned_to
;

CREATE OR REPLACE VIEW readable.crop_categories AS
SELECT
  s.name AS "Name",
  s.name_sinhala AS "Name Sinhala",
  s.name_tamil AS "Name Tamil",
  s.description AS "Description",
  s.image_url AS "Image Url",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j1.full_name, j1.email) AS "Created By",
  s.shelf_life_days AS "Shelf Life Days"
FROM public.crop_categories s
LEFT JOIN public.profiles j1 ON j1.id = s.created_by
;

CREATE OR REPLACE VIEW readable.crop_prices AS
SELECT
  j1.name::text AS "Category",
  j2.name::text AS "Variety",
  COALESCE(j3.name::text, j3.code::text) AS "Centre",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.purchase_price AS "Purchase Price",
  s.selling_price AS "Selling Price",
  initcap(replace(s.unit::text, '_', ' ')) AS "Unit",
  to_char(s.effective_from, 'YYYY-MM-DD') AS "Effective From",
  to_char(s.effective_until, 'YYYY-MM-DD') AS "Effective Until",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j4.full_name, j4.email) AS "Created By",
  COALESCE(j5.full_name, j5.email) AS "Approved By"
FROM public.crop_prices s
LEFT JOIN public.crop_categories j1 ON j1.id = s.category_id
LEFT JOIN public.crop_varieties j2 ON j2.id = s.variety_id
LEFT JOIN public.collection_centres j3 ON j3.id = s.centre_id
LEFT JOIN public.profiles j4 ON j4.id = s.created_by
LEFT JOIN public.profiles j5 ON j5.id = s.approved_by
;

CREATE OR REPLACE VIEW readable.crop_varieties AS
SELECT
  j1.name::text AS "Category",
  s.name AS "Name",
  s.description AS "Description",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.crop_varieties s
LEFT JOIN public.crop_categories j1 ON j1.id = s.category_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.delivery_appointments AS
SELECT
  s.reference_no AS "Reference No",
  j1.full_name::text AS "Farmer",
  COALESCE(j2.name::text, j2.code::text) AS "Centre",
  j3.name::text AS "Category",
  j4.name::text AS "Variety",
  to_char(s.scheduled_date, 'YYYY-MM-DD') AS "Scheduled Date",
  s.scheduled_time AS "Scheduled Time",
  s.estimated_qty_kg AS "Estimated Qty Kg",
  s.notes AS "Notes",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j5.full_name, j5.email) AS "Created By"
FROM public.delivery_appointments s
LEFT JOIN public.farmers j1 ON j1.id = s.farmer_id
LEFT JOIN public.collection_centres j2 ON j2.id = s.centre_id
LEFT JOIN public.crop_categories j3 ON j3.id = s.category_id
LEFT JOIN public.crop_varieties j4 ON j4.id = s.variety_id
LEFT JOIN public.profiles j5 ON j5.id = s.created_by
;

CREATE OR REPLACE VIEW readable.delivery_schedules AS
SELECT
  s.schedule_no AS "Schedule No",
  j1.order_no::text AS "Order",
  j2.plate_number::text AS "Vehicle",
  j3.full_name::text AS "Driver",
  COALESCE(j4.full_name, j4.email) AS "Coordinator",
  s.pickup_address AS "Pickup Address",
  s.delivery_address AS "Delivery Address",
  to_char(s.scheduled_date, 'YYYY-MM-DD') AS "Scheduled Date",
  s.scheduled_time AS "Scheduled Time",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j5.full_name, j5.email) AS "Created By"
FROM public.delivery_schedules s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.transport_vehicles j2 ON j2.id = s.vehicle_id
LEFT JOIN public.drivers j3 ON j3.id = s.driver_id
LEFT JOIN public.profiles j4 ON j4.id = s.coordinator_id
LEFT JOIN public.profiles j5 ON j5.id = s.created_by
;

CREATE OR REPLACE VIEW readable.delivery_tracking AS
SELECT
  j1.schedule_no::text AS "Schedule",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.location AS "Location",
  s.notes AS "Notes",
  to_char(s.recorded_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Recorded At",
  COALESCE(j2.full_name, j2.email) AS "Recorded By"
FROM public.delivery_tracking s
LEFT JOIN public.delivery_schedules j1 ON j1.id = s.schedule_id
LEFT JOIN public.profiles j2 ON j2.id = s.recorded_by
;

CREATE OR REPLACE VIEW readable.documents AS
SELECT
  COALESCE(j1.full_name, j1.email) AS "Owner",
  initcap(replace(s.document_type::text, '_', ' ')) AS "Document Type",
  initcap(replace(s.entity_type::text, '_', ' ')) AS "Entity Type",
  s.entity_id AS "Entity",
  s.file_name AS "File Name",
  s.storage_path AS "Storage Path",
  s.file_size AS "File Size",
  initcap(replace(s.mime_type::text, '_', ' ')) AS "Mime Type",
  CASE WHEN s.is_public THEN 'Yes' WHEN s.is_public IS NULL THEN NULL ELSE 'No' END AS "Is Public",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.documents s
LEFT JOIN public.profiles j1 ON j1.id = s.owner_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.drivers AS
SELECT
  COALESCE(j1.name::text, j1.code::text) AS "Centre",
  s.full_name AS "Full Name",
  s.nic_number AS "Nic Number",
  s.phone AS "Phone",
  s.license_no AS "License No",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.drivers s
LEFT JOIN public.collection_centres j1 ON j1.id = s.centre_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.farmer_crops AS
SELECT
  j1.full_name::text AS "Farmer",
  j2.name::text AS "Category",
  j3.name::text AS "Variety",
  s.cultivated_area_acres AS "Cultivated Area Acres",
  to_char(s.planting_date, 'YYYY-MM-DD') AS "Planting Date",
  to_char(s.expected_harvest_date, 'YYYY-MM-DD') AS "Expected Harvest Date",
  s.expected_quantity_kg AS "Expected Quantity Kg",
  initcap(replace(s.farming_method::text, '_', ' ')) AS "Farming Method",
  initcap(replace(s.certification_status::text, '_', ' ')) AS "Certification Status",
  s.notes AS "Notes",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j4.full_name, j4.email) AS "Created By"
FROM public.farmer_crops s
LEFT JOIN public.farmers j1 ON j1.id = s.farmer_id
LEFT JOIN public.crop_categories j2 ON j2.id = s.category_id
LEFT JOIN public.crop_varieties j3 ON j3.id = s.variety_id
LEFT JOIN public.profiles j4 ON j4.id = s.created_by
;

CREATE OR REPLACE VIEW readable.farmer_documents AS
SELECT
  j1.full_name::text AS "Farmer",
  initcap(replace(s.document_type::text, '_', ' ')) AS "Document Type",
  s.file_name AS "File Name",
  s.storage_path AS "Storage Path",
  s.file_size AS "File Size",
  initcap(replace(s.mime_type::text, '_', ' ')) AS "Mime Type",
  to_char(s.uploaded_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Uploaded At",
  COALESCE(j2.full_name, j2.email) AS "Uploaded By",
  CASE WHEN s.is_verified THEN 'Yes' WHEN s.is_verified IS NULL THEN NULL ELSE 'No' END AS "Is Verified"
FROM public.farmer_documents s
LEFT JOIN public.farmers j1 ON j1.id = s.farmer_id
LEFT JOIN public.profiles j2 ON j2.id = s.uploaded_by
;

CREATE OR REPLACE VIEW readable.farmer_invoices AS
SELECT
  s.invoice_no AS "Invoice No",
  j1.payment_no::text AS "Payment",
  j2.collection_no::text AS "Collection",
  j3.full_name::text AS "Farmer",
  to_char(s.issue_date, 'YYYY-MM-DD') AS "Issue Date",
  to_char(s.due_date, 'YYYY-MM-DD') AS "Due Date",
  s.gross_amount_lkr AS "Gross Amount Lkr",
  s.deductions_lkr AS "Deductions Lkr",
  s.net_amount_lkr AS "Net Amount Lkr",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.payment_method AS "Payment Method",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  s.reference_no AS "Reference No",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j4.full_name, j4.email) AS "Created By"
FROM public.farmer_invoices s
LEFT JOIN public.farmer_payments j1 ON j1.id = s.payment_id
LEFT JOIN public.produce_collections j2 ON j2.id = s.collection_id
LEFT JOIN public.farmers j3 ON j3.id = s.farmer_id
LEFT JOIN public.profiles j4 ON j4.id = s.created_by
;

CREATE OR REPLACE VIEW readable.farmer_payment_deductions AS
SELECT
  j1.payment_no::text AS "Payment",
  s.description AS "Description",
  s.amount_lkr AS "Amount Lkr",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.farmer_payment_deductions s
LEFT JOIN public.farmer_payments j1 ON j1.id = s.payment_id
;

CREATE OR REPLACE VIEW readable.farmer_payments AS
SELECT
  s.payment_no AS "Payment No",
  j1.collection_no::text AS "Collection",
  j2.full_name::text AS "Farmer",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.accepted_qty_kg AS "Accepted Qty Kg",
  s.price_per_kg_lkr AS "Price Per Kg Lkr",
  s.gross_amount_lkr AS "Gross Amount Lkr",
  s.total_deductions_lkr AS "Total Deductions Lkr",
  s.net_amount_lkr AS "Net Amount Lkr",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.payment_method AS "Payment Method",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  COALESCE(j3.full_name, j3.email) AS "Calculated By",
  to_char(s.calculated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Calculated At",
  COALESCE(j4.full_name, j4.email) AS "Approved By",
  to_char(s.approved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Approved At",
  COALESCE(j5.full_name, j5.email) AS "Paid By",
  to_char(s.paid_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Paid At",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.farmer_payments s
LEFT JOIN public.produce_collections j1 ON j1.id = s.collection_id
LEFT JOIN public.farmers j2 ON j2.id = s.farmer_id
LEFT JOIN public.profiles j3 ON j3.id = s.calculated_by
LEFT JOIN public.profiles j4 ON j4.id = s.approved_by
LEFT JOIN public.profiles j5 ON j5.id = s.paid_by
;

CREATE OR REPLACE VIEW readable.farmers AS
SELECT
  COALESCE(j1.full_name, j1.email) AS "Profile",
  s.farmer_code AS "Farmer Code",
  s.nic_number AS "Nic Number",
  s.full_name AS "Full Name",
  s.email AS "Email",
  s.phone AS "Phone",
  s.address AS "Address",
  s.district AS "District",
  s.divisional_secretariat AS "Divisional Secretariat",
  s.farm_name AS "Farm Name",
  s.farm_location AS "Farm Location",
  s.farm_size_acres AS "Farm Size Acres",
  s.bank_name AS "Bank Name",
  s.bank_branch AS "Bank Branch",
  s.account_holder_name AS "Account Holder Name",
  s.account_number_masked AS "Account Number Masked",
  s.emergency_contact_name AS "Emergency Contact Name",
  s.emergency_contact_phone AS "Emergency Contact Phone",
  initcap(replace(s.verification_status::text, '_', ' ')) AS "Verification Status",
  initcap(replace(s.account_status::text, '_', ' ')) AS "Account Status",
  COALESCE(j2.full_name, j2.email) AS "Verified By",
  to_char(s.verified_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Verified At",
  COALESCE(j3.name::text, j3.code::text) AS "Assigned Centre",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j4.full_name, j4.email) AS "Created By",
  COALESCE(j5.full_name, j5.email) AS "Updated By"
FROM public.farmers s
LEFT JOIN public.profiles j1 ON j1.id = s.profile_id
LEFT JOIN public.profiles j2 ON j2.id = s.verified_by
LEFT JOIN public.collection_centres j3 ON j3.id = s.assigned_centre_id
LEFT JOIN public.profiles j4 ON j4.id = s.created_by
LEFT JOIN public.profiles j5 ON j5.id = s.updated_by
;

CREATE OR REPLACE VIEW readable.inspection_evidence_images AS
SELECT
  s.inspection_id AS "Inspection",
  s.storage_path AS "Storage Path",
  s.file_name AS "File Name",
  s.caption AS "Caption",
  initcap(replace(s.image_type::text, '_', ' ')) AS "Image Type",
  s.sort_order AS "Sort Order",
  COALESCE(j1.full_name, j1.email) AS "Uploaded By",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.inspection_evidence_images s
LEFT JOIN public.profiles j1 ON j1.id = s.uploaded_by
;

CREATE OR REPLACE VIEW readable.inventory_batches AS
SELECT
  s.batch_no AS "Batch No",
  s.qr_code_value AS "Qr Code Value",
  j1.collection_no::text AS "Collection",
  j2.full_name::text AS "Farmer",
  j3.name::text AS "Category",
  j4.name::text AS "Variety",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.initial_qty_kg AS "Initial Qty Kg",
  s.available_qty_kg AS "Available Qty Kg",
  s.reserved_qty_kg AS "Reserved Qty Kg",
  s.sold_qty_kg AS "Sold Qty Kg",
  s.wasted_qty_kg AS "Wasted Qty Kg",
  initcap(replace(s.unit::text, '_', ' ')) AS "Unit",
  s.purchase_price_lkr AS "Purchase Price Lkr",
  s.selling_price_lkr AS "Selling Price Lkr",
  to_char(s.received_date, 'YYYY-MM-DD') AS "Received Date",
  to_char(s.expected_expiry_date, 'YYYY-MM-DD') AS "Expected Expiry Date",
  COALESCE(j5.name::text, j5.code::text) AS "Warehouse",
  j6.code::text AS "Storage Location",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j7.full_name, j7.email) AS "Created By"
FROM public.inventory_batches s
LEFT JOIN public.produce_collections j1 ON j1.id = s.collection_id
LEFT JOIN public.farmers j2 ON j2.id = s.farmer_id
LEFT JOIN public.crop_categories j3 ON j3.id = s.category_id
LEFT JOIN public.crop_varieties j4 ON j4.id = s.variety_id
LEFT JOIN public.warehouses j5 ON j5.id = s.warehouse_id
LEFT JOIN public.storage_locations j6 ON j6.id = s.storage_location_id
LEFT JOIN public.profiles j7 ON j7.id = s.created_by
;

CREATE OR REPLACE VIEW readable.inventory_transactions AS
SELECT
  j1.batch_no::text AS "Batch",
  initcap(replace(s.transaction_type::text, '_', ' ')) AS "Transaction Type",
  s.quantity_kg AS "Quantity Kg",
  s.balance_kg AS "Balance Kg",
  s.reference_id AS "Reference",
  initcap(replace(s.reference_type::text, '_', ' ')) AS "Reference Type",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.inventory_transactions s
LEFT JOIN public.inventory_batches j1 ON j1.id = s.batch_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.invoice_items AS
SELECT
  j1.invoice_no::text AS "Invoice",
  s.description AS "Description",
  s.quantity_kg AS "Quantity Kg",
  s.unit_price_lkr AS "Unit Price Lkr",
  s.total_lkr AS "Total Lkr"
FROM public.invoice_items s
LEFT JOIN public.invoices j1 ON j1.id = s.invoice_id
;

CREATE OR REPLACE VIEW readable.invoices AS
SELECT
  s.invoice_no AS "Invoice No",
  j1.order_no::text AS "Order",
  j2.company_name::text AS "Buyer",
  to_char(s.issue_date, 'YYYY-MM-DD') AS "Issue Date",
  to_char(s.due_date, 'YYYY-MM-DD') AS "Due Date",
  s.subtotal_lkr AS "Subtotal Lkr",
  s.tax_amount_lkr AS "Tax Amount Lkr",
  s.discount_lkr AS "Discount Lkr",
  s.total_amount_lkr AS "Total Amount Lkr",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j3.full_name, j3.email) AS "Created By",
  s.amount_paid_lkr AS "Amount Paid Lkr"
FROM public.invoices s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.buyers j2 ON j2.id = s.buyer_id
LEFT JOIN public.profiles j3 ON j3.id = s.created_by
;

CREATE OR REPLACE VIEW readable.notifications AS
SELECT
  COALESCE(j1.full_name, j1.email) AS "Recipient",
  initcap(replace(s.type::text, '_', ' ')) AS "Type",
  s.title AS "Title",
  s.message AS "Message",
  initcap(replace(s.related_entity_type::text, '_', ' ')) AS "Related Entity Type",
  s.related_entity_id AS "Related Entity",
  CASE WHEN s.is_read THEN 'Yes' WHEN s.is_read IS NULL THEN NULL ELSE 'No' END AS "Is Read",
  to_char(s.read_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Read At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.notifications s
LEFT JOIN public.profiles j1 ON j1.id = s.recipient_id
;

CREATE OR REPLACE VIEW readable.order_feedback AS
SELECT
  j1.order_no::text AS "Order",
  j2.company_name::text AS "Buyer",
  s.rating AS "Rating",
  s.quality_rating AS "Quality Rating",
  s.delivery_rating AS "Delivery Rating",
  s.comment AS "Comment",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.order_feedback s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.buyers j2 ON j2.id = s.buyer_id
;

CREATE OR REPLACE VIEW readable.outstanding_payments AS
SELECT
  s.kind AS "Kind",
  s.reference AS "Reference",
  s.party AS "Party",
  s.outstanding_lkr AS "Outstanding Lkr",
  to_char(s.due_date, 'YYYY-MM-DD') AS "Due Date",
  s.days_overdue AS "Days Overdue",
  initcap(replace(s.status::text, '_', ' ')) AS "Status"
FROM public.outstanding_payments s
;

CREATE OR REPLACE VIEW readable.payment_receipts AS
SELECT
  s.receipt_no AS "Receipt No",
  initcap(replace(s.receipt_type::text, '_', ' ')) AS "Receipt Type",
  j1.reference_no::text AS "Buyer Payment",
  j2.invoice_no::text AS "Invoice",
  j3.payment_no::text AS "Farmer Payment",
  s.party_name AS "Party Name",
  s.amount_lkr AS "Amount Lkr",
  s.balance_after_lkr AS "Balance After Lkr",
  s.payment_method AS "Payment Method",
  s.reference_no AS "Reference No",
  to_char(s.payment_date, 'YYYY-MM-DD') AS "Payment Date",
  COALESCE(j4.full_name, j4.email) AS "Issued By",
  to_char(s.issued_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Issued At"
FROM public.payment_receipts s
LEFT JOIN public.buyer_payments j1 ON j1.id = s.buyer_payment_id
LEFT JOIN public.invoices j2 ON j2.id = s.invoice_id
LEFT JOIN public.farmer_payments j3 ON j3.id = s.farmer_payment_id
LEFT JOIN public.profiles j4 ON j4.id = s.issued_by
;

CREATE OR REPLACE VIEW readable.produce_collections AS
SELECT
  s.collection_no AS "Collection No",
  j1.reference_no::text AS "Appointment",
  j2.full_name::text AS "Farmer",
  COALESCE(j3.name::text, j3.code::text) AS "Centre",
  j4.name::text AS "Category",
  j5.name::text AS "Variety",
  s.vehicle_number AS "Vehicle Number",
  s.driver_name AS "Driver Name",
  s.gross_weight_kg AS "Gross Weight Kg",
  s.container_weight_kg AS "Container Weight Kg",
  s.net_weight_kg AS "Net Weight Kg",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  to_char(s.arrived_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Arrived At",
  to_char(s.weighed_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Weighed At",
  COALESCE(j6.full_name, j6.email) AS "Officer",
  s.notes AS "Notes",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j7.full_name, j7.email) AS "Created By",
  COALESCE(j8.full_name, j8.email) AS "Updated By",
  s.container_count AS "Container Count",
  initcap(replace(s.container_type::text, '_', ' ')) AS "Container Type"
FROM public.produce_collections s
LEFT JOIN public.delivery_appointments j1 ON j1.id = s.appointment_id
LEFT JOIN public.farmers j2 ON j2.id = s.farmer_id
LEFT JOIN public.collection_centres j3 ON j3.id = s.centre_id
LEFT JOIN public.crop_categories j4 ON j4.id = s.category_id
LEFT JOIN public.crop_varieties j5 ON j5.id = s.variety_id
LEFT JOIN public.profiles j6 ON j6.id = s.officer_id
LEFT JOIN public.profiles j7 ON j7.id = s.created_by
LEFT JOIN public.profiles j8 ON j8.id = s.updated_by
;

CREATE OR REPLACE VIEW readable.profiles AS
SELECT
  s.email AS "Email",
  s.full_name AS "Full Name",
  s.phone AS "Phone",
  s.avatar_url AS "Avatar Url",
  initcap(replace(s.role::text, '_', ' ')) AS "Role",
  initcap(replace(s.account_status::text, '_', ' ')) AS "Account Status",
  COALESCE(j1.name::text, j1.code::text) AS "Assigned Centre",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  s.encrypted_password AS "Encrypted Password"
FROM public.profiles s
LEFT JOIN public.collection_centres j1 ON j1.id = s.assigned_centre
;

CREATE OR REPLACE VIEW readable.purchase_order_items AS
SELECT
  j1.order_no::text AS "Order",
  j2.name::text AS "Category",
  j3.name::text AS "Variety",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.requested_qty_kg AS "Requested Qty Kg",
  s.unit_price_lkr AS "Unit Price Lkr",
  s.total_price_lkr AS "Total Price Lkr",
  s.notes AS "Notes"
FROM public.purchase_order_items s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.crop_categories j2 ON j2.id = s.category_id
LEFT JOIN public.crop_varieties j3 ON j3.id = s.variety_id
;

CREATE OR REPLACE VIEW readable.purchase_orders AS
SELECT
  s.order_no AS "Order No",
  j1.company_name::text AS "Buyer",
  COALESCE(j2.name::text, j2.code::text) AS "Centre",
  initcap(replace(s.status::text, '_', ' ')) AS "Status",
  to_char(s.requested_date, 'YYYY-MM-DD') AS "Requested Date",
  s.delivery_address AS "Delivery Address",
  s.total_amount_lkr AS "Total Amount Lkr",
  s.notes AS "Notes",
  COALESCE(j3.full_name, j3.email) AS "Reviewed By",
  to_char(s.reviewed_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Reviewed At",
  COALESCE(j4.full_name, j4.email) AS "Approved By",
  to_char(s.approved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Approved At",
  to_char(s.cancelled_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Cancelled At",
  s.cancel_reason AS "Cancel Reason",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j5.full_name, j5.email) AS "Created By"
FROM public.purchase_orders s
LEFT JOIN public.buyers j1 ON j1.id = s.buyer_id
LEFT JOIN public.collection_centres j2 ON j2.id = s.centre_id
LEFT JOIN public.profiles j3 ON j3.id = s.reviewed_by
LEFT JOIN public.profiles j4 ON j4.id = s.approved_by
LEFT JOIN public.profiles j5 ON j5.id = s.created_by
;

CREATE OR REPLACE VIEW readable.quality_inspections AS
SELECT
  j1.collection_no::text AS "Collection",
  COALESCE(j2.full_name, j2.email) AS "Inspector",
  initcap(replace(s.grade::text, '_', ' ')) AS "Grade",
  s.accepted_qty_kg AS "Accepted Qty Kg",
  s.rejected_qty_kg AS "Rejected Qty Kg",
  s.inspection_notes AS "Inspection Notes",
  to_char(s.approved_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Approved At",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At"
FROM public.quality_inspections s
LEFT JOIN public.produce_collections j1 ON j1.id = s.collection_id
LEFT JOIN public.profiles j2 ON j2.id = s.inspector_id
;

CREATE OR REPLACE VIEW readable.stock_allocations AS
SELECT
  j1.order_no::text AS "Order",
  s.order_item_id AS "Order Item",
  j2.batch_no::text AS "Batch",
  s.allocated_qty_kg AS "Allocated Qty Kg",
  to_char(s.allocated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Allocated At",
  COALESCE(j3.full_name, j3.email) AS "Allocated By",
  initcap(replace(s.status::text, '_', ' ')) AS "Status"
FROM public.stock_allocations s
LEFT JOIN public.purchase_orders j1 ON j1.id = s.order_id
LEFT JOIN public.inventory_batches j2 ON j2.id = s.batch_id
LEFT JOIN public.profiles j3 ON j3.id = s.allocated_by
;

CREATE OR REPLACE VIEW readable.storage_locations AS
SELECT
  COALESCE(j1.name::text, j1.code::text) AS "Warehouse",
  s.code AS "Code",
  s.description AS "Description",
  s.capacity_kg AS "Capacity Kg",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.storage_locations s
LEFT JOIN public.warehouses j1 ON j1.id = s.warehouse_id
;

CREATE OR REPLACE VIEW readable.system_settings AS
SELECT
  s.key AS "Key",
  s.value AS "Value",
  s.description AS "Description",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j1.full_name, j1.email) AS "Updated By"
FROM public.system_settings s
LEFT JOIN public.profiles j1 ON j1.id = s.updated_by
;

CREATE OR REPLACE VIEW readable.transport_vehicles AS
SELECT
  COALESCE(j1.name::text, j1.code::text) AS "Centre",
  s.plate_number AS "Plate Number",
  initcap(replace(s.vehicle_type::text, '_', ' ')) AS "Vehicle Type",
  s.capacity_kg AS "Capacity Kg",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.transport_vehicles s
LEFT JOIN public.collection_centres j1 ON j1.id = s.centre_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.warehouses AS
SELECT
  COALESCE(j1.name::text, j1.code::text) AS "Centre",
  s.name AS "Name",
  s.code AS "Code",
  s.capacity_kg AS "Capacity Kg",
  s.address AS "Address",
  CASE WHEN s.is_active THEN 'Yes' WHEN s.is_active IS NULL THEN NULL ELSE 'No' END AS "Is Active",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At",
  to_char(s.updated_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Updated At",
  COALESCE(j2.full_name, j2.email) AS "Created By"
FROM public.warehouses s
LEFT JOIN public.collection_centres j1 ON j1.id = s.centre_id
LEFT JOIN public.profiles j2 ON j2.id = s.created_by
;

CREATE OR REPLACE VIEW readable.wastage_records AS
SELECT
  j1.batch_no::text AS "Batch",
  s.quantity_kg AS "Quantity Kg",
  s.reason AS "Reason",
  s.notes AS "Notes",
  s.value_lost_lkr AS "Value Lost Lkr",
  COALESCE(j2.full_name, j2.email) AS "Recorded By",
  to_char(s.created_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM-DD HH24:MI') AS "Created At"
FROM public.wastage_records s
LEFT JOIN public.inventory_batches j1 ON j1.id = s.batch_id
LEFT JOIN public.profiles j2 ON j2.id = s.recorded_by
;

-- Let the dashboard (service role) and SQL editor read them
GRANT USAGE ON SCHEMA readable TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA readable TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA readable GRANT SELECT ON TABLES TO postgres, service_role;
NOTIFY pgrst, 'reload schema';
