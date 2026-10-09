import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, Package, User, Scale, ClipboardCheck, FileText, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { collectionsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { printDocument } from '../../utils/printDocument';
import { roleBasePath } from '../../utils/roleBase';

const GRADE_LABEL: Record<string, string> = { grade_a: 'Grade A', grade_b: 'Grade B', grade_c: 'Grade C', rejected: 'Rejected' };
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-LK', { dateStyle: 'medium' }) : '—');
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const kg = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toLocaleString('en-LK', { maximumFractionDigits: 3 })} kg`);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-surface-50 last:border-0 text-sm">
    <span className="text-surface-500">{label}</span><span className="font-medium text-surface-900 text-right">{value}</span>
  </div>
);

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="card"><div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2">{icon}{title}</h3></div><div className="card-body">{children}</div></div>
);

/**
 * Quality inspection report – generated automatically once an inspection is finalised.
 * Combines batch code, weights, quality results and farmer details; printable / save as PDF.
 */
export const InspectionReport: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['inspection-report', collectionId],
    queryFn: () => collectionsApi.getReport(collectionId!).then(r => r.data.data),
    enabled: !!collectionId,
  });
  const r: any = data;

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;
  if (error || !r) {
    const msg = (error as any)?.response?.data?.message || 'The report could not be loaded.';
    return (
      <div className="card max-w-xl mx-auto my-10 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <p className="font-semibold">{msg}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm mt-4">Go back</button>
      </div>
    );
  }

  const { collection: c, farmer: f, inspection: i, batch: b, receipt } = r;
  const total = Number(i.accepted_qty_kg || 0) + Number(i.rejected_qty_kg || 0);
  const acceptance = total > 0 ? ((Number(i.accepted_qty_kg || 0) / total) * 100).toFixed(1) : '0.0';
  const reportNo = `QIR-${c.collection_no}`;
  const canSeeBatch = ['inventory_manager', 'administrator'].includes(user?.role || '') && b?.id;

  const print = () => printDocument({
    title: 'Quality Inspection Report',
    number: reportNo,
    subtitle: `Generated ${fmtDateTime(i.approved_at)}`,
    sections: [
      { heading: 'Batch', rows: [
        { label: 'Batch code', value: b?.batch_no ?? 'No batch (nothing accepted)' },
        ...(b ? [{ label: 'QR value', value: b.qr_code_value ?? '—' }, { label: 'Expiry date', value: fmtDate(b.expected_expiry_date) }, { label: 'Batch status', value: String(b.status).replace(/_/g, ' ') }] : []),
      ] },
      { heading: 'Farmer', rows: [
        { label: 'Name', value: f?.full_name ?? '—' }, { label: 'Farmer code', value: f?.farmer_code ?? '—' },
        { label: 'NIC', value: f?.nic_number ?? '—' }, { label: 'Phone', value: f?.phone ?? '—' }, { label: 'District', value: f?.district ?? '—' },
      ] },
      { heading: 'Collection', rows: [
        { label: 'Collection no', value: c.collection_no }, { label: 'Collection date', value: fmtDate(c.created_at) },
        { label: 'Centre', value: c.centre ?? '—' },
        { label: 'Crop', value: `${c.category ?? '—'}${c.variety ? ` (${c.variety})` : ''}` },
        { label: 'Vehicle / driver', value: [c.vehicle_number, c.driver_name].filter(Boolean).join(' / ') || '—' },
      ] },
      { heading: 'Weights', rows: [
        { label: 'Gross weight', value: kg(c.gross_weight_kg) }, { label: 'Container weight', value: kg(c.container_weight_kg) }, { label: 'Net weight', value: kg(c.net_weight_kg) },
      ] },
      { heading: 'Quality result', rows: [
        { label: 'Grade', value: GRADE_LABEL[i.grade] ?? i.grade }, { label: 'Accepted', value: kg(i.accepted_qty_kg) },
        { label: 'Rejected', value: kg(i.rejected_qty_kg) }, { label: 'Acceptance rate', value: `${acceptance} %` },
        { label: 'Inspector', value: i.inspector ?? '—' }, { label: 'Inspected on', value: fmtDateTime(i.approved_at) },
        { label: 'Notes', value: i.inspection_notes || '—' }, { label: 'Collection receipt', value: receipt?.receipt_no ?? '—' },
      ] },
    ],
    table: r.rejections?.length ? { headers: ['Rejection reason', 'Quantity (kg)', 'Notes'], rows: r.rejections.map((x: any) => [String(x.reason).replace(/_/g, ' '), String(x.quantity_kg), x.notes ?? '']) } : undefined,
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Quality Inspection Report</h1><p className="page-subtitle">{reportNo} · generated automatically after inspection</p></div>
        </div>
        <button onClick={print} className="btn-primary btn-sm flex items-center gap-2"><Printer size={14} /> Print / Save PDF</button>
      </div>

      {/* Batch banner */}
      <div className={`rounded-2xl p-5 border ${b ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">Batch code</p>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <p className="text-2xl font-extrabold font-mono text-surface-900">{b?.batch_no ?? 'No batch created'}</p>
          <div className="flex items-center gap-2 text-sm">
            {b && <span className="badge-success">{String(b.status).replace(/_/g, ' ')}</span>}
            {canSeeBatch && <Link to={`${roleBasePath(user?.role)}/stock/${b.id}`} className="btn-secondary btn-sm">Open stock record</Link>}
          </div>
        </div>
        {!b && <p className="text-xs text-amber-700 mt-1">Nothing was accepted, so no stock batch was created.</p>}
        {b && <p className="text-xs text-surface-500 mt-1">QR value {b.qr_code_value} · expires {fmtDate(b.expected_expiry_date)}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Farmer" icon={<User size={14} className="text-primary-600" />}>
          <Row label="Name" value={f?.full_name ?? '—'} /><Row label="Farmer code" value={f?.farmer_code ?? '—'} />
          <Row label="NIC" value={f?.nic_number ?? '—'} /><Row label="Phone" value={f?.phone ?? '—'} /><Row label="District" value={f?.district ?? '—'} />
        </Card>
        <Card title="Collection" icon={<Package size={14} className="text-primary-600" />}>
          <Row label="Collection no" value={c.collection_no} /><Row label="Collection date" value={fmtDate(c.created_at)} />
          <Row label="Centre" value={c.centre ?? '—'} />
          <Row label="Crop" value={`${c.category ?? '—'}${c.variety ? ` (${c.variety})` : ''}`} />
          <Row label="Vehicle / driver" value={[c.vehicle_number, c.driver_name].filter(Boolean).join(' / ') || '—'} />
        </Card>
        <Card title="Weights" icon={<Scale size={14} className="text-primary-600" />}>
          <Row label="Gross weight" value={kg(c.gross_weight_kg)} /><Row label="Container weight" value={kg(c.container_weight_kg)} />
          <Row label="Net weight" value={<b>{kg(c.net_weight_kg)}</b>} />
        </Card>
        <Card title="Quality result" icon={<ClipboardCheck size={14} className="text-primary-600" />}>
          <Row label="Grade" value={GRADE_LABEL[i.grade] ?? i.grade} />
          <Row label="Accepted" value={<span className="text-primary-700">{kg(i.accepted_qty_kg)}</span>} />
          <Row label="Rejected" value={<span className="text-red-600">{kg(i.rejected_qty_kg)}</span>} />
          <Row label="Acceptance rate" value={`${acceptance} %`} />
          <Row label="Inspector" value={i.inspector ?? '—'} /><Row label="Inspected on" value={fmtDateTime(i.approved_at)} />
          {i.inspection_notes && <Row label="Notes" value={i.inspection_notes} />}
        </Card>
      </div>

      {r.rejections?.length > 0 && (
        <Card title="Rejections" icon={<AlertCircle size={14} className="text-red-500" />}>
          <table className="table"><thead><tr><th>Reason</th><th>Quantity</th><th>Notes</th></tr></thead>
            <tbody>{r.rejections.map((x: any, idx: number) => <tr key={idx}><td className="capitalize">{String(x.reason).replace(/_/g, ' ')}</td><td>{kg(x.quantity_kg)}</td><td>{x.notes || '—'}</td></tr>)}</tbody></table>
        </Card>
      )}

      {r.images?.length > 0 && (
        <Card title={`Evidence photos (${r.images.length})`} icon={<ImageIcon size={14} className="text-primary-600" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {r.images.map((img: any) => (
              <a key={img.id} href={img.storage_path} target="_blank" rel="noreferrer" className="block">
                <img src={img.storage_path} alt={img.caption || 'Evidence'} className="w-full h-28 object-cover rounded-xl border border-surface-100" />
                {img.caption && <p className="text-xs text-surface-500 mt-1 truncate">{img.caption}</p>}
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card title="Collection receipt" icon={<FileText size={14} className="text-primary-600" />}>
        <Row label="Receipt no" value={receipt?.receipt_no ?? '—'} /><Row label="Receipt status" value={receipt?.status ?? '—'} />
        <Row label="Issued" value={fmtDateTime(receipt?.issued_at)} />
      </Card>
    </div>
  );
};
