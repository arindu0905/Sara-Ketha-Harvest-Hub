import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi, adminApi } from '../../services/api';
import {
  Truck, User, Plus, Edit3, Trash2, CheckCircle, XCircle,
  Search, RefreshCw, Shield, Phone, AlertCircle, Award
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

interface Vehicle {
  id: string;
  centre_id: string | null;
  plate_number: string;
  vehicle_type: string;
  capacity_kg: number | null;
  is_active: boolean;
  created_at: string;
  collection_centres?: { name: string; district: string } | null;
}

interface Driver {
  id: string;
  centre_id: string | null;
  full_name: string;
  nic_number: string;
  phone: string;
  license_no: string;
  is_active: boolean;
  created_at: string;
  collection_centres?: { name: string; district: string } | null;
}

const VEHICLE_TYPES = [
  { value: 'truck', label: 'Heavy Truck (5T - 10T)' },
  { value: 'refrigerated', label: 'Refrigerated Cold Truck' },
  { value: 'van', label: 'Delivery Van (2T - 3T)' },
  { value: 'pickup', label: 'Pick-up Truck (1.5T)' },
];

const INITIAL_VEHICLE_FORM = {
  plate_number: '',
  vehicle_type: 'truck',
  capacity_kg: '5000',
  centre_id: '',
  is_active: true,
};

const INITIAL_DRIVER_FORM = {
  full_name: '',
  nic_number: '',
  phone: '',
  license_no: '',
  centre_id: '',
  is_active: true,
};

export const VehiclesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [search, setSearch] = useState('');

  // Vehicle Modals
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(INITIAL_VEHICLE_FORM);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  // Driver Modals
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState(INITIAL_DRIVER_FORM);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  // Queries
  const { data: vehiclesRes, isLoading: loadingVehicles, refetch: refetchVehicles } = useQuery({
    queryKey: ['transport-vehicles-crud'],
    queryFn: () => deliveriesApi.getVehicles(),
  });

  const { data: driversRes, isLoading: loadingDrivers, refetch: refetchDrivers } = useQuery({
    queryKey: ['transport-drivers-crud'],
    queryFn: () => deliveriesApi.getDrivers(),
  });

  const { data: centresRes } = useQuery({
    queryKey: ['transport-centres-list'],
    queryFn: () => adminApi.getCentres(),
  });

  const vehicles: Vehicle[] = vehiclesRes?.data?.data || [];
  const drivers: Driver[] = driversRes?.data?.data || [];
  const centres = centresRes?.data?.data || [];

  // Vehicle Mutations
  const createVehicleMutation = useMutation({
    mutationFn: (data: typeof INITIAL_VEHICLE_FORM) => deliveriesApi.createVehicle(data),
    onSuccess: () => {
      toast.success('Vehicle registered successfully!');
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-list'] });
      setShowAddVehicleModal(false);
      setVehicleForm(INITIAL_VEHICLE_FORM);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add vehicle'),
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => deliveriesApi.updateVehicle(id, data),
    onSuccess: () => {
      toast.success('Vehicle updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-list'] });
      setEditingVehicle(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update vehicle'),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: string) => deliveriesApi.deleteVehicle(id),
    onSuccess: () => {
      toast.success('Vehicle deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-vehicles-list'] });
      setVehicleToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Cannot delete vehicle assigned to deliveries');
      setVehicleToDelete(null);
    },
  });

  // Driver Mutations
  const createDriverMutation = useMutation({
    mutationFn: (data: typeof INITIAL_DRIVER_FORM) => deliveriesApi.createDriver(data),
    onSuccess: () => {
      toast.success('Driver registered successfully!');
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-list'] });
      setShowAddDriverModal(false);
      setDriverForm(INITIAL_DRIVER_FORM);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add driver'),
  });

  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => deliveriesApi.updateDriver(id, data),
    onSuccess: () => {
      toast.success('Driver details updated!');
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-list'] });
      setEditingDriver(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update driver'),
  });

  const deleteDriverMutation = useMutation({
    mutationFn: (id: string) => deliveriesApi.deleteDriver(id),
    onSuccess: () => {
      toast.success('Driver deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-crud'] });
      queryClient.invalidateQueries({ queryKey: ['transport-drivers-list'] });
      setDriverToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Cannot delete driver assigned to deliveries');
      setDriverToDelete(null);
    },
  });

  // Filtered lists
  const filteredVehicles = vehicles.filter(v =>
    v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
    v.vehicle_type.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.nic_number.toLowerCase().includes(search.toLowerCase()) ||
    d.license_no.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck className="text-primary-600" size={28} />
            Fleet & Drivers Management
          </h1>
          <p className="page-subtitle">Manage transport assets, delivery vehicles, and registered drivers</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchVehicles(); refetchDrivers(); }}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          {activeTab === 'vehicles' ? (
            <button
              onClick={() => { setVehicleForm(INITIAL_VEHICLE_FORM); setShowAddVehicleModal(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Add Vehicle
            </button>
          ) : (
            <button
              onClick={() => { setDriverForm(INITIAL_DRIVER_FORM); setShowAddDriverModal(true); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Register Driver
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-surface-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'vehicles'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <Truck size={16} />
            Fleet Vehicles ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'drivers'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-surface-600 hover:text-surface-900'
            }`}
          >
            <User size={16} />
            Drivers ({drivers.length})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
          <input
            type="text"
            placeholder={activeTab === 'vehicles' ? 'Search by plate number, type...' : 'Search by name, NIC, license, phone...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>
      </div>

      {/* ─── Vehicles Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'vehicles' && (
        <div className="card overflow-hidden">
          {loadingVehicles ? (
            <div className="p-12 text-center text-surface-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
              Loading fleet vehicles...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="mx-auto text-surface-300 mb-3" size={48} />
              <h3 className="text-lg font-semibold text-surface-700 mb-1">No Vehicles Found</h3>
              <p className="text-sm text-surface-400 mb-4">Register your transport vehicles to start assigning delivery dispatches.</p>
              <button onClick={() => setShowAddVehicleModal(true)} className="btn-primary btn-sm inline-flex items-center gap-2">
                <Plus size={14} /> Add Vehicle
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Plate Number</th>
                    <th className="py-3 px-4">Vehicle Type</th>
                    <th className="py-3 px-4">Capacity</th>
                    <th className="py-3 px-4">Assigned Centre</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-sm">
                  {filteredVehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-surface-900">
                        {v.plate_number}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-surface-700">
                        {v.vehicle_type}
                      </td>
                      <td className="py-3.5 px-4 text-surface-600">
                        {v.capacity_kg ? `${v.capacity_kg.toLocaleString()} kg` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-surface-600 text-xs">
                        {v.collection_centres?.name || 'Central Logistics'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          v.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {v.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingVehicle(v)}
                            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setVehicleToDelete(v)}
                            className="p-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Drivers Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'drivers' && (
        <div className="card overflow-hidden">
          {loadingDrivers ? (
            <div className="p-12 text-center text-surface-500">
              <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
              Loading registered drivers...
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="p-12 text-center">
              <User className="mx-auto text-surface-300 mb-3" size={48} />
              <h3 className="text-lg font-semibold text-surface-700 mb-1">No Drivers Found</h3>
              <p className="text-sm text-surface-400 mb-4">Register your transport drivers with their license details.</p>
              <button onClick={() => setShowAddDriverModal(true)} className="btn-primary btn-sm inline-flex items-center gap-2">
                <Plus size={14} /> Register Driver
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Driver Name</th>
                    <th className="py-3 px-4">NIC Number</th>
                    <th className="py-3 px-4">License No</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-sm">
                  {filteredDrivers.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-surface-900">
                        {d.full_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-surface-700">
                        {d.nic_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-surface-700">
                        {d.license_no}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-surface-600">
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-surface-400" />
                          {d.phone}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          d.is_active
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {d.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingDriver(d)}
                            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setDriverToDelete(d)}
                            className="p-1.5 rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Add Vehicle Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddVehicleModal}
        onClose={() => setShowAddVehicleModal(false)}
        title="Add Fleet Vehicle"
        subtitle="Register a new transport vehicle into the logistics fleet"
      >
        <form onSubmit={(e) => { e.preventDefault(); createVehicleMutation.mutate(vehicleForm); }} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Plate Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={vehicleForm.plate_number}
              onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })}
              placeholder="e.g. WP-CAB-5678"
              className="input w-full font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Vehicle Type</label>
            <select
              value={vehicleForm.vehicle_type}
              onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
              className="input w-full"
            >
              {VEHICLE_TYPES.map(vt => (
                <option key={vt.value} value={vt.value}>{vt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Capacity (kg)</label>
            <input
              type="number"
              value={vehicleForm.capacity_kg}
              onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_kg: e.target.value })}
              placeholder="e.g. 5000"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Assigned Collection Centre</label>
            <select
              value={vehicleForm.centre_id}
              onChange={(e) => setVehicleForm({ ...vehicleForm, centre_id: e.target.value })}
              className="input w-full"
            >
              <option value="">-- Central Fleet (No specific centre) --</option>
              {centres.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} ({c.district})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={() => setShowAddVehicleModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createVehicleMutation.isPending} className="btn-primary flex items-center gap-2">
              {createVehicleMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Vehicle
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Vehicle Modal ──────────────────────────────────────────────── */}
      {editingVehicle && (
        <Modal
          isOpen={!!editingVehicle}
          onClose={() => setEditingVehicle(null)}
          title={`Edit ${editingVehicle.plate_number}`}
          subtitle="Update vehicle details and availability status"
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            updateVehicleMutation.mutate({
              id: editingVehicle.id,
              data: {
                plate_number: editingVehicle.plate_number,
                vehicle_type: editingVehicle.vehicle_type,
                capacity_kg: editingVehicle.capacity_kg,
                centre_id: editingVehicle.centre_id,
                is_active: editingVehicle.is_active,
              }
            });
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Plate Number</label>
              <input
                type="text"
                value={editingVehicle.plate_number}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, plate_number: e.target.value.toUpperCase() })}
                className="input w-full font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Vehicle Type</label>
              <select
                value={editingVehicle.vehicle_type}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, vehicle_type: e.target.value })}
                className="input w-full"
              >
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt.value} value={vt.value}>{vt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Capacity (kg)</label>
              <input
                type="number"
                value={editingVehicle.capacity_kg || ''}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, capacity_kg: e.target.value ? parseFloat(e.target.value) : null })}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Status</label>
              <select
                value={editingVehicle.is_active ? 'active' : 'inactive'}
                onChange={(e) => setEditingVehicle({ ...editingVehicle, is_active: e.target.value === 'active' })}
                className="input w-full"
              >
                <option value="active">Active / Available</option>
                <option value="inactive">Inactive / In Maintenance</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button type="button" onClick={() => setEditingVehicle(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={updateVehicleMutation.isPending} className="btn-primary flex items-center gap-2">
                {updateVehicleMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Delete Vehicle Modal ────────────────────────────────────────────── */}
      {vehicleToDelete && (
        <Modal
          isOpen={!!vehicleToDelete}
          onClose={() => setVehicleToDelete(null)}
          title="Delete Fleet Vehicle"
          subtitle={`Delete ${vehicleToDelete.plate_number} from the fleet`}
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              Are you sure you want to delete vehicle <strong>{vehicleToDelete.plate_number}</strong>?
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button onClick={() => setVehicleToDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteVehicleMutation.mutate(vehicleToDelete.id)} disabled={deleteVehicleMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">
                Delete Vehicle
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Add Driver Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddDriverModal}
        onClose={() => setShowAddDriverModal(false)}
        title="Register New Driver"
        subtitle="Add a licensed driver to the logistics operations"
      >
        <form onSubmit={(e) => { e.preventDefault(); createDriverMutation.mutate(driverForm); }} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driverForm.full_name}
              onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
              placeholder="e.g. Sunil Perera"
              className="input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                NIC Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={driverForm.nic_number}
                onChange={(e) => setDriverForm({ ...driverForm, nic_number: e.target.value })}
                placeholder="e.g. 198512345678"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                License Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={driverForm.license_no}
                onChange={(e) => setDriverForm({ ...driverForm, license_no: e.target.value.toUpperCase() })}
                placeholder="e.g. B1234567"
                className="input w-full font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={driverForm.phone}
              onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
              placeholder="e.g. 0771234567"
              className="input w-full"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
            <button type="button" onClick={() => setShowAddDriverModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createDriverMutation.isPending} className="btn-primary flex items-center gap-2">
              {createDriverMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Register Driver
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit Driver Modal ───────────────────────────────────────────────── */}
      {editingDriver && (
        <Modal
          isOpen={!!editingDriver}
          onClose={() => setEditingDriver(null)}
          title={`Edit ${editingDriver.full_name}`}
          subtitle="Update driver credentials and contact details"
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            updateDriverMutation.mutate({
              id: editingDriver.id,
              data: {
                full_name: editingDriver.full_name,
                nic_number: editingDriver.nic_number,
                phone: editingDriver.phone,
                license_no: editingDriver.license_no,
                is_active: editingDriver.is_active,
              }
            });
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={editingDriver.full_name}
                onChange={(e) => setEditingDriver({ ...editingDriver, full_name: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">NIC Number</label>
                <input
                  type="text"
                  value={editingDriver.nic_number}
                  onChange={(e) => setEditingDriver({ ...editingDriver, nic_number: e.target.value })}
                  className="input w-full font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-700 mb-1.5">License Number</label>
                <input
                  type="text"
                  value={editingDriver.license_no}
                  onChange={(e) => setEditingDriver({ ...editingDriver, license_no: e.target.value.toUpperCase() })}
                  className="input w-full font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Phone Number</label>
              <input
                type="text"
                value={editingDriver.phone}
                onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">Status</label>
              <select
                value={editingDriver.is_active ? 'active' : 'inactive'}
                onChange={(e) => setEditingDriver({ ...editingDriver, is_active: e.target.value === 'active' })}
                className="input w-full"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button type="button" onClick={() => setEditingDriver(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={updateDriverMutation.isPending} className="btn-primary flex items-center gap-2">
                {updateDriverMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Delete Driver Modal ─────────────────────────────────────────────── */}
      {driverToDelete && (
        <Modal
          isOpen={!!driverToDelete}
          onClose={() => setDriverToDelete(null)}
          title="Delete Driver"
          subtitle={`Delete driver ${driverToDelete.full_name}`}
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              Are you sure you want to delete driver <strong>{driverToDelete.full_name}</strong>?
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100">
              <button onClick={() => setDriverToDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteDriverMutation.mutate(driverToDelete.id)} disabled={deleteDriverMutation.isPending} className="btn bg-red-600 text-white hover:bg-red-700">
                Delete Driver
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
