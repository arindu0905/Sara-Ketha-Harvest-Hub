import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi, inspectionsApi } from '../../services/api';
import { ArrowLeft, AlertCircle, Loader2, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const inspectionSchema = z.object({
  grade: z.enum(['grade_a', 'grade_b', 'grade_c', 'rejected']),
  accepted_qty_kg: z.string().min(1, 'Enter accepted quantity'),
  rejected_qty_kg: z.string().optional(),
  inspection_notes: z.string().optional(),
});

type InspectionForm = z.infer<typeof inspectionSchema>;

export const CreateInspection: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const { data: collRes } = useQuery({
    queryKey: ['collection-inspect', collectionId],
    queryFn: () => collectionsApi.getById(collectionId!),
    enabled: !!collectionId,
  });
  const collection = collRes?.data?.data;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<InspectionForm>({ resolver: zodResolver(inspectionSchema) });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inspectionsApi.create(data),
    onSuccess: () => { toast.success('Inspection recorded!'); navigate('/inspector/pending'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  });

  const onSubmit = (data: InspectionForm) => {
    mutation.mutate({
      collection_id: collectionId,
      grade: data.grade,
      accepted_qty_kg: parseFloat(data.accepted_qty_kg),
      rejected_qty_kg: parseFloat(data.rejected_qty_kg || '0'),
      inspection_notes: data.inspection_notes || null,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Quality Inspection</h1><p className="page-subtitle">{collection?.collection_no}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4">Collection Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">Farmer</span><span className="font-medium">{collection?.farmers?.full_name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Crop</span><span className="font-medium">{collection?.crop_categories?.name}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Net Weight</span><span className="font-bold text-primary-700">{collection?.net_weight_kg} kg</span></div>
            <div className="flex justify-between"><span className="text-surface-500">Centre</span><span className="font-medium">{collection?.collection_centres?.name}</span></div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2"><CheckSquare size={16} /> Inspection Form</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Quality Grade *</label>
              <select className={`form-select ${errors.grade ? 'form-input-error' : ''}`} {...register('grade')}>
                <option value="">Select grade</option>
                <option value="grade_a">Grade A — Premium</option>
                <option value="grade_b">Grade B — Standard</option>
                <option value="grade_c">Grade C — Below Standard</option>
                <option value="rejected">Rejected</option>
              </select>
              {errors.grade && <p className="form-error"><AlertCircle size={12} />{errors.grade.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Accepted Qty (kg) *</label>
                <input type="number" step="0.1" min="0" max={collection?.net_weight_kg} className={`form-input ${errors.accepted_qty_kg ? 'form-input-error' : ''}`} {...register('accepted_qty_kg')} />
                {errors.accepted_qty_kg && <p className="form-error"><AlertCircle size={12} />{errors.accepted_qty_kg.message}</p>}
              </div>
              <div>
                <label className="form-label">Rejected Qty (kg)</label>
                <input type="number" step="0.1" min="0" className="form-input" {...register('rejected_qty_kg')} />
              </div>
            </div>

            <div>
              <label className="form-label">Inspection Notes</label>
              <textarea className="form-input" rows={3} placeholder="Quality observations, defects found..." {...register('inspection_notes')} />
            </div>

            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
              {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Recording...</> : '✅ Record Inspection'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
