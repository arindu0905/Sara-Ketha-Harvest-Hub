import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farmersApi } from '../../services/api';
import { ArrowLeft, CheckCircle, XCircle, User, MapPin, Phone, Leaf, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';

export const FarmerVerification: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: farmerRes, isLoading } = useQuery({
    queryKey: ['farmer-detail', id],
    queryFn: () => farmersApi.getById(id!),
    enabled: !!id,
  });

  const farmer = farmerRes?.data?.data;

  const mutation = useMutation({
    mutationFn: (data: { verification_status: string; notes?: string }) => farmersApi.updateStatus(id!, data),
    onSuccess: (_, vars) => {
      toast.success(`Farmer ${vars.verification_status === 'verified' ? 'verified' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['farmer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['officer-farmers-dir'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) return <div className="card p-8"><div className="skeleton h-64 rounded-xl" /></div>;
  if (!farmer) return <div className="card"><div className="empty-state"><p>Farmer not found</p></div></div>;

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between text-sm py-2 border-b border-surface-50">
      <span className="text-surface-500">{label}</span>
      <span className="font-medium text-surface-800">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">Farmer Verification</h1>
            <p className="page-subtitle">Review and verify farmer details</p>
          </div>
        </div>
        {farmer.verification_status !== 'verified' && (
          <div className="flex gap-2">
            <button onClick={() => mutation.mutate({ verification_status: 'rejected', notes: 'Rejected by officer' })} disabled={mutation.isPending} className="btn-danger btn-sm"><XCircle size={14} /> Reject</button>
            <button onClick={() => mutation.mutate({ verification_status: 'verified' })} disabled={mutation.isPending} className="btn-primary btn-sm"><CheckCircle size={14} /> Verify</button>
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div className={`alert ${farmer.verification_status === 'verified' ? 'alert-success' : farmer.verification_status === 'rejected' ? 'alert-error' : 'alert-warning'}`}>
        <span className="font-medium capitalize">Status: {farmer.verification_status}</span>
        {farmer.verified_at && <span className="text-xs ml-2">· Verified on {new Date(farmer.verified_at).toLocaleDateString('en-LK')}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><User size={16} /> Personal Details</h3></div>
          <div className="card-body">
            <InfoRow label="Full Name" value={farmer.full_name} />
            <InfoRow label="NIC Number" value={farmer.nic_number} />
            <InfoRow label="Farmer Code" value={farmer.farmer_code} />
            <InfoRow label="Phone" value={farmer.phone} />
            <InfoRow label="Email" value={farmer.email} />
            <InfoRow label="Address" value={farmer.address} />
            <InfoRow label="District" value={farmer.district} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold flex items-center gap-2"><Leaf size={16} /> Farm & Bank</h3></div>
          <div className="card-body">
            <InfoRow label="Farm Name" value={farmer.farm_name} />
            <InfoRow label="Farm Location" value={farmer.farm_location} />
            <InfoRow label="Farm Size" value={farmer.farm_size_acres ? `${farmer.farm_size_acres} acres` : null} />
            <InfoRow label="Centre" value={farmer.collection_centres?.name} />
            <div className="divider" />
            <InfoRow label="Bank Name" value={farmer.bank_name} />
            <InfoRow label="Branch" value={farmer.bank_branch} />
            <InfoRow label="Account Holder" value={farmer.account_holder_name} />
            <InfoRow label="Account No" value={farmer.account_number_masked} />
          </div>
        </div>
      </div>

      {farmer.farmer_crops?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold">Registered Crops ({farmer.farmer_crops.length})</h3></div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Category</th><th>Variety</th><th>Area</th><th>Method</th></tr></thead>
              <tbody>
                {farmer.farmer_crops.map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.crop_categories?.name}</td>
                    <td>{c.crop_varieties?.name || '—'}</td>
                    <td>{c.cultivated_area_acres ? `${c.cultivated_area_acres} ac` : '—'}</td>
                    <td className="capitalize">{c.farming_method?.replace(/_/g, ' ')}</td>
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
