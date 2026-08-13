import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { complaintsApi } from '../../services/api';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const complaintSchema = z.object({
  category: z.string().min(1, 'Select a category'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

type ComplaintForm = z.infer<typeof complaintSchema>;

const CATEGORIES = [
  { value: 'incorrect_weight', label: 'Incorrect Weight' },
  { value: 'incorrect_grade', label: 'Incorrect Grade' },
  { value: 'incorrect_payment', label: 'Incorrect Payment' },
  { value: 'delayed_payment', label: 'Delayed Payment' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'product_quality_issue', label: 'Product Quality Issue' },
  { value: 'system_issue', label: 'System Issue' },
  { value: 'other', label: 'Other' },
];

export const SubmitComplaint: React.FC = () => {
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<ComplaintForm>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { priority: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => complaintsApi.create(data),
    onSuccess: () => {
      toast.success('Complaint submitted successfully!');
      navigate('/farmer/complaints');
    },
    onError: () => toast.error('Failed to submit complaint'),
  });

  const onSubmit = (data: ComplaintForm) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Submit Complaint</h1>
            <p className="page-subtitle">Report an issue or concern</p>
          </div>
        </div>
      </div>

      <div className="card max-w-2xl">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="form-label">Category *</label>
              <select className={`form-select ${errors.category ? 'form-input-error' : ''}`} {...register('category')}>
                <option value="">Select complaint category</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              {errors.category && <p className="form-error"><AlertCircle size={12} />{errors.category.message}</p>}
            </div>

            <div>
              <label className="form-label">Subject *</label>
              <input className={`form-input ${errors.subject ? 'form-input-error' : ''}`} placeholder="Brief description of the issue" {...register('subject')} />
              {errors.subject && <p className="form-error"><AlertCircle size={12} />{errors.subject.message}</p>}
            </div>

            <div>
              <label className="form-label">Priority</label>
              <select className="form-select" {...register('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="form-label">Description *</label>
              <textarea className={`form-input ${errors.description ? 'form-input-error' : ''}`} rows={5} placeholder="Provide detailed information about the issue..." {...register('description')} />
              {errors.description && <p className="form-error"><AlertCircle size={12} />{errors.description.message}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : '📋 Submit Complaint'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
