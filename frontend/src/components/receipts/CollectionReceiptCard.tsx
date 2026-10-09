import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Receipt, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { collectionsApi } from '../../services/api';
import { printDocument } from '../../utils/printDocument';
import { formatDateTimeSL } from '../../utils/lkrFormat';
import { apiErrorMessage } from '../../utils/apiError';

export function printCollectionReceipt(r: any) {
  const c = r.produce_collections || {}; const f = r.farmers || {}; const centre = r.collection_centres || {};
  printDocument({
    title: 'Collection Receipt', number: r.receipt_no,
    subtitle: `${centre.name ?? ''} · issued ${formatDateTimeSL(r.issued_at)}`,
    sections: [
      { heading: 'Farmer', rows: [{ label: 'Name', value: f.full_name ?? '' }, { label: 'Farmer ID', value: f.farmer_code ?? '' }] },
      { heading: 'Collection', rows: [
        { label: 'Collection no.', value: c.collection_no ?? '' },
        { label: 'Produce', value: [c.crop_categories?.name, c.crop_varieties?.name].filter(Boolean).join(' – ') },
        { label: 'Gross weight', value: `${r.gross_weight_kg ?? '—'} kg` },
        { label: 'Container weight', value: `${r.container_weight_kg ?? '—'} kg` },
        { label: 'Net weight', value: `${r.net_weight_kg ?? '—'} kg` },
        { label: 'Accepted', value: `${r.accepted_qty_kg} kg` },
        { label: 'Rejected', value: `${r.rejected_qty_kg} kg` },
        { label: 'Grade', value: String(r.grade ?? '').replace(/_/g, ' ').toUpperCase() },
        { label: 'Stock batch', value: r.batch_no ?? '—' },
        { label: 'Farmer acknowledgement', value: r.status === 'confirmed' ? `Confirmed ${formatDateTimeSL(r.farmer_confirmed_at)}` : r.status === 'disputed' ? 'Disputed' : 'Pending' },
      ] },
    ],
    footer: 'Payment will be calculated from the accepted quantity at the grade price effective on the collection date.',
  });
}

/** E1-US8 / E2-US5: digital receipt – view, print, and (farmer) confirm or dispute. */
export const CollectionReceiptCard: React.FC<{ collectionId: string; role: 'farmer' | 'officer' | 'staff'; canIssue?: boolean }> = ({ collectionId, role, canIssue }) => {
  const qc = useQueryClient();
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['collection-receipt', collectionId],
    queryFn: () => collectionsApi.getReceipt(collectionId),
    retry: false,
  });
  const receipt = data?.data?.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['collection-receipt', collectionId] });

  const respond = useMutation({
    mutationFn: (accept: boolean) => collectionsApi.confirmReceipt(collectionId, { accept, note: note.trim() || undefined }),
    onSuccess: (r: any) => { toast.success(r.data?.message || 'Done'); setDisputing(false); setNote(''); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const issue = useMutation({
    mutationFn: () => collectionsApi.issueReceipt(collectionId),
    onSuccess: () => { toast.success('Receipt issued'); refresh(); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <div className="card p-5"><div className="skeleton h-24 rounded-xl" /></div>;
  if (!receipt) {
    const notYet = (error as any)?.response?.status === 404;
    return (
      <div className="card p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-surface-500"><Receipt size={18} />{notYet ? 'A receipt is issued once the produce has been inspected.' : 'Receipt unavailable.'}</div>
        {canIssue && <button className="btn-primary btn-sm" disabled={issue.isPending} onClick={() => issue.mutate()}>Issue receipt</button>}
      </div>
    );
  }

  const badge = receipt.status === 'confirmed' ? 'badge-success' : receipt.status === 'disputed' ? 'badge-danger' : 'badge-warning';
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt size={16} /> Collection receipt <span className="font-mono text-xs text-surface-500">{receipt.receipt_no}</span></h3>
        <span className={badge}>{receipt.status}</span>
      </div>
      <div className="card-body space-y-3 text-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Net weight', `${receipt.net_weight_kg} kg`], ['Accepted', `${receipt.accepted_qty_kg} kg`], ['Rejected', `${receipt.rejected_qty_kg} kg`], ['Grade', String(receipt.grade ?? '—').replace(/_/g, ' ')]].map(([l, v]) => (
            <div key={l}><p className="text-xs text-surface-500">{l}</p><p className="font-semibold capitalize">{v}</p></div>))}
        </div>
        {receipt.farmer_note && <p className="text-xs italic text-surface-500">Farmer note: "{receipt.farmer_note}"</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary btn-sm flex items-center gap-1" onClick={() => printCollectionReceipt(receipt)}><Printer size={14} /> Print / save PDF</button>
          {role === 'farmer' && receipt.status === 'issued' && !disputing && (<>
            <button className="btn-primary btn-sm flex items-center gap-1" disabled={respond.isPending} onClick={() => respond.mutate(true)}><CheckCircle size={14} /> Confirm receipt</button>
            <button className="btn-secondary btn-sm flex items-center gap-1 text-red-600" onClick={() => setDisputing(true)}><AlertTriangle size={14} /> Something is wrong</button>
          </>)}
        </div>
        {disputing && (
          <div className="space-y-2">
            <textarea className="form-input" rows={2} placeholder="Describe what is incorrect (weight, grade…)" value={note} onChange={e => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-danger btn-sm" disabled={note.trim().length < 5 || respond.isPending} onClick={() => respond.mutate(false)}>Send dispute</button>
              <button className="btn-secondary btn-sm" onClick={() => setDisputing(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
