import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { farmersApi } from '../services/api';

const TYPES: Record<string, string> = {
  nic: 'NIC copy',
  land_deed: 'Land deed / permit',
  bank_passbook: 'Bank passbook',
  farmer_certificate: 'Farmer certificate',
  other: 'Other',
};
const MAX_BYTES = 5 * 1024 * 1024;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

/** Farmer document management (Epic 1). `readOnly` hides upload/delete. */
export const FarmerDocuments: React.FC<{ farmerId: string; readOnly?: boolean; canVerify?: boolean }> = ({ farmerId, readOnly, canVerify }) => {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('nic');
  const key = ['farmer-documents', farmerId];

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => farmersApi.getDocuments(farmerId) });
  const docs: any[] = data?.data?.data ?? [];

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('Only JPG, PNG, WEBP or PDF files are allowed');
      if (file.size > MAX_BYTES) throw new Error('File must be 5 MB or smaller');
      return farmersApi.uploadDocument(farmerId, { doc_type: docType, file_name: file.name, data: await readAsDataUrl(file) });
    },
    onSuccess: () => { toast.success('Document uploaded'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || e?.message || 'Upload failed'),
  });

  const verify = useMutation({
    mutationFn: ({ docId, v }: { docId: string; v: boolean }) => farmersApi.verifyDocument(farmerId, docId, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: (docId: string) => farmersApi.deleteDocument(farmerId, docId),
    onSuccess: () => { toast.success('Document removed'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  return (
    <div className="card overflow-hidden">
      <div className="card-header p-4 border-b border-surface-100 flex flex-wrap gap-3 justify-between items-center">
        <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
          <FileText size={18} className="text-primary-600" /> Documents ({docs.length})
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <select className="form-input text-xs py-1.5" value={docType} onChange={e => setDocType(e.target.value)}>
              {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
            <button className="btn-primary btn-sm flex items-center gap-1" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Upload size={14} /> {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="p-4 text-sm text-surface-500">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="p-6 text-center text-sm text-surface-500">No documents uploaded yet. JPG, PNG, WEBP or PDF, up to 5 MB.</div>
      ) : (
        <ul className="divide-y divide-surface-100">
          {docs.map(d => (
            <li key={d.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-surface-900 truncate">{d.file_name}</div>
                <div className="text-xs text-surface-500">{TYPES[d.document_type] || d.document_type} · {new Date(d.uploaded_at).toLocaleDateString('en-LK')} · {Math.max(1, Math.round((d.file_size || 0) / 1024))} KB{d.is_verified ? " · ✓ Verified" : ""}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-primary-600 flex items-center gap-1 text-xs font-semibold"><ExternalLink size={14} /> View</a>}
                {canVerify && (
                  <button className="text-xs font-semibold text-emerald-700" onClick={() => verify.mutate({ docId: d.id, v: !d.is_verified })}>
                    {d.is_verified ? 'Unverify' : 'Verify'}
                  </button>
                )}
                {!readOnly && (
                  <button className="text-red-600" title="Delete" onClick={() => window.confirm('Delete this document?') && remove.mutate(d.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
