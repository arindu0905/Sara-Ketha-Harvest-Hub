import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi, farmersApi, cropsApi, centresApi, appointmentsApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCategoryName } from '../../utils/categoryUtils';

const collectionSchema = z.object({
  appointment_id: z.string().optional(),
  farmer_id: z.string().min(1, 'Select a farmer'),
  centre_id: z.string().min(1, 'Select a centre'),
  category_id: z.string().min(1, 'Select a crop category'),
  variety_id: z.string().optional(),
  vehicle_number: z.string().optional(),
  driver_name: z.string().optional(),
  notes: z.string().optional(),
});

type CollectionForm = z.infer<typeof collectionSchema>;

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '—');

/**
 * Register a delivery (E2-US2). A scheduled delivery is registered FROM its appointment: the farmer, centre,
 * crop category and variety come from the appointment and are shown to the officer; a walk-in has no appointment.
 */
export const RegisterCollection: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const appointmentFromUrl = params.get('appointment') || '';

  const { data: farmersRes } = useQuery({ queryKey: ['all-farmers'], queryFn: () => farmersApi.getAll({ limit: '200', verification_status: 'verified' }) });
  const { data: categoriesRes } = useQuery({ queryKey: ['crop-categories'], queryFn: () => cropsApi.getCategories() });
  const { data: centresRes } = useQuery({ queryKey: ['centres'], queryFn: () => centresApi.getAll() });
  const { data: apptRes } = useQuery({ queryKey: ['open-appointments'], queryFn: () => appointmentsApi.getAll() });

  const farmers = farmersRes?.data?.data || [];
  const categories = categoriesRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];
  const openAppointments: any[] = (apptRes?.data?.data || []).filter((a: any) => ['scheduled', 'confirmed'].includes(a.status));

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CollectionForm>({
    resolver: zodResolver(collectionSchema),
    defaultValues: { appointment_id: appointmentFromUrl },
  });
  const appointmentId = watch('appointment_id') || '';
  const selectedCategory = watch('category_id');
  const appt = openAppointments.find(a => a.id === appointmentId);
  const locked = !!appt;
  const varieties = categories.find((c: any) => c.id === selectedCategory)?.crop_varieties?.filter((v: any) => v.is_active) || [];

  // Choosing an appointment fills in everything the farmer already told us.
  useEffect(() => {
    if (!appt) return;
    setValue('farmer_id', appt.farmer_id);
    setValue('centre_id', appt.centre_id);
    setValue('category_id', appt.category_id);
  }, [appt, setValue]);
  useEffect(() => {
    if (appt?.variety_id && selectedCategory === appt.category_id) setValue('variety_id', appt.variety_id);
  }, [appt, selectedCategory, varieties.length, setValue]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => collectionsApi.create(data),
    onSuccess: () => { toast.success('Collection registered!'); navigate('/officer/collections'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const onSubmit = (data: CollectionForm) =>
    mutation.mutate({ ...data, appointment_id: data.appointment_id || undefined, variety_id: data.variety_id || null });

  const farmerOptions = appt && !farmers.some((f: any) => f.id === appt.farmer_id)
    ? [...farmers, { id: appt.farmer_id, full_name: appt.farmers?.full_name, farmer_code: appt.farmers?.farmer_code }]
    : farmers;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Register Collection</h1><p className="page-subtitle">Record a scheduled or walk-in produce delivery</p></div>
        </div>
      </div>

      <div className="card max-w-2xl"><div className="card-body">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="form-label">Delivery appointment</label>
            <select className="form-select" {...register('appointment_id')}>
              <option value="">Walk-in delivery (no appointment)</option>
              {openAppointments.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.reference_no} · {a.farmers?.full_name} · {formatCategoryName(a.crop_categories) || a.crop_categories?.name}{a.crop_varieties?.name ? ` (${a.crop_varieties.name})` : ''} · {fmtDate(a.scheduled_date)}
                </option>
              ))}
            </select>
          </div>

          {appt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-1">
              <p className="font-semibold text-emerald-800 flex items-center gap-2"><CalendarCheck size={15} /> Appointment {appt.reference_no}</p>
              <p><span className="text-surface-500">Farmer:</span> <b>{appt.farmers?.full_name}</b> ({appt.farmers?.farmer_code})</p>
              <p><span className="text-surface-500">Crop category:</span> <b>{formatCategoryName(appt.crop_categories) || appt.crop_categories?.name}</b>{appt.crop_varieties?.name ? ` · ${appt.crop_varieties.name}` : ''}</p>
              <p><span className="text-surface-500">Date:</span> {fmtDate(appt.scheduled_date)} · <span className="text-surface-500">Estimated quantity:</span> {appt.estimated_qty_kg ? `${Number(appt.estimated_qty_kg).toLocaleString()} kg` : '—'}</p>
              <p><span className="text-surface-500">Centre:</span> {appt.collection_centres?.name || '—'}</p>
              {appt.notes && <p><span className="text-surface-500">Farmer note:</span> {appt.notes}</p>}
            </div>
          )}

          <div>
            <label className="form-label">Farmer *</label>
            <select className={`form-select ${locked ? 'pointer-events-none bg-surface-50' : ''} ${errors.farmer_id ? 'form-input-error' : ''}`} {...register('farmer_id')}>
              <option value="">Select farmer</option>
              {farmerOptions.map((f: any) => <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>)}
            </select>
            {errors.farmer_id && <p className="form-error"><AlertCircle size={12} />{errors.farmer_id.message}</p>}
          </div>

          <div><label className="form-label">Collection Centre *</label>
            <select className={`form-select ${locked ? 'pointer-events-none bg-surface-50' : ''} ${errors.centre_id ? 'form-input-error' : ''}`} {...register('centre_id')}>
              <option value="">Select centre</option>
              {centres.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.centre_id && <p className="form-error"><AlertCircle size={12} />{errors.centre_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Crop Category *</label>
              <select className={`form-select ${locked ? 'pointer-events-none bg-surface-50' : ''} ${errors.category_id ? 'form-input-error' : ''}`} {...register('category_id')}>
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
            <div><label className="form-label">Vehicle Number</label><input className="form-input" {...register('vehicle_number')} /></div>
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
