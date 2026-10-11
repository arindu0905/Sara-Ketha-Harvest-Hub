import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarClock, ArrowRight, History } from 'lucide-react';
import { Modal } from './ui/Modal';
import { cropsApi } from '../services/api';

export const HARVEST_REASONS: Record<string, string> = {
  weather: '🌦️ Weather',
  pests_disease: '🐛 Pests or disease',
  better_growth: '🌱 Growing better than expected',
  slower_growth: '🐢 Growing slower than expected',
  water_shortage: '💧 Water shortage',
  labour_or_cost: '👷 Labour or cost',
  market_timing: '📈 Better market timing',
  other: '📝 Other',
  initial_estimate: '🌾 First estimate',
};

const fmtDate = (d?: string | null) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

interface Props {
  crop: { id: string; planting_date?: string; expected_harvest_date?: string; expected_quantity_kg?: number } | null;
  cropName: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Revise a crop's expected harvest (date and quantity) and see how the estimate has changed over time. */
export const HarvestEstimateModal: React.FC<Props> = ({ crop, cropName, onClose, onSaved }) => {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('weather');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (!crop) return;
    setDate(crop.expected_harvest_date ? String(crop.expected_harvest_date).slice(0, 10) : '');
    setQty(crop.expected_quantity_kg ? String(crop.expected_quantity_kg) : '');
    setReason('weather');
    setNote('');
  }, [crop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: res, isLoading, error } = useQuery({
    queryKey: ['harvest-estimates', crop?.id],
    queryFn: () => cropsApi.getHarvestEstimates(crop!.id),
    enabled: !!crop,
    retry: false,
  });
  const history: any[] = res?.data?.data || [];

  const save = useMutation({
    mutationFn: () => cropsApi.addHarvestEstimate(crop!.id, { expected_harvest_date: date, expected_quantity_kg: qty ? Number(qty) : undefined, reason, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success('Harvest estimate updated');
      qc.invalidateQueries({ queryKey: ['harvest-estimates', crop?.id] });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not save the estimate'),
  });

  const today = new Date().toLocaleDateString('en-CA');
  const minDate = crop?.planting_date && String(crop.planting_date).slice(0, 10) > today ? String(crop.planting_date).slice(0, 10) : today;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return toast.error('Choose the new expected harvest date');
    if (date < minDate) return toast.error(date < today ? 'The harvest date cannot be in the past' : 'The harvest date cannot be before planting');
    if (qty && !(Number(qty) > 0)) return toast.error('Expected quantity must be greater than zero');
    save.mutate();
  };

  return (
    <Modal isOpen={!!crop} onClose={onClose} title={`Expected harvest – ${cropName}`} subtitle="Update it whenever your estimate changes. Every change is saved in the history.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">New expected harvest date <span className="text-red-500">*</span></label>
            <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Expected quantity (kg)</label>
            <input type="number" min="0" step="0.1" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="input w-full" placeholder="e.g. 500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-surface-700 mb-1.5">Why is it changing?</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(HARVEST_REASONS).filter(([k]) => k !== 'initial_estimate').map(([k, label]) => (
              <button type="button" key={k} onClick={() => setReason(k)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${reason === k ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-white text-surface-700 border-surface-200 hover:border-emerald-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-surface-700 mb-1.5">Note (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="input w-full resize-none" placeholder="e.g. Heavy rain delayed flowering by two weeks" />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={save.isPending}>
            <CalendarClock size={15} /> {save.isPending ? 'Saving…' : 'Save new estimate'}
          </button>
        </div>
      </form>

      <div className="mt-5 pt-4 border-t border-surface-100">
        <h4 className="text-sm font-bold text-surface-800 flex items-center gap-1.5 mb-2"><History size={14} /> Estimate history</h4>
        {isLoading ? <div className="skeleton h-14 rounded-xl" /> : error ? (
          <p className="text-xs text-amber-700">{(error as any)?.response?.data?.message || 'Could not load the history'}</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-surface-400">No estimates recorded yet.</p>
        ) : (
          <ol className="relative border-l-2 border-emerald-200 ml-2 space-y-3 max-h-56 overflow-y-auto pr-1">
            {history.map((h, i) => {
              const prev = history[i + 1];
              return (
                <li key={h.id} className="ml-4">
                  <span className={`absolute -left-[7px] w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-emerald-500' : 'bg-surface-300'}`} />
                  <p className="text-xs font-semibold text-surface-800 flex items-center gap-1 flex-wrap">
                    {prev && prev.expected_harvest_date !== h.expected_harvest_date && (<><span className="text-surface-400 line-through">{fmtDate(prev.expected_harvest_date)}</span><ArrowRight size={11} className="text-surface-400" /></>)}
                    {fmtDate(h.expected_harvest_date)}
                    {h.expected_quantity_kg ? <span className="font-normal text-surface-500"> · {Number(h.expected_quantity_kg).toLocaleString()} kg</span> : null}
                    {i === 0 && <span className="badge-success text-[10px]">Current</span>}
                  </p>
                  <p className="text-[11px] text-surface-500">
                    {HARVEST_REASONS[h.reason] || h.reason} · {new Date(h.recorded_at).toLocaleDateString('en-LK')}{h.profiles?.full_name ? ` · ${h.profiles.full_name}` : ''}
                  </p>
                  {h.note && <p className="text-[11px] text-surface-600 italic">“{h.note}”</p>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
};
