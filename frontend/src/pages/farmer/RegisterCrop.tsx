import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { farmersApi, cropsApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatCategoryName } from '../../utils/categoryUtils';

const cropSchema = z.object({
  category_id: z.string().min(1, 'Select a crop category'),
  variety_id: z.string().optional(),
  cultivated_area_acres: z.string().optional(),
  planting_date: z.string().optional(),
  expected_harvest_date: z.string().optional(),
  expected_quantity_kg: z.string().optional(),
  farming_method: z.enum(['organic', 'conventional', 'hydroponic', 'mixed']),
  notes: z.string().optional(),
});

type CropForm = z.infer<typeof cropSchema>;

export const RegisterCrop: React.FC = () => {
  const navigate = useNavigate();

  const { data: farmerData } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      return res.data?.data;
    },
  });

  const { data: categoriesRes } = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => cropsApi.getCategories(),
  });

  const categories = categoriesRes?.data?.data || [];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CropForm>({
    resolver: zodResolver(cropSchema),
    defaultValues: { farming_method: 'conventional' },
  });

  const selectedCategory = watch('category_id');
  const varieties = categories.find((c: any) => c.id === selectedCategory)?.crop_varieties?.filter((v: any) => v.is_active) || [];

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => cropsApi.create(data),
    onSuccess: () => {
      toast.success('Crop registered successfully!');
      navigate('/farmer/crops');
    },
    onError: () => toast.error('Failed to register crop'),
  });

  const onSubmit = (data: CropForm) => {
    if (!farmerData?.id) {
      toast.error('Farmer record not found');
      return;
    }
    mutation.mutate({
      farmer_id: farmerData.id,
      category_id: data.category_id,
      variety_id: data.variety_id || null,
      cultivated_area_acres: data.cultivated_area_acres ? parseFloat(data.cultivated_area_acres) : null,
      planting_date: data.planting_date || null,
      expected_harvest_date: data.expected_harvest_date || null,
      expected_quantity_kg: data.expected_quantity_kg ? parseFloat(data.expected_quantity_kg) : null,
      farming_method: data.farming_method,
      notes: data.notes || null,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Register New Crop</h1>
            <p className="page-subtitle">Add a new crop to your farm records</p>
          </div>
        </div>
      </div>

      <div className="card max-w-2xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Crop Category *</label>
                <select className={`form-select ${errors.category_id ? 'form-input-error' : ''}`} {...register('category_id')}>
                  <option value="">Select category</option>
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{formatCategoryName(cat)}</option>
                  ))}
                </select>
                {errors.category_id && <p className="form-error"><AlertCircle size={12} />{errors.category_id.message}</p>}
              </div>

              <div>
                <label className="form-label">Variety</label>
                <select className="form-select" {...register('variety_id')} disabled={!selectedCategory}>
                  <option value="">Select variety (optional)</option>
                  {varieties.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Cultivated Area (acres)</label>
                <input type="number" step="0.01" min="0" className="form-input" placeholder="e.g. 2.5" {...register('cultivated_area_acres')} />
              </div>
              <div>
                <label className="form-label">Farming Method</label>
                <select className="form-select" {...register('farming_method')}>
                  <option value="conventional">Conventional</option>
                  <option value="organic">Organic</option>
                  <option value="hydroponic">Hydroponic</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Planting Date</label>
                <input type="date" className="form-input" {...register('planting_date')} />
              </div>
              <div>
                <label className="form-label">Expected Harvest Date</label>
                <input type="date" className="form-input" {...register('expected_harvest_date')} />
              </div>
            </div>

            <div>
              <label className="form-label">Expected Quantity (kg)</label>
              <input type="number" step="0.01" min="0" className="form-input" placeholder="e.g. 500" {...register('expected_quantity_kg')} />
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} placeholder="Any additional information..." {...register('notes')} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Registering...</> : '🌱 Register Crop'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
