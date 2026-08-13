import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmersApi, cropsApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCategoryForLanguage } from '../../utils/categoryUtils';
import { Leaf, Plus, Sprout, Calendar, Scale, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

interface CropRecord {
  id: string;
  farmer_id: string;
  category_id: string;
  variety_id?: string;
  cultivated_area_acres?: number;
  planting_date?: string;
  expected_harvest_date?: string;
  expected_quantity_kg?: number;
  farming_method?: string;
  notes?: string;
  is_active: boolean;
  crop_categories?: { id: string; name: string; name_sinhala?: string; name_tamil?: string };
  crop_varieties?: { id: string; name: string };
}

export const FarmerCrops: React.FC = () => {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [editingCrop, setEditingCrop] = useState<CropRecord | null>(null);
  const [editForm, setEditForm] = useState({
    cultivated_area_acres: '',
    planting_date: '',
    expected_harvest_date: '',
    expected_quantity_kg: '',
    farming_method: 'conventional',
    notes: '',
    is_active: true,
  });

  const { data: farmerData } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      return res.data?.data;
    },
  });

  const farmerId = farmerData?.id;

  const { data: cropsRes, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['farmer-crops', farmerId],
    queryFn: () => cropsApi.getAll({ farmer_id: farmerId! }),
    enabled: !!farmerId,
  });

  const crops: CropRecord[] = cropsRes?.data?.data || [];

  const updateCropMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => cropsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-crops', farmerId] });
      toast.success('Crop updated successfully');
      setEditingCrop(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update crop');
    },
  });

  const deleteCropMutation = useMutation({
    mutationFn: (id: string) => cropsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-crops', farmerId] });
      toast.success('Crop removed successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove crop');
    },
  });

  const handleOpenEdit = (crop: CropRecord) => {
    setEditingCrop(crop);
    setEditForm({
      cultivated_area_acres: crop.cultivated_area_acres ? crop.cultivated_area_acres.toString() : '',
      planting_date: crop.planting_date || '',
      expected_harvest_date: crop.expected_harvest_date || '',
      expected_quantity_kg: crop.expected_quantity_kg ? crop.expected_quantity_kg.toString() : '',
      farming_method: crop.farming_method || 'conventional',
      notes: crop.notes || '',
      is_active: crop.is_active,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrop) return;

    updateCropMutation.mutate({
      id: editingCrop.id,
      data: {
        cultivated_area_acres: editForm.cultivated_area_acres ? parseFloat(editForm.cultivated_area_acres) : null,
        planting_date: editForm.planting_date || null,
        expected_harvest_date: editForm.expected_harvest_date || null,
        expected_quantity_kg: editForm.expected_quantity_kg ? parseFloat(editForm.expected_quantity_kg) : null,
        farming_method: editForm.farming_method,
        notes: editForm.notes || null,
        is_active: editForm.is_active,
      },
    });
  };

  const handleDeleteCrop = (cropId: string, cropName: string) => {
    if (confirm(t('confirm_delete_crop') || `Are you sure you want to remove your ${cropName} crop record?`)) {
      deleteCropMutation.mutate(cropId);
    }
  };

  const getCategoryDisplayName = (crop: CropRecord) => {
    return formatCategoryForLanguage(crop.crop_categories, language) || 'Crop';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Leaf className="text-primary-600" size={28} /> {t('my_crops')}
          </h1>
          <p className="page-subtitle">{t('my_crops_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> {t('refresh')}
          </button>
          <Link to="/farmer/crops/register" className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={16} /> {t('register_crop')}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      ) : crops.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
              <Leaf className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_crops_registered')}</h3>
            <p className="text-surface-400 text-sm max-w-sm mb-4">{t('no_crops_desc')}</p>
            <Link to="/farmer/crops/register" className="btn-primary btn-sm"><Plus size={14} /> {t('register_first_crop')}</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => {
            const cropName = getCategoryDisplayName(crop);
            return (
              <div key={crop.id} className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between border border-surface-200/80">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                      <Sprout size={20} className="text-primary-600" />
                    </div>
                    {crop.is_active
                      ? <span className="badge-success text-xs">{t('active')}</span>
                      : <span className="badge-neutral text-xs">{t('inactive')}</span>
                    }
                  </div>
                  <h3 className="text-lg font-bold text-surface-900 mb-0.5">
                    {cropName}
                  </h3>
                  <p className="text-xs font-semibold text-primary-700 mb-3">
                    {crop.crop_varieties?.name || t('no_variety_specified')}
                  </p>
                  <div className="space-y-2 text-xs">
                    {crop.cultivated_area_acres && (
                      <div className="flex items-center gap-2 text-surface-600">
                        <Scale size={14} className="text-surface-400" />
                        <span>{t('area')}: <strong className="text-surface-800">{crop.cultivated_area_acres} {t('acres')}</strong></span>
                      </div>
                    )}
                    {crop.planting_date && (
                      <div className="flex items-center gap-2 text-surface-600">
                        <Calendar size={14} className="text-surface-400" />
                        <span>{t('planted')}: {new Date(crop.planting_date).toLocaleDateString(language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-LK')}</span>
                      </div>
                    )}
                    {crop.expected_harvest_date && (
                      <div className="flex items-center gap-2 text-surface-600">
                        <Calendar size={14} className="text-surface-400" />
                        <span>{t('harvest')}: {new Date(crop.expected_harvest_date).toLocaleDateString(language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-LK')}</span>
                      </div>
                    )}
                    {crop.expected_quantity_kg && (
                      <div className="flex items-center gap-2 text-surface-600">
                        <Leaf size={14} className="text-surface-400" />
                        <span>{t('expected')}: <strong className="text-surface-800">{crop.expected_quantity_kg} kg</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-100 text-surface-700 capitalize">
                    {t(crop.farming_method || 'conventional')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(crop)}
                      className="btn-ghost p-1.5 rounded-lg text-surface-600 hover:text-surface-900 hover:bg-surface-100"
                      title={t('edit_crop')}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCrop(crop.id, cropName)}
                      className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                      title={t('delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Edit Crop Modal ─── */}
      <Modal
        isOpen={Boolean(editingCrop)}
        onClose={() => setEditingCrop(null)}
        title={`${t('edit_crop')}: ${editingCrop ? getCategoryDisplayName(editingCrop) : 'Crop'}`}
        subtitle={t('my_crops_subtitle')}
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1">
                {t('area')} ({t('acres')})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.cultivated_area_acres}
                onChange={(e) => setEditForm({ ...editForm, cultivated_area_acres: e.target.value })}
                placeholder="e.g. 2.5"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1">
                {t('farming_method')}
              </label>
              <select
                value={editForm.farming_method}
                onChange={(e) => setEditForm({ ...editForm, farming_method: e.target.value })}
                className="input w-full"
              >
                <option value="conventional">{t('conventional')}</option>
                <option value="organic">{t('organic')}</option>
                <option value="hydroponic">{t('hydroponic')}</option>
                <option value="mixed">{t('mixed')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1">
                {t('planted')}
              </label>
              <input
                type="date"
                value={editForm.planting_date}
                onChange={(e) => setEditForm({ ...editForm, planting_date: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1">
                {t('harvest')}
              </label>
              <input
                type="date"
                value={editForm.expected_harvest_date}
                onChange={(e) => setEditForm({ ...editForm, expected_harvest_date: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1">
              {t('expected')} (kg)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editForm.expected_quantity_kg}
              onChange={(e) => setEditForm({ ...editForm, expected_quantity_kg: e.target.value })}
              placeholder="e.g. 500"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1">
              {t('notes')}
            </label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Any additional information..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="crop-active-toggle"
              checked={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="checkbox"
            />
            <label htmlFor="crop-active-toggle" className="text-sm font-medium text-surface-700 cursor-pointer">
              {t('active')}
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={() => setEditingCrop(null)} className="btn-secondary">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={updateCropMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateCropMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> {t('save')}...
                </>
              ) : (
                t('save')
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

