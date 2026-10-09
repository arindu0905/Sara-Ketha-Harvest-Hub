import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { toCsv } from '../utils/csv';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

const iso = (d: Date) => d.toISOString().split('T')[0];

function range(q: Record<string, string>): { from: string; to: string } {
  const to = q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? q.to : iso(new Date());
  const d = new Date(); d.setDate(d.getDate() - 89);
  const from = q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : iso(d);
  if (from > to) throw new AppError('"from" must not be after "to"', 400);
  return { from, to };
}

async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw new AppError(`${fn}: ${error.message}`, 500);
  return data as T;
}

/**
 * GET /api/reports/management?from=&to=
 * One call for the whole management dashboard (E4-US6..US9).
 */
export const getManagementReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from, to } = range(req.query as Record<string, string>);
    const [operations, farmers, buyers, waste, supplyDemand, prices, financial] = await Promise.all([
      rpc('report_operations_overview', { p_from: from, p_to: to }),
      rpc('report_farmer_performance', { p_from: from, p_to: to }),
      rpc('report_buyer_performance', { p_from: from, p_to: to }),
      rpc('report_waste_analysis', { p_from: from, p_to: to }),
      rpc('report_supply_demand', { p_history: 12, p_ahead: 3 }),
      rpc('report_price_trends', { p_months: 12 }),
      rpc('report_financial_summary', { p_from: from, p_to: to }),
    ]);
    sendSuccess(res, { data: { range: { from, to }, operations, farmers, buyers, waste, supply_demand: supplyDemand, price_trends: prices, financial } });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/export/:type?from=&to=   (E4-US9, CSV)
 * type: collections | inventory | wastage | farmer-performance | buyer-performance | supply-demand | financial | outstanding
 */
export const exportReportCsv = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from, to } = range(req.query as Record<string, string>);
    const type = req.params.type;
    let headers: string[] = []; let rows: unknown[][] = [];

    switch (type) {
      case 'collections': {
        const { data, error } = await supabaseAdmin.from('produce_collections')
          .select('collection_no, status, net_weight_kg, created_at, farmers!farmer_id(full_name, farmer_code), crop_categories!category_id(name), collection_centres!centre_id(name), quality_inspections(grade, accepted_qty_kg, rejected_qty_kg)')
          .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`).order('created_at');
        if (error) throw new AppError(error.message, 500);
        headers = ['Collection No', 'Date', 'Farmer Code', 'Farmer', 'Crop', 'Centre', 'Net kg', 'Grade', 'Accepted kg', 'Rejected kg', 'Status'];
        rows = (data || []).map((c: any) => {
          const f = Array.isArray(c.farmers) ? c.farmers[0] : c.farmers; const cat = Array.isArray(c.crop_categories) ? c.crop_categories[0] : c.crop_categories;
          const ce = Array.isArray(c.collection_centres) ? c.collection_centres[0] : c.collection_centres; const q = Array.isArray(c.quality_inspections) ? c.quality_inspections[0] : c.quality_inspections;
          return [c.collection_no, c.created_at?.slice(0, 10), f?.farmer_code, f?.full_name, cat?.name, ce?.name, c.net_weight_kg, q?.grade, q?.accepted_qty_kg, q?.rejected_qty_kg, c.status];
        });
        break;
      }
      case 'inventory': {
        const { data, error } = await supabaseAdmin.from('inventory_batches')
          .select('batch_no, grade, status, initial_qty_kg, available_qty_kg, reserved_qty_kg, sold_qty_kg, wasted_qty_kg, purchase_price_lkr, selling_price_lkr, received_date, expected_expiry_date, crop_categories!category_id(name), warehouses!warehouse_id(name)')
          .order('received_date');
        if (error) throw new AppError(error.message, 500);
        headers = ['Batch', 'Crop', 'Grade', 'Status', 'Initial kg', 'Available kg', 'Reserved kg', 'Sold kg', 'Wasted kg', 'Buy LKR/kg', 'Sell LKR/kg', 'Received', 'Expiry', 'Warehouse'];
        rows = (data || []).map((b: any) => {
          const cat = Array.isArray(b.crop_categories) ? b.crop_categories[0] : b.crop_categories; const w = Array.isArray(b.warehouses) ? b.warehouses[0] : b.warehouses;
          return [b.batch_no, cat?.name, b.grade, b.status, b.initial_qty_kg, b.available_qty_kg, b.reserved_qty_kg, b.sold_qty_kg, b.wasted_qty_kg, b.purchase_price_lkr, b.selling_price_lkr, b.received_date, b.expected_expiry_date, w?.name];
        });
        break;
      }
      case 'wastage': {
        const { data, error } = await supabaseAdmin.from('wastage_records')
          .select('created_at, quantity_kg, reason, notes, value_lost_lkr, inventory_batches!batch_id(batch_no, crop_categories!category_id(name))')
          .gte('created_at', from).lte('created_at', `${to}T23:59:59.999Z`).order('created_at');
        if (error) throw new AppError(error.message, 500);
        headers = ['Date', 'Batch', 'Crop', 'Reason', 'Quantity kg', 'Value lost LKR', 'Notes'];
        rows = (data || []).map((w: any) => {
          const b = Array.isArray(w.inventory_batches) ? w.inventory_batches[0] : w.inventory_batches; const c = Array.isArray(b?.crop_categories) ? b.crop_categories[0] : b?.crop_categories;
          return [w.created_at?.slice(0, 10), b?.batch_no, c?.name, w.reason, w.quantity_kg, w.value_lost_lkr, w.notes];
        });
        break;
      }
      case 'farmer-performance': {
        const data = await rpc<any[]>('report_farmer_performance', { p_from: from, p_to: to });
        headers = ['Farmer Code', 'Farmer', 'District', 'Collections', 'Net kg', 'Accepted kg', 'Rejected kg', 'Acceptance %', 'Avg grade (0-3)', 'Paid LKR'];
        rows = data.map(r => [r.farmer_code, r.farmer_name, r.district, r.collections, r.total_net_kg, r.accepted_kg, r.rejected_kg, r.acceptance_rate_pct, r.avg_grade_score, r.total_paid_lkr]);
        break;
      }
      case 'buyer-performance': {
        const data = await rpc<any[]>('report_buyer_performance', { p_from: from, p_to: to });
        headers = ['Buyer Code', 'Company', 'Orders', 'Cancelled', 'Cancellation %', 'Ordered LKR', 'Paid LKR', 'Outstanding LKR'];
        rows = data.map(r => [r.buyer_code, r.company_name, r.orders, r.cancelled_orders, r.cancellation_rate_pct, r.ordered_value_lkr, r.paid_lkr, r.outstanding_lkr]);
        break;
      }
      case 'supply-demand': {
        const d = await rpc<any>('report_supply_demand', { p_history: 12, p_ahead: 3 });
        headers = ['Month', 'Supply kg', 'Demand kg', 'Gap kg (supply-demand)', 'Type'];
        rows = d.months.map((m: any) => [m.label, m.supply_kg, m.demand_kg, Math.round((m.supply_kg - m.demand_kg) * 10) / 10, m.is_forecast ? 'Forecast' : 'Actual']);
        break;
      }
      case 'financial': {
        const d = await rpc<any>('report_financial_summary', { p_from: from, p_to: to });
        headers = ['Month', 'Revenue LKR', 'Farmer payouts LKR', 'Profit LKR'];
        rows = d.monthly.map((m: any) => [m.label, m.revenue_lkr, m.farmer_payouts_lkr, m.profit_lkr]);
        rows.push(['TOTAL', d.revenue_lkr, d.farmer_payouts_lkr, d.revenue_lkr - d.farmer_payouts_lkr]);
        rows.push(['Wastage cost', '', '', -d.wastage_cost_lkr]);
        rows.push(['Profit estimate (after wastage)', '', '', d.profit_estimate_lkr]);
        break;
      }
      case 'outstanding': {
        const { data, error } = await supabaseAdmin.from('outstanding_payments').select('*').order('days_overdue', { ascending: false });
        if (error) throw new AppError(error.message, 500);
        headers = ['Type', 'Reference', 'Party', 'Outstanding LKR', 'Due date', 'Days overdue', 'Status'];
        rows = (data || []).map((r: any) => [r.kind === 'buyer_invoice' ? 'Buyer receivable' : 'Farmer payable', r.reference, r.party, r.outstanding_lkr, r.due_date, r.days_overdue, r.status]);
        break;
      }
      default:
        throw new AppError('Unknown report type', 404);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="harvesthub_${type}_${from}_${to}.csv"`);
    res.send('﻿' + toCsv(headers, rows));
  } catch (e) { next(e); }
};
