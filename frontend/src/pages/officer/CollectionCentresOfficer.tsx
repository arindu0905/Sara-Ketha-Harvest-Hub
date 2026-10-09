import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { centresApi } from '../../services/api';
import {
  Building2, Plus, MapPin, Phone, Mail, UserCheck,
  RefreshCw, Edit3, Loader2, CheckCircle2, XCircle
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CollectionCentre {
  id: string;
  name: string;
  code: string;
  address: string;
  district: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  capacity_kg?: number | null;
  profiles?: { id: string; full_name: string; email: string } | null;
}

const SRI_LANKA_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

const INITIAL_FORM = {
  name: '', code: '', address: '', district: '',
  phone: '', email: '', capacity_kg: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const CollectionCentresOfficer: React.FC = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState<CollectionCentre | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['centres-officer'],
    queryFn: () => centresApi.getAll(),
  });
  const centres: CollectionCentre[] = response?.data?.data || [];

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => centresApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centres-officer'] });
      queryClient.invalidateQueries({ queryKey: ['centres-list'] });
      toast.success('Collection centre registered successfully');
      handleCloseModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create centre'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => centresApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centres-officer'] });
      queryClient.invalidateQueries({ queryKey: ['centres-list'] });
      toast.success('Collection centre updated');
      handleCloseModal();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update centre'),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingCentre(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (c: CollectionCentre) => {
    setEditingCentre(c);
    setForm({
      name: c.name,
      code: c.code,
      address: c.address,
      district: c.district,
      phone: c.phone || '',
      email: c.email || '',
      capacity_kg: c.capacity_kg ? c.capacity_kg.toString() : '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCentre(null);
    setForm(INITIAL_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Centre name is required');
    if (!form.code.trim()) return toast.error('Centre code is required');
    if (!form.address.trim()) return toast.error('Address is required');
    if (!form.district) return toast.error('Please select a district');

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      address: form.address.trim(),
      district: form.district,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      capacity_kg: form.capacity_kg ? parseFloat(form.capacity_kg) : null,
    };

    if (editingCentre) {
      updateMutation.mutate({ id: editingCentre.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="text-primary-600" size={26} />
            Collection Centres
          </h1>
          <p className="page-subtitle">View and register agricultural collection hubs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Register Centre
          </button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && centres.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary-50 text-primary-600"><Building2 size={20} /></div>
            <div>
              <p className="text-xs text-surface-500">Total Centres</p>
              <p className="text-xl font-bold">{centres.length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-xs text-surface-500">Active</p>
              <p className="text-xl font-bold">{centres.filter(c => c.is_active).length}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-surface-100 text-surface-500"><XCircle size={20} /></div>
            <div>
              <p className="text-xs text-surface-500">Inactive</p>
              <p className="text-xl font-bold">{centres.filter(c => !c.is_active).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Centres Grid */}
      {isLoading ? (
        <div className="card p-8">
          <div className="flex flex-col items-center gap-3 text-surface-400">
            <RefreshCw className="animate-spin" size={24} />
            <p className="text-sm">Loading collection centres...</p>
          </div>
        </div>
      ) : centres.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-700 mb-1">No collection centres found</h3>
          <p className="text-sm text-surface-400 mb-4">Register the first agricultural collection hub</p>
          <button onClick={handleOpenAdd} className="btn-primary btn-sm inline-flex items-center gap-2">
            <Plus size={14} /> Register Centre
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {centres.map((c) => (
            <div key={c.id} className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-primary-100 text-primary-700 font-mono">
                        {c.code}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="font-bold text-surface-900 text-base leading-tight">{c.name}</h3>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="btn-ghost p-1.5 rounded-lg text-surface-400 hover:text-surface-700 flex-shrink-0"
                    title="Edit Centre"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-surface-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-surface-400 flex-shrink-0" />
                    <span className="truncate">{c.address}, {c.district}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-surface-400 flex-shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-surface-400 flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.capacity_kg && (
                    <div className="flex items-center gap-2">
                      <span className="text-surface-400">📦</span>
                      <span>Capacity: <strong>{c.capacity_kg.toLocaleString()} kg</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Manager */}
              {c.profiles && (
                <div className="mt-4 pt-3 border-t border-surface-100 flex items-center gap-2 text-xs text-surface-500">
                  <UserCheck size={13} className="text-primary-600" />
                  <span>Manager: <strong className="text-surface-800">{c.profiles.full_name}</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Centre Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCentre ? `Edit — ${editingCentre.name}` : 'Register Collection Centre'}
        subtitle={editingCentre ? 'Update the details for this centre' : 'Register a new agricultural collection hub'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Centre Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Dambulla Hub"
                className="form-input w-full"
                autoFocus
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Centre Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CC-DMB"
                maxLength={10}
                className="form-input w-full uppercase font-mono"
                disabled={!!editingCentre}
              />
              {editingCentre && <p className="text-xs text-surface-400 mt-1">Code cannot be changed after creation</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address of the centre"
              className="form-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                District <span className="text-red-500">*</span>
              </label>
              <select
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="form-select w-full"
              >
                <option value="">Select district...</option>
                {SRI_LANKA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Capacity (kg)
              </label>
              <input
                type="number"
                min="0"
                value={form.capacity_kg}
                onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
                placeholder="e.g. 50000"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+94 77 1234567"
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="centre@harvesthub.lk"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={handleCloseModal} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isBusy} className="btn-primary flex items-center gap-2">
              {isBusy
                ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                : <><Plus size={14} /> {editingCentre ? 'Update Centre' : 'Register Centre'}</>
              }
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
