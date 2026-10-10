import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cropsApi } from '../../services/api';
import {
  ArrowLeft,
  Leaf,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  Tag,
  Search,
  CheckCircle,
  XCircle,
  Package,
  Layers,
  ImagePlus,
  X as XIcon,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { formatCategoryName, getCategoryEnglish, getCategorySinhala, getCategoryTamil } from '../../utils/categoryUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface CropVariety {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  is_active: boolean;
  created_at?: string;
}

interface CropCategory {
  id: string;
  name: string;
  name_sinhala: string;
  name_tamil?: string;
  description: string;
  is_active: boolean;
  created_at?: string;
  crop_varieties?: CropVariety[];
}

export const CategoryProductsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CropVariety | null>(null);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);

  // Form states
  const [productForm, setProductForm] = useState({ name: '', description: '' });
  const [editProductForm, setEditProductForm] = useState({ name: '', description: '', is_active: true });
  const [categoryForm, setCategoryForm] = useState({ name: '', name_sinhala: '', name_tamil: '', description: '' });

  // Fetch Category Details & Products
  const { data: response, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ['crop-category', id],
    queryFn: () => cropsApi.getCategoryById(id!),
    enabled: Boolean(id),
  });

  const category: CropCategory | null = response?.data?.data || null;
  const varieties: CropVariety[] = category?.crop_varieties || [];

  // Product photos (administrator)
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const handleImagePick = (varietyId: string, file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return void toast.error('Please choose a PNG, JPG or WebP image');
    if (file.size > 3 * 1024 * 1024) return void toast.error('Image is too large – the limit is 3 MB');
    const reader = new FileReader();
    reader.onload = async () => {
      setUploadingId(varietyId);
      try {
        await cropsApi.uploadVarietyImage(varietyId, String(reader.result));
        toast.success('Product image saved');
        queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Could not upload the image');
      } finally {
        setUploadingId(null);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleImageRemove = async (varietyId: string) => {
    try {
      await cropsApi.removeVarietyImage(varietyId);
      toast.success('Image removed');
      queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not remove the image');
    }
  };

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => cropsApi.createVariety(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Product added successfully');
      handleCloseAddProductModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to add product');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ varietyId, data }: { varietyId: string; data: Record<string, unknown> }) =>
      cropsApi.updateVariety(varietyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Product updated successfully');
      handleCloseEditProductModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update product');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (varietyId: string) => cropsApi.deleteVariety(varietyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Product removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove product');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (data: typeof categoryForm) => cropsApi.updateCategory(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crop-category', id] });
      queryClient.invalidateQueries({ queryKey: ['crop-categories'] });
      toast.success('Category updated successfully');
      setShowEditCategoryModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update category');
    },
  });

  // Modal Handlers
  const handleOpenAddProductModal = () => {
    setProductForm({ name: '', description: '' });
    setShowAddProductModal(true);
  };

  const handleCloseAddProductModal = () => {
    setShowAddProductModal(false);
    setProductForm({ name: '', description: '' });
  };

  const handleOpenEditProductModal = (product: CropVariety) => {
    setEditingProduct(product);
    setEditProductForm({
      name: product.name,
      description: product.description || '',
      is_active: product.is_active,
    });
  };

  const handleCloseEditProductModal = () => {
    setEditingProduct(null);
    setEditProductForm({ name: '', description: '', is_active: true });
  };

  const handleOpenEditCategoryModal = () => {
    if (!category) return;
    setCategoryForm({
      name: category.name,
      name_sinhala: category.name_sinhala || '',
      name_tamil: category.name_tamil || '',
      description: category.description || '',
    });
    setShowEditCategoryModal(true);
  };

  // Form Submits
  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return toast.error('Product name is required');
    createProductMutation.mutate(productForm);
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editProductForm.name.trim()) return toast.error('Product name is required');
    updateProductMutation.mutate({ varietyId: editingProduct.id, data: editProductForm });
  };

  const handleUpdateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return toast.error('Category name is required');
    if (!categoryForm.name_sinhala.trim()) return toast.error('Sinhala name is required');
    updateCategoryMutation.mutate(categoryForm);
  };

  const handleDeleteProduct = (varietyId: string, varietyName: string) => {
    if (confirm(`Are you sure you want to deactivate product "${varietyName}"?`)) {
      deleteProductMutation.mutate(varietyId);
    }
  };

  const getCategoryTitle = () => {
    if (!category) return '';
    if (language === 'si' && category.name_sinhala) return category.name_sinhala;
    if (language === 'ta' && category.name_tamil) return category.name_tamil;
    return category.name;
  };

  // Filtered Products List
  const filteredVarieties = varieties.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'active' ? v.is_active : !v.is_active;

    return matchesSearch && matchesStatus;
  });

  const activeCount = varieties.filter(v => v.is_active).length;
  const inactiveCount = varieties.length - activeCount;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-surface-500">
        <RefreshCw className="animate-spin mb-3 text-primary-600" size={32} />
        <p className="font-medium text-surface-700">Loading category products...</p>
      </div>
    );
  }

  if (isError || !category) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/admin/categories')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Crop Categories
        </button>
        <div className="card p-12 text-center text-surface-500">
          <Leaf className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-surface-800 mb-1">Crop Category Not Found</h3>
          <p className="text-sm text-surface-500 mb-4">The category you are looking for does not exist or has been removed.</p>
          <Link to="/admin/categories" className="btn-primary inline-flex items-center gap-2">
            View All Categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Breadcrumb & Back Navigation ─── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/categories')}
          className="btn-ghost px-3 py-1.5 rounded-xl text-surface-600 hover:text-surface-900 hover:bg-surface-100 flex items-center gap-2 text-sm font-medium transition-all"
        >
          <ArrowLeft size={18} /> Back to Categories
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
          <button onClick={handleOpenEditCategoryModal} className="btn-secondary flex items-center gap-2 text-xs">
            <Edit3 size={14} />
            Edit Category
          </button>
          <button onClick={handleOpenAddProductModal} className="btn-primary flex items-center gap-2 text-xs">
            <Plus size={14} />
            Add Product
          </button>
        </div>
      </div>

      {/* ─── Category Header Banner ─── */}
      <div className="card p-6 bg-gradient-to-r from-primary-900 via-primary-800 to-emerald-900 text-white rounded-2xl shadow-card relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-8">
          <Leaf size={240} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                <Leaf className="text-emerald-300" size={24} />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {formatCategoryName(category)}
              </h1>
              {getCategorySinhala(category) && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/15 text-emerald-200 border border-white/20">
                  {getCategorySinhala(category)}
                </span>
              )}
              {getCategoryTamil(category) && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/15 text-emerald-200 border border-white/20">
                  {getCategoryTamil(category)}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${category.is_active ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-red-500/30 text-red-200 border border-red-400/40'}`}>
                {category.is_active ? 'Active Category' : 'Inactive Category'}
              </span>
            </div>
            <p className="text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
              {category.description || 'Standardized agricultural crop classification.'}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 shrink-0">
            <div className="text-center px-3 border-r border-white/20">
              <span className="block text-2xl font-bold">{varieties.length}</span>
              <span className="text-[11px] text-emerald-200 font-medium uppercase tracking-wider">Products</span>
            </div>
            <div className="text-center px-3 border-r border-white/20">
              <span className="block text-2xl font-bold text-emerald-300">{activeCount}</span>
              <span className="text-[11px] text-emerald-200 font-medium uppercase tracking-wider">Active</span>
            </div>
            <div className="text-center px-3">
              <span className="block text-2xl font-bold text-amber-300">{inactiveCount}</span>
              <span className="text-[11px] text-emerald-200 font-medium uppercase tracking-wider">Inactive</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Filters Bar ─── */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search products under ${category.name}...`}
            className="input pl-9 w-full text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-surface-600">Filter by:</span>
          <div className="inline-flex rounded-xl bg-surface-100 p-1 border border-surface-200 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'all' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'}`}
            >
              All ({varieties.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${statusFilter === 'inactive' ? 'bg-white text-red-700 shadow-sm' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>
        </div>
      </div>

      {/* ─── Products List / Grid ─── */}
      {filteredVarieties.length === 0 ? (
        <div className="card p-12 text-center text-surface-500 space-y-3">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto text-primary-600">
            <Package size={28} />
          </div>
          <h3 className="text-lg font-bold text-surface-800">
            {searchQuery ? 'No matching products found' : `No products under ${category.name}`}
          </h3>
          <p className="text-xs text-surface-500 max-w-md mx-auto">
            {searchQuery
              ? `No products matched "${searchQuery}". Try adjusting your search query.`
              : `Add product varieties for ${category.name} e.g., Samba, Nadu, Keeri Samba.`}
          </p>
          <button onClick={handleOpenAddProductModal} className="btn-primary inline-flex items-center gap-2 text-xs mt-2">
            <Plus size={14} /> Add Product Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVarieties.map((product) => (
            <div
              key={product.id}
              className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between border border-surface-200/80 hover:border-primary-300"
            >
              <div className="relative -mx-5 -mt-5 mb-4 h-36 bg-surface-100 overflow-hidden rounded-t-2xl group">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-surface-400 text-xs gap-1">
                    <ImagePlus size={22} /> No photo yet
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                  <label className="cursor-pointer bg-white/95 hover:bg-white text-surface-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow flex items-center gap-1">
                    <ImagePlus size={12} /> {uploadingId === product.id ? 'Uploading…' : product.image_url ? 'Change' : 'Add photo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingId === product.id}
                      onChange={(e) => { handleImagePick(product.id, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {product.image_url && (
                    <button type="button" onClick={() => handleImageRemove(product.id)} title="Remove photo"
                      className="bg-white/95 hover:bg-white text-red-600 p-1 rounded-lg shadow"><XIcon size={13} /></button>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Tag size={16} />
                    </div>
                    <h3 className="font-bold text-base text-surface-900 leading-snug">{product.name}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      product.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {product.is_active ? (
                      <>
                        <CheckCircle size={10} /> Active
                      </>
                    ) : (
                      <>
                        <XCircle size={10} /> Inactive
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs text-surface-500 leading-relaxed mt-2 mb-4 pl-1">
                  {product.description || 'No specific product description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-surface-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-surface-400 flex items-center gap-1">
                  <Layers size={12} /> {category.name}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditProductModal(product)}
                    className="btn-ghost p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100"
                    title="Edit Product"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    className="btn-ghost p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Deactivate Product"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Add Product Modal ─── */}
      <Modal
        isOpen={showAddProductModal}
        onClose={handleCloseAddProductModal}
        title={`Add Product under ${category.name}`}
        subtitle={`Create a new product variety classified under ${category.name}`}
      >
        <form onSubmit={handleCreateProductSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Product / Variety Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="e.g. Samba, Nadu, Cherry Tomato, Keeri Samba"
              className="input w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Product Description
            </label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Detailed product characteristics, crop features, or grading details..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={handleCloseAddProductModal} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProductMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {createProductMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Plus size={14} /> Add Product
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Product Modal ─── */}
      <Modal
        isOpen={Boolean(editingProduct)}
        onClose={handleCloseEditProductModal}
        title={`Edit Product: ${editingProduct?.name}`}
        subtitle="Update product variety details and active status"
      >
        <form onSubmit={handleEditProductSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editProductForm.name}
              onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
              className="input w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Description
            </label>
            <textarea
              value={editProductForm.description}
              onChange={(e) => setEditProductForm({ ...editProductForm, description: e.target.value })}
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="product-active-toggle"
              checked={editProductForm.is_active}
              onChange={(e) => setEditProductForm({ ...editProductForm, is_active: e.target.checked })}
              className="checkbox"
            />
            <label htmlFor="product-active-toggle" className="text-sm font-medium text-surface-700 cursor-pointer">
              Product Active Status
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={handleCloseEditProductModal} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProductMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateProductMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Updating...
                </>
              ) : (
                'Update Product'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Category Modal ─── */}
      <Modal
        isOpen={showEditCategoryModal}
        onClose={() => setShowEditCategoryModal(false)}
        title={`Edit Category: ${category.name}`}
        subtitle="Update crop category classifications"
      >
        <form onSubmit={handleUpdateCategorySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Sinhala Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={categoryForm.name_sinhala}
                onChange={(e) => setCategoryForm({ ...categoryForm, name_sinhala: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Tamil Name
              </label>
              <input
                type="text"
                value={categoryForm.name_tamil}
                onChange={(e) => setCategoryForm({ ...categoryForm, name_tamil: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Description
            </label>
            <textarea
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={() => setShowEditCategoryModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateCategoryMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateCategoryMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
