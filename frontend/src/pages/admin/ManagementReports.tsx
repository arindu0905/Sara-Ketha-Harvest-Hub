import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Area,
} from 'recharts';
import { Download, Printer, TrendingUp, Package, Trash2, Banknote, Users, ShoppingCart, FileText } from 'lucide-react';
import { reportsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { formatLKR } from '../../utils/lkrFormat';
import { apiErrorMessage, downloadBlob } from '../../utils/apiError';
import { printReport, ReportSection } from '../../utils/printDocument';

type Tab = 'overview' | 'farmers' | 'buyers' | 'waste' | 'forecast' | 'prices' | 'financial';
const TABS: [Tab, string][] = [['overview', 'Operations'], ['farmers', 'Farmer performance'], ['buyers', 'Buyer performance'], ['waste', 'Waste analysis'], ['forecast', 'Supply vs demand'], ['prices', 'Price trends'], ['financial', 'Financial']];
const EXPORT_FOR: Partial<Record<Tab, string>> = { overview: 'collections', farmers: 'farmer-performance', buyers: 'buyer-performance', waste: 'wastage', forecast: 'supply-demand', financial: 'financial' };
const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#dc2626', '#7c3aed', '#0ea5e9', '#64748b'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const ManagementReports: React.FC = () => {
  const today = new Date();
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth() - 2, 1)));
  const [to, setTo] = useState(iso(today));
  const [priceCrop, setPriceCrop] = useState('');
  const badRange = from > to;

  const { data: res, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['management-report', from, to],
    queryFn: () => reportsApi.getManagement({ from, to }),
    enabled: !badRange,
  });
  const d = res?.data?.data;

  const exportCsv = async () => {
    const type = EXPORT_FOR[tab];
    if (!type) return toast('This view has no CSV – use PDF');
    try {
      const r = await reportsApi.exportCsv(type, { from, to });
      downloadBlob(r.data as Blob, `${type}_${from}_to_${to}.csv`);
    } catch (e) { toast.error(apiErrorMessage(e, 'Export failed')); }
  };

  const exportPdf = () => {
    if (!d) return;
    const s: ReportSection[] = [];
    const op = d.operations;
    s.push({ heading: 'Operations summary', headers: ['Metric', 'Value'], rows: [
      ['Collections', op.collections.count], ['Net weight collected (kg)', op.collections.net_kg], ['Inspections', op.quality.inspections],
      ['Accepted (kg)', op.quality.accepted_kg], ['Rejected (kg)', op.quality.rejected_kg], ['Stock available (kg)', op.inventory.available_kg],
      ['Stock value', formatLKR(op.inventory.stock_value_lkr, 0)], ['Near-expiry batches', op.inventory.near_expiry_batches]] });
    s.push({ heading: 'Farmer performance', headers: ['Farmer', 'District', 'Collections', 'Net kg', 'Acceptance %', 'Paid'],
      rows: d.farmers.map((f: any) => [`${f.farmer_name} (${f.farmer_code})`, f.district, f.collections, f.total_net_kg, f.acceptance_rate_pct ?? '–', formatLKR(f.total_paid_lkr, 0)]) });
    s.push({ heading: 'Buyer performance', headers: ['Buyer', 'Orders', 'Cancelled', 'Ordered', 'Paid', 'Outstanding'],
      rows: d.buyers.map((b: any) => [b.company_name, b.orders, b.cancelled_orders, formatLKR(b.ordered_value_lkr, 0), formatLKR(b.paid_lkr, 0), formatLKR(b.outstanding_lkr, 0)]) });
    s.push({ heading: `Waste (rate ${d.waste.waste_rate_pct}%)`, headers: ['Reason', 'kg', 'Value lost'], rows: d.waste.by_reason.map((r: any) => [r.reason, r.kg, formatLKR(r.value_lkr, 0)]) });
    s.push({ heading: 'Supply vs demand (incl. forecast)', headers: ['Month', 'Supply kg', 'Demand kg', 'Type'], rows: d.supply_demand.months.map((m: any) => [m.label, m.supply_kg, m.demand_kg, m.is_forecast ? 'Forecast' : 'Actual']) });
    s.push({ heading: 'Financial summary', headers: ['Metric', 'LKR'], rows: [['Revenue received', d.financial.revenue_lkr], ['Farmer payouts', d.financial.farmer_payouts_lkr], ['Wastage cost', d.financial.wastage_cost_lkr], ['Estimated profit', d.financial.profit_estimate_lkr], ['Receivable', d.financial.outstanding_receivable_lkr], ['Payable', d.financial.outstanding_payable_lkr]] });
    printReport('Management Report', `${from} to ${to}`, s);
  };

  const crops: string[] = d ? Array.from(new Set<string>(d.price_trends.map((p: any) => p.category))) : [];
  const crop = priceCrop || crops[0] || '';
  const priceSeries = d ? d.price_trends.filter((p: any) => p.category === crop) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Management Reports</h1><p className="page-subtitle">Live figures computed on the server · {d?.supply_demand?.method ?? ''}</p></div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv} disabled={!d}><Download size={16} /> CSV</button>
          <button className="btn-secondary" onClick={exportPdf} disabled={!d}><Printer size={16} /> PDF</button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div><label className="form-label">From</label><input type="date" className="form-input" value={from} max={to} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="form-label">To</label><input type="date" className="form-input" value={to} min={from} max={iso(today)} onChange={e => setTo(e.target.value)} /></div>
        {badRange && <p className="form-error">"From" must be before "To"</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {isError && <div className="alert alert-error"><p className="text-sm">{apiErrorMessage(error, 'Could not load report')} <button className="underline" onClick={() => refetch()}>Retry</button></p></div>}
      {isLoading && <div className="card p-6"><div className="skeleton h-64 rounded-xl" /></div>}

      {d && tab === 'overview' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Collections" value={d.operations.collections.count} subtitle={`${Math.round(d.operations.collections.net_kg).toLocaleString()} kg`} icon={<Package size={22} />} />
          <StatCard title="Acceptance rate" value={`${(() => { const q = d.operations.quality; const t = Number(q.accepted_kg) + Number(q.rejected_kg); return t ? ((q.accepted_kg / t) * 100).toFixed(1) : '–'; })()}%`} subtitle={`${d.operations.quality.inspections} inspections`} icon={<FileText size={22} />} iconBg="bg-green-100" iconColor="text-green-600" />
          <StatCard title="Stock on hand" value={`${Math.round(d.operations.inventory.available_kg).toLocaleString()} kg`} subtitle={formatLKR(d.operations.inventory.stock_value_lkr, 0)} icon={<Package size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
          <StatCard title="Near-expiry batches" value={d.operations.inventory.near_expiry_batches} icon={<Trash2 size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-4 h-72"><h3 className="text-sm font-semibold mb-2">Collected by centre (kg)</h3>
            <ResponsiveContainer width="100%" height="90%"><BarChart data={d.operations.collections.by_centre}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="centre" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="kg" fill="#16a34a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="card p-4 h-72"><h3 className="text-sm font-semibold mb-2">Grades</h3>
            <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={d.operations.quality.by_grade} dataKey="count" nameKey="grade" outerRadius={80}>{d.operations.quality.by_grade.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          <div className="card p-4 h-72"><h3 className="text-sm font-semibold mb-2">Stock by crop (kg)</h3>
            <ResponsiveContainer width="100%" height="90%"><BarChart data={d.operations.inventory.by_category} layout="vertical"><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={70} /><Tooltip /><Bar dataKey="available_kg" fill="#3b82f6" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="card p-4"><h3 className="text-sm font-semibold mb-2">Top rejection reasons</h3>
          {d.operations.quality.top_rejection_reasons.length === 0 ? <p className="text-sm text-surface-400">None in this period</p> : (
            <div className="flex flex-wrap gap-2">{d.operations.quality.top_rejection_reasons.map((r: any) => <span key={r.reason} className="badge-danger capitalize">{String(r.reason).replace(/_/g, ' ')} · {r.kg} kg</span>)}</div>)}</div>
      </>)}

      {d && tab === 'farmers' && (
        <div className="card overflow-hidden"><div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><Users size={16} /> Farmers ranked by volume</h3></div>
          <div className="table-container"><table className="table"><thead><tr><th>Farmer</th><th>District</th><th>Collections</th><th>Net kg</th><th>Accepted</th><th>Rejected</th><th>Acceptance</th><th>Avg grade (0–3)</th><th>Paid</th></tr></thead>
            <tbody>{d.farmers.length === 0 ? <tr><td colSpan={9} className="text-center text-surface-400 py-6">No collections in this period</td></tr> : d.farmers.map((f: any) => (
              <tr key={f.farmer_id}><td className="font-medium">{f.farmer_name}<br /><span className="text-xs text-surface-400">{f.farmer_code}</span></td><td>{f.district}</td><td>{f.collections}</td><td>{f.total_net_kg}</td><td>{f.accepted_kg}</td><td className="text-red-600">{f.rejected_kg}</td>
                <td>{f.acceptance_rate_pct == null ? '–' : <span className={f.acceptance_rate_pct < 80 ? 'badge-danger' : f.acceptance_rate_pct < 90 ? 'badge-warning' : 'badge-success'}>{f.acceptance_rate_pct}%</span>}</td><td>{f.avg_grade_score ?? '–'}</td><td>{formatLKR(f.total_paid_lkr, 0)}</td></tr>))}</tbody></table></div></div>
      )}

      {d && tab === 'buyers' && (
        <div className="card overflow-hidden"><div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><ShoppingCart size={16} /> Buyers ranked by order value</h3></div>
          <div className="table-container"><table className="table"><thead><tr><th>Buyer</th><th>Orders</th><th>Cancelled</th><th>Ordered</th><th>Paid</th><th>Outstanding</th><th>Cancellation</th></tr></thead>
            <tbody>{d.buyers.length === 0 ? <tr><td colSpan={7} className="text-center text-surface-400 py-6">No orders in this period</td></tr> : d.buyers.map((b: any) => (
              <tr key={b.buyer_id}><td className="font-medium">{b.company_name}<br /><span className="text-xs text-surface-400">{b.buyer_code}</span></td><td>{b.orders}</td><td>{b.cancelled_orders}</td><td>{formatLKR(b.ordered_value_lkr, 0)}</td><td className="text-green-700">{formatLKR(b.paid_lkr, 0)}</td>
                <td className={Number(b.outstanding_lkr) > 0 ? 'text-amber-700 font-semibold' : ''}>{formatLKR(b.outstanding_lkr, 0)}</td><td>{b.cancellation_rate_pct ?? 0}%</td></tr>))}</tbody></table></div></div>
      )}

      {d && tab === 'waste' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Wasted" value={`${Math.round(d.waste.total_wasted_kg)} kg`} icon={<Trash2 size={22} />} iconBg="bg-red-100" iconColor="text-red-600" />
          <StatCard title="Value lost" value={formatLKR(d.waste.total_value_lost_lkr, 0)} icon={<Banknote size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" />
          <StatCard title="Waste rate" value={`${d.waste.waste_rate_pct}%`} subtitle={`of ${Math.round(d.waste.received_kg)} kg received`} icon={<TrendingUp size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
          <StatCard title="Rejected at inspection" value={`${Math.round(d.waste.rejected_at_inspection_kg ?? 0)} kg`} icon={<Package size={22} />} iconBg="bg-purple-100" iconColor="text-purple-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-4 h-72"><h3 className="text-sm font-semibold mb-2">By reason (kg)</h3>
            <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={d.waste.by_reason} dataKey="kg" nameKey="reason" outerRadius={80}>{d.waste.by_reason.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          <div className="card p-4 h-72"><h3 className="text-sm font-semibold mb-2">By crop (kg)</h3>
            <ResponsiveContainer width="100%" height="90%"><BarChart data={d.waste.by_category}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="kg" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
      </>)}

      {d && tab === 'forecast' && (
        <div className="card p-4"><h3 className="text-sm font-semibold mb-1">Supply vs demand with 3-month forecast</h3>
          <p className="text-xs text-surface-500 mb-3">Dashed segments are forecasts ({d.supply_demand.method}). Supply trend {d.supply_demand.supply_slope_kg_per_month >= 0 ? '+' : ''}{d.supply_demand.supply_slope_kg_per_month} kg/mo · demand trend {d.supply_demand.demand_slope_kg_per_month >= 0 ? '+' : ''}{d.supply_demand.demand_slope_kg_per_month} kg/mo.</p>
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={d.supply_demand.months}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend />
            <Area type="monotone" dataKey="supply_kg" name="Supply (kg)" fill="#bbf7d0" stroke="#16a34a" /><Line type="monotone" dataKey="demand_kg" name="Demand (kg)" stroke="#3b82f6" strokeWidth={2} dot /></ComposedChart></ResponsiveContainer></div>
          <div className="table-container mt-4"><table className="table"><thead><tr><th>Month</th><th>Supply kg</th><th>Demand kg</th><th>Gap</th><th></th></tr></thead>
            <tbody>{d.supply_demand.months.map((m: any) => (<tr key={m.month} className={m.is_forecast ? 'bg-blue-50/50' : ''}><td>{m.label}</td><td>{m.supply_kg}</td><td>{m.demand_kg}</td>
              <td className={m.supply_kg - m.demand_kg < 0 ? 'text-red-600' : 'text-green-700'}>{Math.round((m.supply_kg - m.demand_kg) * 10) / 10}</td><td>{m.is_forecast && <span className="badge-info">forecast</span>}</td></tr>))}</tbody></table></div></div>
      )}

      {d && tab === 'prices' && (
        <div className="card p-4"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold">Average purchase vs selling price per kg</h3>
          <select className="form-select w-auto" value={crop} onChange={e => setPriceCrop(e.target.value)}>{crops.map(c => <option key={c}>{c}</option>)}</select></div>
          {priceSeries.length === 0 ? <p className="text-sm text-surface-400 py-10 text-center">No stock received in the last 12 months</p> : (
            <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={priceSeries}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend />
              <Line dataKey="avg_purchase_lkr" name="Purchase (LKR/kg)" stroke="#f59e0b" strokeWidth={2} /><Line dataKey="avg_selling_lkr" name="Selling (LKR/kg)" stroke="#16a34a" strokeWidth={2} /></LineChart></ResponsiveContainer></div>)}</div>
      )}

      {d && tab === 'financial' && (<>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Revenue received" value={formatLKR(d.financial.revenue_lkr, 0)} icon={<Banknote size={22} />} />
          <StatCard title="Farmer payouts" value={formatLKR(d.financial.farmer_payouts_lkr, 0)} icon={<Users size={22} />} iconBg="bg-orange-100" iconColor="text-orange-600" />
          <StatCard title="Estimated profit" value={formatLKR(d.financial.profit_estimate_lkr, 0)} subtitle="revenue − payouts − wastage" icon={<TrendingUp size={22} />} iconBg={d.financial.profit_estimate_lkr >= 0 ? 'bg-green-100' : 'bg-red-100'} iconColor={d.financial.profit_estimate_lkr >= 0 ? 'text-green-600' : 'text-red-600'} />
          <StatCard title="Wastage cost" value={formatLKR(d.financial.wastage_cost_lkr, 0)} icon={<Trash2 size={22} />} iconBg="bg-red-100" iconColor="text-red-600" />
          <StatCard title="Receivable" value={formatLKR(d.financial.outstanding_receivable_lkr, 0)} icon={<Banknote size={22} />} iconBg="bg-blue-100" iconColor="text-blue-600" />
          <StatCard title="Payable" value={formatLKR(d.financial.outstanding_payable_lkr, 0)} icon={<Banknote size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
        </div>
        <div className="card p-4 h-80"><h3 className="text-sm font-semibold mb-2">Monthly cash in vs cash out</h3>
          <ResponsiveContainer width="100%" height="90%"><BarChart data={d.financial.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => formatLKR(v, 0)} /><Legend />
            <Bar dataKey="revenue_lkr" name="Revenue" fill="#16a34a" /><Bar dataKey="farmer_payouts_lkr" name="Farmer payouts" fill="#f59e0b" /></BarChart></ResponsiveContainer></div>
      </>)}
    </div>
  );
};
