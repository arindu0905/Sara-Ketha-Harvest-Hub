import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../services/api';
import { currentRoleBase } from '../../utils/roleBase';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, Gavel, Package, TrendingUp, CheckCircle,
  XCircle, Play, Pause, AlertTriangle, RefreshCw, Eye, Users,
  DollarSign, Calendar, MapPin, Info, Plus, Trash2
} from 'lucide-react';
import {
  useAuction, useAuctionBids,
  useApproveAuction, usePublishAuction, useOpenAuction,
  usePauseAuction, useCloseAuction,
} from '../../hooks/useAuction';
import { useQueryClient } from '@tanstack/react-query';
import { auctionKeys } from '../../hooks/useAuction';
import { auctionApi } from '../../services/auctionApi';
import {
  formatLKR, formatDateTimeSL, auctionStatusLabel, gradeLabel
} from '../../utils/lkrFormat';
import { useAuctionCountdown, formatCountdown } from '../../hooks/useAuctionCountdown';
import toast from 'react-hot-toast';

// ─── Lifecycle action button ──────────────────────────────────────────────────

interface ActionBtnProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isPending: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

function ActionBtn({ label, icon, onClick, isPending, variant = 'primary' }: ActionBtnProps) {
  const cls = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    info:    'bg-blue-600 hover:bg-blue-700 text-white',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all ${cls} disabled:opacity-60`}
    >
      {icon}
      {isPending ? 'Working...' : label}
    </button>
  );
}

// ─── Lifecycle controls per status ───────────────────────────────────────────

function AuctionControls({ auction, onRefresh }: { auction: any; onRefresh: () => void }) {
  const id = auction.id;
  const approve = useApproveAuction(id);
  const publish = usePublishAuction(id);
  const open    = useOpenAuction(id);
  const pause   = usePauseAuction(id);
  const close   = useCloseAuction(id);

  const wrap = (mutation: any) => {
    mutation.mutate(undefined, { onSuccess: () => { onRefresh(); } });
  };

  const confirmClose = () => {
    if (!window.confirm('Close this auction now? This will stop all bidding.')) return;
    wrap(close);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {auction.status === 'draft' && (
        <>
          <ActionBtn label="Approve" icon={<CheckCircle size={15} />} onClick={() => wrap(approve)} isPending={approve.isPending} variant="success" />
          <Link to={`${currentRoleBase()}/auction/create`} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-100 text-surface-700 hover:bg-surface-200 transition-all">
            <Gavel size={15} /> Edit Auction
          </Link>
        </>
      )}
      {auction.status === 'scheduled' && (
        <>
          <ActionBtn label="Publish Now" icon={<Eye size={15} />} onClick={() => wrap(publish)} isPending={publish.isPending} variant="info" />
          <ActionBtn label="Open Auction" icon={<Play size={15} />} onClick={() => wrap(open)} isPending={open.isPending} variant="success" />
        </>
      )}
      {auction.status === 'open' && (
        <>
          <ActionBtn label="Pause" icon={<Pause size={15} />} onClick={() => wrap(pause)} isPending={pause.isPending} variant="warning" />
          <ActionBtn label="Close Auction" icon={<XCircle size={15} />} onClick={confirmClose} isPending={close.isPending} variant="danger" />
        </>
      )}
      {auction.status === 'paused' && (
        <>
          <ActionBtn label="Resume" icon={<Play size={15} />} onClick={() => wrap(open)} isPending={open.isPending} variant="success" />
          <ActionBtn label="Close Auction" icon={<XCircle size={15} />} onClick={confirmClose} isPending={close.isPending} variant="danger" />
        </>
      )}
      {(auction.status === 'awaiting_award' || auction.status === 'closed') && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <AlertTriangle size={15} className="text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">Waiting for lot award confirmation</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminAuctionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'lots' | 'bids'>('overview');

  const { data: auction, isLoading, error } = useAuction(id);
  const { data: bids = [] } = useAuctionBids(id);

  // ── add / remove lots ──
  const [showLotForm, setShowLotForm] = useState(false);
  const [lotForm, setLotForm] = useState({ batch_id: '', quantity: '', price: '', reserve: '' });
  const [savingLot, setSavingLot] = useState(false);
  const { data: stockRes } = useQuery({
    queryKey: ['auctionable-stock', id],
    queryFn: () => inventoryApi.getAll({ status: 'available', available_for_auction: 'true', limit: '200' }),
    enabled: showLotForm,
  });
  const stock: any[] = stockRes?.data?.data ?? [];
  const pickedBatch = stock.find(b => b.id === lotForm.batch_id);

  const canEditLots = ['draft', 'scheduled', 'paused'].includes((auction as any)?.status);

  const addLot = async () => {
    const qty = Number(lotForm.quantity), price = Number(lotForm.price), reserve = lotForm.reserve ? Number(lotForm.reserve) : undefined;
    if (!pickedBatch) return toast.error('Select a stock batch');
    if (!(qty > 0) || qty > Number(pickedBatch.available_qty_kg)) return toast.error(`Quantity must be between 0 and ${pickedBatch.available_qty_kg} kg`);
    if (!(price > 0)) return toast.error('Enter a starting price');
    if (reserve !== undefined && reserve < price) return toast.error('Reserve price must be at least the starting price');
    setSavingLot(true);
    try {
      await auctionApi.createLot(id, {
        inventory_batch_id: pickedBatch.id,
        crop_category_id: pickedBatch.category_id ?? pickedBatch.crop_categories?.id,
        quality_grade: pickedBatch.grade, lot_quantity: qty, unit: 'kg',
        starting_price_per_unit: price, reserve_price_per_unit: reserve,
      } as any);
      toast.success('Lot added');
      setShowLotForm(false); setLotForm({ batch_id: '', quantity: '', price: '', reserve: '' });
      onRefresh();
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(d?.errors?.[0] ? `${d.errors[0].field}: ${d.errors[0].message}` : d?.message ?? 'Could not add the lot');
    } finally { setSavingLot(false); }
  };
  const removeLot = async (lotId: string) => {
    if (!window.confirm('Remove this lot from the auction?')) return;
    try { await auctionApi.deleteLot(id, lotId); toast.success('Lot removed'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Could not remove the lot'); }
  };

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: auctionKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: auctionKeys.bids(id) });
  };

  const cd = useAuctionCountdown(auction?.status === 'open' ? auction.end_at : undefined);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={40} className="mx-auto mb-3 text-amber-400" />
        <h2 className="text-lg font-bold text-surface-700">Auction not found</h2>
        <button onClick={() => navigate(-1)} className="mt-3 text-primary-600 hover:underline text-sm">← Go back</button>
      </div>
    );
  }

  const sl = auctionStatusLabel(auction.status);
  const lots: any[] = (auction as any).auction_lots ?? [];
  const centre: any = (auction as any).collection_centres;

  const totalBids = bids.length;
  const highestBid = lots.length > 0 ? Math.max(...lots.map((l: any) => l.current_price_per_unit ?? l.starting_price_per_unit ?? 0)) : 0;

  const tabs = [
    { key: 'overview', label: 'Overview',    count: undefined },
    { key: 'lots',     label: 'Lots',        count: lots.length },
    { key: 'bids',     label: 'Bid Activity', count: totalBids },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 pb-16 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="self-start p-2 rounded-xl hover:bg-surface-100 text-surface-600 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sl.bg} ${sl.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sl.dot} ${auction.status === 'open' ? 'animate-pulse' : ''}`} />
              {sl.label}
            </span>
            <span className="text-xs text-surface-400 font-mono">{auction.auction_number}</span>
          </div>
          <h1 className="text-xl font-bold text-surface-900">{auction.title}</h1>
          {centre && (
            <p className="text-sm text-surface-500 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {centre.name}{centre.district ? `, ${centre.district}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button onClick={onRefresh} className="btn-ghost p-2 rounded-xl text-surface-500 hover:text-surface-800">
            <RefreshCw size={15} />
          </button>
          <AuctionControls auction={auction} onRefresh={onRefresh} />
        </div>
      </div>

      {/* Live countdown */}
      {auction.status === 'open' && !cd.expired && (
        <div className={`rounded-2xl px-5 py-3 flex items-center justify-between ${cd.finalMinutes ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="flex items-center gap-2">
            <Clock size={16} className={cd.finalMinutes ? 'text-red-600 animate-pulse' : 'text-emerald-600'} />
            <span className={`text-sm font-bold ${cd.finalMinutes ? 'text-red-700' : 'text-emerald-700'}`}>
              Closes in: {formatCountdown(cd)}
            </span>
          </div>
          <span className="text-xs text-surface-500">{formatDateTimeSL(auction.end_at)}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Starting Price', value: formatLKR(auction.starting_price), icon: <DollarSign size={15} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Current Top Bid', value: highestBid > 0 ? formatLKR(highestBid) : 'No bids yet', icon: <TrendingUp size={15} className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Total Lots', value: lots.length, icon: <Package size={15} className="text-purple-600" />, bg: 'bg-purple-50' },
          { label: 'Total Bids', value: totalBids, icon: <Users size={15} className="text-amber-600" />, bg: 'bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className={`card p-4 ${kpi.bg} border-0`}>
            <div className="flex items-center gap-1.5 mb-1">{kpi.icon}<p className="text-xs text-surface-500">{kpi.label}</p></div>
            <p className="text-lg font-extrabold text-surface-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-2xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === t.key ? 'bg-white shadow-sm text-primary-700' : 'text-surface-500 hover:text-surface-700'}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeTab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-surface-200 text-surface-600'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-surface-900 flex items-center gap-2"><Info size={15} /> Auction Details</h3>
            <dl className="space-y-2 text-sm">
              {[
                ['Auction Type', auction.auction_type === 'open_ascending' ? 'Open Ascending (English)' : 'Sealed Bid'],
                ['Start', formatDateTimeSL(auction.start_at)],
                ['End', formatDateTimeSL(auction.end_at)],
                ['Min. Increment', formatLKR(auction.minimum_increment)],
                ['Payment Deadline', `${auction.payment_deadline_hours ?? 48} hours`],
                ['Anti-snipe', auction.auto_extension_enabled ? `Yes – ${auction.extension_minutes} min extension` : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-surface-500 shrink-0">{k}</dt>
                  <dd className="font-medium text-surface-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-surface-900 flex items-center gap-2"><MapPin size={15} /> Collection Centre</h3>
            {centre ? (
              <dl className="space-y-2 text-sm">
                {[
                  ['Name', centre.name],
                  ['District', centre.district ?? '—'],
                  ['Address', centre.address ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-surface-500 shrink-0">{k}</dt>
                    <dd className="font-medium text-surface-900 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-surface-400">No centre info available</p>
            )}
            <div className="pt-2 border-t border-surface-100 space-y-1">
              <h4 className="text-xs font-semibold text-surface-600">Lot Status Summary</h4>
              {lots.length === 0 ? (
                <p className="text-xs text-surface-400">No lots added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {['pending', 'open', 'closed', 'awarded'].map(s => {
                    const count = lots.filter((l: any) => l.lot_status === s).length;
                    if (!count) return null;
                    return (
                      <span key={s} className="text-xs bg-surface-100 text-surface-700 rounded-full px-2 py-0.5 font-medium">
                        {s}: {count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lots */}
      {activeTab === 'lots' && (
        <div className="space-y-3">
          {canEditLots ? (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-surface-600">
                  {lots.length === 0 ? 'This auction has no lots yet – buyers cannot bid until you add one.' : 'Add more lots, or remove one that has not opened for bidding.'}
                </p>
                <button onClick={() => setShowLotForm(v => !v)} className="btn-primary btn-sm flex items-center gap-1"><Plus size={14} /> Add lot</button>
              </div>
              {showLotForm && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs">Stock batch *</label>
                    <select className="form-select" value={lotForm.batch_id} onChange={e => setLotForm({ ...lotForm, batch_id: e.target.value, quantity: '' })}>
                      <option value="">Select a batch…</option>
                      {stock.map(b => <option key={b.id} value={b.id}>{b.batch_no} – {b.crop_categories?.name} · {b.grade?.replace('_', ' ')} ({b.available_qty_kg} kg)</option>)}
                    </select>
                    {stock.length === 0 && <p className="text-xs text-amber-600 mt-1">No free stock: every batch with stock is already in an auction lot or an order.</p>}
                  </div>
                  <div><label className="form-label text-xs">Quantity (kg) *</label><input type="number" min="0.1" step="0.1" max={pickedBatch?.available_qty_kg} className="form-input" value={lotForm.quantity} onChange={e => setLotForm({ ...lotForm, quantity: e.target.value })} /></div>
                  <div><label className="form-label text-xs">Starting price (LKR/kg) *</label><input type="number" min="0.01" step="0.01" className="form-input" value={lotForm.price} onChange={e => setLotForm({ ...lotForm, price: e.target.value })} /></div>
                  <div><label className="form-label text-xs">Reserve price (optional)</label><input type="number" min="0.01" step="0.01" className="form-input" value={lotForm.reserve} onChange={e => setLotForm({ ...lotForm, reserve: e.target.value })} /></div>
                  <div className="flex items-end gap-2">
                    <button onClick={addLot} disabled={savingLot} className="btn-primary btn-sm">{savingLot ? 'Adding…' : 'Add to auction'}</button>
                    <button onClick={() => setShowLotForm(false)} className="btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : lots.length === 0 && (
            <p className="text-xs text-surface-400">Lots cannot be changed while the auction is running. Pause it first.</p>
          )}
          {lots.length === 0 ? (
            <div className="card p-8 text-center">
              <Package size={32} className="mx-auto mb-3 text-surface-300" />
              <p className="text-surface-500 font-medium">No lots added to this auction yet.</p>
            </div>
          ) : (
            lots.map((lot: any, i: number) => (
              <div key={lot.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-surface-400 font-mono mb-0.5">Lot {lot.lot_number ?? i + 1}</p>
                    <p className="font-bold text-surface-900">{lot.crop_categories?.name ?? '—'}</p>
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                      lot.quality_grade === 'grade_a' ? 'bg-emerald-100 text-emerald-800' :
                      lot.quality_grade === 'grade_b' ? 'bg-blue-100 text-blue-800' :
                      lot.quality_grade === 'grade_c' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {(gradeLabel(lot.quality_grade) as any).label ?? String(gradeLabel(lot.quality_grade))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                  {canEditLots && ['draft', 'published'].includes(lot.lot_status) && (
                    <button onClick={() => removeLot(lot.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Remove lot"><Trash2 size={14} /></button>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    lot.lot_status === 'open' ? 'bg-emerald-100 text-emerald-700' :
                    lot.lot_status === 'awarded' ? 'bg-purple-100 text-purple-700' :
                    'bg-surface-100 text-surface-600'
                  }`}>
                    {lot.lot_status}
                  </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-surface-400">Quantity</p>
                    <p className="font-bold">{lot.lot_quantity} {lot.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Start Price</p>
                    <p className="font-bold">{formatLKR(lot.starting_price_per_unit)}/{lot.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Current Price</p>
                    <p className="font-bold text-emerald-700">{formatLKR(lot.current_price_per_unit ?? lot.starting_price_per_unit)}/{lot.unit}</p>
                  </div>
                </div>

                {/* Lot images */}
                {(lot.auction_lot_images ?? []).length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {lot.auction_lot_images.map((img: any) => (
                      <img
                        key={img.id}
                        src={img.storage_path}
                        alt="Produce"
                        className="w-16 h-16 rounded-xl object-cover border border-surface-200"
                        onError={e => (e.currentTarget.src = 'https://placehold.co/64x64?text=IMG')}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Bids */}
      {activeTab === 'bids' && (
        <div className="card overflow-hidden">
          {bids.length === 0 ? (
            <div className="p-8 text-center">
              <TrendingUp size={32} className="mx-auto mb-3 text-surface-300" />
              <p className="text-surface-500 font-medium">No bids placed yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr>
                  {['Time', 'Lot', 'Bid Amount', 'Quantity', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {bids.slice().reverse().map((bid: any) => (
                  <tr key={bid.id} className="hover:bg-surface-50/50">
                    <td className="px-4 py-3 text-surface-500 text-xs">{formatDateTimeSL(bid.bid_time ?? bid.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-600">Lot {bid.lot_number ?? '—'}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{formatLKR(bid.bid_amount_per_unit)}/kg</td>
                    <td className="px-4 py-3">{bid.bid_quantity} kg</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        bid.status === 'winning' ? 'bg-emerald-100 text-emerald-700' :
                        bid.status === 'outbid'  ? 'bg-surface-100 text-surface-500' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {bid.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
