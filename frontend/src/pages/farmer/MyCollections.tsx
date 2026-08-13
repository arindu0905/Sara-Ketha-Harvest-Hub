import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmersApi, collectionsApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCategoryForLanguage } from '../../utils/categoryUtils';
import { Package, ChevronRight } from 'lucide-react';

export const MyCollections: React.FC = () => {
  const { t, language, formatDate } = useLanguage();

  const { data: farmerData } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      return res.data?.data;
    },
  });

  const farmerId = farmerData?.id;

  const { data: collectionsRes, isLoading } = useQuery({
    queryKey: ['farmer-collections-all', farmerId],
    queryFn: () => collectionsApi.getAll({ farmer_id: farmerId!, limit: '50' }),
    enabled: !!farmerId,
  });

  const collections = collectionsRes?.data?.data || [];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      arrived: 'badge-info', weighed: 'badge-info', under_inspection: 'badge-warning',
      accepted: 'badge-success', partially_accepted: 'badge-earth', rejected: 'badge-danger',
      added_to_inventory: 'badge-success', payment_pending: 'badge-warning', completed: 'badge-success',
    };
    return <span className={map[status] || 'badge-neutral'}>{status?.replace(/_/g, ' ')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('collections')}</h1>
          <p className="page-subtitle">{t('collections_subtitle') || 'Track all your produce collections'}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : collections.length === 0 ? (
        <div className="card">
          <div className="empty-state py-8">
            <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_collections_yet')}</h3>
            <p className="text-surface-400 text-sm max-w-sm mb-4">{t('schedule_delivery_subtitle') || 'Your produce collections will appear here after delivery.'}</p>
            <Link to="/farmer/schedule" className="btn-primary btn-sm">{t('schedule_first_delivery')}</Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('collection_no') || 'Collection No'}</th>
                  <th>{t('my_crops')}</th>
                  <th>{t('net_weight') || 'Weight'}</th>
                  <th>{t('grade')}</th>
                  <th>{t('status')}</th>
                  <th>{t('effective_date') || 'Date'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c: any) => {
                  const inspection = c.quality_inspections?.[0];
                  return (
                    <tr key={c.id}>
                      <td className="font-semibold text-surface-900">{c.collection_no}</td>
                      <td>{formatCategoryForLanguage(c.crop_categories, language) || '—'}</td>
                      <td>{c.net_weight_kg ? `${c.net_weight_kg} kg` : c.gross_weight_kg ? `${c.gross_weight_kg} kg` : t('not_weighed')}</td>
                      <td>{inspection?.grade ? <span className="capitalize">{inspection.grade.replace(/_/g, ' ')}</span> : '—'}</td>
                      <td>{statusBadge(c.status)}</td>
                      <td className="text-surface-500 text-xs">{formatDate(c.created_at)}</td>
                      <td>
                        <Link to={`/farmer/collections/${c.id}`} className="btn-ghost p-1 rounded-lg">
                          <ChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
