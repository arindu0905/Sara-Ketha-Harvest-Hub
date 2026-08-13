import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi } from '../../services/api';
import { ArrowLeft, Scale, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const weighSchema = z.object({
  gross_weight_kg: z.string().min(1, 'Enter gross weight'),
  container_weight_kg: z.string().optional(),
});

type WeighForm = z.infer<typeof weighSchema>;

export const WeighProduce: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: collectionRes, isLoading } = useQuery({
    queryKey: ['collection-weigh', id],
    queryFn: () => collectionsApi.getById(id!),
    enabled: !!id,
  });

  const collection = collectionRes?.data?.data;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<WeighForm>({ resolver: zodResolver(weighSchema) });

  const grossWeight = parseFloat(watch('gross_weight_kg') || '0');
  const containerWeight = parseFloat(watch('container_weight_kg') || '0');
  const netWeight = Math.max(0, grossWeight - containerWeight);

  const mutation = useMutation({
    mutationFn: (data: { gross_weight_kg: number; container_weight_kg: number }) => collectionsApi.weigh(id!, data),
    onSuccess: () => {
      toast.success(`Weighing recorded! Net weight: ${netWeight.toFixed(1)} kg`);
      queryClient.invalidateQueries({ queryKey: ['collection-weigh', id] });
      navigate('/officer/collections');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const onSubmit = (data: WeighForm) => {
    mutation.mutate({
      gross_weight_kg: parseFloat(data.gross_weight_kg),
      container_weight_kg: parseFloat(data.container_weight_kg || '0'),
    });
  };

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Weigh Produce</h1>
            <p className="page-subtitle">{collection?.collection_no} · {collection?.farmers?.full_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Info */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Collection Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Collection No</span><span className="font-medium">{collection?.collection_no}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Farmer</span><span className="font-medium">{collection?.farmers?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Crop</span><span className="font-medium">{collection?.crop_categories?.name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Status</span><span className="badge-info text-xs">{collection?.status}</span></div>
          </div>
        </div>

        {/* Weighing Form */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2"><Scale size={16} /> Record Weighing</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Gross Weight (kg) *</label>
              <input type="number" step="0.1" min="0.1" className={`form-input ${errors.gross_weight_kg ? 'form-input-error' : ''}`} placeholder="e.g. 250" {...register('gross_weight_kg')} />
              {errors.gross_weight_kg && <p className="form-error"><AlertCircle size={12} />{errors.gross_weight_kg.message}</p>}
            </div>
            <div>
              <label className="form-label">Container Weight (kg)</label>
              <input type="number" step="0.1" min="0" className="form-input" placeholder="e.g. 5" {...register('container_weight_kg')} />
            </div>

            <div className="bg-primary-50 rounded-xl p-4 text-center">
              <p className="text-xs text-primary-600 font-medium">NET WEIGHT</p>
              <p className="text-3xl font-bold text-primary-700 font-display">{netWeight.toFixed(1)} kg</p>
            </div>

            <button type="submit" disabled={mutation.isPending || netWeight <= 0} className="btn-primary w-full">
              {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Recording...</> : '⚖️ Record Weight'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
