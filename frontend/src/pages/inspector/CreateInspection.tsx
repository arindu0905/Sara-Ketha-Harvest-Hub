import React, { useEffect, useRef, useState } from 'react';
import { roleBasePath } from '../../utils/roleBase';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collectionsApi, inspectionsApi } from '../../services/api';
import {
  ArrowLeft, AlertCircle, Loader2, CheckSquare, Plus, Trash2,
  ShieldCheck, Scale, Camera, ImagePlus, X, Eye, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Constants ─────────────────────────────────────────────────────────────────

const REJECTION_REASONS = [
  { id: 'pest_damage',       label: '🦠 Pest / Disease Damage' },
  { id: 'overripe',          label: '🍂 Over-ripe / Decomposing' },
  { id: 'incorrect_size',    label: '📏 Under-size / Undersized' },
  { id: 'damaged',           label: '💥 Physical Damage (bruising, crushing)' },
  { id: 'fungal_infection',  label: '🍄 Fungal Infection / Mold' },
  { id: 'pesticide_residue', label: '☣️ Pesticide Residue' },
  { id: 'other',             label: '⚠️ Other Defect' },
];

const IMAGE_TYPES = [
  { value: 'general',       label: 'General View' },
  { value: 'defect',        label: 'Defect / Damage' },
  { value: 'label',         label: 'Label / Packaging' },
  { value: 'rejected_area', label: 'Rejected Area' },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvidenceImage {
  id?: string;
  file?: File;
  preview: string;         // data URL for preview
  data?: string;           // data URL to send to backend
  caption: string;
  image_type: string;
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────

const rejectionReasonSchema = z.object({
  reason:      z.string().min(1, 'Select a rejection reason'),
  quantity_kg: z.string().min(1, 'Enter rejected quantity (kg)'),
  notes:       z.string().optional(),
});

const inspectionSchema = z.object({
  grade:             z.enum(['grade_a', 'grade_b', 'grade_c', 'rejected'], { required_error: 'Select quality grade' }),
  accepted_qty_kg:   z.string().min(1, 'Enter accepted quantity'),
  rejected_qty_kg:   z.string().optional(),
  inspection_notes:  z.string().optional(),
  rejection_reasons: z.array(rejectionReasonSchema).optional(),
});

type InspectionForm = z.infer<typeof inspectionSchema>;

// ─── Image Upload Panel ──────────────────────────────────────────────────────

function EvidenceUploader({ images, onChange }: { images: EvidenceImage[]; onChange: (imgs: EvidenceImage[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<EvidenceImage | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const MAX = 8;
    if (images.length + files.length > MAX) {
      toast.error(`Maximum ${MAX} images allowed`);
      return;
    }
    const newImages: EvidenceImage[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const img: EvidenceImage = { file, preview: dataUrl, data: dataUrl, caption: '', image_type: 'general' };
        newImages.push(img);
        if (newImages.length === files.length) {
          onChange([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const update = (idx: number, field: keyof EvidenceImage, value: string) => {
    const updated = images.map((img, i) => i === idx ? { ...img, [field]: value } : img);
    onChange(updated);
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className="border-2 border-dashed border-primary-200 rounded-2xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-all"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500', 'bg-primary-50'); }}
        onDragLeave={e => { e.currentTarget.classList.remove('border-primary-500', 'bg-primary-50'); }}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-primary-500', 'bg-primary-50'); addFiles(e.dataTransfer.files); }}
      >
        <ImagePlus size={28} className="mx-auto mb-2 text-primary-400" />
        <p className="text-sm font-semibold text-primary-700">Click or drag images here</p>
        <p className="text-xs text-surface-400 mt-1">JPG, PNG, WebP · Max 8 images · Each up to 5MB</p>
        <button type="button" className="mt-3 btn-primary btn-sm text-xs inline-flex items-center gap-1.5">
          <Upload size={13} /> Choose Images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative border border-surface-200 rounded-xl overflow-hidden bg-surface-50">
              {/* Thumbnail */}
              <div className="relative">
                <img
                  src={img.preview}
                  alt={`Evidence ${idx + 1}`}
                  className="w-full h-28 object-cover"
                />
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPreview(img)}
                    className="p-1 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-all"
                    title="Preview"
                  >
                    <Eye size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-1 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-all"
                    title="Remove"
                  >
                    <X size={11} />
                  </button>
                </div>
                <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md">
                  #{idx + 1}
                </span>
              </div>

              {/* Caption & type */}
              <div className="p-2 space-y-1.5">
                <input
                  type="text"
                  className="form-input text-xs py-1"
                  placeholder="Caption (optional)"
                  value={img.caption}
                  onChange={e => update(idx, 'caption', e.target.value)}
                />
                <select
                  className="form-select text-xs py-1"
                  value={img.image_type}
                  onChange={e => update(idx, 'image_type', e.target.value)}
                >
                  {IMAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={preview.preview} alt="preview" className="w-full rounded-2xl shadow-2xl" />
            {preview.caption && (
              <p className="text-white text-center mt-3 text-sm">{preview.caption}</p>
            )}
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 bg-white text-surface-900 rounded-full p-1.5 shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const CreateInspection: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [evidenceImages, setEvidenceImages] = useState<EvidenceImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const { data: collRes, isLoading: collLoading } = useQuery({
    queryKey: ['collection-inspect', collectionId],
    queryFn: () => collectionsApi.getById(collectionId!),
    enabled: !!collectionId,
  });
  const collection = collRes?.data?.data;

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<InspectionForm>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      grade: undefined,
      accepted_qty_kg: '',
      rejected_qty_kg: '0',
      inspection_notes: '',
      rejection_reasons: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rejection_reasons' });

  const acceptedQtyStr = watch('accepted_qty_kg');
  const rejectedQtyStr = watch('rejected_qty_kg');
  const grade = watch('grade');

  const netWeight = collection?.net_weight_kg ? Number(collection.net_weight_kg) : 0;
  const acceptedQty = parseFloat(acceptedQtyStr || '0');
  const rejectedQty = parseFloat(rejectedQtyStr || '0');

  useEffect(() => {
    if (netWeight > 0 && !acceptedQtyStr) {
      if (grade === 'rejected') {
        setValue('accepted_qty_kg', '0');
        setValue('rejected_qty_kg', String(netWeight));
      } else {
        setValue('accepted_qty_kg', String(netWeight));
        setValue('rejected_qty_kg', '0');
      }
    }
  }, [netWeight, grade, setValue, acceptedQtyStr]);

  const showRejectionSection = rejectedQty > 0 || grade === 'rejected';

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => inspectionsApi.create(data),
    onSuccess: async (res: any) => {
      const inspectionId = res?.data?.data?.id;

      // Upload evidence images if any
      if (evidenceImages.length > 0 && inspectionId) {
        setUploadingImages(true);
        try {
          await inspectionsApi.uploadImages(inspectionId, evidenceImages.map(img => ({
            data:       img.data!,
            caption:    img.caption   || undefined,
            image_type: img.image_type,
          })));
          toast.success(`Inspection recorded + ${evidenceImages.length} image(s) uploaded!`);
        } catch {
          toast.success('Inspection recorded! (Image upload had an issue — check the console)');
        } finally {
          setUploadingImages(false);
        }
      } else {
        toast.success('Inspection saved: stock batch created, collection receipt issued and farmer notified.');
      }
      const saved = res?.data?.data;
      if (saved?.batch_no || saved?.receipt_no) {
        toast.success(`${saved.batch_no ? `Batch ${saved.batch_no} · ` : ''}Receipt ${saved.receipt_no ?? ''}`, { duration: 8000 });
      }

      queryClient.invalidateQueries({ queryKey: ['pending-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspected-collections'] });
      queryClient.invalidateQueries({ queryKey: ['officer-collections'] });
      // the report is generated automatically: batch code, weights, quality result and farmer details
      navigate(`${roleBasePath(user?.role)}/inspection-report/${collectionId}`, { replace: true });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to record inspection'),
  });

  const onSubmit = (data: InspectionForm) => {
    const acc = parseFloat(data.accepted_qty_kg || '0');
    const rej = parseFloat(data.rejected_qty_kg || '0');

    if (netWeight > 0 && Math.abs(acc + rej - netWeight) > 0.05) {
      toast.error(`Accepted (${acc} kg) + rejected (${rej} kg) must equal the net weight (${netWeight} kg) — nothing may go unaccounted for`);
      return;
    }
    const reasons = (data.rejection_reasons || []) as any[];
    if (rej > 0) {
      if (reasons.length === 0) { toast.error('Add at least one rejection reason'); return; }
      const sum = reasons.reduce((t, r) => t + parseFloat(r.quantity_kg || '0'), 0);
      if (sum > rej + 0.05) { toast.error(`Rejection reason quantities (${sum} kg) exceed the rejected total (${rej} kg)`); return; }
    }

    mutation.mutate({
      collection_id:     collectionId,
      grade:             data.grade,
      accepted_qty_kg:   acc,
      rejected_qty_kg:   rej,
      inspection_notes:  data.inspection_notes || null,
      rejection_reasons: (data.rejection_reasons || []).map((r: any) => ({
        reason:      r.reason,
        quantity_kg: parseFloat(r.quantity_kg || '0'),
        notes:       r.notes || null,
      })),
    });
  };

  const isSubmitting = mutation.isPending || uploadingImages;

  if (collLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Quality Inspection &amp; Grading</h1>
            <p className="page-subtitle">{collection?.collection_no} · {collection?.farmers?.full_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Collection Summary ───────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2 border-b pb-3">
              <Scale size={16} className="text-primary-600" /> Collection Details
            </h3>

            <div className="space-y-3 text-sm">
              {[
                ['Farmer Name',           collection?.farmers?.full_name],
                ['Farmer Code',           collection?.farmers?.farmer_code],
                ['Crop Category',         collection?.crop_categories?.name],
                collection?.crop_varieties?.name && ['Crop Variety', collection.crop_varieties.name],
                ['Gross Weight',          `${collection?.gross_weight_kg || '—'} kg`],
                ['Tare / Container Weight', `${collection?.container_weight_kg || '0'} kg (${collection?.container_count || 0} ${collection?.container_type || 'containers'})`],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label as string} className="flex justify-between border-b pb-2">
                  <span className="text-surface-500">{label}</span>
                  <span className="font-medium text-surface-900 text-right">{value}</span>
                </div>
              ))}
              <div className="flex justify-between bg-primary-50 p-3 rounded-xl">
                <span className="font-semibold text-primary-800">Net Weight</span>
                <span className="font-bold text-lg text-primary-700">{collection?.net_weight_kg} kg</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500">
                <span>Collection Date</span>
                <span>{collection?.created_at ? new Date(collection.created_at).toLocaleString('en-LK') : '—'}</span>
              </div>
            </div>
          </div>

          {/* ── Evidence Images ────────────────────────────────────────── */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Camera size={16} className="text-primary-600" />
              4. Evidence Images
              <span className="ml-1 text-xs font-normal text-surface-400">(optional · max 8)</span>
            </h3>
            <p className="text-xs text-surface-500 mb-4">
              Upload photographs of the produce as evidence — overall quality view, specific defects, labels, or rejected areas.
              Images are saved separately to the inspection record.
            </p>
            <EvidenceUploader images={evidenceImages} onChange={setEvidenceImages} />
            {evidenceImages.length > 0 && (
              <p className="text-xs text-emerald-700 font-medium mt-3 flex items-center gap-1">
                <Camera size={11} /> {evidenceImages.length} image{evidenceImages.length > 1 ? 's' : ''} ready to upload
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Inspection Form ─────────────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2">
            <CheckSquare size={18} className="text-primary-600" /> Complete Inspection Form
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* 1. Grade */}
            <div>
              <label className="form-label font-semibold">1. Assign Overall Quality Grade *</label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {[
                  { value: 'grade_a',  color: 'green',  label: 'Grade A — Premium',        desc: 'Fresh, correct size, no visible defects, excellent color' },
                  { value: 'grade_b',  color: 'blue',   label: 'Grade B — Standard',        desc: 'Minor surface defects, slight size variation, good quality' },
                  { value: 'grade_c',  color: 'amber',  label: 'Grade C — Below Standard',  desc: 'Below standard — over-ripe, under-sized, or minor damage — still usable' },
                  { value: 'rejected', color: 'red',    label: 'Rejected',                  desc: 'Entire batch fails quality standards and cannot be used' },
                ].map(g => (
                  <label key={g.value} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${grade === g.value ? `border-${g.color}-500 bg-${g.color}-50/60 ring-2 ring-${g.color}-500` : 'border-surface-200 hover:bg-surface-50'}`}>
                    <input type="radio" value={g.value} className="mt-1" {...register('grade')} />
                    <div>
                      <span className={`font-bold text-${g.color}-800 text-sm`}>{g.label}</span>
                      <p className={`text-xs text-${g.color}-700`}>{g.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.grade && <p className="form-error mt-1"><AlertCircle size={12} />{errors.grade.message}</p>}
            </div>

            {/* 2. Quantities */}
            <div>
              <label className="form-label font-semibold mb-2 block">2. Accepted &amp; Rejected Quantities (kg) *</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-xs">Accepted Quantity (kg) *</label>
                  <input
                    type="number" step="0.1" min="0" max={netWeight}
                    className={`form-input ${errors.accepted_qty_kg ? 'form-input-error' : ''}`}
                    placeholder="e.g. 700"
                    {...register('accepted_qty_kg')}
                  />
                  {errors.accepted_qty_kg && <p className="form-error"><AlertCircle size={12} />{errors.accepted_qty_kg.message}</p>}
                </div>
                <div>
                  <label className="form-label text-xs">Rejected Quantity (kg)</label>
                  <input
                    type="number" step="0.1" min="0" max={netWeight}
                    className="form-input"
                    placeholder="e.g. 50"
                    {...register('rejected_qty_kg')}
                  />
                </div>
              </div>
              <p className="text-xs text-surface-500 mt-1">
                Total Net Weight: <strong>{netWeight} kg</strong> | Accepted: <strong>{acceptedQty} kg</strong> | Rejected: <strong>{rejectedQty} kg</strong>
              </p>
            </div>

            {/* Rejection Reasons */}
            {showRejectionSection && (
              <div className="border border-red-200 rounded-xl p-4 bg-red-50/40 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <AlertCircle size={16} /> Rejection Reasons Log
                  </h4>
                  <button
                    type="button"
                    onClick={() => append({ reason: REJECTION_REASONS[0].id, quantity_kg: String(rejectedQty || '0'), notes: '' })}
                    className="btn-secondary btn-sm text-xs"
                  >
                    <Plus size={12} /> Add Reason
                  </button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs text-red-600 italic">Click "Add Reason" to document specific defect reasons.</p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="p-3 bg-white rounded-xl border border-red-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label text-xs">Reason *</label>
                        <select className="form-select text-xs" {...register(`rejection_reasons.${index}.reason`)}>
                          {REJECTION_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-xs">Quantity (kg) *</label>
                        <input type="number" step="0.1" min="0" className="form-input text-xs" placeholder="e.g. 20" {...register(`rejection_reasons.${index}.quantity_kg`)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" className="form-input text-xs flex-1" placeholder="Specific notes e.g. severe bruising on top layer..." {...register(`rejection_reasons.${index}.notes`)} />
                      <button type="button" onClick={() => remove(index)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 flex-shrink-0" title="Remove Reason">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Notes */}
            <div>
              <label className="form-label font-semibold">3. Additional Inspection Notes</label>
              <textarea
                className="form-input text-sm"
                rows={3}
                placeholder="Document physical observations, temperature, moisture, packaging condition..."
                {...register('inspection_notes')}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploadingImages ? `Uploading ${evidenceImages.length} image(s)...` : 'Submitting Inspection...'}
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Submit Quality Inspection
                  {evidenceImages.length > 0 && <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">+ {evidenceImages.length} photo{evidenceImages.length > 1 ? 's' : ''}</span>}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
