import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi, farmersApi, cropsApi, adminApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCategoryName } from '../../utils/categoryUtils';

const collectionSchema = z.object({
  farmer_id: z.string().min(1, 'Select a farmer'),
  centre_id: z.string().min(1, 'Select a centre'),
  category_id: z.string().min(1, 'Select a crop category'),
  variety_id: z.string().optional(),
  vehicle_number: z.string().optional(),
  driver_name: z.string().optional(),
  notes: z.string().optional(),
});

type CollectionForm = z.infer<typeof collectionSchema>;

export const RegisterCollection: React.FC = () => {
  const navigate = useNavigate();

  const { data: farmersRes } = useQuery({ queryKey: ['all-farmers'], queryFn: () => farmersApi.getAll({ limit: '200', verification_status: 'verified' }) });
  const { data: categoriesRes } = useQuery({ queryKey: ['crop-categories'], queryFn: () => cropsApi.getCategories() });
  const { data: centresRes } = useQuery({ queryKey: ['centres'], queryFn: () => adminApi.getCentres() });

  const farmers = farmersRes?.data?.data || [];
  const categories = categoriesRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CollectionForm>({ resolver: zodResolver(collectionSchema) });
  const selectedCategory = watch('category_id');
  const varieties = categories.find((c: any) => c.id === selectedCategory)?.crop_varieties?.filter((v: any) => v.is_active) || [];

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => collectionsApi.create(data),
    onSuccess: () => { toast.success('Collection registered!'); navigate('/officer/collections'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const onSubmit = (data: CollectionForm) => mutation.mutate({ ...data, variety_id: data.variety_id || null });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Register Collection</h1><p className="page-subtitle">Record a new produce collection</p></div>
        </div>
      </div>

      <div className="card max-w-2xl"><div className="card-body">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="form-label">Farmer *</label>
            <select className={`form-select ${errors.farmer_id ? 'form-input-error' : ''}`} {...register('farmer_id')}>
              <option value="">Select farmer</option>
              {farmers.map((f: any) => <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>)}
            </select>
            {errors.farmer_id && <p className="form-error"><AlertCircle size={12} />{errors.farmer_id.message}</p>}
          </div>

          <div><label className="form-label">Collection Centre *</label>
            <select className={`form-select ${errors.centre_id ? 'form-input-error' : ''}`} {...register('centre_id')}>
              <option value="">Select centre</option>
              {centres.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.centre_id && <p className="form-error"><AlertCircle size={12} />{errors.centre_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Crop Category *</label>
              <select className={`form-select ${errors.category_id ? 'form-input-error' : ''}`} {...register('category_id')}>
                <option value="">Select crop</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{formatCategoryName(c)}</option>)}
              </select>
              {errors.category_id && <p className="form-error"><AlertCircle size={12} />{errors.category_id.message}</p>}
            </div>
            <div><label className="form-label">Variety</label>
              <select className="form-select" {...register('variety_id')} disabled={!selectedCategory}>
                <option value="">Optional</option>
                {varieties.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Vehicle Number</label><input className="form-input" placeholder="e.g. WP-AB-1234" {...register('vehicle_number')} /></div>
            <div><label className="form-label">Driver Name</label><input className="form-input" {...register('driver_name')} /></div>
          </div>

          <div><label className="form-label">Notes</label><textarea className="form-input" rows={2} {...register('notes')} /></div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Registering...</> : '📦 Register Collection'}
            </button>
          </div>
        </form>
      </div></div>
    </div>
  );
};
