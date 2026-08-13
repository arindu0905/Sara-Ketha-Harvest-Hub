import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../../services/api';
import { ShoppingCart, Package } from 'lucide-react';

export const ProductMarketplace: React.FC = () => {
  const { data: summaryRes, isLoading } = useQuery({ queryKey: ['marketplace-summary'], queryFn: () => inventoryApi.getSummary() });
  const categories = summaryRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Product Marketplace</h1><p className="page-subtitle">Browse available produce</p></div>
        <Link to="/buyer/orders/new" className="btn-primary btn-sm"><ShoppingCart size={14} /> Place Order</Link>
      </div>

      {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="card p-6"><div className="skeleton h-32 rounded-xl" /></div>)}</div>
      : categories.length === 0 ? (
        <div className="card"><div className="empty-state"><Package className="w-10 h-10 text-surface-300 mb-3" /><h3 className="text-lg font-semibold text-surface-700 mb-2">No Stock Available</h3><p className="text-surface-400 text-sm">Check back later for available produce.</p></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat: any, i: number) => (
            <div key={i} className="card-hover p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl">🌾</div>
                <div><h3 className="text-lg font-bold text-surface-900">{cat.name}</h3><p className="text-xs text-surface-500">Available produce</p></div>
              </div>
              <div className="bg-primary-50 rounded-xl p-4 mb-4 text-center">
                <p className="text-xs text-primary-600 font-medium">AVAILABLE STOCK</p>
                <p className="text-2xl font-bold text-primary-700 font-display">{cat.total_available?.toLocaleString()} kg</p>
              </div>
              {cat.by_grade && Object.keys(cat.by_grade).length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-surface-500">By Grade:</p>
                  {Object.entries(cat.by_grade).map(([grade, qty]: any) => (
                    <div key={grade} className="flex justify-between text-sm">
                      <span className="capitalize text-surface-600">{grade.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{qty.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/buyer/orders/new" className="btn-primary w-full btn-sm"><ShoppingCart size={14} /> Order Now</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
