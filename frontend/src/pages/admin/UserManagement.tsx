import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, authApi } from '../../services/api';
import {
  Users, Search, Filter, Shield, CheckCircle, XCircle, Clock,
  RefreshCw, Edit3, ChevronLeft, ChevronRight, Check, Plus, UserX, UserCheck, Trash2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  account_status: 'active' | 'pending' | 'inactive' | 'suspended';
  created_at: string;
  assigned_centre: string | null;
  collection_centres?: { name: string } | null;
}

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'collection_centre_officer', label: 'Collection Officer' },
  { value: 'quality_inspector', label: 'Quality Inspector' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'finance_officer', label: 'Finance Officer' },
  { value: 'transport_coordinator', label: 'Transport Coordinator' },
  { value: 'manager', label: 'Manager (read-only reports)' },
  { value: 'administrator', label: 'Administrator' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const ROLE_BADGE_STYLES: Record<string, string> = {
  administrator: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-rose-100 text-rose-700 border-rose-200',
  finance_officer: 'bg-blue-100 text-blue-700 border-blue-200',
  inventory_manager: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  quality_inspector: 'bg-teal-100 text-teal-700 border-teal-200',
  collection_centre_officer: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  transport_coordinator: 'bg-amber-100 text-amber-700 border-amber-200',
  farmer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  buyer: 'bg-orange-100 text-orange-700 border-orange-200',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

const INITIAL_ADD_USER = {
  full_name: '',
  email: '',
  password: '',
  role: 'farmer',
};

export const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [newStatus, setNewStatus] = useState<string>('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addUserForm, setAddUserForm] = useState(INITIAL_ADD_USER);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const { data: usersResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, statusFilter],
    queryFn: () => adminApi.getUsers({
      page: page.toString(),
      limit: limit.toString(),
      search,
      role: roleFilter,
      status: statusFilter,
    }),
  });

  // ─── Pending Farmer Verification ────────────────────────────────────────────
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifySearch, setVerifySearch] = useState('');

  const { data: pendingFarmersRes, refetch: refetchPending } = useQuery({
    queryKey: ['admin-pending-farmers', verifySearch],
    queryFn: () => adminApi.getPendingFarmers({ search: verifySearch }),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const pendingFarmers: any[] = pendingFarmersRes?.data?.data || [];
  const pendingCount = pendingFarmersRes?.data?.meta?.total || pendingFarmers.length;

  const verifyFarmerMutation = useMutation({
    mutationFn: ({ farmerId, status, notes }: { farmerId: string; status: 'verified' | 'rejected'; notes?: string }) =>
      adminApi.verifyFarmer(farmerId, { verification_status: status, notes }),
    onSuccess: (_, vars) => {
      toast.success(`Farmer account ${vars.status === 'verified' ? 'approved & verified' : 'rejected'} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-pending-farmers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update farmer verification status');
    },
  });
  // ─────────────────────────────────────────────────────────────────────────────

  const users: UserProfile[] = usersResponse?.data?.data || [];
  const pagination = usersResponse?.data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.updateRole(id, role),
    onSuccess: () => {
      toast.success('User role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update user role');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, account_status }: { id: string; account_status: string }) => adminApi.updateStatus(id, account_status),
    onSuccess: () => {
      toast.success('User account status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof INITIAL_ADD_USER) => adminApi.createUser(data),
    onSuccess: () => {
      toast.success('New user registered successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddModal(false);
      setAddUserForm(INITIAL_ADD_USER);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: (res: any) => {
      const body = res?.data;
      if (body?.data?.deactivated) toast(body.message, { icon: 'ℹ️', duration: 7000 });
      else toast.success(body?.message || 'User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete user — they may have associated records');
      setUserToDelete(null);
    },
  });

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setNewStatus(user.account_status);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    if (newRole !== selectedUser.role) {
      await updateRoleMutation.mutateAsync({ id: selectedUser.id, role: newRole });
    }
    if (newStatus !== selectedUser.account_status) {
      await updateStatusMutation.mutateAsync({ id: selectedUser.id, account_status: newStatus });
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserForm.full_name.trim()) return toast.error('Full name is required');
    if (!addUserForm.email.trim()) return toast.error('Email is required');
    if (!addUserForm.password || addUserForm.password.length < 6) return toast.error('Password must be at least 6 characters');
    createUserMutation.mutate(addUserForm);
  };

  const handleToggleSuspend = (user: UserProfile) => {
    const targetStatus = user.account_status === 'suspended' ? 'active' : 'suspended';
    updateStatusMutation.mutate({ id: user.id, account_status: targetStatus });
  };

  const formatRoleLabel = (roleKey: string) => {
    const found = ROLE_OPTIONS.find(r => r.value === roleKey);
    return found ? found.label : roleKey.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="text-primary-600" size={28} /> {t('users')}
          </h1>
          <p className="page-subtitle">{t('user_management_subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            {t('refresh')}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            {t('add_user')}
          </button>
        </div>
      </div>

      {/* ─── Pending Farmer Verifications Panel ─────────────────────────────── */}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-amber-100/60 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={20} className="text-amber-700" />
              <h2 className="font-bold text-amber-900 text-sm">Pending Farmer Account Verifications</h2>
              <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
                <input
                  className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-amber-300 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400 w-44"
                  placeholder="Search farmers..."
                  value={verifySearch}
                  onChange={e => setVerifySearch(e.target.value)}
                />
              </div>
              <button onClick={() => refetchPending()} className="btn-ghost p-1.5 rounded-lg text-amber-700 hover:bg-amber-200">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-amber-100">
            {pendingFarmers.length === 0 ? (
              <div className="py-6 text-center text-amber-600 text-sm">No pending farmers match your search.</div>
            ) : (
              pendingFarmers.map((farmer: any) => (
                <div key={farmer.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 bg-white/50 hover:bg-white/80 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                      {farmer.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 text-sm truncate">{farmer.full_name}</p>
                      <p className="text-xs text-surface-500">{farmer.farmer_code} · {farmer.district} · {farmer.phone || farmer.email || '—'}</p>
                      <p className="text-xs text-surface-400">Registered: {new Date(farmer.created_at).toLocaleDateString('en-LK', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      className="form-input text-xs py-1.5 w-40"
                      onChange={e => setVerifyNotes(e.target.value)}
                    />
                    <button
                      onClick={() => verifyFarmerMutation.mutate({ farmerId: farmer.id, status: 'verified', notes: verifyNotes || undefined })}
                      disabled={verifyFarmerMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => verifyFarmerMutation.mutate({ farmerId: farmer.id, status: 'rejected', notes: verifyNotes || 'Rejected by administrator' })}
                      disabled={verifyFarmerMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
          <input
            type="text"
            placeholder={t('quick_search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="form-input pl-10 w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-surface-400" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="form-select text-sm py-2"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-select text-sm py-2"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-surface-500">
            <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
            Loading user accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto text-surface-300 mb-3" size={48} />
            <h3 className="text-lg font-semibold text-surface-700 mb-1">{t('no_users_found')}</h3>
            <button onClick={() => setShowAddModal(true)} className="btn-primary btn-sm inline-flex items-center gap-2 mt-2">
              <Plus size={14} /> {t('add_user')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                  <th className="py-3 px-4">{t('user')}</th>
                  <th className="py-3 px-4">{t('role')}</th>
                  <th className="py-3 px-4">{t('status')}</th>
                  <th className="py-3 px-4">{t('centre')}</th>
                  <th className="py-3 px-4">{t('registered')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm shrink-0">
                          {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-900">{u.full_name || 'Unnamed User'}</div>
                          <div className="text-xs text-surface-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE_STYLES[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {formatRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_STYLES[u.account_status] || 'bg-gray-100 text-gray-700'}`}>
                        {u.account_status === 'active' && <CheckCircle size={12} />}
                        {u.account_status === 'pending' && <Clock size={12} />}
                        {u.account_status === 'suspended' && <XCircle size={12} />}
                        <span className="capitalize">{t(u.account_status) || u.account_status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-surface-600">
                      {u.collection_centres?.name || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-surface-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                        >
                          <Edit3 size={13} /> {t('edit')}
                        </button>
                        <button
                          onClick={() => handleToggleSuspend(u)}
                          title={u.account_status === 'suspended' ? 'Reactivate User' : 'Suspend User'}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            u.account_status === 'suspended'
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {u.account_status === 'suspended' ? <UserCheck size={14} /> : <UserX size={14} />}
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          title="Delete User"
                          className="p-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-surface-100 flex items-center justify-between">
            <div className="text-xs text-surface-500">
              Showing page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.totalPages}</span> ({pagination.total} total users)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add User Modal ────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddUserForm(INITIAL_ADD_USER); }}
        title={t('add_user')}
        subtitle="Register a user profile with assigned role and credentials"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addUserForm.full_name}
              onChange={(e) => setAddUserForm({ ...addUserForm, full_name: e.target.value })}
              placeholder="e.g. Sunil Jayasinghe"
              className="input w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={addUserForm.email}
              onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
              placeholder="e.g. sunil@harvesthub.lk"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={addUserForm.password}
              onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Assign System Role <span className="text-red-500">*</span>
            </label>
            <select
              value={addUserForm.role}
              onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
              className="input w-full"
            >
              {ROLE_OPTIONS.filter(r => r.value !== '').map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setAddUserForm(INITIAL_ADD_USER); }}
              className="btn-secondary"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {createUserMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  {t('create')}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Role & Status Modal */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`${t('edit')} ${selectedUser.full_name}`}
          subtitle={`Update role and status for ${selectedUser.full_name}`}
        >
          <div className="space-y-4">
            <div className="bg-surface-50 rounded-xl p-3 text-sm">
              <div className="font-semibold text-surface-900">{selectedUser.full_name}</div>
              <div className="text-xs text-surface-500">{selectedUser.email}</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">{t('role')}</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="input w-full"
              >
                {ROLE_OPTIONS.filter(r => r.value !== '').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">{t('status')}</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="input w-full"
              >
                <option value="active">{t('active')}</option>
                <option value="pending">{t('pending')}</option>
                <option value="inactive">{t('inactive')}</option>
                <option value="suspended">{t('suspended')}</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="btn-secondary"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={updateRoleMutation.isPending || updateStatusMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {(updateRoleMutation.isPending || updateStatusMutation.isPending) ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* ─── Delete Confirmation Modal ─────────────────────── */}
      {userToDelete && (
        <Modal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          title="Delete User Account"
          subtitle={`Permanently delete ${userToDelete.full_name}'s account`}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">This action is permanent and cannot be undone</p>
                <p className="text-xs text-red-600 mt-1">Accounts with no activity are removed completely. If this user already has records (collections, payments, orders), the account is deactivated and blocked from signing in instead, so the records stay intact.</p>
              </div>
            </div>

            <div className="bg-surface-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-sm shrink-0">
                {userToDelete.full_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-surface-900 text-sm">{userToDelete.full_name}</div>
                <div className="text-xs text-surface-500">{userToDelete.email}</div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${ROLE_BADGE_STYLES[userToDelete.role] || 'bg-gray-100 text-gray-700'}`}>
                  {formatRoleLabel(userToDelete.role)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
                className="btn flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm"
              >
                {deleteUserMutation.isPending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 size={14} /> Delete User</>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
