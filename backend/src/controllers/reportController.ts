import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

/**
 * GET /api/reports/dashboard
 */
export const getDashboardStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('v_dashboard_summary')
      .select('*')
      .single();
    if (error) throw new AppError(error.message, 500);
    sendSuccess(res, { data });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/collections
 * Daily and monthly collection summary.
 */
export const getCollectionReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { from_date, to_date, centre_id, category_id } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from('produce_collections')
      .select(`
        id, collection_no, status, net_weight_kg, created_at,
        farmers!farmer_id(full_name, farmer_code, district),
        crop_categories!category_id(name),
        collection_centres!centre_id(name),
        quality_inspections(grade, accepted_qty_kg, rejected_qty_kg)
      `);

    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);
    if (centre_id) query = query.eq('centre_id', centre_id);
    if (category_id) query = query.eq('category_id', category_id);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
    if (error) throw new AppError(error.message, 500);

    // Aggregate totals
    const totals = (data || []).reduce((acc: any, c: any) => {
      acc.total_collections++;
      acc.total_net_weight += c.net_weight_kg || 0;
      const insp = c.quality_inspections?.[0];
      if (insp) {
        acc.total_accepted += insp.accepted_qty_kg || 0;
        acc.total_rejected += insp.rejected_qty_kg || 0;
      }
      return acc;
    }, { total_collections: 0, total_net_weight: 0, total_accepted: 0, total_rejected: 0 });

    sendSuccess(res, { data: { collections: data, totals } });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/inventory
 */
export const getInventoryReport = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        id, batch_no, grade, status, initial_qty_kg, available_qty_kg,
        sold_qty_kg, wasted_qty_kg, expected_expiry_date, received_date,
        selling_price_lkr,
        crop_categories!category_id(name),
        warehouses!warehouse_id(name)
      `)
      .order('expected_expiry_date', { ascending: true, nullsFirst: false })
      .limit(200);

    if (error) throw new AppError(error.message, 500);

    const today = new Date().toISOString().split('T')[0];
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const summary = {
      total_batches: data?.length || 0,
      available_batches: data?.filter((b: any) => b.status === 'available').length || 0,
      near_expiry: data?.filter((b: any) => b.expected_expiry_date && b.expected_expiry_date <= weekLater && b.expected_expiry_date >= today).length || 0,
      expired: data?.filter((b: any) => b.expected_expiry_date && b.expected_expiry_date < today).length || 0,
      total_available_kg: data?.filter((b: any) => b.status === 'available').reduce((s: number, b: any) => s + b.available_qty_kg, 0) || 0,
      total_value_lkr: data?.filter((b: any) => b.status === 'available').reduce((s: number, b: any) => s + (b.available_qty_kg * b.selling_price_lkr), 0) || 0,
    };

    sendSuccess(res, { data: { batches: data, summary } });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/payments
 */
export const getPaymentReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type = 'farmer', from_date, to_date } = req.query as Record<string, string>;

    if (type === 'farmer') {
      let query = supabaseAdmin
        .from('farmer_payments')
        .select(`
          id, payment_no, status, accepted_qty_kg, price_per_kg_lkr,
          gross_amount_lkr, total_deductions_lkr, net_amount_lkr,
          payment_date, created_at,
          farmers!farmer_id(full_name, farmer_code, district),
          produce_collections!collection_id(collection_no,
            crop_categories!category_id(name))
        `);

      if (from_date) query = query.gte('created_at', from_date);
      if (to_date) query = query.lte('created_at', to_date);

      const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
      if (error) throw new AppError(error.message, 500);

      const totals = (data || []).reduce((acc: any, p: any) => {
        acc.total_payments++;
        acc.total_gross += p.gross_amount_lkr || 0;
        acc.total_deductions += p.total_deductions_lkr || 0;
        acc.total_net += p.net_amount_lkr || 0;
        if (p.status === 'paid') acc.total_paid += p.net_amount_lkr || 0;
        return acc;
      }, { total_payments: 0, total_gross: 0, total_deductions: 0, total_net: 0, total_paid: 0 });

      sendSuccess(res, { data: { payments: data, totals } });
    } else {
      const { data, error } = await supabaseAdmin
        .from('buyer_payments')
        .select(`
          *, invoices!invoice_id(invoice_no, total_amount_lkr),
          buyers!buyer_id(company_name, buyer_code)
        `)
        .order('payment_date', { ascending: false });
      if (error) throw new AppError(error.message, 500);
      sendSuccess(res, { data: data || [] });
    }
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/financial
 */
export const getFinancialReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { year = new Date().getFullYear().toString() } = req.query as Record<string, string>;

    // Monthly buyer revenue
    const { data: revenue } = await supabaseAdmin
      .from('buyer_payments')
      .select('amount_lkr, payment_date')
      .gte('payment_date', `${year}-01-01`)
      .lte('payment_date', `${year}-12-31`);

    // Monthly farmer payouts
    const { data: payouts } = await supabaseAdmin
      .from('farmer_payments')
      .select('net_amount_lkr, paid_at')
      .eq('status', 'paid')
      .gte('paid_at', `${year}-01-01`)
      .lte('paid_at', `${year}-12-31`);

    // Aggregate by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      month_name: new Date(2024, i).toLocaleString('default', { month: 'short' }),
      revenue: 0,
      farmer_payouts: 0,
      profit: 0,
    }));

    (revenue || []).forEach((r: any) => {
      const m = new Date(r.payment_date).getMonth();
      monthlyData[m].revenue += r.amount_lkr;
    });

    (payouts || []).forEach((p: any) => {
      const m = new Date(p.paid_at!).getMonth();
      monthlyData[m].farmer_payouts += p.net_amount_lkr;
    });

    monthlyData.forEach(m => { m.profit = m.revenue - m.farmer_payouts; });

    const totals = monthlyData.reduce((acc, m) => ({
      total_revenue: acc.total_revenue + m.revenue,
      total_payouts: acc.total_payouts + m.farmer_payouts,
      total_profit: acc.total_profit + m.profit,
    }), { total_revenue: 0, total_payouts: 0, total_profit: 0 });

    sendSuccess(res, { data: { monthly: monthlyData, totals, year: parseInt(year) } });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/wastage
 */
export const getWastageReport = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_batches')
      .select(`
        batch_no, wasted_qty_kg, initial_qty_kg, received_date,
        crop_categories!category_id(name),
        farmers!farmer_id(full_name, farmer_code)
      `)
      .gt('wasted_qty_kg', 0)
      .order('wasted_qty_kg', { ascending: false });

    if (error) throw new AppError(error.message, 500);

    const total_wasted = (data || []).reduce((s: number, b: any) => s + b.wasted_qty_kg, 0);
    const total_initial = (data || []).reduce((s: number, b: any) => s + b.initial_qty_kg, 0);
    const waste_rate = total_initial > 0 ? (total_wasted / total_initial * 100).toFixed(2) : '0';

    sendSuccess(res, { data: { records: data, total_wasted, waste_rate_percent: parseFloat(waste_rate) } });
  } catch (e) { next(e); }
};

/**
 * GET /api/reports/orders
 */
export const getOrdersReport = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        id, order_no, status, total_amount_lkr, requested_date, created_at,
        buyers!buyer_id(company_name, buyer_code),
        purchase_order_items(requested_qty_kg, crop_categories!category_id(name))
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw new AppError(error.message, 500);

    const summary = {
      total: data?.length || 0,
      by_status: {} as Record<string, number>,
    };
    (data || []).forEach((o: any) => {
      summary.by_status[o.status] = (summary.by_status[o.status] || 0) + 1;
    });

    sendSuccess(res, { data: { orders: data, summary } });
  } catch (e) { next(e); }
};
