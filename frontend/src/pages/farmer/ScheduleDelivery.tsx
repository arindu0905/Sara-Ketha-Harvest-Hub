import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { farmersApi, cropsApi, appointmentsApi } from '../../services/api';
import { adminApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCategoryName } from '../../utils/categoryUtils';

const deliverySchema = z.object({
  centre_id: z.string().min(1, 'Select a collection centre'),
  category_id: z.string().min(1, 'Select a crop category'),
  variety_id: z.string().optional(),
  scheduled_date: z.string().min(1, 'Select a delivery date'),
  estimated_quantity_kg: z.string().min(1, 'Enter estimated quantity'),
  notes: z.string().optional(),
});

type DeliveryForm = z.infer<typeof deliverySchema>;

export const ScheduleDelivery: React.FC = () => {
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

  const { data: centresRes } = useQuery({
    queryKey: ['centres'],
    queryFn: () => adminApi.getCentres(),
  });

  const categories = categoriesRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];

  const { register, handleSubmit, watch, formState: { errors } } = useForm<DeliveryForm>({
    resolver: zodResolver(deliverySchema),
  });

  const selectedCategory = watch('category_id');
  const varieties = categories.find((c: any) => c.id === selectedCategory)?.crop_varieties?.filter((v: any) => v.is_active) || [];

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => appointmentsApi.create(data),
    onSuccess: () => {
      toast.success('Delivery scheduled successfully!');
      navigate('/farmer/appointments');
    },
    onError: () => toast.error('Failed to schedule delivery'),
  });

  const onSubmit = (data: DeliveryForm) => {
    if (!farmerData?.id) {
      toast.error('Farmer record not found');
      return;
    }
    mutation.mutate({
      farmer_id: farmerData.id,
      centre_id: data.centre_id,
      category_id: data.category_id,
      variety_id: data.variety_id || null,
      scheduled_date: data.scheduled_date,
      estimated_quantity_kg: parseFloat(data.estimated_quantity_kg),
      notes: data.notes || null,
    });
  };

  // Minimum date is tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Schedule Delivery</h1>
            <p className="page-subtitle">Book an appointment to deliver your produce</p>
          </div>
        </div>
      </div>

      <div className="card max-w-2xl">
        <div className="card-body">
          <div className="alert-info mb-6">
            <CalendarDays size={16} className="flex-shrink-0" />
            <span>Schedule your delivery at least one day in advance. You'll receive a confirmation with your appointment details.</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="form-label">Collection Centre *</label>
              <select className={`form-select ${errors.centre_id ? 'form-input-error' : ''}`} {...register('centre_id')}>
                <option value="">Select centre</option>
                {centres.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.district})</option>
                ))}
              </select>
              {errors.centre_id && <p className="form-error"><AlertCircle size={12} />{errors.centre_id.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Crop Category *</label>
                <select className={`form-select ${errors.category_id ? 'form-input-error' : ''}`} {...register('category_id')}>
                  <option value="">Select crop</option>
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
                <label className="form-label">Delivery Date *</label>
                <input type="date" min={minDateStr} className={`form-input ${errors.scheduled_date ? 'form-input-error' : ''}`} {...register('scheduled_date')} />
                {errors.scheduled_date && <p className="form-error"><AlertCircle size={12} />{errors.scheduled_date.message}</p>}
              </div>
              <div>
                <label className="form-label">Estimated Quantity (kg) *</label>
                <input type="number" step="0.1" min="0.1" className={`form-input ${errors.estimated_quantity_kg ? 'form-input-error' : ''}`} placeholder="e.g. 200" {...register('estimated_quantity_kg')} />
                {errors.estimated_quantity_kg && <p className="form-error"><AlertCircle size={12} />{errors.estimated_quantity_kg.message}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} placeholder="Any special instructions..." {...register('notes')} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Scheduling...</> : '📅 Schedule Delivery'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
