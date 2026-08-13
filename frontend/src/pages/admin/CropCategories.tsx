import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cropsApi } from '../../services/api';
import { Leaf, RefreshCw, Plus, Edit3, Trash2, Tag, X, Check, PackagePlus, ArrowRight, ExternalLink } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

import { formatCategoryName, getCategorySinhala, getCategoryTamil } from '../../utils/categoryUtils';

interface CropVariety {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface CropCategory {
  id: string;
  name: string;
  name_sinhala: string;
  name_tamil?: string;
  description: string;
  is_active: boolean;
  crop_varieties?: CropVariety[];
}

const INITIAL_FORM = { name: '', name_sinhala: '', name_tamil: '', description: '' };

export const CropCategories: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CropCategory | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // Products state for creation modal
  const [formVarieties, setFormVarieties] = useState<string[]>([]);
  const [newVarietyInput, setNewVarietyInput] = useState('');

  // Inline product addition on category cards
  const [activeCardAddId, setActiveCardAddId] = useState<string | null>(null);
  const [cardVarietyInput, setCardVarietyInput] = useState('');

  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['crop-categories'],
    queryFn: () => cropsApi.getCategories(),
  });

  const categories: CropCategory[] = response?.data?.data || [];

  const createCategoryMutation = useMutation({
    mutationFn: (data: typeof INITIAL_FORM & { varieties: string[] }) => cropsApi.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Crop category and products created successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof INITIAL_FORM> }) => cropsApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Crop category updated successfully');
      handleCloseModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update category');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => cropsApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Category deactivated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to deactivate category');
    },
  });

  const createVarietyMutation = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      cropsApi.createVariety(categoryId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Product added under category');
      setCardVarietyInput('');
      setNewVarietyInput('');
      setActiveCardAddId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to add product');
    },
  });

  const deleteVarietyMutation = useMutation({
    mutationFn: (id: string) => cropsApi.deleteVariety(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Product removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove product');
    },
  });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setForm(INITIAL_FORM);
    setFormVarieties([]);
    setNewVarietyInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (c: CropCategory) => {
    setEditingCategory(c);
    setForm({
      name: c.name,
      name_sinhala: c.name_sinhala || '',
      name_tamil: c.name_tamil || '',
      description: c.description || '',
    });
    setFormVarieties([]);
    setNewVarietyInput('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setForm(INITIAL_FORM);
    setFormVarieties([]);
    setNewVarietyInput('');
  };

  const handleAddVarietyToForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newVarietyInput.trim();
    if (!trimmed) return;
    if (formVarieties.includes(trimmed)) {
      toast.error('Product already added to list');
      return;
    }
    setFormVarieties([...formVarieties, trimmed]);
    setNewVarietyInput('');
  };

  const handleRemoveVarietyFromForm = (index: number) => {
    setFormVarieties(formVarieties.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Category name is required');
    if (!form.name_sinhala.trim()) return toast.error('Sinhala name is required');

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: form });
    } else {
      createCategoryMutation.mutate({ ...form, varieties: formVarieties });
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Are you sure you want to deactivate this crop category?')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleAddProductToCategory = (categoryId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('Product name cannot be empty');
    createVarietyMutation.mutate({ categoryId, name: trimmed });
  };

  const handleDeleteProduct = (varietyId: string, varietyName: string) => {
    if (confirm(`Remove product "${varietyName}"?`)) {
      deleteVarietyMutation.mutate(varietyId);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Leaf className="text-primary-600" size={28} /> {t('crop_categories')}
          </h1>
          <p className="page-subtitle">{t('crop_categories_subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
          <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            {t('add_category')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-surface-500">
          <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
          Loading crop categories...
        </div>
      ) : categories.length === 0 ? (
        <div className="card p-12 text-center text-surface-500">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_categories_found')}</h3>
          <button onClick={handleOpenAdd} className="btn-primary btn-sm inline-flex items-center gap-2 mt-2">
            <Plus size={14} /> {t('add_category')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((c) => {
            const activeVarieties = (c.crop_varieties || []).filter(v => v.is_active);
            const sinhalaName = getCategorySinhala(c);
            const tamilName = getCategoryTamil(c);

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/admin/categories/${c.id}`)}
                className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between group cursor-pointer border border-surface-200/80 hover:border-primary-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-surface-900 group-hover:text-primary-600 transition-colors flex items-center gap-1.5">
                        {c.name}
                        <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 transition-all text-primary-600 -translate-x-1 group-hover:translate-x-0" />
                      </h3>
                      <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                        {formatCategoryName(c)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                      {sinhalaName && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {sinhalaName}
                        </span>
                      )}
                      {tamilName && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                          {tamilName}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-surface-500 leading-relaxed mb-4">
                    {c.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-surface-100 flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.is_active ? t('active') : t('inactive')}
                    </span>
                    <span className="text-xs font-semibold text-primary-600 group-hover:underline flex items-center gap-1">
                      View Products ({activeVarieties.length}) <ArrowRight size={12} />
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(c);
                      }}
                      className="btn-ghost p-1 rounded-lg text-surface-500 hover:text-surface-900"
                      title="Edit Category"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(c.id);
                      }}
                      className="btn-ghost p-1 rounded-lg text-red-500 hover:text-red-700"
                      title="Deactivate Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add/Edit Category Modal ──────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingCategory ? `${t('edit')} ${editingCategory.name}` : t('add_category')}
        subtitle={editingCategory ? `Update category details and manage products` : 'Create a new crop category and add products under it'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rice, Tea, Coconut, Vegetables"
              className="input w-full"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Sinhala Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name_sinhala}
                onChange={(e) => setForm({ ...form, name_sinhala: e.target.value })}
                placeholder="e.g. සහල්"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Tamil Name
              </label>
              <input
                type="text"
                value={form.name_tamil}
                onChange={(e) => setForm({ ...form, name_tamil: e.target.value })}
                placeholder="e.g. அரிசி"
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this crop category..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* ─── Products under this category ─── */}
          <div className="pt-3 border-t border-surface-100">
            <label className="block text-sm font-semibold text-surface-800 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <PackagePlus size={16} className="text-primary-600" />
                Products / Varieties under this Category
              </span>
            </label>
            <p className="text-xs text-surface-500 mb-2">
              Add individual product varieties for this category (e.g. Samba, Nadu, Keeri Samba).
            </p>

            {/* If creating new category: add to formVarieties */}
            {!editingCategory && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newVarietyInput}
                    onChange={(e) => setNewVarietyInput(e.target.value)}
                    placeholder="Enter product name (e.g. Samba)"
                    className="input text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddVarietyToForm();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddVarietyToForm()}
                    disabled={!newVarietyInput.trim()}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {formVarieties.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {formVarieties.map((vName, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        {vName}
                        <button
                          type="button"
                          onClick={() => handleRemoveVarietyFromForm(idx)}
                          className="text-emerald-600 hover:text-red-600 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-surface-400 italic">
                    No products added yet. Type a product name above and click Add.
                  </span>
                )}
              </div>
            )}

            {/* If editing existing category: show existing and allow inline creation */}
            {editingCategory && (
              <div className="space-y-3">
                {editingCategory.crop_varieties && editingCategory.crop_varieties.filter(v => v.is_active).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {editingCategory.crop_varieties
                      .filter(v => v.is_active)
                      .map((v) => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-surface-100 text-surface-800 border border-surface-200"
                        >
                          {v.name}
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(v.id, v.name)}
                            className="text-surface-400 hover:text-red-600 transition-colors"
                            title={`Delete ${v.name}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-surface-400 italic">No products added yet under this category.</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newVarietyInput}
                    onChange={(e) => setNewVarietyInput(e.target.value)}
                    placeholder="Add new product to this category..."
                    className="input text-sm flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newVarietyInput.trim()) {
                          handleAddProductToCategory(editingCategory.id, newVarietyInput);
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newVarietyInput.trim()) {
                        handleAddProductToCategory(editingCategory.id, newVarietyInput);
                      }
                    }}
                    disabled={createVarietyMutation.isPending || !newVarietyInput.trim()}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 shrink-0"
                  >
                    {createVarietyMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add Product
                  </button>
                </div>
              </div>
            )}
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
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  {editingCategory ? t('update') : t('create')}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

