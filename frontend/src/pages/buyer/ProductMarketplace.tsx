import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../services/api';
import { ShoppingCart, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export const ProductMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const { data: summaryRes, isLoading } = useQuery({
    queryKey: ['marketplace-summary'],
    queryFn: () => inventoryApi.getSummary(),
  });
  const categories = summaryRes?.data?.data || [];

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('rice') || n.includes('grain') || n.includes('සහල්')) return '🌾';
    if (n.includes('veg') || n.includes('එළවළු')) return '🥦';
    if (n.includes('fruit') || n.includes('පලතුරු')) return '🍎';
    return '🌱';
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart className="text-primary-600 w-6 h-6" /> Product Marketplace
          </h1>
          <p className="page-subtitle">
            Browse available agricultural produce, view real-time stock levels, and place purchase orders
          </p>
        </div>
        <Link to="/buyer/orders/new" className="btn-primary btn-sm flex items-center gap-1.5 shadow-md">
          <ShoppingCart size={15} /> Place Order
        </Link>
      </div>

      {/* Newly Added Stock Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-primary-600 to-teal-700 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-white mb-1">
            <Sparkles size={14} className="text-amber-300" /> Newly Added Stock Available
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">Fresh Produce Directly From Verified Farmers</h2>
          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
            All available stock is quality-inspected at regional hubs and backed by FEFO reservation guarantees.
          </p>
        </div>
      </div>

      {/* Produce Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={20} /> Available Produce Categories
          </h3>
          <span className="text-xs font-semibold text-surface-500">
            {categories.length} Categories In Stock
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 space-y-3">
                <div className="skeleton h-44 rounded-xl" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="card py-16 text-center">
            <div className="empty-state max-w-sm mx-auto">
              <ShoppingCart className="w-12 h-12 text-surface-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-surface-800 mb-1">No Stock Available</h3>
              <p className="text-surface-500 text-xs">Check back later for newly inspected produce.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat: any, i: number) => {
              const totalQty = cat.total_available || 0;

              return (
                <div
                  key={cat.category_id || i}
                  className="card-hover p-6 flex flex-col justify-between relative overflow-hidden border border-surface-200/80 shadow-sm cursor-pointer"
                  onClick={() => cat.category_id && navigate(`/buyer/marketplace/${cat.category_id}`)}
                >
                  {/* Newly Added Badge */}
                  <div className="absolute top-4 right-4">
                    <span className="badge-success text-2xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Sparkles size={11} /> Newly Added
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-primary-100">
                        {getCategoryIcon(cat.name)}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-surface-900 leading-snug">{cat.name}</h4>
                        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Verified Batch Stock
                        </p>
                      </div>
                    </div>

                    {/* Stock Card Highlight */}
                    <div className="bg-gradient-to-br from-primary-50 to-emerald-50/50 rounded-2xl p-4 mb-5 text-center border border-primary-100/60">
                      <p className="text-2xs uppercase tracking-wider text-primary-700 font-bold mb-0.5">
                        TOTAL AVAILABLE STOCK
                      </p>
                      <p className="text-3xl font-extrabold text-primary-800 font-display">
                        {totalQty.toLocaleString()} <span className="text-base font-bold">kg</span>
                      </p>
                    </div>

                    {/* Breakdown by Grade */}
                    {cat.by_grade && Object.keys(cat.by_grade).length > 0 && (
                      <div className="space-y-2 mb-6 bg-surface-50 p-3.5 rounded-xl border border-surface-100">
                        <p className="text-xs font-bold text-surface-700">Stock Availability by Grade:</p>
                        {Object.entries(cat.by_grade).map(([grade, qty]: any) => (
                          <div key={grade} className="flex justify-between items-center text-xs">
                            <span className="capitalize font-medium text-surface-600">
                              {grade.replace(/_/g, ' ')}
                            </span>
                            <span className="font-bold text-surface-900">{qty.toLocaleString()} kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/buyer/marketplace/${cat.category_id || ''}`}
                    className="btn-primary w-full btn-sm flex items-center justify-center gap-2 shadow-md shadow-primary-600/15 py-2.5 font-semibold text-xs"
                  >
                    <ShoppingCart size={15} /> View Products & Prices <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
