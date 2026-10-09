# User-story coverage – Sara Ketha Harvest Hub (Sprint 0 proposal, 40 stories)

**Status key** — **Audited**: existed in the project; read, tested where possible, defects fixed. **Reworked**: existed but was incomplete or unsafe, rebuilt. **New**: did not exist.

> Verification honesty: the SQL (migrations 023-026) was run against a real PostgreSQL 16 and the scripts in `supabase/tests/` pass. Backend `tsc` is clean and 38 Jest tests pass. The frontend type-checks with `tsc --noEmit`. Nothing could be exercised against your live Supabase project or a running browser (the build sandbox blocks Vite's native binaries), so please run the smoke checklist at the bottom after applying the migrations.

## Epic 1 – Farmer & user management

| Story | Delivered | Where | Status |
|---|---|---|---|
| E1-US1 Farmer self-registration | Register form limited to farmer/buyer; server schema rejects any other role (previous version let anyone self-register as administrator); farmers start `pending` | `authController`, `validationSchemas`, `RegisterPage` | Reworked |
| E1-US2 Language (EN/SI/TA) | Missing Sinhala/Tamil keys added (nav, payments, receipts, roles); nav no longer shows raw keys | `LanguageContext.tsx` | Reworked |
| E1-US3 Officer registers farmers | Field whitelists, safe search (previous `.or()` filter was injectable), ownership checks | `farmerController`, `RegisterFarmer`, `FarmerDirectory` | Reworked |
| E1-US4 Verify farmers | Approve/reject with notification; unverified farmers cannot book appointments or deliver | `farmerController`, `appointmentController.assertFarmerVerified`, `FarmerVerification` | Reworked |
| E1-US5 Farmer profile | Mass-assignment closed (farmer can edit only own non-status fields); `getMe` no longer falls back to someone else's record | `farmerController`, `FarmerProfile` | Reworked |
| E1-US6 Register crops | Existing flow; farmers scoped to own crops | `FarmerCrops`, `RegisterCrop` | Audited |
| E1-US7 Crop history | Existing history view, now ownership-scoped | `FarmerCrops` | Audited |
| E1-US8 Officer search | Server search by name/NIC/code/district with status filters | `FarmerDirectory` | Audited |
| E1-US9/10/11 Conversational AI crop advisor | Suitability score is now **computed** (district fit 40 + rotation 30 + soil pH 15 + rainfall 15) with a per-crop breakdown shown in the UI; rotation violations are never recommended; Gemini only phrases the explanation (optional). Endpoint requires login and is rate-limited. Previously scores were fixed 97/92/87 by rank | `services/cropAdvisor.ts`, `botController`, `FarmerCropBotModal` | Reworked |

## Epic 2 – Collection & quality

| Story | Delivered | Where | Status |
|---|---|---|---|
| E2-US1 Delivery appointment | Capacity per centre per day, duplicate guard, status transitions, farmer can cancel own appointment; anyone could previously create/patch appointments with a raw body | `appointmentController`, `MyAppointments`, `ScheduleDelivery` | Reworked |
| E2-US2 Register scheduled / walk-in produce | Links to appointment, requires verified farmer | `collectionController`, `RegisterCollection` | Reworked |
| E2-US3 Weighing & net weight | Validation (gross > container, positive), server-side net | `weighCollection`, `WeighProduce` | Reworked |
| E2-US4 Inspection & grading | Single transaction `finalize_inspection` | migration 025, `inspectionController`, `CreateInspection` | Reworked |
| E2-US5 Accepted / rejected quantities | accepted + rejected must equal net weight; reasons required for rejections; client and DB both enforce | migration 025, `CreateInspection` | Reworked |
| E2-US6 Evidence images | The page called an API method that did not exist (upload was broken) – added | `api.ts`, `inspectionController` | Reworked |
| E2-US7 Batch numbers | Batch created only for accepted produce, with expiry from crop shelf life and ledger entry | `finalize_inspection` | Reworked |
| E2-US8 Collection receipts | Numbered receipts, print/PDF, farmer confirm or dispute (officer is notified) | `collection_receipts`, `CollectionReceiptCard`, `CollectionDetail`, `CollectionHistory` | New |
| E2-US9 Prevent incorrect entries | DB-level checks (duplicate inspection, wrong state, quantity mismatch) mapped to 404/400/409 | migration 025, `rpcError.ts` | New |

## Epic 3 – Inventory, orders, auctions

| Story | Delivered | Where | Status |
|---|---|---|---|
| E3-US1 Batches | Real stock only: the old code invented 50 kg "virtual batches" and default stock figures – removed | `inventoryController`, `CurrentInventory` | Reworked |
| E3-US2 Warehouses | Existing; transfer validates warehouse is active and the location belongs to it | `WarehousesPage`, `transferBatch` | Audited |
| E3-US3 Real-time stock | Summary by crop/grade with low-stock flag, reserved vs available, expiry column, filters | `InventoryDashboard`, `CurrentInventory`, `BatchDetails` | Reworked |
| E3-US4 Expiry & spoilage | Server expiry overview with risk levels and value at risk, one-click write-off sweep, wastage records with reasons and value lost, charts | migration 024, `NearExpiryStock`, `WastageRecords` | New |
| E3-US5 Buyer registration & browsing | Buyer profile one-per-account, field whitelist; staff verify and set credit | `buyerRoutes`, `ProductMarketplace` | Reworked |
| E3-US6 Create / track orders | Ownership checks, status allow-list; buyers cancel only own pre-dispatch orders | `orderController`, `orderRoutes`, `MyOrders`, `OrderDetails` | Reworked |
| E3-US7 Approval & reservation | Atomic FEFO reservation `reserve_order_stock`, buyer notified | migration 024 | Reworked |
| E3-US8 Delivery preparation / tracking | Role-restricted schedule routes, buyers see only their own deliveries, status validation, buyer notifications | `deliveryRoutes`, `DeliverySchedule`, `ActiveDeliveries` | Reworked |
| E3-US9 Prevent overselling / expired allocation / excess reservation | `INSUFFICIENT_STOCK`, `EXCESSIVE_RESERVATION` (70 % cap, setting), expired batches skipped, stale reservations released after 48 h (settings) | migration 024; tested in `supabase/tests/01_*` | New |
| E3-US10 Place bids | Existing auction module | `auctionController`, `AuctionDetailPage` | Audited |
| E3-US11 My bids | Existing | `MyBidsPage` | Audited |
| E3-US12 Review bids | Existing | `AuctionDashboardPage` | Audited |
| E3-US13 Accept / award | Existing award RPC | `award_auction_lot` | Audited |
| E3-US14 Bid result notification | Winners notified at close (existing); losing bidders and reserve-not-met now notified, their bids marked rejected | migration 026 trigger | New |

## Epic 4 – Finance & management

| Story | Delivered | Where | Status |
|---|---|---|---|
| E4-US1 Calculate farmer payment | Always from the approved inspection and the active price; the old code created fake grade-A inspections and used fallback prices 200/170/140 | `farmerPaymentController`, `CalculatePayment` | Reworked |
| E4-US2 Deductions & approval | Approve / reject-with-reason / pay lifecycle; payout needs approval; optional setting to require a different approver | `ApprovePayments`, migration 025 | Reworked |
| E4-US3 Farmer payment tracking | Farmer sees only own payments, true statuses, printable payout receipt | `MyPayments` | Reworked |
| E4-US4 Buyer payments | Partial payments, overpayment guard, balance, no duplicate payment of a paid invoice | `record_buyer_payment`, `BuyerInvoicesFinance` | Reworked |
| E4-US5 Receipts & outstanding | Numbered receipts for buyer payments and farmer payouts, outstanding receivable/payable with days overdue | `payment_receipts`, `OutstandingPayments` | New |
| E4-US6 Collection / inventory / quality overview | `/reports/management` operations tab | `ManagementReports` | New |
| E4-US7 Farmer, buyer, waste analysis | Performance tables, acceptance %, cancellation %, waste by reason/crop | migration 026, `ManagementReports` | New |
| E4-US8 Financial, supply & demand | Revenue, payouts, wastage cost, profit estimate, monthly chart; supply vs demand | `ManagementReports` | New |
| E4-US9 Forecasts & exports | 3-month least-squares forecast (method stated on screen), CSV (server, formula-injection safe) and PDF | `exportReportCsv`, `ManagementReports` | New |

Cross-cutting: new **Manager** role (read-only reports and orders) added end-to-end (enum, routes, nav, login redirect, translations, user admin).

## Smoke checklist after applying migrations
1. Register as farmer → officer verifies → farmer books appointment → officer registers + weighs → inspector grades (try accepted + rejected ≠ net weight: must be refused) → receipt appears for the farmer → finance calculates, approves, pays → farmer prints receipt.
2. Buyer places an order for more than 70 % of a crop's stock: refused. Order within limit: approved, stock reserved. Cancel: stock returns.
3. Record wastage on a batch; run the expiry write-off; see both in Wastage Records and in the manager report.
4. Record a partial buyer payment, then the balance: two receipts, invoice becomes paid.
5. Log in as a manager: Management Reports load, CSV downloads, no write buttons.

## Additions (migration 027)
- **Farmer documents** (Epic 1 description): upload NIC / land deed / passbook / certificate (JPG, PNG, WEBP, PDF, max 5 MB) to a private bucket, signed-URL viewing, officer "Verify" – `farmerDocumentController`, `FarmerDocuments` (farmer profile and officer verification pages).
- **Buyer feedback** (Epic 3 description): rating (overall, quality, delivery) and comment on delivered / completed orders, once per order, inventory managers notified – `order_feedback`, `OrderFeedback` on the order page.
- **Email notifications**: every in-app notification is also emailed when `SMTP_HOST` is configured (see `.env.example`); otherwise a no-op.
- **E3-US12/US13 bid review UI**: new `AuctionAwardPage` (`/inventory/auction/:id/award`) lists every bid per lot with buyer, price, status; the manager can *Accept & award* (creates order + invoice) or *Reject winning bid* with a reason (bidder notified, bid marked rejected, lot offered to next bidder or cancelled). Backend: `GET /auctions/:id/award-board`; `offer-next` now also open to inventory managers.
