import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { warehousesApi } from '../../services/api';
import { Warehouse } from 'lucide-react';

export const WarehousesPage: React.FC = () => {
  const { data: whRes, isLoading } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesApi.getAll({}) });
  const warehouses = whRes?.data?.data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Warehouses</h1><p className="page-subtitle">Storage facility management</p></div></div>
      {isLoading ? <div className="card p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div> : warehouses.length === 0 ? (
        <div className="card"><div className="empty-state"><Warehouse className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No warehouses configured</p></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w: any) => (
            <div key={w.id} className="card-hover p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-earth-100 rounded-xl flex items-center justify-center"><Warehouse size={20} className="text-earth-600" /></div>
                <div><h3 className="text-base font-bold text-surface-900">{w.name}</h3><p className="text-xs text-surface-500 font-mono">{w.code}</p></div>
              </div>
              <div className="space-y-1 text-sm text-surface-600">
                <p>{w.address || '—'}</p>
                <p>Capacity: {w.total_capacity_mt ? `${w.total_capacity_mt} MT` : '—'}</p>
                {w.manager && <p className="text-xs">Manager: {w.manager?.full_name || '—'}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-surface-100">
                {w.is_active ? <span className="badge-success text-xs">Active</span> : <span className="badge-neutral text-xs">Inactive</span>}
                {w.storage_locations_count && <span className="badge-info text-xs ml-2">{w.storage_locations_count} locations</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
