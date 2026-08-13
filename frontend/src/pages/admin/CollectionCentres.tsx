import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Building2, RefreshCw, MapPin, Phone, Mail, UserCheck, Plus, Edit3, Power } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface CollectionCentre {
  id: string;
  name: string;
  code: string;
  address: string;
  district: string;
  phone: string;
  email: string;
  is_active: boolean;
  capacity_kg?: number;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const SRI_LANKA_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

const INITIAL_FORM = {
  name: '',
  code: '',
  address: '',
  district: '',
  phone: '',
  email: '',
  capacity_kg: '',
};

export const CollectionCentres: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState<CollectionCentre | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-centres'],
    queryFn: () => adminApi.getCentres(),
  });

  const centres: CollectionCentre[] = response?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => adminApi.createCentre(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-centres'] });
      toast.success('Collection centre created successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create centre');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => adminApi.updateCentre(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-centres'] });
      toast.success('Collection centre updated successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update centre');
    },
  });

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
      name: form.name,
      code: form.code.toUpperCase(),
      address: form.address,
      district: form.district,
      phone: form.phone || null,
      email: form.email || null,
      capacity_kg: form.capacity_kg ? parseFloat(form.capacity_kg) : null,
    };

    if (editingCentre) {
      updateMutation.mutate({ id: editingCentre.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (c: CollectionCentre) => {
    updateMutation.mutate({
      id: c.id,
      data: { is_active: !c.is_active },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 className="text-primary-600" size={28} /> {t('collection_centres')}
          </h1>
          <p className="page-subtitle">{t('collection_centres_subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
          <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            {t('add_centre')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-surface-500">
          <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
          Loading collection centres...
        </div>
      ) : centres.length === 0 ? (
        <div className="card p-12 text-center text-surface-500">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_centres_found')}</h3>
          <button onClick={handleOpenAdd} className="btn-primary btn-sm inline-flex items-center gap-2 mt-2">
            <Plus size={14} /> {t('add_centre')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {centres.map((c) => (
            <div key={c.id} className="card p-6 flex flex-col justify-between hover:shadow-card-hover transition-all">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary-100 text-primary-700 mb-1">
                      {c.code}
                    </span>
                    <h3 className="text-base font-bold text-surface-900">{c.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.is_active ? t('active') : t('inactive')}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="btn-ghost p-1 rounded-lg text-surface-500 hover:text-surface-900"
                      title="Edit Centre"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(c)}
                      className={`btn-ghost p-1 rounded-lg ${c.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                      title={c.is_active ? 'Deactivate Centre' : 'Activate Centre'}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-surface-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-surface-400 shrink-0" />
                    <span>{c.address}, {c.district}</span>
                  </div>
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-surface-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-surface-400 shrink-0" />
                      <span>{c.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {c.profiles && (
                <div className="mt-4 pt-3 border-t border-surface-100 flex items-center gap-2 text-xs text-surface-500">
                  <UserCheck size={14} className="text-primary-600" />
                  <span>Manager: <strong className="text-surface-800">{c.profiles.full_name}</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Add/Edit Centre Modal ──────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCentre ? `${t('edit')} ${editingCentre.name}` : t('add_centre')}
        subtitle={editingCentre ? `Update details for ${editingCentre.name}` : 'Register a new agricultural collection hub'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Dambulla Hub"
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('code')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CC-DMB"
                maxLength={10}
                className="input w-full uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              {t('address')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address of the centre"
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('district')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="input w-full"
              >
                <option value="">Select district...</option>
                {SRI_LANKA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('capacity')}
              </label>
              <input
                type="number"
                min="0"
                value={form.capacity_kg}
                onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
                placeholder="e.g. 50000"
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('phone')}
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +94 77 1234567"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('email')}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. dambulla@harvesthub.lk"
                className="input w-full"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="btn-secondary"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  {editingCentre ? t('update') : t('create')}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
