const { table, qa, note, ul, ol, FOUNDATIONS } = require('./common');

module.exports = {
  id: 'E4',
  file: 'E4_Payments_Analytics_Reporting_Study_Guide',
  title: 'Epic 4 – Payments, Analytics & Reporting',
  sub: 'Concepts, validations, demo script and viva questions',
  body: `
<h2>1. Epic overview</h2>
<p>Epic 4 handles the <b>money and the insight</b>: calculating what each farmer is paid from the graded quantity, applying authorised deductions, approvals and payouts, recording buyer payments against invoices, issuing receipts, tracking outstanding amounts, and giving the Manager reports, performance analysis, forecasts and exports.</p>
<p><b>Stakeholders:</b> Finance Officer, Farmer (payment transparency), Manager (management), Payment service providers (secondary).</p>

<h3>1.1 Story map</h3>
${table(['Story', 'What happens', 'Screen', 'API', 'DB'], [
  ['<b>E4-US1</b> <span class="pill">S1</span>', 'Calculate farmer payment from accepted quantity × grade price', '<code>CalculatePayment</code>, <code>PendingPayments</code>', '<code>POST /api/farmer-payments/calculate</code>', 'farmer_payments, farmer_invoices'],
  ['<b>E4-US2</b> <span class="pill">S1</span>', 'Authorised deductions, approval, rejection, payout', '<code>ApprovePayments</code>', '<code>PATCH /:id/approve</code>, <code>/reject</code>, <code>/mark-paid</code>', 'farmer_payment_deductions, <code>pay_farmer_payment()</code>'],
  ['<b>E4-US3</b> <span class="pill">S1</span>', 'Farmer views payments and status, prints receipt', '<code>MyPayments</code>', '<code>GET /api/farmer-payments</code>, <code>/:id/receipt</code>', 'farmer_payments, payment_receipts'],
  ['<b>E4-US4</b> <span class="pill">S1</span>', 'Buyer payments (partial allowed) and invoices', '<code>BuyerInvoicesFinance</code>, <code>BuyerInvoices</code>', '<code>POST /api/invoices/:id/payment</code>', '<code>record_buyer_payment()</code>, invoices, buyer_payments'],
  ['<b>E4-US5</b>', 'Payment receipts and outstanding payments', '<code>OutstandingPayments</code>, <code>PaymentHistory</code>', '<code>GET /api/invoices/outstanding</code>', 'payment_receipts, view outstanding_payments'],
  ['<b>E4-US6</b>', 'Collection, inventory and quality reports', '<code>ManagementReports</code> (Operations)', '<code>GET /api/reports/management</code>', '<code>report_operations_overview()</code>'],
  ['<b>E4-US7</b>', 'Farmer, buyer and waste performance', '<code>ManagementReports</code> (Performance)', 'same call', '<code>report_farmer_performance()</code>, <code>report_buyer_performance()</code>, <code>report_waste_analysis()</code>'],
  ['<b>E4-US8</b>', 'Revenue, expenses, profit estimate, supply, demand, price trends', '<code>ManagementReports</code> (Financial / Market)', 'same call', '<code>report_financial_summary()</code>, <code>report_supply_demand()</code>, <code>report_price_trends()</code>'],
  ['<b>E4-US9</b>', 'Forecasts and PDF / CSV export', '<code>ManagementReports</code>', '<code>GET /api/reports/export/:type</code>', 'least-squares forecast in <code>report_supply_demand()</code>']
])}

<h2>2. Core concepts</h2>

<h3>2.1 How a farmer payment is calculated (E4-US1)</h3>
<div class="flow">gross   = accepted_qty_kg × price_per_kg          (price from the ACTIVE price list for crop + grade + centre)
net     = gross − total_deductions
Example: 118.5 kg × LKR 160 = LKR 18,960.00 gross;  deduction "transport LKR 500"  →  net LKR 18,460.00</div>
${ul([
  'The inputs come from the <b>approved inspection</b> (accepted quantity and grade) – the finance officer cannot type a quantity. This links quality to money.',
  'The price comes from <code>get_current_price()</code> (the active price for that crop and grade, set by an administrator or finance officer in Price Management). A finance officer may override the price only with a <b>written justification note</b>.',
  'Calculating again is allowed only while the payment is still <i>calculated</i> (not yet approved or paid).'
])}

<h3>2.2 Payment life-cycle and separation of duties</h3>
<div class="flow">calculated ──approve──► approved ──pay──► paid  (receipt issued)
     └────reject (reason)────► rejected</div>
${ul([
  '<b>Maker–checker (separation of duties):</b> a system setting <code>require_payment_approval_separation</code> can force that the person who calculated a payment cannot also approve it (403). Administrators are exempt.',
  '<b>Payout needs approval:</b> <code>pay_farmer_payment()</code> refuses to pay anything that is not <i>approved</i> or is already paid.',
  'When paid, a numbered <b>payout receipt</b> is created (<code>RCT-…</code>); the farmer can print it.'
])}

<h3>2.3 Buyer payments, partial payments and receipts (E4-US4 / US5)</h3>
${ul([
  'An <b>invoice</b> has total, amount paid and balance. Buyers may pay in <b>instalments</b>; each payment creates its own numbered receipt and the invoice becomes <i>paid</i> when the balance reaches zero.',
  '<code>record_buyer_payment()</code> works inside one transaction, so the invoice, payment row and receipt always agree.',
  '<b>Outstanding payments:</b> receivables (buyers owe us) and payables (we owe farmers) with <b>days overdue</b> so finance can chase them.'
])}

<h3>2.4 Management analytics (E4-US6 – US9)</h3>
${table(['Area', 'What it shows', 'How'], [
  ['Operations', 'Collections, accepted vs rejected, inventory and quality overview', '<code>report_operations_overview()</code> aggregates SQL'],
  ['Performance', 'Farmer ranking (volume, acceptance %), buyer behaviour (orders, cancellation %), waste by reason and crop', 'SQL report functions, filtered by date range'],
  ['Financial', 'Revenue, farmer payouts, wastage cost, <b>profit estimate = revenue − payouts − wastage</b>, monthly chart', '<code>report_financial_summary()</code>'],
  ['Supply &amp; demand', 'Monthly supply (collected kg) vs demand (ordered kg)', '<code>report_supply_demand()</code>'],
  ['Forecast', 'Next 3 months of supply and demand', '<b>Least-squares linear trend</b> over the history; the method is stated on the screen so nobody mistakes it for a black box'],
  ['Price trends', 'Average purchase / selling price per crop by month', '<code>report_price_trends()</code>'],
  ['Export', 'CSV (server generated) and PDF (print)', '<code>GET /api/reports/export/:type</code>']
])}
${note('key', '<b>Be ready to explain the forecast:</b> a straight line y = a + b·x is fitted through the monthly history by minimising squared errors (least squares); the line is extended three months ahead. It is a simple trend estimate, not a seasonal model, and it is labelled as such.')}
<p>The <b>Manager role</b> is <b>read-only</b>: it can see reports and orders but every write endpoint rejects it (403).</p>

<h2>3. Validations</h2>

<h3>3.1 Calculating a farmer payment – E4-US1 / US2</h3>
${table(['Rule', 'Result'], [
  ['Only the <b>finance officer</b> may calculate', '403 for other roles'],
  ['<code>collection_id</code> required; collection must exist', '400 / 404'],
  ['A <b>completed quality inspection</b> must exist', '409 "A completed quality inspection is required before a payment can be calculated"'],
  ['Accepted quantity must be &gt; 0 (a fully rejected delivery has nothing to pay)', '409 "Nothing was accepted for this collection…"'],
  ['Cannot recalculate once approved or paid', '409 "Payment PAY-… is already approved and can no longer be recalculated"'],
  ['A <b>purchase price</b> must exist for that crop and grade (or be supplied as an override)', '409 "No active purchase price is configured… set one in Price Management"'],
  ['A price override requires a note', '400 "A note explaining the price override is required"'],
  ['<code>deductions</code> must be a list; each needs a description and an amount &gt; 0', '400'],
  ['<b>Total deductions cannot exceed the gross amount</b>', '400 "Deductions (LKR x) cannot exceed the gross amount (LKR y)"'],
  ['Money is rounded to 2 decimals; payment number is unique (retry on collision)', '–']
])}

<h3>3.2 Approving, rejecting, paying – E4-US2</h3>
${table(['Rule', 'Result'], [
  ['Approve only if status is <i>calculated</i> / pending approval', '409 "…only calculated payments can be approved"'],
  ['Maker ≠ checker (when the setting is on)', '403 "A payment must be approved by someone other than the person who calculated it"'],
  ['Reject needs a reason of at least 5 characters', '400'],
  ['Cannot reject something already paid or rejected', '409'],
  ['Pay only if <b>approved</b>; cannot pay twice', 'INVALID_STATE → 409 "payment is already paid" / "must be approved before it can be paid"'],
  ['All finance actions restricted to <code>finance_officer</code>', '403 otherwise']
])}

<h3>3.3 Farmer sees payments – E4-US3</h3>
${ul([
  'Roles allowed: farmer, finance officer, manager.',
  '<b>Ownership:</b> a farmer opens only their own payment or receipt (403 otherwise); the list is filtered to their farmer id.',
  'The payout receipt exists only after payment ("A receipt is issued once the payment has been paid" – 404 before that).'
])}

<h3>3.4 Buyer payments – E4-US4 / US5 (<code>record_buyer_payment()</code>)</h3>
${table(['Rule', 'Error'], [
  ['Invoice must exist', 'NOT_FOUND → 404'],
  ['Invoice must not be cancelled', 'INVALID_STATE → 409'],
  ['<b>No duplicate payment of a fully paid invoice</b>', 'INVALID_STATE → 409 "invoice is already fully paid"'],
  ['Amount must be &gt; 0', 'INVALID_QTY → 400'],
  ['<b>Order must be approved first</b> (not submitted, under review, rejected, cancelled or draft)', 'INVALID_STATE → 409'],
  ['<b>No overpayment:</b> amount ≤ outstanding balance', 'INVALID_QTY → 400 "payment of x exceeds outstanding balance of y"'],
  ['Only the finance officer records payments', '403']
])}

<h3>3.5 Management reports and export – E4-US6 to US9</h3>
${ul([
  'Report and export endpoints allow <b>manager</b> and <b>finance officer</b> (inventory manager only for exports); other roles → 403.',
  'Date range <code>from</code> / <code>to</code> is parsed with defaults; the export <code>type</code> must be one of the supported report names (otherwise 404 "Unknown report type").',
  '<b>CSV formula-injection protection:</b> any cell that starts with <code>=</code>, <code>+</code>, <code>-</code> or <code>@</code> is prefixed so Excel cannot execute it as a formula; commas and quotes are escaped. This is covered by an automated test.',
  'PDF export uses the browser print engine on the on-screen report, so what you see is what is exported.'
])}

<h3>3.6 Price management (feeds payments)</h3>
${ul([
  'Only the <b>administrator or finance officer</b> creates or changes prices; the active price for a crop/grade/centre is resolved by <code>get_current_price()</code>.',
  'A price has a status (active / inactive / superseded) so history stays for the price-trend report.'
])}

<h2>4. Suggested live demo</h2>
${ol([
  'Finance officer → <b>Calculate payment</b> for an inspected collection: show quantity and grade price pulled automatically. Add a deduction larger than the gross → refused; then a valid "transport" deduction (US1, US2).',
  '<b>Approve &amp; disburse</b>: approve, then mark paid; try paying an unapproved payment to show the rule.',
  'Farmer → <b>My payments</b>: statuses and the printable payout receipt (US3).',
  'Finance → <b>Buyer invoices</b>: record a partial payment, show the receipt and the balance; then try to overpay → refused; pay the balance → invoice becomes paid (US4).',
  '<b>Outstanding payments</b>: receivables, payables and days overdue (US5).',
  'Manager login → <b>Management reports</b>: Operations, Performance (farmer / buyer / waste), Financial with profit estimate, supply-demand forecast and price trends (US6–US8). Show there are no write buttons.',
  '<b>Export CSV</b> and <b>PDF</b> (US9).'
])}

<h2>5. Likely viva questions and model answers</h2>
${qa([
  ['How is the farmer payment calculated?', 'Accepted quantity from the approved inspection × current purchase price for the crop and grade = gross; minus authorised deductions = net. The finance officer cannot alter the quantity; a price override needs a written note.'],
  ['What stops finance from paying the wrong amount?', 'Quantity and grade come from the inspection, price from the price list, deductions are validated (positive, described, not more than gross), and the amount is rounded to 2 decimals and stored on the payment.'],
  ['What is separation of duties and do you have it?', 'The person who prepares a payment should not approve it. A system setting can enforce that the approver differs from the calculator (403 otherwise).'],
  ['Why must a payment be approved before payout?', 'Approval is a control point. The payout database function refuses anything not approved and refuses a second payment, so double payment is impossible.'],
  ['How do partial buyer payments work?', 'Each payment reduces the invoice balance and creates its own receipt. The function rejects amounts above the balance and payments on paid or cancelled invoices; when balance reaches zero the invoice becomes paid.'],
  ['Why are payments done in database functions?', 'Invoice update, payment row and receipt must succeed or fail together; a transaction guarantees consistent financial records.'],
  ['What are outstanding payments?', 'Receivables = unpaid invoices from buyers, payables = approved farmer payments not yet paid, each with days overdue.'],
  ['How is the profit estimate computed?', 'Revenue from buyer sales minus farmer payouts minus wastage cost. It is an estimate because other operating costs are not recorded.'],
  ['How does the forecast work?', 'A least-squares straight line is fitted to the monthly supply and demand history and extended for three months. The screen states the method.'],
  ['What can the Manager do?', 'View reports and orders and export them. The role is read-only, enforced on every write endpoint with 403.'],
  ['How do you protect exported CSV files?', 'Cells starting with = + - or @ are neutralised (formula-injection protection) and the data is escaped; export is limited to authorised roles.'],
  ['How does a farmer know their payment status?', 'My payments lists calculated / approved / paid / rejected with amounts and a printable receipt once paid.'],
  ['Where do prices come from?', 'The administrator or finance officer maintains the price list per crop, grade and centre; payments and the marketplace read the active price.']
])}

<h2>6. Know your limitations</h2>
${ul([
  'No real payment-gateway or bank integration: payments are <b>recorded</b> by finance staff after money moves outside the system (the Sprint 0 budget includes a payment module as a future step).',
  'The profit estimate ignores overheads (salaries, transport, rent) because they are not captured.',
  'Forecasting is a linear trend, not seasonal or machine-learning based.',
  'Email notifications of payments depend on an SMTP server being configured; otherwise only in-app notifications are sent.',
  'PDF export relies on the browser print dialog instead of a server-side PDF generator.'
])}

<h2>7. Where to find it in the code</h2>
${table(['Concern', 'File'], [
  ['Farmer payments', '<code>backend/src/controllers/farmerPaymentController.ts</code>'],
  ['Pay-out, buyer payments, receipts SQL', '<code>supabase/migrations/025_receipts_inspection_payments.sql</code>'],
  ['Invoices and outstanding', '<code>backend/src/routes/invoiceRoutes.ts</code>'],
  ['Management reports and CSV export', '<code>backend/src/controllers/managementReportController.ts</code>, <code>supabase/migrations/026_management_reports_and_bid_results.sql</code>'],
  ['CSV safety test', '<code>backend/src/__tests__/csvAndErrors.test.ts</code>'],
  ['SQL tests', '<code>supabase/tests/02_payments_receipts.sql</code>'],
  ['Frontend', '<code>frontend/src/pages/finance/*</code>, <code>pages/farmer/MyPayments.tsx</code>, <code>pages/admin/ManagementReports.tsx</code>']
])}
${FOUNDATIONS}
`
};
