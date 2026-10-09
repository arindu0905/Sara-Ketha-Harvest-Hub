import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateAuction } from '../../hooks/useAuction';
import { getSriLankanSeasons, SL_DISTRICTS, formatLKR } from '../../utils/lkrFormat';
import { formatCategoryName } from '../../utils/categoryUtils';
import { centresApi } from '../../services/api';
import { auctionApi } from '../../services/auctionApi';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronLeft, Check, Plus, Trash2, AlertCircle } from 'lucide-react';

// ─── Step schemas ─────────────────────────────────────────────────────────────

const AuctionConfigSchema = z.object({
  collection_centre_id:   z.string().uuid('Select a collection centre'),
  auction_type:           z.enum(['open_ascending', 'sealed_bid']).default('open_ascending'),
  title:                  z.string().min(5).max(200),
  description:            z.string().max(2000).optional(),
  start_at:               z.string().min(1, 'Select start time'),
  end_at:                 z.string().min(1, 'Select end time'),
  starting_price:         z.number().positive(),
  minimum_increment:      z.number().positive().default(100),
  payment_deadline_hours: z.number().int().positive().default(48),
  auto_extension_enabled: z.boolean().default(true),
  extension_minutes:      z.number().int().positive().default(5),
  reserve_price:          z.preprocess((val) => Number.isNaN(val) ? undefined : val, z.number().positive().optional()),
}).refine((d) => new Date(d.start_at).getTime() >= Date.now() - 2 * 60 * 1000, {
  message: 'Start date and time cannot be in the past',
  path: ['start_at'],
}).refine((d) => new Date(d.end_at).getTime() > Date.now(), {
  message: 'End date and time cannot be in the past',
  path: ['end_at'],
}).refine((d) => new Date(d.start_at) < new Date(d.end_at), {
  message: 'Start time must be before end time',
  path: ['start_at'],
}).refine((d) => !d.reserve_price || Number(d.reserve_price) >= d.starting_price, {
  message: 'Reserve price must be ≥ starting price',
  path: ['reserve_price'],
});

/** Current local date-time in the format <input type="datetime-local"> expects (used as its minimum). */
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const steps = [
  { label: 'Configure Auction', icon: '⚙️' },
  { label: 'Add Lots',          icon: '📦' },
  { label: 'Review & Submit',   icon: '✓'  },
];

type AuctionConfig = z.infer<typeof AuctionConfigSchema>;

interface DraftLot {
  tempId:               string;
  inventory_batch_id:   string;
  crop_category_id:     string;
  quality_grade:        string;
  lot_quantity:         number;
  unit:                 string;
  starting_price_per_unit: number;
  origin_district?:     string;
  harvest_season?:      string;
  traceability_notes?:  string;
  batchLabel?:          string;
}

// ─── Step 1: Configure ───────────────────────────────────────────────────────

function StepConfigure({ onNext }: { onNext: (d: AuctionConfig) => void }) {
  const { data: centres = [] } = useQuery({
    queryKey: ['centres-for-auction'],
    // /centres is open to every signed-in staff role (the /admin version is administrator-only)
    queryFn:  () => centresApi.getAll().then((r) => (r.data.data ?? []).filter((c: any) => c.is_active !== false)),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AuctionConfig>({
    resolver: zodResolver(AuctionConfigSchema),
    defaultValues: {
      auction_type:           'open_ascending',
      minimum_increment:      100,
      payment_deadline_hours: 48,
      auto_extension_enabled: true,
      extension_minutes:      5,
    },
  });
  const autoExtension = watch('auto_extension_enabled');

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Collection Centre *</label>
        <select {...register('collection_centre_id')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500">
          <option value="">Select centre...</option>
          {centres.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name} – {c.district}</option>
          ))}
        </select>
        {errors.collection_centre_id && <p className="text-xs text-red-600 mt-1">{errors.collection_centre_id.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Auction Title *</label>
        <input {...register('title')} placeholder="e.g. Premium Colombo Tomato Auction – August 2025" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea {...register('description')} rows={3} placeholder="Describe the auction for buyers..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time *</label>
          <input type="datetime-local" min={nowLocal()} {...register('start_at')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
          {errors.start_at && <p className="text-xs text-red-600 mt-1">{errors.start_at.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time *</label>
          <input type="datetime-local" min={watch('start_at') || nowLocal()} {...register('end_at')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
          {errors.end_at && <p className="text-xs text-red-600 mt-1">{errors.end_at.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Starting Price (LKR/kg) *</label>
          <input type="number" step="0.01" {...register('starting_price', { valueAsNumber: true })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
          {errors.starting_price && <p className="text-xs text-red-600 mt-1">{errors.starting_price.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reserve Price (optional)</label>
          <input type="number" step="0.01" {...register('reserve_price', { valueAsNumber: true })} placeholder="Leave blank if no reserve" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
          {errors.reserve_price && <p className="text-xs text-red-600 mt-1">{errors.reserve_price.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Increment (LKR)</label>
          <input type="number" {...register('minimum_increment', { valueAsNumber: true })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Deadline (hours)</label>
          <input type="number" {...register('payment_deadline_hours', { valueAsNumber: true })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* Anti-snipe */}
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-3 mb-3">
          <input type="checkbox" id="auto_ext" {...register('auto_extension_enabled')} className="text-emerald-600 w-4 h-4" />
          <label htmlFor="auto_ext" className="text-sm font-medium text-gray-800">Enable Anti-Snipe Auto-Extension</label>
        </div>
        {autoExtension && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Extension window (minutes before end)</label>
            <input type="number" {...register('extension_minutes', { valueAsNumber: true })} className="w-32 border border-blue-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-blue-600 mt-1">Bids placed in the final N minutes will extend the auction.</p>
          </div>
        )}
      </div>

      <button type="submit" className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
        Next: Add Lots <ChevronRight size={16} />
      </button>
    </form>
  );
}

// ─── Step 2: Add Lots ────────────────────────────────────────────────────────

function StepAddLots({ onNext, onBack }: { onNext: (lots: DraftLot[]) => void; onBack: () => void }) {
  const [lots, setLots]         = useState<DraftLot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Partial<DraftLot>>({ unit: 'kg', quality_grade: 'grade_a' });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-available'],
    queryFn:  () => inventoryApi.getAll({ status: 'available', available_for_auction: 'true', limit: '200' }).then((r) => r.data.data ?? []),
  });

  const addLot = () => {
    if (!form.inventory_batch_id || !form.lot_quantity || !form.starting_price_per_unit) {
      return alert('Fill in all required lot fields.');
    }
    const batch = inventory.find((b: any) => b.id === form.inventory_batch_id);
    if (!(batch?.category_id ?? batch?.crop_categories?.id)) return alert('This batch has no crop category and cannot be auctioned.');
    setLots([...lots, {
      ...form as DraftLot,
      tempId:     crypto.randomUUID(),
      batchLabel: batch ? `${batch.batch_no} – ${batch.crop_categories?.name ?? ''}` : form.inventory_batch_id,
      crop_category_id: batch?.category_id ?? batch?.crop_categories?.id ?? '',
    }]);
    setForm({ unit: 'kg', quality_grade: 'grade_a' });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{lots.length} lot{lots.length !== 1 ? 's' : ''} added</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <Plus size={14} /> Add Lot
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">New Lot</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Inventory Batch *</label>
            <select
              value={form.inventory_batch_id ?? ''}
              onChange={(e) => setForm({ ...form, inventory_batch_id: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select batch...</option>
              {inventory.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.batch_no} – {formatCategoryName(b.crop_categories)} ({b.available_qty_kg} kg available)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quality Grade *</label>
              <select value={form.quality_grade} onChange={(e) => setForm({ ...form, quality_grade: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="grade_a">Grade A</option>
                <option value="grade_b">Grade B</option>
                <option value="grade_c">Grade C</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="kg">kg</option>
                <option value="metric_ton">Metric Ton</option>
                <option value="bag">Bag</option>
                <option value="crate">Crate</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lot Quantity *</label>
              <input type="number" step="0.001" value={form.lot_quantity ?? ''} onChange={(e) => setForm({ ...form, lot_quantity: +e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Starting Price (LKR/unit) *</label>
              <input type="number" step="0.01" value={form.starting_price_per_unit ?? ''} onChange={(e) => setForm({ ...form, starting_price_per_unit: +e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Origin District</label>
              <select value={form.origin_district ?? ''} onChange={(e) => setForm({ ...form, origin_district: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Select...</option>
                {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Harvest Season</label>
              <select value={form.harvest_season ?? ''} onChange={(e) => setForm({ ...form, harvest_season: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Select...</option>
                {getSriLankanSeasons().map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addLot} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
              Add to Auction
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lot list */}
      {lots.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
          <p className="text-sm">No lots added yet. Add at least one lot to continue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lots.map((lot, i) => (
            <div key={lot.tempId} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Lot {i + 1}: {lot.batchLabel}</p>
                <p className="text-xs text-gray-500">{lot.quality_grade.replace('_', ' ').toUpperCase()} · {lot.lot_quantity} {lot.unit} · {formatLKR(lot.starting_price_per_unit)}/unit</p>
              </div>
              <button onClick={() => setLots(lots.filter((l) => l.tempId !== lot.tempId))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {lots.length > 0 && (
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
            <ChevronLeft size={14} /> Back
          </button>
          <button onClick={() => onNext(lots)} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-1">
            Review <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Review ──────────────────────────────────────────────────────────

function StepReview({
  config, lots, onBack, onCreate
}: {
  config: AuctionConfig; lots: DraftLot[]; onBack: () => void; onCreate: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Auction Configuration</h3>
        <dl className="space-y-2 text-sm">
          {[
            ['Title', config.title],
            ['Starts', new Date(config.start_at).toLocaleString('en-LK')],
            ['Ends',   new Date(config.end_at).toLocaleString('en-LK')],
            ['Starting Price', formatLKR(config.starting_price)],
            ['Min Increment', formatLKR(config.minimum_increment)],
            ['Reserve Price', config.reserve_price ? formatLKR(config.reserve_price) : 'None'],
            ['Payment Deadline', `${config.payment_deadline_hours} hours`],
            ['Anti-snipe', config.auto_extension_enabled ? `Yes – ${config.extension_minutes} min` : 'No'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-medium text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Lots ({lots.length})</h3>
        <div className="space-y-2">
          {lots.map((lot, i) => (
            <div key={lot.tempId} className="flex justify-between text-sm py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-600">Lot {i + 1}: {lot.batchLabel}</span>
              <span className="font-medium text-gray-900">{formatLKR(lot.starting_price_per_unit)}/{lot.unit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">The auction will be saved as a <strong>draft</strong>. You can then approve, publish and open it yourself from its page; it also opens automatically at its start time.</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
          <ChevronLeft size={14} /> Edit
        </button>
        <button onClick={onCreate} className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-green-700 flex items-center justify-center gap-2 shadow-lg">
          <Check size={16} /> Create Auction Draft
        </button>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export function CreateAuctionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep]         = useState(0);
  const [config, setConfig]     = useState<AuctionConfig | null>(null);
  const [lots, setLots]         = useState<DraftLot[]>([]);
  const { mutateAsync: createAuction } = useCreateAuction();

  const handleCreate = async () => {
    if (!config) return;
    // Convert datetime-local strings (e.g. "2026-10-03T13:27") to full ISO 8601
    // that the backend Zod schema (z.string().datetime()) accepts.
    const payload = {
      ...config,
      start_at: new Date(config.start_at).toISOString(),
      end_at:   new Date(config.end_at).toISOString(),
    };
    const auction = await createAuction(payload as any);

    // Save the lots chosen in step 2 – previously they were only shown in the review and never sent.
    let failed = 0;
    for (const lot of lots) {
      try {
        await auctionApi.createLot(auction.id, {
          inventory_batch_id:      lot.inventory_batch_id,
          crop_category_id:        lot.crop_category_id,
          quality_grade:           lot.quality_grade as any,
          lot_quantity:            Number(lot.lot_quantity),
          unit:                    (lot.unit || 'kg') as any,
          starting_price_per_unit: Number(lot.starting_price_per_unit),
          origin_district:         lot.origin_district || undefined,
          harvest_season:          lot.harvest_season || undefined,
          traceability_notes:      lot.traceability_notes || undefined,
        });
      } catch (err: any) {
        failed++;
        toast.error(`Lot "${lot.batchLabel ?? lot.inventory_batch_id}" was not added: ${err?.response?.data?.message ?? 'unknown error'}${err?.response?.data?.errors?.[0] ? ` (${err.response.data.errors[0].field}: ${err.response.data.errors[0].message})` : ''}`);
      }
    }
    if (lots.length > 0 && failed === 0) toast.success(`${lots.length} lot${lots.length > 1 ? 's' : ''} added to the auction`);
    // Navigate to the new auction's management page based on role
    const basePath = user?.role === 'administrator' ? '/admin' : '/inventory';
    navigate(`${basePath}/auction/${auction.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/20 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Auction</h1>

        {/* Stepper */}
        <div className="flex items-center mb-8">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step ? 'bg-emerald-600 text-white' :
                  i === step ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? <Check size={16} /> : s.icon}
                </div>
                <p className={`text-xs mt-1.5 font-medium ${i === step ? 'text-emerald-700' : 'text-gray-400'}`}>{s.label}</p>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-all ${i < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          {step === 0 && (
            <StepConfigure onNext={(c) => { setConfig(c); setStep(1); }} />
          )}
          {step === 1 && (
            <StepAddLots onNext={(l) => { setLots(l); setStep(2); }} onBack={() => setStep(0)} />
          )}
          {step === 2 && config && (
            <StepReview config={config} lots={lots} onBack={() => setStep(1)} onCreate={handleCreate} />
          )}
        </div>
      </div>
    </div>
  );
}
