import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inventoryApi } from '../../services/api';
import { ArrowLeft, ShoppingCart, Package, ImageOff } from 'lucide-react';
import { formatLKR } from '../../utils/lkrFormat';
import { imageSrc } from '../../services/apiClient';

const gradeLabel = (g: string) => g.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

/** Registered products (varieties) of one category with photo, price per grade and stock. */
export const CategoryProducts: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  const { data: res, isLoading, error } = useQuery({
    queryKey: ['marketplace-products', categoryId],
    queryFn: () => inventoryApi.getMarketplace(categoryId!),
    enabled: !!categoryId,
  });
  const category = res?.data?.data?.category;
  const products: any[] = res?.data?.data?.products || [];

  const orderLink = (p: any) => {
    const firstInStock = p.grades.find((g: any) => g.available_kg > 0);
    const params = new URLSearchParams({ category_id: categoryId || '' });
    if (p.id) params.set('variety_id', p.id);
    if (firstInStock) params.set('grade', firstInStock.grade);
    return `/buyer/orders/new?${params.toString()}`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/buyer/marketplace')} className="btn-ghost p-2 rounded-xl" aria-label="Back"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{category?.name || 'Products'}</h1>
            <p className="page-subtitle">{products.length} registered product{products.length === 1 ? '' : 's'} – prices are per kg</p>
          </div>
        </div>
        <Link to={`/buyer/orders/new?category_id=${categoryId}`} className="btn-primary btn-sm flex items-center gap-1.5">
          <ShoppingCart size={15} /> Place Order
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}</div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-600">Could not load the products. Please try again.</div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500">No products are registered in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => {
            const inStock = p.available_kg > 0;
            return (
              <div key={p.id || p.name} className="card overflow-hidden flex flex-col border border-surface-200/80">
                <div className="h-44 bg-surface-100 flex items-center justify-center overflow-hidden">
                  {p.image_url
                    ? <img src={imageSrc(p.image_url)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    : <ImageOff className="w-10 h-10 text-surface-300" />}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-surface-900 leading-snug">{p.name}</h3>
                    <span className={inStock ? 'badge-success' : 'badge-neutral'}>{inStock ? 'In stock' : 'Out of stock'}</span>
                  </div>
                  {p.description && <p className="text-xs text-surface-500 mt-1 line-clamp-2">{p.description}</p>}

                  <div className="mt-4 rounded-xl border border-surface-100 bg-surface-50 divide-y divide-surface-100">
                    {p.grades.length === 0 ? (
                      <p className="p-3 text-xs text-surface-400">No price or stock listed yet</p>
                    ) : p.grades.map((g: any) => (
                      <div key={g.grade} className="flex items-center justify-between p-2.5 text-xs">
                        <span className="font-medium text-surface-700">{gradeLabel(g.grade)}</span>
                        <span className="text-surface-500">{g.available_kg > 0 ? `${g.available_kg.toLocaleString()} kg` : 'No stock'}</span>
                        <span className="font-bold text-primary-700">{g.price_per_kg !== null ? `${formatLKR(g.price_per_kg, 2)} / kg` : 'Price not set'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <Link to={orderLink(p)} className={`btn-primary w-full btn-sm flex items-center justify-center gap-2 ${inStock ? '' : 'opacity-60'}`}>
                      <ShoppingCart size={15} /> {inStock ? 'Order this product' : 'Order (pre-order)'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
