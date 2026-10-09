import { useState } from 'react';
import { currentRoleBase } from '../../utils/roleBase';
import { useAuctionReports, useAuctionDisputes, useBuyerEligibility, useSetCreditLimit, useAuctionAuditLogs } from '../../hooks/useAuction';
import { formatLKR, formatLKRCompact, formatDateTimeSL } from '../../utils/lkrFormat';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle2, Users, BookOpen } from 'lucide-react';

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const { data: report, isLoading, refetch } = useAuctionReports({ from: from || undefined, to: to || undefined });

  const pieData = report ? [
    { name: 'Successful', value: report.successful_auctions },
    { name: 'No Reserve Met', value: report.total_auctions - report.successful_auctions },
  ] : [];

  const COLORS = ['#059669', '#D97706'];

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl font-medium hover:bg-emerald-700 transition-colors">
          Apply
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white h-28 rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Auctions',     value: report.total_auctions,         color: 'text-gray-900',    bg: 'bg-white' },
              { label: 'Successful',         value: report.successful_auctions,    color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Total Revenue',      value: formatLKRCompact(report.total_revenue_lkr), color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'Total Bids',         value: report.total_bids,             color: 'text-blue-700',    bg: 'bg-blue-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-4 text-center`}>
                <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Success rate */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Auction Outcome Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* KPIs */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Key Performance Indicators</h3>
              <div className="space-y-4">
                {[
                  { label: 'Success Rate',        value: `${report.success_rate_pct}%`,         color: 'bg-emerald-500' },
                  { label: 'Avg Bids / Auction',  value: report.avg_bids_per_auction,            color: 'bg-blue-500' },
                  { label: 'Payment Default Rate', value: `${report.default_rate_pct}%`,         color: 'bg-red-500' },
                  { label: 'Total Revenue',        value: formatLKRCompact(report.total_revenue_lkr), color: 'bg-purple-500' },
                ].map((kpi) => (
                  <div key={kpi.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${kpi.color}`} />
                      <span className="text-sm text-gray-700">{kpi.label}</span>
                    </div>
                    <span className="font-bold text-gray-900 text-sm">{kpi.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Disputes Tab ─────────────────────────────────────────────────────────────

function DisputesTab() {
  const { data: disputes = [], isLoading } = useAuctionDisputes();

  const pending = disputes.filter((d: any) => d.status === 'submitted');
  const reviewing = disputes.filter((d: any) => d.status === 'under_review');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Submitted', value: pending.length, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Under Review', value: reviewing.length, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Total', value: disputes.length, color: 'text-gray-900', bg: 'bg-white' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-4 text-center`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-gray-100" />)}</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-2" />
          <p className="text-gray-500 text-sm">No disputes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => {
            const st = d.status === 'submitted' ? 'bg-amber-50 border-amber-200' :
                       d.status === 'under_review' ? 'bg-blue-50 border-blue-200' :
                       'bg-gray-50 border-gray-200';
            return (
              <div key={d.id} className={`rounded-2xl border p-4 ${st}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm capitalize">{d.dispute_type.replace(/_/g,' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{d.auctions?.auction_number} · {d.profiles?.full_name}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{d.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    d.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                    d.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{d.status}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="text-xs text-blue-600 font-medium hover:underline">Review</button>
                  <button className="text-xs text-emerald-600 font-medium hover:underline">Resolve</button>
                  <button className="text-xs text-red-500 font-medium hover:underline">Reject</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Credit Limits Tab ────────────────────────────────────────────────────────

function CreditLimitsTab() {
  const { data: buyers = [], isLoading } = useBuyerEligibility();
  const { mutate: setLimit, isPending }  = useSetCreditLimit();
  const [editing, setEditing] = useState<Record<string, number>>({});

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Set per-buyer auction credit limits. Buyers cannot bid beyond their available limit.</p>
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-white rounded-xl animate-pulse border border-gray-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {buyers.map((b: any) => {
            const cl = b.buyer_credit_limits?.[0];
            const current = editing[b.id] ?? cl?.credit_limit_lkr ?? 0;
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{b.company_name}</p>
                  <p className="text-xs text-gray-500">{b.buyer_code} · {b.verification_status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">LKR</span>
                  <input
                    type="number"
                    value={current}
                    onChange={(e) => setEditing({ ...editing, [b.id]: +e.target.value })}
                    className="w-32 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-right font-medium"
                  />
                  <button
                    onClick={() => {
                      setLimit({ buyerId: b.id, data: { credit_limit_lkr: current } });
                      setEditing({ ...editing, [b.id]: current });
                    }}
                    disabled={isPending}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                {cl && (
                  <div className="text-right text-xs text-gray-400">
                    Used: {formatLKR(cl.utilised_lkr)}<br />
                    Avail: <span className="text-emerald-600 font-medium">{formatLKR(cl.available_lkr)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Audit Logs Tab ───────────────────────────────────────────────────────────

function AuditLogsTab() {
  const { data: logs = [], isLoading } = useAuctionAuditLogs();
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white rounded-xl animate-pulse border border-gray-100" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Time', 'Actor', 'Action', 'Entity', 'Entity ID'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDateTimeSL(log.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">{log.actor_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{log.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.entity_type}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.entity_id?.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'reports',  label: 'Reports',      icon: <TrendingUp  size={15} /> },
  { key: 'disputes', label: 'Disputes',     icon: <AlertTriangle size={15} /> },
  { key: 'credits',  label: 'Credit Limits',icon: <Users       size={15} /> },
  { key: 'audit',    label: 'Audit Logs',   icon: <BookOpen    size={15} /> },
];

export function AuctionReportsPage() {
  const [tab, setTab] = useState('reports');
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auction Administration</h1>
          <p className="text-gray-500 text-sm mt-1">Reports, disputes, credit limits, and audit logs for the auction module.</p>
        </div>
        <a href={`${currentRoleBase()}/auction/create`} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          + Add Auction
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
              tab === t.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports'  && <ReportsTab />}
      {tab === 'disputes' && <DisputesTab />}
      {tab === 'credits'  && <CreditLimitsTab />}
      {tab === 'audit'    && <AuditLogsTab />}
    </div>
  );
}
