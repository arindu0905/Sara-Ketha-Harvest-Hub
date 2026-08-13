import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pricesApi, cropsApi } from '../../services/api';
import { DollarSign, RefreshCw, Tag, Plus, CheckCircle, XCircle, Edit3, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { formatCategoryName } from '../../utils/categoryUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface CropPrice {
  id: string;
  category_id: string;
  grade: string;
  purchase_price: number;
  selling_price: number;
  unit: string;
  effective_from: string;
  status: string;
  crop_categories?: {
    name: string;
    name_sinhala?: string;
    name_tamil?: string;
  };
}

interface CropCategory {
  id: string;
  name: string;
}

const GRADES = ['grade_a', 'grade_b', 'grade_c'];
const UNITS = ['kg', 'mt', 'bushel'];

const INITIAL_FORM = {
  category_id: '',
  grade: 'grade_a',
  purchase_price: '',
  selling_price: '',
  unit: 'kg',
  effective_from: new Date().toISOString().split('T')[0],
};

export const PriceManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CropPrice | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['current-prices'],
    queryFn: () => pricesApi.getCurrent(),
  });

  const { data: categoriesRes } = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => cropsApi.getCategories(),
  });

  const prices: CropPrice[] = response?.data?.data || [];
  const categories: CropCategory[] = categoriesRes?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => pricesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      toast.success('Price created successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create price');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => pricesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      toast.success('Price updated successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update price');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      toast.success('Price record deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete price');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => pricesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      toast.success('Price status updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const handleOpenAdd = () => {
    setEditingPrice(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (p: CropPrice) => {
    setEditingPrice(p);
    setForm({
      category_id: p.category_id,
      grade: p.grade,
      purchase_price: p.purchase_price ? p.purchase_price.toString() : '',
      selling_price: p.selling_price ? p.selling_price.toString() : '',
      unit: p.unit || 'kg',
      effective_from: p.effective_from ? p.effective_from.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPrice(null);
    setForm(INITIAL_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) return toast.error('Please select a crop category');
    if (!form.purchase_price || !form.selling_price) return toast.error('Both prices are required');

    const purchasePrice = parseFloat(form.purchase_price);
    const sellingPrice = parseFloat(form.selling_price);
    if (isNaN(purchasePrice) || isNaN(sellingPrice) || purchasePrice <= 0 || sellingPrice <= 0) {
      return toast.error('Prices must be valid positive numbers');
    }

    const payload = {
      category_id: form.category_id,
      grade: form.grade,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      unit: form.unit,
      effective_from: form.effective_from,
    };

    if (editingPrice) {
      updateMutation.mutate({ id: editingPrice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleStatus = (p: CropPrice) => {
    const nextStatus = p.status === 'active' ? 'inactive' : 'active';
    statusMutation.mutate({ id: p.id, status: nextStatus });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this price record?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <DollarSign className="text-primary-600" size={28} /> {t('price_management')}
          </h1>
          <p className="page-subtitle">{t('price_management_subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
          <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            {t('add_price')}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-surface-500">
            <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
            Loading price list...
          </div>
        ) : prices.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_prices_found')}</h3>
            <button onClick={handleOpenAdd} className="btn-primary btn-sm inline-flex items-center gap-2 mt-2">
              <Plus size={14} /> {t('add_price')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                  <th className="py-3 px-4">{t('crop_categories')}</th>
                  <th className="py-3 px-4">{t('grade')}</th>
                  <th className="py-3 px-4">{t('purchase_price')}</th>
                  <th className="py-3 px-4">{t('selling_price')}</th>
                  <th className="py-3 px-4">{t('margin')}</th>
                  <th className="py-3 px-4">{t('effective_date')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {prices.map((p) => {
                  const margin = p.selling_price - p.purchase_price;
                  return (
                    <tr key={p.id} className="hover:bg-surface-50/80">
                      <td className="py-3.5 px-4 font-semibold text-surface-900">
                        {formatCategoryName(p.crop_categories) || 'Crop'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 uppercase">
                          <Tag size={12} /> {p.grade.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-emerald-700">
                        Rs. {Number(p.purchase_price).toFixed(2)} / {p.unit}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-blue-700">
                        Rs. {Number(p.selling_price).toFixed(2)} / {p.unit}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-surface-600">
                        + Rs. {margin.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-surface-500">
                        {new Date(p.effective_from).toLocaleDateString('en-LK')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`btn-ghost p-1.5 rounded-lg text-xs font-medium ${
                              p.status === 'active' ? 'text-green-700 hover:bg-green-50' : 'text-gray-500 hover:bg-gray-100'
                            }`}
                            title={p.status === 'active' ? 'Deactivate Price' : 'Activate Price'}
                          >
                            {p.status === 'active' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="btn-ghost p-1.5 rounded-lg text-surface-600 hover:text-surface-900 hover:bg-surface-100"
                            title="Edit Price"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete Price Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add/Edit Price Modal ──────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingPrice ? 'Edit Price Record' : t('add_price')}
        subtitle={editingPrice ? 'Update purchase and selling price rates' : 'Set a new purchase and selling price for a crop grade'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              {t('crop_categories')} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="input w-full"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{formatCategoryName(c)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('grade')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="input w-full"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Unit
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input w-full"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('purchase_price')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                placeholder="e.g. 150.00"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                {t('selling_price')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                placeholder="e.g. 180.00"
                className="input w-full"
              />
            </div>
          </div>

          {form.purchase_price && form.selling_price && (
            <div className="bg-surface-50 rounded-xl p-3 flex items-center justify-between text-sm">
              <span className="text-surface-600">{t('margin')} per {form.unit}:</span>
              <span className={`font-bold ${parseFloat(form.selling_price) - parseFloat(form.purchase_price) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Rs. {(parseFloat(form.selling_price) - parseFloat(form.purchase_price)).toFixed(2)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              {t('effective_date')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.effective_from}
              onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
              className="input w-full"
            />
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
                  {editingPrice ? t('update') : t('save')}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
