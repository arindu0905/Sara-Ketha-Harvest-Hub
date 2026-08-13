import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { complaintsApi } from '../../services/api';
import { MessageSquare, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'delivery_issue', label: 'Delivery Issue' }, { value: 'product_quality_issue', label: 'Product Quality' },
  { value: 'incorrect_payment', label: 'Incorrect Payment' }, { value: 'system_issue', label: 'System Issue' }, { value: 'other', label: 'Other' },
];

export const BuyerComplaints: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: cmpRes, isLoading } = useQuery({ queryKey: ['buyer-complaints'], queryFn: () => complaintsApi.getAll({}) });
  const complaints = cmpRes?.data?.data || [];

  const form = useForm<{ category: string; subject: string; description: string }>();
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => complaintsApi.create(data),
    onSuccess: () => { toast.success('Complaint submitted'); queryClient.invalidateQueries({ queryKey: ['buyer-complaints'] }); form.reset(); },
    onError: () => toast.error('Failed'),
  });

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { submitted: 'badge-info', under_review: 'badge-warning', resolved: 'badge-success', rejected: 'badge-danger' };
    return <span className={m[s] || 'badge-neutral'}>{s?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Support & Complaints</h1><p className="page-subtitle">Submit and track issues</p></div></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? <div className="card p-6 space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          : complaints.length === 0 ? <div className="card"><div className="empty-state"><MessageSquare className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No complaints</p></div></div>
          : <div className="space-y-3">{complaints.map((c: any) => (
            <div key={c.id} className="card p-4">
              <div className="flex justify-between items-start"><div>
                <div className="flex items-center gap-2 mb-1"><p className="text-sm font-bold">{c.complaint_no}</p>{statusBadge(c.status)}</div>
                <p className="text-sm text-surface-700">{c.subject}</p>
                <p className="text-xs text-surface-400 mt-1 capitalize">{c.category?.replace(/_/g,' ')}</p>
              </div><span className="text-xs text-surface-400">{new Date(c.created_at).toLocaleDateString('en-LK')}</span></div>
              {c.resolution && <p className="text-xs text-surface-500 mt-2 pt-2 border-t border-surface-100"><span className="font-medium">Resolution:</span> {c.resolution}</p>}
            </div>
          ))}</div>}
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Submit New Complaint</h3></div>
          <div className="card-body">
            <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-3">
              <select className="form-select" {...form.register('category', { required: true })}><option value="">Category</option>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              <input className="form-input" placeholder="Subject" {...form.register('subject', { required: true })} />
              <textarea className="form-input" rows={3} placeholder="Description..." {...form.register('description', { required: true })} />
              <button type="submit" disabled={mutation.isPending} className="btn-primary w-full btn-sm">
                {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
