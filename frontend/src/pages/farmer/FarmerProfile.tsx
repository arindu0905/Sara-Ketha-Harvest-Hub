import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { farmersApi } from '../../services/api';
import { User, Phone, MapPin, Leaf, Landmark, Shield, Edit2, Save, X, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { FarmerDocuments } from '../../components/FarmerDocuments';

// ─── Sri Lankan Validators ────────────────────────────────────────────────────
const validatePhone = (value: string): string | null => {
  if (!value) return null; // optional field
  if (!/^0\d{9}$/.test(value))
    return 'Phone must be exactly 10 digits starting with 0 (e.g. 0771234567)';
  return null;
};

const validateNIC = (value: string): string | null => {
  if (!value) return null; // optional field
  if (!/^(\d{9}[VvXx]|\d{12})$/.test(value))
    return 'Old NIC: 9 digits + V or X (e.g. 781234567V) · New NIC: 12 digits (e.g. 198012345678)';
  return null;
};

export const FarmerProfile: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

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
  // Self-registered farmers have a generated placeholder NIC. They can enter the real one once; afterwards an officer must change it.
  const nicIsPlaceholder = /^NIC-[0-9A-F]{8}$/i.test(farmer?.nic_number || '');

  React.useEffect(() => {
    if (farmer) {
      setForm({
        full_name: farmer.full_name || '',
        nic_number: nicIsPlaceholder ? '' : (farmer.nic_number || ''),
        phone: farmer.phone || '',
        address: farmer.address || '',
        district: farmer.district || '',
        farm_name: farmer.farm_name || '',
        farm_location: farmer.farm_location || '',
        farm_size_acres: farmer.farm_size_acres?.toString() || '',
        bank_name: farmer.bank_name || '',
        bank_branch: farmer.bank_branch || '',
        account_holder_name: farmer.account_holder_name || '',
        account_number: '', // never pre-filled: the full number is not stored, only ****1234
        emergency_contact_name: farmer.emergency_contact_name || '',
        emergency_contact_phone: farmer.emergency_contact_phone || '',
      });
      setFieldErrors({});
    }
  }, [farmer]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => farmersApi.update(farmer.id, data),
    onSuccess: () => {
      toast.success('Profile updated successfully ✓');
      queryClient.invalidateQueries({ queryKey: ['farmer-me'] });
      setEditing(false);
      setFieldErrors({});
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update profile';
      toast.error(msg);
    },
  });

  // Live field change with instant validation
  const handleFieldChange = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'phone') setFieldErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    if (field === 'nic_number') setFieldErrors(prev => ({ ...prev, nic_number: validateNIC(value) }));
  }, []);

  const hasValidationErrors = Object.values(fieldErrors).some(e => e !== null && e !== undefined);

  const handleSave = () => {
    // Run all validations before submitting
    const phoneErr = validatePhone(form.phone);
    const nicErr = validateNIC(form.nic_number);
    const emergencyErr = validatePhone(form.emergency_contact_phone);
    if (form.account_number && !/^[0-9]{6,20}$/.test(form.account_number)) {
      toast.error('Account number must be 6 to 20 digits');
      return;
    }
    if (phoneErr || nicErr || emergencyErr) {
      setFieldErrors(prev => ({ ...prev, phone: phoneErr, nic_number: nicErr, emergency_contact_phone: emergencyErr }));
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    updateMutation.mutate({
      full_name: form.full_name,
      ...(form.nic_number ? { nic_number: form.nic_number } : {}),
      phone: form.phone,
      address: form.address,
      district: form.district,
      farm_name: form.farm_name,
      farm_location: form.farm_location,
      farm_size_acres: form.farm_size_acres ? parseFloat(form.farm_size_acres) : null,
      bank_name: form.bank_name,
      bank_branch: form.bank_branch,
      account_holder_name: form.account_holder_name,
      ...(form.account_number ? { account_number: form.account_number } : {}),
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
    });
  };

  const verificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="badge-success text-xs font-semibold px-2.5 py-1"><CheckCircle size={12} /> Verified Farmer</span>;
      case 'pending':
        return <span className="badge-warning text-xs font-semibold px-2.5 py-1">Pending Verification</span>;
      case 'rejected':
        return <span className="badge-danger text-xs font-semibold px-2.5 py-1">Rejected</span>;
      default:
        return <span className="badge-neutral text-xs font-semibold px-2.5 py-1">Unverified</span>;
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
        <p className="text-sm font-semibold text-surface-800 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <User className="text-primary-600 w-6 h-6" /> My Profile
          </h1>
          <p className="page-subtitle">Digitally view and maintain your farmer profile, land records, and bank payout details</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-primary btn-sm flex items-center gap-1.5 shadow-md">
            <Edit2 size={14} /> Edit Profile
          </button>
        ) : (
        <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setFieldErrors({}); }} className="btn-secondary btn-sm flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || hasValidationErrors}
              className="btn-primary btn-sm flex items-center gap-1 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </div>

      {/* Account Header Card */}
      <div className="card p-6 border-l-4 border-l-primary-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-black shadow-inner">
              {user?.full_name?.charAt(0).toUpperCase() || 'F'}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-surface-900">{farmer.full_name}</h2>
              <p className="text-xs text-surface-500 font-medium">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="badge-info text-xs font-mono font-bold px-2 py-0.5">{farmer.farmer_code}</span>
                {verificationBadge(farmer.verification_status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-4">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <User size={18} className="text-primary-600" /> Personal Information
            </h3>
          </div>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="form-label text-xs font-semibold">Full Name</label>
                  <input className="form-input text-xs py-2" value={form.full_name} onChange={e => handleFieldChange('full_name', e.target.value)} />
                </div>

                {/* NIC with live validation */}
                <div>
                  <label className="form-label text-xs font-semibold">NIC / Identification</label>
                  {(<>
                  <input
                    className={`form-input text-xs py-2 font-mono ${
                      fieldErrors.nic_number ? 'border-red-400 focus:ring-red-400 bg-red-50' :
                      form.nic_number && !fieldErrors.nic_number ? 'border-green-400 bg-green-50' : ''
                    }`}
                    value={form.nic_number}
                    onChange={e => handleFieldChange('nic_number', e.target.value.trim())}
                    placeholder="e.g. 781234567V or 199812345678"
                    maxLength={12}
                  />
                  {fieldErrors.nic_number ? (
                    <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" />{fieldErrors.nic_number}
                    </p>
                  ) : form.nic_number && !fieldErrors.nic_number ? (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={11} /> Valid NIC format
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-surface-400">Old: 9 digits + V/X &nbsp;|&nbsp; New: 12 digits</p>
                  )}
                  </>)}
                </div>

                {/* Phone with live validation */}
                <div>
                  <label className="form-label text-xs font-semibold">Phone Number</label>
                  <input
                    className={`form-input text-xs py-2 font-mono ${
                      fieldErrors.phone ? 'border-red-400 focus:ring-red-400 bg-red-50' :
                      form.phone && !fieldErrors.phone ? 'border-green-400 bg-green-50' : ''
                    }`}
                    value={form.phone}
                    onChange={e => handleFieldChange('phone', e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 0771234567"
                    maxLength={10}
                    type="tel"
                  />
                  {fieldErrors.phone ? (
                    <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" />{fieldErrors.phone}
                    </p>
                  ) : form.phone && !fieldErrors.phone ? (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle size={11} /> Valid phone number
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-surface-400">Must be exactly 10 digits starting with 0</p>
                  )}
                </div>

                <div>
                  <label className="form-label text-xs font-semibold">Address</label>
                  <textarea className="form-input text-xs py-2" rows={2} value={form.address} onChange={e => handleFieldChange('address', e.target.value)} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">District</label>
                  <input className="form-input text-xs py-2" value={form.district} onChange={e => handleFieldChange('district', e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <InfoField label="Full Name" value={farmer.full_name} />
                <InfoField label="NIC / Identification" value={nicIsPlaceholder ? 'Not provided yet – add it via Edit' : farmer.nic_number} />
                <InfoField label="Phone" value={farmer.phone} icon={<Phone size={16} />} />
                <InfoField label="Address" value={farmer.address} icon={<MapPin size={16} />} />
                <InfoField label="District" value={farmer.district} />
              </>
            )}
          </div>
        </div>

        {/* Farm Details */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-4">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <Leaf size={18} className="text-primary-600" /> Farm Details
            </h3>
          </div>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="form-label text-xs font-semibold">Farm Name</label>
                  <input className="form-input text-xs py-2" value={form.farm_name} onChange={e => setForm({...form, farm_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">Farm Location</label>
                  <input className="form-input text-xs py-2" value={form.farm_location} onChange={e => setForm({...form, farm_location: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">Farm Size (acres)</label>
                  <input className="form-input text-xs py-2" type="number" step="0.01" value={form.farm_size_acres} onChange={e => setForm({...form, farm_size_acres: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <InfoField label="Farm Name" value={farmer.farm_name} />
                <InfoField label="Farm Location" value={farmer.farm_location} />
                <InfoField label="Farm Size" value={farmer.farm_size_acres ? `${farmer.farm_size_acres} acres` : null} />
                <InfoField label="Assigned Collection Hub" value={farmer.collection_centres?.name || 'Central Agricultural Hub'} />
              </>
            )}
          </div>
        </div>

        {/* Bank Details */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-4">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <Landmark size={18} className="text-primary-600" /> Bank Payout Details
            </h3>
          </div>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="form-label text-xs font-semibold">Bank Name</label>
                  <input className="form-input text-xs py-2" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">Branch Name</label>
                  <input className="form-input text-xs py-2" value={form.bank_branch} onChange={e => setForm({...form, bank_branch: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">Account Holder Name</label>
                  <input className="form-input text-xs py-2" value={form.account_holder_name} onChange={e => setForm({...form, account_holder_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">New Account Number</label>
                  <input className="form-input text-xs py-2 font-mono" inputMode="numeric" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value.replace(/[^0-9]/g, '')})} />
                  <p className="text-2xs text-surface-400 mt-1">Current: {farmer.account_number_masked || 'none'}. Leave blank to keep it. 6–20 digits.</p>
                </div>
              </>
            ) : (
              <>
                <InfoField label="Bank Name" value={farmer.bank_name} />
                <InfoField label="Branch" value={farmer.bank_branch} />
                <InfoField label="Account Holder" value={farmer.account_holder_name} />
                <InfoField label="Account Number" value={farmer.account_number_masked} />
              </>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="card p-6">
          <div className="card-header border-b border-surface-100 pb-3 mb-4">
            <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
              <Shield size={18} className="text-primary-600" /> Emergency Contact
            </h3>
          </div>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="form-label text-xs font-semibold">Contact Name</label>
                  <input className="form-input text-xs py-2" value={form.emergency_contact_name} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold">Contact Phone</label>
                  <input className="form-input text-xs py-2" value={form.emergency_contact_phone} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} />
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

      {farmer.id && <FarmerDocuments farmerId={farmer.id} />}

      {/* Crops Summary */}
      {farmer.farmer_crops && farmer.farmer_crops.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header p-4 border-b border-surface-100 flex justify-between items-center">
            <h3 className="text-base font-bold text-surface-900">Registered Crops</h3>
            <span className="badge-info text-xs font-semibold px-2.5 py-0.5">{farmer.farmer_crops.length} crops</span>
          </div>
          <div className="table-container">
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
                    <td className="font-semibold text-surface-900">{crop.crop_categories?.name || '—'}</td>
                    <td>{crop.crop_varieties?.name || '—'}</td>
                    <td>{crop.cultivated_area_acres ? `${crop.cultivated_area_acres} acres` : '—'}</td>
                    <td className="capitalize">{crop.farming_method?.replace(/_/g, ' ') || '—'}</td>
                    <td>
                      {crop.is_active ? (
                        <span className="badge-success text-xs px-2 py-0.5">Active</span>
                      ) : (
                        <span className="badge-neutral text-xs px-2 py-0.5">Inactive</span>
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
