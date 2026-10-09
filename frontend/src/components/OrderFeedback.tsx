import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../services/api';

const Stars: React.FC<{ value: number; onChange?: (n: number) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
        <Star size={20} className={n <= value ? 'text-amber-500 fill-amber-400' : 'text-surface-300'} />
      </button>
    ))}
  </div>
);

/** Buyer feedback on a delivered order. Staff see it read-only. */
export const OrderFeedback: React.FC<{ orderId: string; status: string; isBuyer: boolean }> = ({ orderId, status, isBuyer }) => {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [quality, setQuality] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [comment, setComment] = useState('');
  const key = ['order-feedback', orderId];

  const { data } = useQuery({ queryKey: key, queryFn: () => ordersApi.getFeedback(orderId) });
  const fb = data?.data?.data;

  const submit = useMutation({
    mutationFn: () => ordersApi.submitFeedback(orderId, {
      rating, quality_rating: quality || undefined, delivery_rating: delivery || undefined, comment,
    }),
    onSuccess: () => { toast.success('Thank you for your feedback'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not submit feedback'),
  });

  const eligible = ['delivered', 'completed'].includes(status);
  if (!fb && !(isBuyer && eligible)) return null;

  return (
    <div className="card p-5 space-y-3">
      <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2"><Star size={16} className="text-primary-600" /> Buyer Feedback</h4>
      {fb ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-surface-600">Overall</span><Stars value={fb.rating} /></div>
          {fb.quality_rating && <div className="flex items-center justify-between"><span className="text-surface-600">Produce quality</span><Stars value={fb.quality_rating} /></div>}
          {fb.delivery_rating && <div className="flex items-center justify-between"><span className="text-surface-600">Delivery</span><Stars value={fb.delivery_rating} /></div>}
          {fb.comment && <p className="bg-surface-50 p-3 rounded-xl text-surface-700">{fb.comment}</p>}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!rating) return toast.error('Please select an overall rating'); submit.mutate(); }}>
          <div className="flex items-center justify-between text-sm"><span>Overall *</span><Stars value={rating} onChange={setRating} /></div>
          <div className="flex items-center justify-between text-sm"><span>Produce quality</span><Stars value={quality} onChange={setQuality} /></div>
          <div className="flex items-center justify-between text-sm"><span>Delivery</span><Stars value={delivery} onChange={setDelivery} /></div>
          <textarea className="form-input text-sm w-full" rows={3} maxLength={1000} placeholder="Comments (optional)" value={comment} onChange={e => setComment(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit feedback'}</button>
        </form>
      )}
    </div>
  );
};
