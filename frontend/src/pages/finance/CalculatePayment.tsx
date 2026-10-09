import React, { useState } from 'react';
import { one } from '../../utils/relations';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsApi, farmerPaymentsApi } from '../../services/api';
import { ArrowLeft, DollarSign, Plus, Trash2, Loader2, Calculator, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Deduction {
  description: string;
  amount_lkr: number;
}

// Reference base rate pricing per kg for crop categories (LKR)
const CROP_BASE_RATES: Record<string, number> = {
  'rice': 220,
  'paddy': 220,
  'samba': 240,
  'keeri samba': 280,
  'tomato': 185,
  'carrot': 320,
  'potato': 260,
  'onion': 210,
  'chilli': 450,
  'cabbage': 140,
  'leeks': 190,
  'banana': 160,
  'papaya': 130,
  'tea': 360,
  'cinnamon': 850,
};

const GRADE_MULTIPLIERS: Record<string, number> = {
  'grade_a': 1.0,
  'grade_b': 0.85,
  'grade_c': 0.70,
  'reject': 0.0,
};

export const CalculatePayment: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const [deductions, setDeductions] = useState<Deduction[]>([
    { description: 'Transport & Logistics Fee', amount_lkr: 1500 },
    { description: 'Handling & Packaging Sacks', amount_lkr: 800 },
  ]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const { data: collectionRes, isLoading } = useQuery({
    queryKey: ['collection-calc-payment', collectionId],
    queryFn: () => collectionsApi.getById(collectionId!),
    enabled: !!collectionId,
  });

  const collection = collectionRes?.data?.data;
  const inspection = one(collection?.quality_inspections);

  // Derive rate based on crop category and quality grade
  const cropName = (collection?.crop_categories?.name || collection?.crops?.name || 'Produce').toLowerCase();
  const matchedKey = Object.keys(CROP_BASE_RATES).find(k => cropName.includes(k));
  const basePricePerKg = matchedKey ? CROP_BASE_RATES[matchedKey] : 200;

  const rawGrade = (inspection?.grade || 'grade_a').toLowerCase().replace(/\s+/g, '_');
  const gradeMultiplier = GRADE_MULTIPLIERS[rawGrade] !== undefined ? GRADE_MULTIPLIERS[rawGrade] : 1.0;
  const effectivePricePerKg = Math.round(basePricePerKg * gradeMultiplier);

  const acceptedQtyKg = parseFloat(inspection?.accepted_qty_kg || collection?.net_weight_kg || 0);
  const grossAmountLkr = Math.round(acceptedQtyKg * effectivePricePerKg);

  const addDeduction = () => {
    if (!desc.trim() || !amount || parseFloat(amount) <= 0) {
      return toast.error('Please enter valid deduction description and amount.');
    }
    setDeductions([...deductions, { description: desc.trim(), amount_lkr: parseFloat(amount) }]);
    setDesc('');
    setAmount('');
    toast.success('Deduction added');
  };

  const addPresetDeduction = (presetDesc: string, presetAmount: number) => {
    setDeductions([...deductions, { description: presetDesc, amount_lkr: presetAmount }]);
    toast.success(`Added ${presetDesc}`);
  };

  const removeDeduction = (idx: number) => {
    setDeductions(deductions.filter((_, i) => i !== idx));
  };

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => farmerPaymentsApi.calculate(data),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'Payment calculated and generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['finance-pending-collections'] });
      queryClient.invalidateQueries({ queryKey: ['finance-calculated-payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance-all-payments-history'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      navigate('/finance/approve');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to calculate payment'),
  });

  const totalDeductions = deductions.reduce((s, d) => s + d.amount_lkr, 0);
  const netPaymentLkr = Math.max(0, grossAmountLkr - totalDeductions);

  const handleCalculate = () => {
    mutation.mutate({
      collection_id: collectionId,
      deductions,
      gross_amount_lkr: grossAmountLkr,
      unit_price_lkr: effectivePricePerKg,
      net_amount_lkr: netPaymentLkr,
    });
  };

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Calculator className="text-primary-600 w-6 h-6" /> Calculate Farmer Payment
            </h1>
            <p className="page-subtitle">Collection #{collection?.collection_no} • Farmer: {collection?.farmers?.full_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Inspection & Base Rate Calculations */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-bold text-surface-900 pb-2 border-b border-surface-100 flex items-center justify-between">
              <span>Produce & Quality Inspection</span>
              <span className="badge-info text-2xs uppercase font-mono">{inspection?.grade || 'Grade A'}</span>
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-surface-600">
                <span>Farmer Name:</span>
                <span className="font-semibold text-surface-900">{collection?.farmers?.full_name || 'Farmer'}</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Bank & Account:</span>
                <span className="font-medium text-surface-800">
                  {collection?.farmers?.bank_name ? `${collection.farmers.bank_name} (${collection.farmers.account_number || 'Acc'})` : 'Cash Settlement'}
                </span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Crop Category:</span>
                <span className="font-bold text-primary-700 capitalize">{collection?.crop_categories?.name || collection?.crops?.name || 'Produce'}</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Quality Grade:</span>
                <span className="font-medium text-surface-800 capitalize">{inspection?.grade?.replace(/_/g, ' ') || 'Grade A'}</span>
              </div>
              <div className="flex justify-between text-surface-600">
                <span>Accepted Net Weight:</span>
                <span className="font-bold text-surface-900">{acceptedQtyKg.toLocaleString()} kg</span>
              </div>
            </div>
          </div>

          {/* Pricing & Gross Amount Calculation */}
          <div className="card p-6 space-y-4 bg-gradient-to-br from-white to-primary-50/30 border border-primary-100">
            <h3 className="text-sm font-bold text-surface-900 pb-2 border-b border-surface-200 flex items-center gap-2">
              <DollarSign size={16} className="text-primary-600" /> Rate & Gross Calculation
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-surface-600">
                <span>Base Market Rate (Reference Pricing):</span>
                <span className="font-semibold text-surface-900">LKR {basePricePerKg.toLocaleString()} / kg</span>
              </div>
              <div className="flex justify-between items-center text-surface-600">
                <span>Grade Adjustment Factor:</span>
                <span className="font-semibold text-surface-900">{(gradeMultiplier * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center text-surface-600">
                <span>Effective Rate:</span>
                <span className="font-bold text-emerald-700">LKR {effectivePricePerKg.toLocaleString()} / kg</span>
              </div>

              <div className="pt-3 border-t border-surface-200 flex justify-between items-center bg-white p-3.5 rounded-xl border border-surface-200">
                <div>
                  <p className="text-xs text-surface-500 font-medium">Gross Produce Amount</p>
                  <p className="text-2xs text-surface-400">({acceptedQtyKg.toLocaleString()} kg × LKR {effectivePricePerKg})</p>
                </div>
                <span className="text-xl font-extrabold text-primary-700 font-display">
                  LKR {grossAmountLkr.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Itemized Deductions & Final Calculation */}
        <div className="card p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-surface-100">
              <h3 className="text-sm font-bold text-surface-900">Itemized Deductions</h3>
              <span className="text-xs text-surface-500 font-medium">{deductions.length} item(s)</span>
            </div>

            {/* Itemized List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {deductions.length === 0 ? (
                <div className="p-4 text-center bg-surface-50 rounded-xl border border-dashed border-surface-200">
                  <p className="text-xs text-surface-400">No deductions added yet.</p>
                </div>
              ) : (
                deductions.map((d, i) => (
                  <div key={i} className="flex justify-between items-center bg-red-50/50 border border-red-100 p-3 rounded-xl text-sm">
                    <span className="font-medium text-surface-800 text-xs">{d.description}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600 text-xs">- LKR {d.amount_lkr.toLocaleString()}</span>
                      <button onClick={() => removeDeduction(i)} className="text-surface-400 hover:text-red-600 p-1" title="Remove deduction">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Custom Deduction Input */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-surface-700">Add Custom Deduction</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1 text-xs"
                  placeholder="Deduction reason (e.g. Storage Fee)"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
                <input
                  type="number"
                  className="form-input w-28 text-xs font-mono"
                  placeholder="Amount LKR"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <button type="button" onClick={addDeduction} className="btn-secondary btn-sm flex items-center gap-1">
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-1">
              <p className="text-2xs font-semibold text-surface-500 uppercase tracking-wider">Quick Presets:</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => addPresetDeduction('Transport Logistics', 1500)}
                  className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Transport (LKR 1,500)
                </button>
                <button
                  type="button"
                  onClick={() => addPresetDeduction('Handling & Sacks', 800)}
                  className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Sacks (LKR 800)
                </button>
                <button
                  type="button"
                  onClick={() => addPresetDeduction('Moisture Penalty', 1200)}
                  className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Moisture (LKR 1,200)
                </button>
              </div>
            </div>
          </div>

          {/* Final Calculation Summary */}
          <div className="space-y-3 pt-4 border-t border-surface-200 bg-surface-50 p-4 rounded-xl border border-surface-200">
            <div className="flex justify-between text-xs text-surface-600">
              <span>Gross Produce Value:</span>
              <span className="font-semibold text-surface-900">LKR {grossAmountLkr.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-surface-600">
              <span>Total Deductions ({deductions.length} items):</span>
              <span className="font-bold text-red-600">- LKR {totalDeductions.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-surface-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-surface-900">Net Farmer Payment:</span>
              <span className="text-2xl font-extrabold text-emerald-700 font-display">
                LKR {netPaymentLkr.toLocaleString()}
              </span>
            </div>

            <button
              onClick={handleCalculate}
              disabled={mutation.isPending}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm shadow-md mt-3"
            >
              {mutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Calculating...</>
              ) : (
                <><CheckCircle2 size={16} /> Confirm & Generate Payment Voucher</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
