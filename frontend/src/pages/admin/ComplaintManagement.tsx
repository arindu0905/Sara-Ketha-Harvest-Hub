import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquare, X, Send, CheckCircle } from 'lucide-react';
import { complaintsApi } from '../../services/api';
import { ExportCsvButton } from '../../components/ui/ExportCsvButton';

const STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed'];
const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const badge = (s: string) =>
  s === 'resolved' ? 'badge-success' : s === 'rejected' ? 'badge-danger' : s === 'closed' ? 'badge-neutral'
    : s === 'submitted' ? 'badge-info' : 'badge-warning';

export const ComplaintManagement: React.FC = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState('under_review');
  const [resolution, setResolution] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);

  const list = useQuery({
    queryKey: ['admin-complaints', filter],
    queryFn: () => complaintsApi.getAll(filter ? { status: filter, limit: '100' } : { limit: '100' }),
  });
  const detail = useQuery({
    queryKey: ['admin-complaint', openId],
    queryFn: () => complaintsApi.getById(openId!),
    enabled: !!openId,
  });

  const complaints: any[] = list.data?.data?.data || [];
  const current: any = detail.data?.data?.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-complaints'] });
    qc.invalidateQueries({ queryKey: ['admin-complaint', openId] });
  };
  const err = (e: any) => toast.error(e?.response?.data?.message || 'Action failed');

  const update = useMutation({
    mutationFn: () => complaintsApi.updateStatus(openId!, { status, ...(resolution.trim() ? { resolution: resolution.trim() } : {}) }),
    onSuccess: () => { toast.success('Complaint updated – the user has been notified'); setResolution(''); refresh(); },
    onError: err,
  });
  const addComment = useMutation({
    mutationFn: () => complaintsApi.addComment(openId!, comment.trim(), internal),
    onSuccess: () => { setComment(''); refresh(); },
    onError: err,
  });

  const open = (c: any) => {
    setOpenId(c.id);
    setStatus(c.status === 'submitted' ? 'under_review' : c.status);
    setResolution(c.resolution || '');
  };
  const needsNote = status === 'resolved' || status === 'rejected';
  const closed = current?.status === 'closed';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Complaint Management</h1>
          <p className="page-subtitle">Review, respond to and resolve complaints submitted by farmers</p>
        </div>
        <div className="flex items-center gap-2">
        <ExportCsvButton filename="complaints" headers={['Complaint No','Subject','Category','Status','Submitted by','Handled by','Resolution','Created']}
          rows={complaints.map((c) => [c.complaint_no, c.subject, label(c.category || ''), label(c.status), c.submitter?.full_name, c.assignee?.full_name, c.resolution, new Date(c.created_at).toLocaleDateString('en-LK')])} />
        <select className="form-input w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        </div>
      </div>

      {list.isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : complaints.length === 0 ? (
        <div className="card empty-state">
          <MessageSquare className="w-8 h-8 text-surface-400 mb-2" />
          <p className="text-surface-500 text-sm">No complaints found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <button key={c.id} onClick={() => open(c)} className="card p-5 w-full text-left hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-surface-900">{c.complaint_no}</span>
                    <span className={badge(c.status)}>{label(c.status)}</span>
                  </div>
                  <p className="text-sm font-medium text-surface-700">{c.subject}</p>
                  <p className="text-xs text-surface-500 mt-1">
                    {label(c.category || '')} · by {c.submitter?.full_name || 'Unknown'}
                    {c.assignee?.full_name ? ` · handled by ${c.assignee.full_name}` : ''}
                  </p>
                </div>
                <span className="text-xs text-surface-400 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('en-LK')}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpenId(null)}>
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900">{current?.complaint_no || 'Complaint'}</h2>
              <button onClick={() => setOpenId(null)} aria-label="Close"><X size={18} /></button>
            </div>

            {!current ? <div className="skeleton h-40 rounded-xl" /> : (
              <>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-surface-800">{current.subject}</p>
                  <p className="text-xs text-surface-500">{label(current.category || '')} · {new Date(current.created_at).toLocaleString('en-LK')}</p>
                  <p className="text-sm text-surface-600 whitespace-pre-wrap pt-2">{current.description}</p>
                  {current.evidence_url && (
                    <a href={current.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 underline">View attached evidence</a>
                  )}
                </div>

                <div className="card p-4 space-y-3">
                  <p className="text-sm font-semibold text-surface-800">Resolve this complaint</p>
                  {closed ? (
                    <p className="text-xs text-surface-500">This complaint is closed and can no longer be changed.</p>
                  ) : (
                    <>
                      <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                      </select>
                      <textarea
                        className="form-input min-h-[90px]"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder={needsNote ? 'Resolution note (required)' : 'Resolution note (optional)'}
                      />
                      <button
                        className="btn-primary btn-sm"
                        disabled={update.isPending || (needsNote && !resolution.trim())}
                        onClick={() => update.mutate()}
                      >
                        <CheckCircle size={14} /> {update.isPending ? 'Saving…' : 'Update status'}
                      </button>
                      <p className="text-xs text-surface-400">The farmer is notified and sees the status and resolution note.</p>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-surface-800">Comments</p>
                  {(current.complaint_comments || []).length === 0 && <p className="text-xs text-surface-400">No comments yet.</p>}
                  {(current.complaint_comments || []).map((cm: any) => (
                    <div key={cm.id} className={`rounded-xl p-3 text-sm ${cm.is_internal ? 'bg-amber-50' : 'bg-surface-50'}`}>
                      <p className="text-xs text-surface-500 mb-1">
                        {cm.profiles?.full_name || 'User'} · {new Date(cm.created_at).toLocaleString('en-LK')}
                        {cm.is_internal ? ' · internal note' : ''}
                      </p>
                      <p className="text-surface-700 whitespace-pre-wrap">{cm.comment}</p>
                    </div>
                  ))}
                  <textarea className="form-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a reply…" />
                  <label className="flex items-center gap-2 text-xs text-surface-600">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    Internal note (hidden from the farmer)
                  </label>
                  <button className="btn-secondary btn-sm" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>
                    <Send size={14} /> Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
