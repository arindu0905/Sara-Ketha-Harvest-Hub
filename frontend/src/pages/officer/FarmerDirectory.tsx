import React, { useState } from 'react';
import { DoneBy } from '../../components/ui/DoneBy';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { farmersApi } from '../../services/api';
import { Search, Users, ChevronRight, Filter } from 'lucide-react';

export const FarmerDirectory: React.FC = () => {
  const [search, setSearch] = useState('');
  const [verFilter, setVerFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: farmersRes, isLoading } = useQuery({
    queryKey: ['officer-farmers-dir', search, verFilter, page],
    queryFn: () => farmersApi.getAll({
      page: page.toString(), limit: '20',
      ...(search && { search }),
      ...(verFilter && { verification_status: verFilter }),
    }),
  });

  const farmers = farmersRes?.data?.data || [];
  const total = farmersRes?.data?.meta?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const verBadge = (s: string) => {
    switch (s) {
      case 'verified': return <span className="badge-success text-xs">Verified</span>;
      case 'pending': return <span className="badge-warning text-xs">Pending</span>;
      case 'rejected': return <span className="badge-danger text-xs">Rejected</span>;
      default: return <span className="badge-neutral text-xs">Unverified</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Farmer Directory</h1>
          <p className="page-subtitle">{total} farmers registered</p>
        </div>
        <Link to="/officer/farmers/register" className="btn-primary btn-sm">+ Register Farmer</Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input className="form-input pl-9" placeholder="Search by name, code, NIC, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-select w-auto" value={verFilter} onChange={e => { setVerFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : farmers.length === 0 ? (
        <div className="card"><div className="empty-state"><Users className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No farmers found</p></div></div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th>Code</th>
                    <th>District</th>
                    <th>Phone</th>
                    <th>Crops</th>
                    <th>Verification</th>
                    <th>Verified by</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {farmers.map((f: any) => (
                    <tr key={f.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                            {f.full_name?.charAt(0)}
                          </div>
                          <span className="font-medium text-surface-900">{f.full_name}</span>
                        </div>
                      </td>
                      <td className="text-xs font-mono">{f.farmer_code}</td>
                      <td>{f.district || '—'}</td>
                      <td className="text-sm">{f.phone || '—'}</td>
                      <td className="text-center">{f.farmer_crops?.[0]?.count ?? 0}</td>
                      <td>{verBadge(f.verification_status)}</td>
                      <td><DoneBy items={[[null, f.verifier, f.verified_at]]} /></td>
                      <td>
                        <Link to={`/officer/farmers/${f.id}/verify`} className="btn-ghost p-1 rounded-lg text-xs">
                          <ChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
              <span className="flex items-center text-sm text-surface-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="btn-secondary btn-sm">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
