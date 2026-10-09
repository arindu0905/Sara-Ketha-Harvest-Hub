import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmersApi } from '../../services/api';
import { ArrowLeft, CheckCircle, XCircle, User, MapPin, Phone, Leaf, Landmark, ShieldCheck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { FarmerDocuments } from '../../components/FarmerDocuments';

export const FarmerVerification: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const { data: farmerRes, isLoading } = useQuery({
    queryKey: ['farmer-detail', id],
    queryFn: () => farmersApi.getById(id!),
    enabled: !!id,
  });

  const farmer = farmerRes?.data?.data;

  const mutation = useMutation({
    mutationFn: (data: { verification_status: string; notes?: string }) => farmersApi.updateStatus(id!, data),
    onSuccess: (_, vars) => {
      toast.success(`Farmer registration status updated to "${vars.verification_status}" successfully`);
      queryClient.invalidateQueries({ queryKey: ['farmer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['officer-farmers-dir'] });
    },
    onError: () => toast.error('Failed to update verification status'),
  });

  if (isLoading) {
    return (
      <div className="card p-8 space-y-4">
        <div className="skeleton h-12 w-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="card py-12 text-center">
        <div className="empty-state max-w-sm mx-auto">
          <User className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-surface-800 mb-1">Farmer Not Found</h3>
          <p className="text-surface-500 text-xs mb-4">The requested farmer record could not be located.</p>
          <button onClick={() => navigate('/officer/farmers')} className="btn-primary btn-sm mx-auto">
            Return to Directory
          </button>
        </div>
      </div>
    );
  }

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between items-center text-sm py-2.5 border-b border-surface-100/80">
      <span className="text-surface-500 font-medium text-xs">{label}</span>
      <span className="font-semibold text-surface-900">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/officer/farmers')}
            className="btn-ghost p-2 rounded-xl text-surface-600 hover:text-surface-900"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShieldCheck className="text-primary-600 w-6 h-6" /> Farmer Registration Verification
            </h1>
            <p className="page-subtitle">Review personal identity, land records, and verify farmer registration</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {farmer.verification_status !== 'verified' && (
            <button
              onClick={() => mutation.mutate({ verification_status: 'verified', notes })}
              disabled={mutation.isPending}
              className="btn-primary btn-sm flex items-center gap-1.5 shadow-md shadow-primary-600/15"
            >
              <CheckCircle size={15} /> Approve & Verify Registration
            </button>
          )}

          {farmer.verification_status !== 'rejected' && (
            <button
              onClick={() => mutation.mutate({ verification_status: 'rejected', notes: notes || 'Rejected by officer' })}
              disabled={mutation.isPending}
              className="btn-danger btn-sm flex items-center gap-1.5"
            >
              <XCircle size={15} /> Reject Registration
            </button>
          )}

          {farmer.verification_status === 'verified' && (
            <button
              onClick={() => mutation.mutate({ verification_status: 'pending', notes: 'Reset to pending review' })}
              disabled={mutation.isPending}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Clock size={15} /> Re-open for Review
            </button>
          )}
        </div>
      </div>

      {/* Verification Status Banner */}
      <div
        className={`p-4 rounded-2xl flex items-center justify-between border ${
          farmer.verification_status === 'verified'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : farmer.verification_status === 'rejected'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {farmer.verification_status === 'verified' ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          ) : farmer.verification_status === 'rejected' ? (
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          ) : (
            <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
          )}
          <div>
            <h4 className="font-bold text-sm capitalize">
              Verification Status: {farmer.verification_status}
            </h4>
            <p className="text-xs opacity-90">
              {farmer.verification_status === 'verified'
                ? `Farmer is officially verified and eligible for produce collection and payouts.`
                : farmer.verification_status === 'rejected'
                ? `Registration rejected. Farmers cannot submit produce until re-verified.`
                : `Farmer registration is pending review by collection centre officer.`}
            </p>
          </div>
        </div>
        {farmer.verified_at && (
          <span className="text-2xs font-semibold px-3 py-1 bg-white/70 rounded-lg shadow-2xs">
            Verified: {new Date(farmer.verified_at).toLocaleDateString('en-LK', { dateStyle: 'medium' })}
          </span>
        )}
      </div>

      {/* Main Farmer Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Identification Details */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-3">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <User size={18} className="text-primary-600" /> Personal Identity Details
            </h3>
          </div>
          <div className="space-y-1">
            <InfoRow label="Full Name" value={farmer.full_name} />
            <InfoRow label="NIC Number" value={farmer.nic_number} />
            <InfoRow label="Farmer Code" value={farmer.farmer_code} />
            <InfoRow label="Phone Number" value={farmer.phone} />
            <InfoRow label="Email Address" value={farmer.email} />
            <InfoRow label="Residential Address" value={farmer.address} />
            <InfoRow label="District" value={farmer.district} />
          </div>
        </div>

        {/* Land & Bank Details */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-3">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <Leaf size={18} className="text-primary-600" /> Farm Land & Bank Payout Details
            </h3>
          </div>
          <div className="space-y-1">
            <InfoRow label="Farm Name" value={farmer.farm_name} />
            <InfoRow label="Farm Location" value={farmer.farm_location} />
            <InfoRow label="Cultivated Size" value={farmer.farm_size_acres ? `${farmer.farm_size_acres} acres` : null} />
            <InfoRow label="Assigned Collection Hub" value={farmer.collection_centres?.name} />
            <div className="py-2" />
            <InfoRow label="Bank Name" value={farmer.bank_name} />
            <InfoRow label="Branch Name" value={farmer.bank_branch} />
            <InfoRow label="Account Holder" value={farmer.account_holder_name} />
            <InfoRow label="Account Number" value={farmer.account_number_masked} />
          </div>
        </div>
      </div>

      {/* Registered Crops List */}
      <FarmerDocuments farmerId={farmer.id} canVerify />

      {farmer.farmer_crops && farmer.farmer_crops.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header p-4 border-b border-surface-100 flex justify-between items-center bg-surface-50">
            <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
              <Leaf size={16} className="text-primary-600" /> Registered Cultivated Crops ({farmer.farmer_crops.length})
            </h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Variety</th>
                  <th>Area (acres)</th>
                  <th>Farming Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {farmer.farmer_crops.map((crop: any) => (
                  <tr key={crop.id}>
                    <td className="font-semibold text-surface-900">{crop.crop_categories?.name || '—'}</td>
                    <td>{crop.crop_varieties?.name || '—'}</td>
                    <td>{crop.cultivated_area_acres ? `${crop.cultivated_area_acres} acres` : '—'}</td>
                    <td className="capitalize">{crop.farming_method?.replace(/_/g, ' ') || 'Standard'}</td>
                    <td>
                      {crop.is_active ? (
                        <span className="badge-success text-xs px-2.5 py-0.5">Active</span>
                      ) : (
                        <span className="badge-neutral text-xs px-2.5 py-0.5">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
