import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { collectionsApi, farmerPaymentsApi } from '../../services/api';
import { ArrowLeft, DollarSign, Plus, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Deduction {
  description: string;
  amount_lkr: number;
}

export const CalculatePayment: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const { data: collectionRes, isLoading } = useQuery({
    queryKey: ['collection-calc-payment', collectionId],
    queryFn: () => collectionsApi.getById(collectionId!),
    enabled: !!collectionId,
  });

  const collection = collectionRes?.data?.data;
  const inspection = collection?.quality_inspections?.[0];

  const addDeduction = () => {
    if (!desc || !amount || parseFloat(amount) <= 0) return;
    setDeductions([...deductions, { description: desc, amount_lkr: parseFloat(amount) }]);
    setDesc('');
    setAmount('');
  };

  const removeDeduction = (idx: number) => {
    setDeductions(deductions.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => farmerPaymentsApi.calculate(data),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Payment calculated successfully!');
      navigate('/finance/approve');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to calculate payment'),
  });

  const handleCalculate = () => {
    mutation.mutate({
      collection_id: collectionId,
      deductions,
    });
  };

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;

  const totalDeductions = deductions.reduce((s, d) => s + d.amount_lkr, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Calculate Farmer Payment</h1>
            <p className="page-subtitle">{collection?.collection_no} · {collection?.farmers?.full_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Inspection Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Farmer</span><span className="font-medium">{collection?.farmers?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Bank Details</span><span className="font-medium">{collection?.farmers?.bank_name || 'N/A'} ({collection?.farmers?.account_holder_name || 'N/A'})</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Crop</span><span className="font-medium">{collection?.crop_categories?.name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Grade</span><span className="capitalize badge-info text-xs">{inspection?.grade?.replace(/_/g, ' ')}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Accepted Qty</span><span className="font-bold text-primary-700">{inspection?.accepted_qty_kg} kg</span></div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Deductions</h3>
          <div className="space-y-3 mb-4">
            {deductions.map((d, i) => (
              <div key={i} className="flex justify-between items-center bg-surface-50 p-3 rounded-xl text-sm">
                <span>{d.description}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-red-600">- LKR {d.amount_lkr.toLocaleString()}</span>
                  <button onClick={() => removeDeduction(i)} className="text-surface-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="form-input flex-1 text-sm" placeholder="Deduction reason" value={desc} onChange={e => setDesc(e.target.value)} />
              <input type="number" className="form-input w-28 text-sm" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
              <button type="button" onClick={addDeduction} className="btn-secondary btn-sm"><Plus size={14} /></button>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-surface-500"><span>Total Deductions</span><span className="text-red-600 font-medium">LKR {totalDeductions.toLocaleString()}</span></div>
          </div>

          <button onClick={handleCalculate} disabled={mutation.isPending} className="btn-primary w-full mt-6">
            {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Calculating...</> : '💵 Calculate & Generate Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
