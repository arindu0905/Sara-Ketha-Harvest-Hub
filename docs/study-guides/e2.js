const { table, qa, note, ul, ol, FOUNDATIONS } = require('./common');

module.exports = {
  id: 'E2',
  file: 'E2_Produce_Collection_Quality_Study_Guide',
  title: 'Epic 2 – Produce Collection, Weighing & Quality Management',
  sub: 'Concepts, validations, demo script and viva questions',
  body: `
<h2>1. Epic overview</h2>
<p>Epic 2 covers the <b>physical journey of produce into the centre</b>: the farmer books a delivery, the officer registers the delivery and weighs it, the inspector grades it and records accepted / rejected quantities, the system generates a <b>batch code</b> for accepted produce and a numbered <b>collection receipt</b> for the farmer.</p>
<p><b>Stakeholders:</b> Farmer, Collection Centre Officer, Quality Inspector.</p>

<h3>1.1 Story map</h3>
${table(['Story', 'What happens', 'Screen', 'API', 'Tables / DB function'], [
  ['<b>E2-US1</b> <span class="pill">Sprint 1</span>', 'Farmer schedules a delivery appointment', '<code>ScheduleDelivery</code>, <code>MyAppointments</code>', '<code>POST /api/appointments</code>, <code>PATCH /:id/status</code>', 'delivery_appointments'],
  ['<b>E2-US2</b> <span class="pill">Sprint 1</span>', 'Officer registers scheduled or walk-in delivery', '<code>RegisterCollection</code>, <code>DeliveryAppointments</code>', '<code>POST /api/collections</code>', 'produce_collections'],
  ['<b>E2-US3</b> <span class="pill">Sprint 1</span>', 'Gross + container weight → net weight', '<code>WeighProduce</code>', '<code>POST /api/collections/:id/weigh</code>', 'produce_collections (net weight is a generated column)'],
  ['<b>E2-US4</b> <span class="pill">Sprint 1</span>', 'Inspector grades the produce', '<code>PendingInspections</code>, <code>CreateInspection</code>', '<code>POST /api/inspections</code>', '<code>finalize_inspection()</code> → quality_inspections'],
  ['<b>E2-US5</b> <span class="pill">Sprint 1</span>', 'Accepted / rejected quantities with reasons', '<code>CreateInspection</code>', 'same call', 'collection_rejections'],
  ['<b>E2-US6</b>', 'Evidence photos', '<code>CreateInspection</code>, <code>InspectionHistory</code>', '<code>POST/GET/DELETE /api/inspections/:id/images</code>', 'inspection_evidence_images + storage bucket <code>evidence-images</code>'],
  ['<b>E2-US7</b>', 'Batch number + code for traceability', '(automatic) shown in <code>CollectionHistory</code>', 'inside <code>finalize_inspection()</code>', 'inventory_batches, inventory_transactions'],
  ['<b>E2-US8</b>', 'Numbered collection receipt, status tracking, farmer confirms', '<code>CollectionReceiptCard</code>, <code>CollectionDetail</code>, <code>MyCollections</code>', '<code>POST /api/collections/:id/receipt</code>, <code>/receipt/confirm</code>', 'collection_receipts'],
  ['<b>E2-US9</b>', 'Prevent incorrect weights / quantities / approvals', 'all of the above', 'API rules + database constraints + RPC', 'CHECK constraints, <code>finalize_inspection()</code>']
])}

<h2>2. Core concepts</h2>

<h3>2.1 The collection life-cycle (state machine)</h3>
<div class="flow">Appointment:  scheduled → confirmed → arrived → completed        (also: cancelled, no_show)
Collection:   scheduled → arrived → weighed → pending_inspection → under_inspection
                  → accepted | partially_accepted | rejected
                  → added_to_inventory → payment_pending → completed</div>
<p>A <b>state machine</b> means each status can only move to certain next statuses (a transition table in the controller). Trying anything else returns <b>409 Conflict</b>, for example "Collection cannot move from <i>scheduled</i> to <i>accepted</i>". This prevents skipping weighing or inspection.</p>

<h3>2.2 Appointments vs walk-ins</h3>
${ul([
  'A <b>scheduled delivery</b> links the collection to an appointment (<code>appointment_id</code>); the appointment becomes <b>completed</b> automatically when the inspection is finalised.',
  'A <b>walk-in</b> is a collection with no appointment – the officer registers it directly. Both end up as the same kind of collection record, so everything after (weighing, inspection, payment) is identical.',
  '<b>Capacity:</b> each centre accepts a maximum number of appointments per day (system setting, default 60), so queues stay manageable.'
])}

<h3>2.3 Net weight is calculated, never typed</h3>
<p><code>net_weight_kg = gross_weight_kg − container_weight_kg</code> is a PostgreSQL <b>generated column</b> (<code>GENERATED ALWAYS AS … STORED</code>). Nobody – not the API, not the UI – can write a wrong net weight; the database computes it from the two inputs. This is a strong answer for "how do you avoid manual calculation errors?".</p>

<h3>2.4 One transaction for inspection – <code>finalize_inspection()</code></h3>
<p>When the inspector submits, a single PostgreSQL function does <b>everything atomically</b> (all or nothing):</p>
${ol([
  'Validates the collection state and the quantities (see section 3.4).',
  'Inserts the <code>quality_inspections</code> row and one <code>collection_rejections</code> row per rejection reason.',
  'Sets the collection status: <b>rejected</b> (grade rejected), <b>partially_accepted</b> (some rejected), or <b>accepted</b>.',
  'Marks the linked appointment <b>completed</b>.',
  'If accepted quantity &gt; 0: generates a <b>batch number</b> (<code>generate_batch_no()</code>), looks up the current price, computes the <b>expiry date</b> from the crop\'s shelf-life days, creates the <code>inventory_batches</code> row (QR value <code>HH-&lt;batch_no&gt;</code>) and a "received" ledger entry in <code>inventory_transactions</code>.',
  'Creates the numbered <b>collection receipt</b> (<code>RCT-YYYY-000001</code> style via <code>next_receipt_no()</code>) and notifies the farmer.'
])}
${note('key', '<b>Why a database function?</b> If the server crashed half-way in plain code you could have an inspection without a batch or a batch without a receipt. In one transaction either everything is saved or nothing is.')}

<h3>2.5 Traceability (E2-US7)</h3>
<p>The batch stores <code>collection_id</code>, <code>farmer_id</code>, crop, grade and expiry. Later, orders allocate stock from batches, so any sold kilo can be traced back to the farmer and the delivery day: <b>farmer → collection → inspection → batch → order → invoice</b>.</p>

<h3>2.6 Receipts and farmer confirmation (E2-US8)</h3>
${ul([
  'Receipt number format <code>RCT-&lt;year&gt;-&lt;6-digit sequence&gt;</code>, unique per collection (one receipt per collection).',
  'The farmer sees the receipt, can <b>print / save as PDF</b>, and either <b>confirm</b> it or <b>dispute</b> it (a note explaining the problem is mandatory when disputing). The officer is notified of disputes.',
  'Receipt status: <code>issued → confirmed | disputed</code>.'
])}

<h2>3. Validations</h2>

<h3>3.1 Appointment – E2-US1</h3>
${table(['Rule', 'Result'], [
  ['Farmer must be <b>verified</b> and account not suspended', '403 "…registration has not been verified yet. Verification is required before using collection services."'],
  ['centre, crop category and date are required', '400'],
  ['Estimated quantity &gt; 0 and ≤ 100,000 kg', '400 "must be greater than zero" / "looks too large"'],
  ['Farmers: at least <b>1 day in advance</b>; staff: not in the past', '400 "Deliveries must be scheduled at least one day in advance"'],
  ['At most <b>90 days</b> ahead', '400'],
  ['Centre must exist and be active', '400'],
  ['No duplicate for the same farmer + crop + centre + date', '409 "You already have an appointment for this crop, centre and date"'],
  ['Daily capacity of the centre', '409 "This centre is fully booked on that date. Please choose another day."'],
  ['Status change must follow the transition table', '409 "Appointment is completed and cannot be changed to …"'],
  ['Farmers can only <b>cancel</b>, and only their own', '403']
])}
<p>Reference numbers are generated by the server; a unique-violation retry loop (error code 23505) guarantees no two appointments share a number even under simultaneous requests.</p>

<h3>3.2 Registering the delivery – E2-US2</h3>
${table(['Rule', 'Result'], [
  ['Only the collection centre officer may register collections', '403 for other roles'],
  ['Zod <code>collectionSchema</code>: farmer_id, centre_id, category_id are valid UUIDs; variety optional', '400 with field errors'],
  ['If an appointment is given: it must exist, belong to the <b>same farmer</b>, and be scheduled / confirmed', '404 / 409'],
  ['One collection per appointment', '409 "A collection has already been registered for this appointment"'],
  ['Farmer must be verified (same check as booking)', '403']
])}

<h3>3.3 Weighing – E2-US3</h3>
${table(['Rule', 'Result'], [
  ['Gross and container are numbers; gross &gt; 0 and container ≥ 0', '400 "Gross and container weights must be valid numbers…"'],
  ['<b>Gross must be greater than container</b> (a net weight of zero or negative is impossible)', '400 "Gross weight must be greater than container weight"; also a database CHECK <code>ck_net_weight_positive</code>'],
  ['Weights can only be changed while the collection is scheduled / arrived / weighed / pending inspection', '409 "Weights cannot be changed once a collection is …"'],
  ['Net weight', '<b>generated by the database</b>, status moves to <code>pending_inspection</code>'],
  ['Only the officer may weigh', '403 for others']
])}

<h3>3.4 Inspection – E2-US4 / US5 / US9 (inside <code>finalize_inspection()</code>)</h3>
${table(['Rule', 'Error code → HTTP'], [
  ['Collection must exist', 'NOT_FOUND → 404'],
  ['<b>Net weight must already be recorded</b> (cannot inspect before weighing)', 'INVALID_STATE → 409'],
  ['Collection status must allow inspection', 'INVALID_STATE → 409'],
  ['<b>Only one inspection per collection</b>', 'INVALID_STATE → 409 "an inspection already exists"'],
  ['Quantities are zero or greater', 'INVALID_QTY → 400'],
  ['<b>accepted + rejected must equal the net weight</b>', 'INVALID_QTY → 400 "accepted (x kg) + rejected (y kg) must equal the net weight (z kg)"'],
  ['A <b>rejected</b> grade cannot have accepted quantity', 'INVALID_QTY → 400'],
  ['Grades A / B / C require accepted quantity &gt; 0', 'INVALID_QTY → 400'],
  ['If anything is rejected, <b>at least one rejection reason</b> is required', 'INVALID_QTY → 400'],
  ['Rejection line quantities cannot exceed total rejected', 'INVALID_QTY → 400'],
  ['Grade must be grade_a, grade_b, grade_c or rejected; quantities must be numbers', '400 (API, before the database)']
])}
<p>The function raises messages like <code>INVALID_QTY: …</code>; <code>utils/rpcError.ts</code> maps the code to the right HTTP status (<code>NOT_FOUND→404</code>, <code>INVALID_QTY→400</code>, <code>INVALID_STATE→409</code>). The same checks exist in the inspection form so the inspector sees the message immediately.</p>

<h3>3.5 Evidence images – E2-US6</h3>
${ul([
  'Images are sent as base64 data URIs and stored in the <code>evidence-images</code> bucket; each gets a record with caption and type (general, defect, label, packaging, rejected area).',
  '404 if the inspection does not exist, 400 if no images were sent; only staff roles (inspector, officer, admin) may upload or delete.',
  'The frontend page previously called an API method that did not exist, so uploads silently failed – this was fixed by adding it.'
])}

<h3>3.6 Receipts – E2-US8</h3>
${table(['Rule', 'Result'], [
  ['Receipt is created only after the inspection exists', '409 "Quality inspection must be completed before a receipt can be issued"'],
  ['A farmer can confirm / dispute only <b>their own</b> receipt', '403'],
  ['Only an <i>issued</i> receipt can be confirmed or disputed (no double confirmation)', '409 "Receipt is already confirmed"'],
  ['Dispute requires an explanation note', '400 "Please explain what is wrong with the receipt"'],
  ['Collection cannot be marked <b>completed</b> before the inspection is approved', '400']
])}

<h2>4. Suggested live demo</h2>
${ol([
  'Farmer logs in → <b>Schedule delivery</b>. Try tomorrow-minus-one date and a negative quantity to show the rules; then a valid booking (US1).',
  'Officer opens <b>Delivery appointments</b>, confirms the appointment, then <b>Register collection</b> linking it (US2). Show that a walk-in works without an appointment.',
  '<b>Weigh produce</b>: try container ≥ gross → error; then valid values and show the net weight appear (US3).',
  'Inspector → <b>Pending inspections</b> → inspect: choose grade, enter accepted + rejected that do <u>not</u> equal net weight → refused; then correct values with a rejection reason and photos (US4, US5, US6, US9).',
  'Show the success message with the new <b>batch number</b> and <b>receipt number</b>; open inventory to see the batch (US7).',
  'Farmer opens <b>My collections</b> → receipt → <b>Confirm</b> (or dispute with a note) (US8).'
])}

<h2>5. Likely viva questions and model answers</h2>
${qa([
  ['How do you make sure the net weight is correct?', 'It is a generated column in PostgreSQL: gross minus container. Users only enter gross and container, and a CHECK constraint plus API validation ensure gross is greater than container.'],
  ['What prevents an inspector from accepting more than was delivered?', '<code>finalize_inspection()</code> requires accepted + rejected to equal the recorded net weight; otherwise it raises INVALID_QTY (HTTP 400). The inspection form enforces the same rule.'],
  ['Why is inspection implemented as a database function?', 'It must create the inspection, rejections, batch, inventory ledger entry, receipt and status updates atomically. A single transaction guarantees there are never partial records.'],
  ['What happens if two inspectors inspect the same collection?', 'The second call fails with INVALID_STATE "an inspection already exists" (409); the receipt table also has a UNIQUE collection_id.'],
  ['How is the batch code created and what is it used for?', 'A database sequence function creates the batch number; the QR value is <code>HH-&lt;batch_no&gt;</code>. It links stock to the farmer and collection for traceability and drives expiry tracking.'],
  ['How is the expiry date decided?', 'Each crop category has <code>shelf_life_days</code> (default 7; longer for rice, spices, tea). Expiry = today + shelf life when the batch is created.'],
  ['What is the difference between a scheduled delivery and a walk-in?', 'A scheduled delivery references an appointment; a walk-in does not. Both create the same collection record afterwards.'],
  ['How do you prevent overbooking?', 'The appointment API counts bookings for the centre and date against the daily capacity setting and returns 409 when full; it also blocks duplicate bookings by the same farmer.'],
  ['Why do you use status transition tables?', 'To forbid impossible jumps (e.g. accepting before weighing). Every status change is checked against allowed next states and returns 409 otherwise.'],
  ['Can the officer edit weights later?', 'Only while the collection has not been inspected. After that the API returns 409, so stored quantities cannot be changed behind an approved inspection.'],
  ['What does the farmer get after inspection?', 'A numbered receipt (accepted / rejected kg, grade, batch number), an in-app notification (and email if SMTP is on), and the right to confirm or dispute it.'],
  ['How are rejection reasons recorded?', 'One row per reason in <code>collection_rejections</code> with quantity and notes; at least one reason is mandatory when anything is rejected, and their quantities cannot exceed the rejected total.'],
  ['What are the roles for each action?', 'Farmer books and confirms receipts; officer registers, weighs and issues receipts; inspector grades; the API uses <code>requireRole</code> so any other role gets 403.']
])}

<h2>6. Know your limitations</h2>
${ul([
  'There is no integration with a physical weighing scale – weights are entered manually (the Sprint 0 document allows a software simulator).',
  'The batch QR is stored as text (<code>HH-&lt;batch_no&gt;</code>); a scannable image/camera scan is not built.',
  'Evidence images are limited by the 10 MB request size of the API; very large photos should be compressed first.',
  'Automated tests do not yet cover the inspection function end to end; it was checked manually (the SQL test scripts in <code>supabase/tests/</code> cover stock reservation, wastage and payments).'
])}

<h2>7. Where to find it in the code</h2>
${table(['Concern', 'File'], [
  ['Appointments', '<code>backend/src/controllers/appointmentController.ts</code>'],
  ['Collections, weighing, receipts', '<code>backend/src/controllers/collectionController.ts</code>'],
  ['Inspections, images', '<code>backend/src/controllers/inspectionController.ts</code>'],
  ['Atomic inspection + batch + receipt', '<code>supabase/migrations/025_receipts_inspection_payments.sql</code>'],
  ['Net weight generated column', '<code>supabase/migrations/001_initial_schema.sql</code> (produce_collections)'],
  ['Error mapping', '<code>backend/src/utils/rpcError.ts</code>'],
  ['Frontend', '<code>frontend/src/pages/farmer/*</code>, <code>pages/officer/*</code>, <code>pages/inspector/*</code>, <code>components/receipts/CollectionReceiptCard.tsx</code>']
])}
${FOUNDATIONS}
`
};
