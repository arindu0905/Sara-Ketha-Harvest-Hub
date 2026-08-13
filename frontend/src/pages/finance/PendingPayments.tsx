import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { collectionsApi } from '../../services/api';
import { DollarSign, ChevronRight } from 'lucide-react';

export const PendingPayments: React.FC = () => {
  const { data: collectionsRes, isLoading } = useQuery({
    queryKey: ['finance-pending-collections'],
    queryFn: () => collectionsApi.getAll({ limit: '50' }),
  });

  const collections = (collectionsRes?.data?.data || []).filter((c: any) =>
    c.quality_inspections?.length > 0 && (!c.farmer_payments || c.farmer_payments.length === 0)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Payment Calculations</h1>
          <p className="page-subtitle">{collections.length} inspected collections awaiting calculation</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : collections.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No pending payments to calculate</p></div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Collection No</th>
                  <th>Farmer</th>
                  <th>Crop</th>
                  <th>Grade</th>
                  <th>Accepted Qty</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c: any) => {
                  const insp = c.quality_inspections[0];
                  return (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.collection_no}</td>
                      <td>{c.farmers?.full_name}</td>
                      <td>{c.crop_categories?.name}</td>
                      <td className="capitalize">{insp.grade?.replace(/_/g, ' ')}</td>
                      <td className="font-medium text-primary-700">{insp.accepted_qty_kg} kg</td>
                      <td className="text-xs text-surface-500">{new Date(c.created_at).toLocaleDateString('en-LK')}</td>
                      <td>
                        <Link to={`/finance/calculate/${c.id}`} className="btn-primary btn-sm">
                          Calculate
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
