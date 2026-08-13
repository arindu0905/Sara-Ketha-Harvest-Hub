import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { farmersApi } from '../../services/api';
import { User, Phone, MapPin, Leaf, Landmark, Shield, Edit2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const FarmerProfile: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: farmerRes, isLoading } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      const farmer = res.data?.data;
      if (farmer?.id) {
        const detail = await farmersApi.getById(farmer.id);
        return detail.data?.data;
      }
      return farmer || null;
    },
  });

  const farmer = farmerRes;

  const [form, setForm] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (farmer) {
      setForm({
        phone: farmer.phone || '',
        address: farmer.address || '',
        farm_name: farmer.farm_name || '',
        farm_location: farmer.farm_location || '',
        farm_size_acres: farmer.farm_size_acres?.toString() || '',
        emergency_contact_name: farmer.emergency_contact_name || '',
        emergency_contact_phone: farmer.emergency_contact_phone || '',
      });
    }
  }, [farmer]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => farmersApi.update(farmer.id, data),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['farmer-me'] });
      setEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleSave = () => {
    updateMutation.mutate({
      phone: form.phone,
      address: form.address,
      farm_name: form.farm_name,
      farm_location: form.farm_location,
      farm_size_acres: form.farm_size_acres ? parseFloat(form.farm_size_acres) : null,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    });
  };

  const verificationBadge = (status: string) => {
    switch (status) {
      case 'verified': return <span className="badge-success"><CheckCircle size={12} /> Verified</span>;
      case 'pending': return <span className="badge-warning">Pending Verification</span>;
      case 'rejected': return <span className="badge-danger">Rejected</span>;
      default: return <span className="badge-neutral">Unverified</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header"><h1 className="page-title">My Profile</h1></div>
        <div className="card p-8"><div className="flex justify-center"><div className="skeleton h-8 w-48 rounded" /></div></div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header"><h1 className="page-title">My Profile</h1></div>
        <div className="card">
          <div className="empty-state">
            <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold text-surface-700 mb-2">Farmer Record Not Found</h3>
            <p className="text-surface-400 text-sm max-w-sm">Your farmer record has not been created yet. Please contact a collection centre officer to register your farmer profile.</p>
          </div>
        </div>
      </div>
    );
  }

  const InfoField = ({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-3">
      {icon && <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center flex-shrink-0 text-surface-500 mt-0.5">{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-surface-800 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">View and manage your farmer profile</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm"><Edit2 size={14} /> Edit Profile</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary btn-sm"><X size={14} /> Cancel</button>
            <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary btn-sm"><Save size={14} /> Save</button>
          </div>
        )}
      </div>

      {/* Account Card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900">{farmer.full_name}</h2>
            <p className="text-sm text-surface-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge-info text-xs">{farmer.farmer_code}</span>
              {verificationBadge(farmer.verification_status)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><User size={16} /> Personal Information</h3>
          </div>
          <div className="card-body space-y-1">
            <InfoField label="Full Name" value={farmer.full_name} />
            <InfoField label="NIC Number" value={farmer.nic_number} />
            {editing ? (
              <>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <textarea className="form-input" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <InfoField label="Phone" value={farmer.phone} icon={<Phone size={16} />} />
                <InfoField label="Address" value={farmer.address} icon={<MapPin size={16} />} />
                <InfoField label="District" value={farmer.district} />
              </>
            )}
          </div>
        </div>

        {/* Farm Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Leaf size={16} /> Farm Details</h3>
          </div>
          <div className="card-body space-y-1">
            {editing ? (
              <>
                <div>
                  <label className="form-label">Farm Name</label>
                  <input className="form-input" value={form.farm_name} onChange={e => setForm({...form, farm_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Farm Location</label>
                  <input className="form-input" value={form.farm_location} onChange={e => setForm({...form, farm_location: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Farm Size (acres)</label>
                  <input className="form-input" type="number" step="0.01" value={form.farm_size_acres} onChange={e => setForm({...form, farm_size_acres: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <InfoField label="Farm Name" value={farmer.farm_name} />
                <InfoField label="Farm Location" value={farmer.farm_location} />
                <InfoField label="Farm Size" value={farmer.farm_size_acres ? `${farmer.farm_size_acres} acres` : null} />
                <InfoField label="Assigned Centre" value={farmer.collection_centres?.name} />
              </>
            )}
          </div>
        </div>

        {/* Bank Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Landmark size={16} /> Bank Details</h3>
          </div>
          <div className="card-body space-y-1">
            <InfoField label="Bank Name" value={farmer.bank_name} />
            <InfoField label="Branch" value={farmer.bank_branch} />
            <InfoField label="Account Holder" value={farmer.account_holder_name} />
            <InfoField label="Account Number" value={farmer.account_number_masked} />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Shield size={16} /> Emergency Contact</h3>
          </div>
          <div className="card-body space-y-1">
            {editing ? (
              <>
                <div>
                  <label className="form-label">Contact Name</label>
                  <input className="form-input" value={form.emergency_contact_name} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Contact Phone</label>
                  <input className="form-input" value={form.emergency_contact_phone} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <InfoField label="Contact Name" value={farmer.emergency_contact_name} />
                <InfoField label="Contact Phone" value={farmer.emergency_contact_phone} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Crops Summary */}
      {farmer.farmer_crops && farmer.farmer_crops.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-surface-800">Registered Crops</h3>
            <span className="badge-info text-xs">{farmer.farmer_crops.length} crops</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Variety</th>
                  <th>Area</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {farmer.farmer_crops.map((crop: any) => (
                  <tr key={crop.id}>
                    <td className="font-medium">{crop.crop_categories?.name || '—'}</td>
                    <td>{crop.crop_varieties?.name || '—'}</td>
                    <td>{crop.cultivated_area_acres ? `${crop.cultivated_area_acres} ac` : '—'}</td>
                    <td className="capitalize">{crop.farming_method?.replace(/_/g, ' ') || '—'}</td>
                    <td>{crop.is_active ? <span className="badge-success">Active</span> : <span className="badge-neutral">Inactive</span>}</td>
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
