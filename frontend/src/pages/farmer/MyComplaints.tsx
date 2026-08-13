import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { complaintsApi } from '../../services/api';
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export const MyComplaints: React.FC = () => {
  const { data: complaintsRes, isLoading } = useQuery({
    queryKey: ['farmer-complaints'],
    queryFn: () => complaintsApi.getAll({}),
  });

  const complaints = complaintsRes?.data?.data || [];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <span className="badge-info"><Clock size={12} /> Submitted</span>;
      case 'under_review': return <span className="badge-warning">Under Review</span>;
      case 'in_progress': return <span className="badge-info">In Progress</span>;
      case 'resolved': return <span className="badge-success"><CheckCircle size={12} /> Resolved</span>;
      case 'rejected': return <span className="badge-danger">Rejected</span>;
      case 'closed': return <span className="badge-neutral">Closed</span>;
      default: return <span className="badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Complaints</h1>
          <p className="page-subtitle">Track and manage your complaints</p>
        </div>
        <Link to="/farmer/complaints/submit" className="btn-primary btn-sm">
          <Plus size={14} /> Submit Complaint
        </Link>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : complaints.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">No Complaints</h3>
            <p className="text-surface-400 text-sm max-w-sm mb-4">You haven't submitted any complaints yet.</p>
            <Link to="/farmer/complaints/submit" className="btn-primary btn-sm"><Plus size={14} /> Submit Complaint</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c: any) => (
            <div key={c.id} className="card p-5 hover:shadow-card-hover transition-all duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-surface-900">{c.complaint_no}</p>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm font-medium text-surface-700">{c.subject}</p>
                  <p className="text-xs text-surface-500 mt-1 capitalize">{c.category?.replace(/_/g, ' ')}</p>
                  {c.description && (
                    <p className="text-xs text-surface-400 mt-2 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <span className="text-xs text-surface-400">{new Date(c.created_at).toLocaleDateString('en-LK')}</span>
              </div>
              {c.resolution && (
                <div className="mt-3 pt-3 border-t border-surface-100">
                  <p className="text-xs text-surface-500"><span className="font-medium text-surface-700">Resolution:</span> {c.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
