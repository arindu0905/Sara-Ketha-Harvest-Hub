import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { farmersApi, centresApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const farmerSchema = z.object({
  nic_number: z.string().regex(/^(\d{9}[VvXx]|\d{12})$/, 'NIC must be 9 digits + V/X (e.g. 781234567V) or 12 digits'),
  full_name: z.string().min(2, 'Full name required'),
  phone: z.string().regex(/^0\d{9}$/, 'Phone must be 10 digits starting with 0 (e.g. 0771234567)'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().min(5, 'Address required'),
  district: z.string().min(2, 'District required'),
  divisional_secretariat: z.string().optional(),
  farm_name: z.string().optional(),
  farm_location: z.string().optional(),
  farm_size_acres: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  account_holder_name: z.string().optional(),
  account_number: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  assigned_centre_id: z.string().optional(),
  notes: z.string().optional(),
});

type FarmerForm = z.infer<typeof farmerSchema>;

export const RegisterFarmer: React.FC = () => {
  const navigate = useNavigate();

  const { data: centresRes } = useQuery({
    queryKey: ['centres'],
    queryFn: () => centresApi.getAll(),
  });
  const centres = centresRes?.data?.data || [];

  const { register, handleSubmit, formState: { errors } } = useForm<FarmerForm>({
    resolver: zodResolver(farmerSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => farmersApi.create(data),
    onSuccess: () => { toast.success('Farmer registered successfully!'); navigate('/officer/farmers'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to register farmer'),
  });

  const onSubmit = (data: FarmerForm) => {
    mutation.mutate({
      ...data,
      email: data.email || null,
      farm_size_acres: data.farm_size_acres ? parseFloat(data.farm_size_acres) : null,
      assigned_centre_id: data.assigned_centre_id || null,
    });
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-surface-700 border-b border-surface-100 pb-2 mb-4">{children}</h3>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Register New Farmer</h1><p className="page-subtitle">Create a farmer record in the system</p></div>
        </div>
      </div>

      <div className="card max-w-3xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <SectionTitle>Personal Information</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">NIC Number *</label><input className={`form-input ${errors.nic_number ? 'form-input-error' : ''}`} placeholder="e.g. 200012345678" {...register('nic_number')} />{errors.nic_number && <p className="form-error"><AlertCircle size={12} />{errors.nic_number.message}</p>}</div>
                <div><label className="form-label">Full Name *</label><input className={`form-input ${errors.full_name ? 'form-input-error' : ''}`} placeholder="Kamal Perera" {...register('full_name')} />{errors.full_name && <p className="form-error"><AlertCircle size={12} />{errors.full_name.message}</p>}</div>
                <div><label className="form-label">Phone *</label><input className={`form-input ${errors.phone ? 'form-input-error' : ''}`} placeholder="071 234 5678" {...register('phone')} />{errors.phone && <p className="form-error"><AlertCircle size={12} />{errors.phone.message}</p>}</div>
                <div><label className="form-label">Email</label><input type="email" className="form-input" placeholder="kamal@example.com" {...register('email')} /></div>
                <div className="sm:col-span-2"><label className="form-label">Address *</label><textarea className={`form-input ${errors.address ? 'form-input-error' : ''}`} rows={2} {...register('address')} />{errors.address && <p className="form-error"><AlertCircle size={12} />{errors.address.message}</p>}</div>
                <div><label className="form-label">District *</label><input className={`form-input ${errors.district ? 'form-input-error' : ''}`} {...register('district')} />{errors.district && <p className="form-error"><AlertCircle size={12} />{errors.district.message}</p>}</div>
                <div><label className="form-label">Divisional Secretariat</label><input className="form-input" {...register('divisional_secretariat')} /></div>
              </div>
            </div>

            <div>
              <SectionTitle>Farm Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Farm Name</label><input className="form-input" {...register('farm_name')} /></div>
                <div><label className="form-label">Farm Location</label><input className="form-input" {...register('farm_location')} /></div>
                <div><label className="form-label">Farm Size (acres)</label><input type="number" step="0.01" className="form-input" {...register('farm_size_acres')} /></div>
                <div><label className="form-label">Assigned Centre</label>
                  <select className="form-select" {...register('assigned_centre_id')}>
                    <option value="">Select centre</option>
                    {centres.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <SectionTitle>Bank Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Bank Name</label><input className="form-input" {...register('bank_name')} /></div>
                <div><label className="form-label">Branch</label><input className="form-input" {...register('bank_branch')} /></div>
                <div><label className="form-label">Account Holder</label><input className="form-input" {...register('account_holder_name')} /></div>
                <div><label className="form-label">Account Number</label><input className="form-input" {...register('account_number')} /></div>
              </div>
            </div>

            <div>
              <SectionTitle>Emergency Contact</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="form-label">Contact Name</label><input className="form-input" {...register('emergency_contact_name')} /></div>
                <div><label className="form-label">Contact Phone</label><input className="form-input" {...register('emergency_contact_phone')} /></div>
              </div>
            </div>

            <div><label className="form-label">Notes</label><textarea className="form-input" rows={2} {...register('notes')} /></div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Registering...</> : '👤 Register Farmer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
