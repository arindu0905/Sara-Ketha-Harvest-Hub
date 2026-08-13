import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Shield, Search, RefreshCw, Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export const AuditLogs: React.FC = () => {
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-audit-logs', page, entityFilter],
    queryFn: () => adminApi.getAuditLogs({
      page: page.toString(),
      limit: limit.toString(),
      entity_type: entityFilter,
    }),
  });

  const logs: AuditLog[] = response?.data?.data || [];
  const pagination = response?.data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Shield className="text-primary-600" size={28} /> Audit Logs
          </h1>
          <p className="page-subtitle">Security and activity tracking log across all system operations</p>
        </div>

        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <Filter size={18} className="text-surface-400" />
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="form-select max-w-xs text-sm"
        >
          <option value="">All Entities</option>
          <option value="farmers">Farmers</option>
          <option value="crop_prices">Crop Prices</option>
          <option value="produce_collections">Collections</option>
          <option value="quality_inspections">Inspections</option>
          <option value="farmer_payments">Farmer Payments</option>
          <option value="invoices">Invoices</option>
          <option value="profiles">Profiles</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-surface-500">
            <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            No audit logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-50/80">
                    <td className="py-3 px-4 text-xs text-surface-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-surface-800">
                        {log.profiles?.full_name || 'System / Service Role'}
                      </div>
                      {log.profiles?.email && (
                        <div className="text-xs text-surface-400">{log.profiles.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase bg-surface-100 text-surface-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-surface-700 font-medium">
                      {log.entity_type}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-surface-500">
                      {log.entity_id ? log.entity_id.substring(0, 8) + '...' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-surface-100 flex items-center justify-between">
            <div className="text-xs text-surface-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} logs)
            </div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-2 text-xs">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-2 text-xs">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
