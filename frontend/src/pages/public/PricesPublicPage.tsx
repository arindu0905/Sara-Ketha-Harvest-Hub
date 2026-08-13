import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { pricesApi } from '../../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { formatCategoryName } from '../../utils/categoryUtils';

export const PricesPublicPage: React.FC = () => {
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-prices'],
    queryFn: () => pricesApi.getCurrent(),
  });

  const prices = (data?.data?.data || []).filter((p: any) =>
    !search || p.crop_categories?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-100 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-surface-600 hover:text-surface-900 font-medium text-sm">
            <ArrowLeft size={18} /> Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <span className="font-bold text-surface-900 font-display">HarvestHub Prices</span>
          </div>
          <Link to="/login" className="btn-primary btn-sm">Sign In</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="page-header">
          <div>
            <h1 className="page-title">Daily Crop Market Prices</h1>
            <p className="page-subtitle">Official collection centre purchasing & selling prices in Sri Lankan Rupees (LKR)</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-3 py-2 w-full sm:w-64">
            <Search size={16} className="text-surface-400" />
            <input
              type="text"
              placeholder="Search crop category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="card p-5 skeleton h-32" />
            ))}
          </div>
        ) : prices.length === 0 ? (
          <div className="card p-12 text-center text-surface-400">No active prices found matching your search.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prices.map((p: any) => (
              <div key={p.id} className="card p-5 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-surface-900 text-lg">{p.crop_categories?.name}</h3>
                    <p className="text-xs text-emerald-700 font-medium">{formatCategoryName(p.crop_categories)}</p>
                  </div>
                  <span className={`badge uppercase ${p.grade === 'grade_a' ? 'badge-success' : p.grade === 'grade_b' ? 'badge-warning' : 'badge-neutral'}`}>
                    {p.grade?.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-100 text-sm">
                  <div>
                    <p className="text-2xs font-semibold text-surface-400 uppercase">Purchase Price</p>
                    <p className="font-bold text-primary-700 text-base">LKR {p.purchase_price} <span className="text-xs text-surface-500 font-normal">/ {p.unit || 'kg'}</span></p>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold text-surface-400 uppercase">Selling Price</p>
                    <p className="font-bold text-earth-700 text-base">LKR {p.selling_price} <span className="text-xs text-surface-500 font-normal">/ {p.unit || 'kg'}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
