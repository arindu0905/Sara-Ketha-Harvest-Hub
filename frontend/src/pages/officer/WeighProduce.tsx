import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi } from '../../services/api';
import { ArrowLeft, Scale, Loader2, AlertCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';

const CONTAINER_TYPES = [
  'Plastic Crates',
  'Sacks / Bags',
  'Burlap Bags',
  'Plastic Bins',
  'Wooden Boxes',
  'Bulk / Loose',
  'Other Container',
];

const weighSchema = z.object({
  gross_weight_kg: z.string().min(1, 'Enter gross weight (kg)'),
  container_weight_kg: z.string().optional(),
  container_count: z.string().min(1, 'Enter number of containers'),
  container_type: z.string().min(1, 'Select container type'),
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

  const { register, handleSubmit, watch, formState: { errors } } = useForm<WeighForm>({
    resolver: zodResolver(weighSchema),
    defaultValues: {
      gross_weight_kg: '',
      container_weight_kg: '0',
      container_count: '1',
      container_type: 'Plastic Crates',
    },
  });

  const grossWeight = parseFloat(watch('gross_weight_kg') || '0');
  const unitContainerWeight = parseFloat(watch('container_weight_kg') || '0');
  const containerCount = Math.max(1, parseInt(watch('container_count') || '1', 10));
  const totalContainerWeight = unitContainerWeight * containerCount;
  const netWeight = Math.max(0, grossWeight - totalContainerWeight);

  const mutation = useMutation({
    mutationFn: (data: {
      gross_weight_kg: number;
      container_weight_kg: number;
      container_count: number;
      container_type: string;
    }) => collectionsApi.weigh(id!, data),
    onSuccess: () => {
      toast.success(`Weighing saved! Net produce weight: ${netWeight.toFixed(1)} kg. Collection sent for inspection.`);
      queryClient.invalidateQueries({ queryKey: ['collection-weigh', id] });
      queryClient.invalidateQueries({ queryKey: ['pending-inspections'] });
      navigate('/officer/collections');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to record weighing'),
  });

  const onSubmit = (data: WeighForm) => {
    mutation.mutate({
      gross_weight_kg: parseFloat(data.gross_weight_kg),
      container_weight_kg: totalContainerWeight,
      container_count: containerCount,
      container_type: data.container_type,
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
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-surface-500">Collection No</span><span className="font-semibold text-primary-700">{collection?.collection_no}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-surface-500">Farmer</span><span className="font-medium">{collection?.farmers?.full_name} ({collection?.farmers?.farmer_code})</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-surface-500">Crop Category</span><span className="font-medium">{collection?.crop_categories?.name}</span></div>
            {collection?.crop_varieties?.name && (
              <div className="flex justify-between border-b pb-2"><span className="text-surface-500">Crop Variety</span><span className="font-medium">{collection?.crop_varieties?.name}</span></div>
            )}
            <div className="flex justify-between border-b pb-2"><span className="text-surface-500">Vehicle Number</span><span className="font-medium">{collection?.vehicle_number || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Current Status</span><span className="badge-info text-xs capitalize">{collection?.status?.replace('_', ' ')}</span></div>
          </div>
        </div>

        {/* Weighing Form */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <Scale size={18} className="text-primary-600" /> Weighbridge Record
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Gross Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className={`form-input ${errors.gross_weight_kg ? 'form-input-error' : ''}`}
                placeholder="e.g. 780"
                {...register('gross_weight_kg')}
              />
              <p className="text-xs text-surface-400 mt-1">Total weight of produce + containers + vehicle (if applicable)</p>
              {errors.gross_weight_kg && <p className="form-error"><AlertCircle size={12} />{errors.gross_weight_kg.message}</p>}
            </div>

            {/* Containers Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label flex items-center gap-1"><Package size={14} /> Number of Containers *</label>
                <input
                  type="number"
                  min="1"
                  className={`form-input ${errors.container_count ? 'form-input-error' : ''}`}
                  placeholder="e.g. 5"
                  {...register('container_count')}
                />
                {errors.container_count && <p className="form-error"><AlertCircle size={12} />{errors.container_count.message}</p>}
              </div>

              <div>
                <label className="form-label">Container Type *</label>
                <select className={`form-select ${errors.container_type ? 'form-input-error' : ''}`} {...register('container_type')}>
                  {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.container_type && <p className="form-error"><AlertCircle size={12} />{errors.container_type.message}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Weight Per Container (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="form-input"
                placeholder="e.g. 1"
                {...register('container_weight_kg')}
              />
              <p className="text-xs text-surface-400 mt-1">
                Weight of 1 empty container ({unitContainerWeight} kg × {containerCount} containers = <strong>{totalContainerWeight.toFixed(1)} kg Total Tare</strong>)
              </p>
            </div>

            {/* Auto-Calculated Net Weight */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-center">
              <p className="text-xs text-primary-700 font-semibold tracking-wider uppercase mb-1">
                NET PRODUCE WEIGHT = GROSS ({grossWeight || 0} kg) − TOTAL TARE ({unitContainerWeight || 0} kg × {containerCount} = {totalContainerWeight || 0} kg)
              </p>
              <p className="text-3xl font-extrabold text-primary-700 font-display">
                {netWeight.toFixed(1)} kg
              </p>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || grossWeight <= totalContainerWeight}
              className="btn-primary w-full py-3"
            >
              {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Saving Weighing Record...</> : '⚖️ Save Weighing Record'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
