const { table, qa, note, ul, ol, FOUNDATIONS } = require('./common');

module.exports = {
  id: 'E3',
  file: 'E3_Inventory_Orders_Distribution_Study_Guide',
  title: 'Epic 3 – Inventory, Buyer Orders & Distribution Management',
  sub: 'Concepts, validations, demo script and viva questions',
  body: `
<h2>1. Epic overview</h2>
<p>Epic 3 manages produce <b>after quality approval</b>: stock in batches and warehouses, expiry and spoilage monitoring, buyer registration, purchase orders with stock reservation, <b>auction bidding</b> as a second sales channel, delivery preparation and tracking, and buyer feedback.</p>
<p><b>Stakeholders:</b> Inventory Manager, Buyer, Transport Coordinator.</p>

<h3>1.1 Story map</h3>
${table(['Story', 'What happens', 'Screen', 'API', 'DB'], [
  ['<b>E3-US1</b> <span class="pill">S1</span>', 'Create / manage inventory batches (created automatically from inspection)', '<code>CurrentInventory</code>, <code>BatchDetails</code>', '<code>GET /api/inventory</code>, <code>/:id</code>, <code>/:id/adjust</code>', 'inventory_batches'],
  ['<b>E3-US2</b> <span class="pill">S1</span>', 'Warehouses and storage locations', '<code>WarehousesPage</code>', '<code>/api/warehouses</code>, <code>/inventory/:id/transfer</code>', 'warehouses, storage_locations'],
  ['<b>E3-US3</b> <span class="pill">S1</span>', 'Real-time stock and batch information', '<code>InventoryDashboard</code>', '<code>GET /api/inventory</code>', 'inventory_batches, inventory_transactions'],
  ['<b>E3-US4</b>', 'Expiry and spoilage tracking', '<code>NearExpiryStock</code>, <code>WastageRecords</code>', '<code>GET /inventory/expiry</code>, <code>POST /inventory/expiry/sweep</code>, <code>POST /inventory/:id/wastage</code>', '<code>record_wastage()</code>, <code>sweep_expired_batches()</code>, wastage_records'],
  ['<b>E3-US5</b> <span class="pill">S1</span>', 'Buyer registers and views products', '<code>RegisterPage</code> (role buyer), <code>ProductMarketplace</code>', '<code>POST /api/buyers</code>, <code>GET /api/prices/current</code>', 'buyers'],
  ['<b>E3-US6</b> <span class="pill">S1</span>', 'Create and track purchase orders', '<code>CreateOrder</code>, <code>MyOrders</code>, <code>OrderDetails</code>', '<code>POST /api/orders</code>, <code>GET /api/orders</code>', 'purchase_orders, purchase_order_items'],
  ['<b>E3-US7</b> <span class="pill">S1</span>', 'Approve order and reserve stock', '<code>OrderDetails</code> (manager view)', '<code>PATCH /api/orders/:id/status</code>, <code>POST /:id/allocate</code>', '<code>reserve_order_stock()</code>, stock_allocations'],
  ['<b>E3-US8</b>', 'Prepare and track deliveries', '<code>DeliverySchedule</code>, <code>ActiveDeliveries</code>, <code>VehiclesPage</code>', '<code>/api/deliveries</code>', 'delivery_schedules, transport_vehicles'],
  ['<b>E3-US9</b>', 'Prevent overselling, expired allocation, excessive reservation', 'error messages on approval', 'inside <code>reserve_order_stock()</code> + trigger', 'system_settings'],
  ['<b>E3-US10</b>', 'Place a bid', '<code>AuctionDetailPage</code>', '<code>POST /api/auctions/:id/lots/:lotId/bids</code>', '<code>place_auction_bid()</code>'],
  ['<b>E3-US11</b>', 'View my bids and statuses', '<code>MyBidsPage</code>', '<code>GET /api/auctions/my-bids</code>', 'auction_bids'],
  ['<b>E3-US12</b>', 'Inventory manager views and manages bids', '<code>AuctionAwardPage</code>, <code>AuctionDashboardPage</code>', '<code>GET /api/auctions/:id/award-board</code>', 'auction_bids, auction_winners'],
  ['<b>E3-US13</b>', 'Accept (award) or reject bids', '<code>AuctionAwardPage</code>', '<code>POST …/award</code>, <code>POST …/offer-next</code> (reject)', '<code>award_auction_lot()</code>, <code>offer_to_next_bidder()</code>'],
  ['<b>E3-US14</b>', 'Buyer notified of the bid result', '<code>NotificationsPage</code>', 'trigger + notifications', '<code>notify_auction_losers()</code>'],
  ['Epic text: feedback', 'Buyer rates a delivered order', '<code>OrderFeedback</code> on <code>OrderDetails</code>', '<code>GET/POST /api/orders/:id/feedback</code>', 'order_feedback']
])}

<h2>2. Core concepts</h2>

<h3>2.1 Batches, stock figures and the stock ledger</h3>
${ul([
  'A <b>batch</b> = accepted produce from one collection, with grade, quantity, price, expiry, warehouse location and QR value.',
  'Three numbers matter: <b>initial</b>, <b>available</b> and <b>reserved</b> quantity. Real-time stock = available; reserved stock is held for approved orders.',
  'Every movement (received, reserved, released, wasted, adjusted, transferred) writes a row to <code>inventory_transactions</code> – a <b>ledger</b> with a running balance. This gives full history and auditability.',
  'The stock screen shows stock by crop and grade with a <b>low-stock flag</b>, reserved vs available quantity and expiry date.'
])}

<h3>2.2 FEFO – First-Expiry-First-Out</h3>
<p>When an order is approved, <code>reserve_order_stock()</code> picks batches ordered by <b>expiry date ascending</b> (then received date). The oldest-expiring produce is sold first, which reduces spoilage – exactly the epic\'s "reduced produce wastage" benefit. Batches are locked with <code>FOR UPDATE</code> so two simultaneous orders cannot reserve the same kilos (<b>concurrency control</b>).</p>

<h3>2.3 Order life-cycle</h3>
<div class="flow">submitted → under_review → approved / rejected → stock_reserved → payment_pending → paid
        → preparing → dispatched → delivered → completed          (cancelled possible before dispatch)</div>
${table(['Role', 'Statuses it may set'], [
  ['Buyer', 'only <b>cancelled</b>, on their own order, and only before dispatch'],
  ['Inventory manager', 'under_review, approved, stock_reserved, rejected, preparing, dispatched, cancelled'],
  ['Finance officer', 'under_review, payment_pending, paid, rejected, cancelled'],
  ['Manager', 'none (read-only role)'],
  ['Administrator', 'any (superuser)']
])}
<p>Approving an order triggers the atomic stock reservation; cancelling or rejecting calls <code>release_order_stock()</code> and the kilos return to available stock. Approved-but-unpaid reservations are <b>released automatically after 48 hours</b> (<code>release_stale_reservations()</code>, setting <code>reservation_hold_hours</code>).</p>

<h3>2.4 Expiry and wastage (E3-US4)</h3>
${ul([
  '<b>Expiry overview</b> lists batches expiring within <code>near_expiry_days</code> (default 7). Risk level: <b>expired</b> (days left &lt; 0), <b>critical</b> (≤ 2 days), <b>high</b> (≤ half the window), otherwise <b>medium</b>. It also shows kilos and <b>value at risk</b> (available kg × purchase price).',
  '<b>Managing near-expiry stock:</b> for each batch the inventory manager can <b>change the expiry date</b> (also used to flag a batch that will not keep), apply a <b>clearance price</b> (discount 1–90 %, audited with old and new price) or <b>write off</b> part or all of it with a reason. The page also has "Flag a batch as near-expiry" for any batch with stock.',
  '<b>Write-off sweep</b> moves expired batches to wasted stock in one action; <b>wastage records</b> store quantity, reason (spoilage, damage, expiry, pest/disease, handling, temperature, other) and the LKR value lost; the Manager\'s waste analysis uses them.'
])}

<h3>2.5 Auctions – a second way to sell</h3>
<div class="flow">draft → scheduled → open ⇄ paused → closed → (reserve_not_met | awaiting_award) → awarded
   → payment_pending → paid → stock_allocated → preparing → dispatched → delivered → completed</div>
${ul([
  '<b>Auction dates cannot be in the past:</b> start and end must be in the future (2-minute grace), and end must be after start – checked in the form and on the server.',
  '<b>Automatic opening and closing:</b> a background scheduler (every 30 seconds, and whenever auctions are listed) opens a <i>scheduled</i> auction when its start time arrives and closes an <i>open</i> one at its end time, which determines the winners. Without it nobody could bid.',
  'Lots have a starting price, an optional <b>reserve price</b> (minimum acceptable), and a minimum bid increment.',
  'When the auction closes, the highest bid at or above reserve becomes the <b>winner offer</b>; bids below reserve end as <i>reserve not met</i>.',
  'The inventory manager reviews all bids on the <b>award board</b>: <b>Accept &amp; award</b> creates a purchase order and invoice; <b>Reject winning bid</b> (reason ≥ 10 characters) marks that bid rejected, notifies the bidder and offers the lot to the next highest bidder (or cancels the lot if none).',
  'Losing bidders are notified automatically when the auction closes (database trigger).'
])}

<h2>3. Validations</h2>

<h3>3.1 Buyer registration – E3-US5</h3>
${ul([
  'Public registration accepts role <code>buyer</code> (or farmer). A buyer then completes their profile: <b>company name, contact person, email, phone, address, district are all required</b> (400 "&lt;field&gt; is required").',
  '<b>One buyer profile per account</b> → 409 "A buyer profile already exists for this account". Buyer code is generated by <code>generate_buyer_code</code>; duplicate unique values → 409.',
  'Whitelisted fields only (a buyer cannot set their own verification status or credit limit); staff verify buyers and set the credit limit.',
  'A buyer sees only their own record; only a <b>verified, active</b> buyer may bid.'
])}

<h3>3.2 Placing an order – E3-US6</h3>
${table(['Rule', 'Result'], [
  ['At least one item', '400 "At least one crop item is required to place an order"'],
  ['Each item needs a crop category and a quantity &gt; 0', '400'],
  ['Preferred collection centre required', '400'],
  ['Delivery address required', '400'],
  ['<b>Unit price is never chosen by the buyer</b>: the server looks up the centre\'s current selling price for the crop and grade (best available grade if none chosen)', 'prevents price tampering; the order screen shows the price read-only'],
  ['Buyer record must exist (resolved from the login)', '400 "Buyer record could not be found"'],
  ['Only buyers (or admin) create orders', '403 for other roles'],
  ['A buyer can open only <b>their own</b> orders', '403 "You can only access your own orders"']
])}

<h3>3.3 Approval and reservation – E3-US7 / US9 (inside <code>reserve_order_stock()</code>)</h3>
${table(['Rule', 'Error'], [
  ['Order must be in <i>submitted</i> or <i>under_review</i>', 'INVALID_STATE → 409'],
  ['<b>No overselling:</b> requested kg must not exceed total available kg for that crop and grade', 'INSUFFICIENT_STOCK → 409 "Tomato requested 500kg but only 300kg is available"'],
  ['<b>Excessive reservation cap:</b> one order may reserve at most <b>70 %</b> of the available stock of that item (setting <code>max_reservation_pct_per_order</code>)', 'EXCESSIVE_RESERVATION → 409'],
  ['<b>No expired stock:</b> only batches that are available / partially sold and not past expiry are considered', 'expired batches are skipped; a trigger <code>validate_stock_allocation</code> also raises "Cannot allocate expired batch"'],
  ['Batch status must not be expired, damaged, disposed or sold', 'trigger exception'],
  ['Order row is locked while processing (<code>FOR UPDATE</code>)', 'prevents two managers approving the same order twice']
])}
<p>Inventory staff can also adjust stock: quantity must be a number &gt; 0; reason must be one of the allowed list; adjustment type must be <i>waste</i> or <i>damage</i>; a write-off cannot exceed the available quantity in the batch (<code>INVALID_QTY</code>).</p>

<h3>3.4 Order status changes</h3>
${ul([
  'Status must be in the allowed list, otherwise 400 "Invalid order status".',
  'Role rules from the table above → 403 "Your role cannot set an order to …".',
  'A finished order cannot change again → 409 "Order is already … and can no longer change"; buyers cannot cancel after dispatch → 409.'
])}

<h3>3.5 Warehouses and transfers – E3-US2</h3>
${ul([
  '<b>Creating a warehouse requires a name, a collection centre and an address of at least 5 characters</b> (400 "Warehouse address is required"); the same rule applies when editing.',
  '<code>warehouse_id</code> is required (400); the warehouse must exist (404) and be <b>active</b> (409 "Target warehouse is inactive").',
  'If a storage location is given it must <b>belong to that warehouse</b> (400).',
  'Only inventory-staff roles may transfer or assign locations.'
])}

<h3>3.6 Deliveries – E3-US8</h3>
${ul([
  'Delivery address and scheduled date are required (400); vehicles need plate number and type; drivers need full name, NIC, phone and licence number.',
  'A vehicle or driver that is assigned to deliveries <b>cannot be deleted</b> (400 "…Consider setting inactive instead").',
  'Roles are restricted: transport coordinator manages schedules; buyers see <b>only their own</b> deliveries; status changes are validated and buyers are notified at each step.'
])}

<h3>3.7 Bidding – E3-US10 / US11 (inside <code>place_auction_bid()</code>)</h3>
${table(['Check', 'Code'], [
  ['Lot exists', 'LOT_NOT_FOUND'],
  ['Auction is <b>open</b> and the lot is open for bidding', 'AUCTION_NOT_OPEN / LOT_NOT_OPEN'],
  ['Bidding window not ended (server time, not the browser clock)', 'AUCTION_ENDED'],
  ['Stock batch behind the lot not expired', 'BATCH_EXPIRED'],
  ['Bid quantity ≤ available lot quantity', 'INSUFFICIENT_QUANTITY'],
  ['<b>Minimum bid:</b> at least the starting price, then current price + minimum increment', 'BID_TOO_LOW'],
  ['Buyer exists, is <b>verified</b> and the account is active', 'BUYER_NOT_FOUND / BUYER_NOT_VERIFIED / BUYER_SUSPENDED'],
  ['<b>Credit limit:</b> bid value must not exceed credit limit minus used credit', 'CREDIT_LIMIT_EXCEEDED'],
  ['Only a buyer can bid', '403']
])}
<p>Bids are placed by an <b>atomic database function</b> with a monotonic bid sequence, so two buyers bidding at the same moment are ordered fairly and consistently.</p>

<h3>3.8 Award / reject – E3-US12 / US13 / US14</h3>
${ul([
  'Only inventory manager, finance officer or administrator can open the award board, award or reject (others → 403).',
  '<b>Reject</b> needs a reason of <b>at least 10 characters</b> (422); the database function marks the previous offer as defaulted, cancels its order/invoice and releases reserved stock.',
  'Award fails if no pending winner exists (404).',
  'Notifications: winner at close, the next bidder when offered, and the rejected bidder; losers and "reserve not met" are notified by a trigger.'
])}

<h3>3.9 Buyer feedback</h3>
${ul([
  'Only the <b>buyer who owns the order</b> can submit; the order must be <b>delivered or completed</b> (400).',
  'Overall rating required; ratings are whole numbers 1–5; comment capped at 1000 characters.',
  '<b>One feedback per order</b> (UNIQUE order_id → 409 "already submitted"); inventory managers are notified; staff see it read-only.'
])}

<h2>4. Suggested live demo</h2>
${ol([
  'Inventory manager → <b>Current inventory</b>: filters, available vs reserved, expiry column (US1, US3). Open a batch to see its QR value and history.',
  '<b>Warehouses</b>: add a warehouse, transfer a batch; try an inactive warehouse (US2).',
  '<b>Near-expiry</b> page: risk levels and value at risk; record wastage and show it in <b>Wastage records</b> (US4).',
  'Buyer → <b>Marketplace</b> / prices, <b>Create order</b> for more than 70 % of the stock → refused (US9). Then an order within the limit (US6).',
  'Manager → open the order → <b>Approve</b>: stock is reserved FEFO; show reserved quantity rising (US7). Cancel the order and show stock returning.',
  'Transport coordinator → create a delivery schedule, update status; buyer tracks it (US8).',
  'Auction: buyer bids below the minimum (rejected), then valid (US10, US11). Manager opens the <b>award board</b>, accepts one lot and rejects another with a reason (US12, US13). Show the buyer\'s notification (US14).',
  'After delivery the buyer leaves feedback.'
])}

<h2>5. Likely viva questions and model answers</h2>
${qa([
  ['How do you prevent overselling?', 'Reservation happens inside one database function that locks the batches (<code>FOR UPDATE</code>), sums the available stock, and raises INSUFFICIENT_STOCK if the order is larger. Because it is transactional, two simultaneous orders cannot take the same kilos.'],
  ['What is FEFO and why use it?', 'First-Expiry-First-Out: reserve from the batch that expires soonest. It minimises spoilage compared with FIFO.'],
  ['What is "excessive reservation" and how is it prevented?', 'One buyer reserving almost all stock would starve others. A configurable cap (default 70 % of available stock for that crop and grade) rejects such orders with EXCESSIVE_RESERVATION.'],
  ['How do you stop expired stock being sold?', 'The reservation query skips expired batches, a trigger rejects allocations of expired or damaged batches, and the expiry sweep writes expired stock off as wastage.'],
  ['What happens to reserved stock if the buyer never pays?', 'A scheduled function releases approved-but-unpaid reservations after 48 hours (configurable) and notifies the buyer.'],
  ['Why a ledger of inventory transactions?', 'It records every receive / reserve / release / waste / adjustment with a running balance, so stock can be reconciled and audited.'],
  ['How do you ensure fairness in an auction?', 'Server-side time and a database function with a monotonic bid sequence; minimum increment, reserve price and credit-limit checks are enforced in the same transaction.'],
  ['What happens when the manager rejects a winning bid?', 'The bid is marked rejected with the reason, the bidder is notified, any order, invoice and reservation for it are cancelled, and the lot is offered to the next highest bidder, or cancelled if there is none.'],
  ['Can a buyer see another buyer\'s orders or bids?', 'No. Order endpoints check ownership (403) and the bids endpoint returns only the caller\'s bids to buyers; staff views mask bidder identity in public listings.'],
  ['Who can change an order\'s status?', 'Role rules: buyers can only cancel their own order before dispatch; inventory managers handle approval and dispatch; finance handles payment states; managers are read-only.'],
  ['How is delivery tracking done?', 'A delivery schedule has statuses (scheduled → … → delivered). The transport coordinator updates it; the buyer sees only their own deliveries and is notified at each change.'],
  ['What is the buyer feedback for?', 'It records satisfaction (overall, quality, delivery) after delivery and is shown to staff, supporting the "buyer feedback" part of the epic.']
])}

<h2>6. Know your limitations</h2>
${ul([
  'Delivery tracking is status-based (no live GPS map).',
  'Invoices are generated and printable, but no external payment gateway is connected (payments are recorded by finance staff).',
  'The reservation expiry runs when the release function is called (on a schedule or manually); it is not a continuously running background worker inside the API.',
  'Automated tests cover the auction rules; reservation and wastage rules are covered by SQL test scripts in <code>supabase/tests/</code>, not by browser tests.'
])}

<h2>7. Where to find it in the code</h2>
${table(['Concern', 'File'], [
  ['Stock reservation, release, wastage, expiry sweep', '<code>supabase/migrations/024_inventory_integrity.sql</code>'],
  ['Inventory API', '<code>backend/src/controllers/inventoryController.ts</code>'],
  ['Orders and feedback', '<code>backend/src/controllers/orderController.ts</code>'],
  ['Buyers', '<code>backend/src/routes/buyerRoutes.ts</code>'],
  ['Deliveries and vehicles', '<code>backend/src/routes/deliveryRoutes.ts</code>'],
  ['Auction schema, functions', '<code>supabase/migrations/004_auction_schema.sql</code>, <code>006_auction_functions.sql</code>, <code>026_…</code>'],
  ['Auction API', '<code>backend/src/controllers/auctionController.ts</code>'],
  ['Award board UI', '<code>frontend/src/pages/inventory/AuctionAwardPage.tsx</code>'],
  ['SQL tests', '<code>supabase/tests/01_inventory_reservation_wastage.sql</code>']
])}
${FOUNDATIONS}
`
};
