import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { warehousesApi, centresApi } from '../../services/api';
import { supabase } from '../../services/supabase';
import {
  Warehouse, Plus, ChevronDown, ChevronRight, MapPin, Box,
  Loader2, RefreshCw, Edit3, Trash2, ToggleLeft, ToggleRight, Building2,
  AlertTriangle, Eye, Search, Layers, Activity, CheckCircle2, XCircle, Info
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StorageLocation {
  id: string;
  code: string;
  description: string | null;
  capacity_kg: number | null;
  is_active: boolean;
}

interface InventoryBatch {
  id: string;
  batch_no: string;
  crop_id: string;
  warehouse_id: string;
  storage_location_id: string | null;
  initial_qty_kg: number;
  available_qty_kg: number;
  grade: string;
  status: string;
  created_at: string;
  crops?: { id: string; name: string; code: string; category?: string } | null;
  storage_locations?: { id: string; code: string; description?: string } | null;
}

interface WarehouseData {
  id: string;
  centre_id?: string;
  name: string;
  code: string;
  capacity_kg: number | null;
  used_capacity_kg: number;
  available_space_kg: number | null;
  utilisation_pct: number;
  address: string | null;
  is_active: boolean;
  storage_locations?: StorageLocation[];
  collection_centres?: { id: string; name: string; code: string; district: string } | null;
  batches?: InventoryBatch[];
}

// ─── Capacity Bar Component ──────────────────────────────────────────────────
const CapacityBar: React.FC<{ used: number; total: number | null; pct: number }> = ({ used, total, pct }) => {
  const colour = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-surface-500">
        <span>Used: <strong className="text-surface-700">{used.toLocaleString()} kg</strong></span>
        <span>{total ? `${pct}% Utilized` : 'No limit set'}</span>
      </div>
      {total ? (
        <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden p-0.5">
          <div className={`h-full ${colour} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      ) : (
        <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full w-full opacity-30" />
        </div>
      )}
      {total && (
        <div className="flex justify-between text-xs text-surface-400">
          <span>Available: <strong className="text-emerald-600">{(total - used > 0 ? total - used : 0).toLocaleString()} kg</strong></span>
          <span>Total: {total.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  );
};

// ─── Location Row Component ──────────────────────────────────────────────────
const LocationRow: React.FC<{
  loc: StorageLocation;
  warehouseId: string;
  onEdit: (loc: StorageLocation) => void;
  onToggle: (loc: StorageLocation) => void;
  onDelete: (loc: StorageLocation) => void;
}> = ({ loc, onEdit, onToggle, onDelete }) => (
  <div className={`flex items-center justify-between py-2.5 px-3.5 rounded-lg text-sm transition-colors ${loc.is_active ? 'bg-surface-50 hover:bg-surface-100/80 border border-surface-200/60' : 'bg-surface-100 opacity-60'}`}>
    <div className="flex items-center gap-2.5 min-w-0">
      <Box size={15} className="text-primary-600 flex-shrink-0" />
      <div>
        <span className="font-mono font-bold text-surface-800 bg-surface-200/60 px-1.5 py-0.5 rounded text-xs mr-2">{loc.code}</span>
        {loc.description && <span className="text-surface-600 text-xs">{loc.description}</span>}
      </div>
    </div>
    <div className="flex items-center gap-2.5 flex-shrink-0">
      {loc.capacity_kg ? (
        <span className="text-xs text-surface-500 font-medium">{loc.capacity_kg.toLocaleString()} kg</span>
      ) : (
        <span className="text-xs text-surface-400">Unlimited</span>
      )}
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${loc.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-200 text-surface-600'}`}>
        {loc.is_active ? 'Active' : 'Off'}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(loc)} className="btn-ghost p-1.5 rounded-md hover:bg-surface-200" title="Edit location">
          <Edit3 size={13} className="text-surface-600" />
        </button>
        <button onClick={() => onToggle(loc)} className="btn-ghost p-1.5 rounded-md hover:bg-surface-200" title={loc.is_active ? 'Deactivate' : 'Activate'}>
          {loc.is_active ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} className="text-surface-400" />}
        </button>
        <button onClick={() => onDelete(loc)} className="btn-ghost p-1.5 rounded-md hover:bg-red-50" title="Deactivate location">
          <Trash2 size={13} className="text-red-400 hover:text-red-600" />
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Warehouses Page ────────────────────────────────────────────────────
export const WarehousesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Modals state
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [viewingWarehouseId, setViewingWarehouseId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'locations' | 'batches'>('overview');
  const [showAddLocation, setShowAddLocation] = useState<{ warehouseId: string; warehouseName: string } | null>(null);
  const [editingLocation, setEditingLocation] = useState<{ loc: StorageLocation; warehouseId: string } | null>(null);

  // ─── React Hook Forms ──────────────────────────────────────────────────────
  const warehouseForm = useForm<{ name: string; code: string; centre_id: string; capacity_kg: string; address: string }>();
  const editWarehouseForm = useForm<{ name: string; code: string; centre_id: string; capacity_kg: string; address: string; is_active: boolean }>();
  const locationForm = useForm<{ code: string; description: string; capacity_kg: string }>();

  // ─── Supabase Realtime Database Listener ───────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('warehouses-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warehouses' },
        (payload) => {
          toast.success(`Warehouse database update (${payload.eventType})`, { id: 'rt-wh' });
          queryClient.invalidateQueries({ queryKey: ['warehouses'] });
          queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'storage_locations' },
        (payload) => {
          toast.success(`Storage location updated (${payload.eventType})`, { id: 'rt-loc' });
          queryClient.invalidateQueries({ queryKey: ['warehouses'] });
          queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_batches' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['warehouses'] });
          queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: whRes, isLoading, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.getAll({}),
  });
  const warehouses: WarehouseData[] = Array.isArray(whRes?.data?.data)
    ? whRes.data.data
    : Array.isArray(whRes?.data)
    ? whRes.data
    : [];

  const { data: detailRes, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['warehouse-detail', viewingWarehouseId],
    queryFn: () => viewingWarehouseId ? warehousesApi.getById(viewingWarehouseId) : null,
    enabled: !!viewingWarehouseId,
  });
  const viewingWarehouse: WarehouseData | null = detailRes?.data?.data || detailRes?.data || null;

  const { data: centresRes } = useQuery({
    queryKey: ['centres-list'],
    queryFn: () => centresApi.getAll(),
  });
  const centres = centresRes?.data?.data || centresRes?.data || [];

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createWarehouseMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => warehousesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse created successfully in database');
      setShowCreateWarehouse(false);
      warehouseForm.reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create warehouse'),
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => warehousesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success('Warehouse updated in database');
      setEditingWarehouse(null);
      editWarehouseForm.reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update warehouse'),
  });

  const toggleWarehouseActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => warehousesApi.update(id, { is_active }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success(`Warehouse ${variables.is_active ? 'activated' : 'deactivated'} in database`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to toggle status'),
  });

  const addLocationMutation = useMutation({
    mutationFn: ({ warehouseId, data }: { warehouseId: string; data: any }) =>
      warehousesApi.addLocation(warehouseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success('Storage location added');
      setShowAddLocation(null);
      locationForm.reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add storage location'),
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ warehouseId, locId, data }: { warehouseId: string; locId: string; data: any }) =>
      warehousesApi.updateLocation(warehouseId, locId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success('Storage location updated');
      setEditingLocation(null);
      locationForm.reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update storage location'),
  });

  const toggleLocationMutation = useMutation({
    mutationFn: ({ warehouseId, locId, is_active }: { warehouseId: string; locId: string; is_active: boolean }) =>
      warehousesApi.updateLocation(warehouseId, locId, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success('Location status updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to toggle location'),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: ({ warehouseId, locId }: { warehouseId: string; locId: string }) =>
      warehousesApi.deleteLocation(warehouseId, locId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail'] });
      toast.success('Storage location deactivated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to deactivate location'),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleCreateWarehouse = (d: { name: string; code: string; centre_id: string; capacity_kg: string; address: string }) => {
    if (!d.name.trim()) return toast.error('Warehouse name is required');
    if (!d.centre_id) return toast.error('Please select a collection centre');
    createWarehouseMutation.mutate({
      name: d.name.trim(),
      code: d.code?.trim() ? d.code.trim().toUpperCase() : undefined,
      centre_id: d.centre_id,
      capacity_kg: d.capacity_kg ? parseFloat(d.capacity_kg) : null,
      address: d.address?.trim() || null,
    });
  };

  const openEditWarehouse = (w: WarehouseData) => {
    setEditingWarehouse(w);
    editWarehouseForm.setValue('name', w.name);
    editWarehouseForm.setValue('code', w.code);
    editWarehouseForm.setValue('centre_id', w.collection_centres?.id || w.centre_id || '');
    editWarehouseForm.setValue('capacity_kg', w.capacity_kg?.toString() || '');
    editWarehouseForm.setValue('address', w.address || '');
    editWarehouseForm.setValue('is_active', w.is_active);
  };

  const handleUpdateWarehouse = (d: { name: string; code: string; centre_id: string; capacity_kg: string; address: string; is_active: boolean }) => {
    if (!editingWarehouse) return;
    if (!d.name.trim()) return toast.error('Warehouse name is required');
    if (!d.centre_id) return toast.error('Please select a collection centre');
    updateWarehouseMutation.mutate({
      id: editingWarehouse.id,
      data: {
        name: d.name.trim(),
        code: d.code?.trim() ? d.code.trim().toUpperCase() : editingWarehouse.code,
        centre_id: d.centre_id,
        capacity_kg: d.capacity_kg ? parseFloat(d.capacity_kg) : null,
        address: d.address?.trim() || null,
        is_active: d.is_active,
      },
    });
  };

  const handleAddLocation = (d: { code: string; description: string; capacity_kg: string }) => {
    if (!showAddLocation) return;
    if (!d.code.trim()) return toast.error('Location code is required');
    addLocationMutation.mutate({
      warehouseId: showAddLocation.warehouseId,
      data: {
        code: d.code.trim().toUpperCase(),
        description: d.description?.trim() || null,
        capacity_kg: d.capacity_kg ? parseFloat(d.capacity_kg) : null,
      },
    });
  };

  const handleUpdateLocation = (d: { code: string; description: string; capacity_kg: string }) => {
    if (!editingLocation) return;
    updateLocationMutation.mutate({
      warehouseId: editingLocation.warehouseId,
      locId: editingLocation.loc.id,
      data: {
        description: d.description?.trim() || null,
        capacity_kg: d.capacity_kg ? parseFloat(d.capacity_kg) : null,
      },
    });
  };

  const openEditLocation = (loc: StorageLocation, warehouseId: string) => {
    setEditingLocation({ loc, warehouseId });
    locationForm.setValue('code', loc.code);
    locationForm.setValue('description', loc.description || '');
    locationForm.setValue('capacity_kg', loc.capacity_kg?.toString() || '');
  };

  // ─── Filter Warehouses ─────────────────────────────────────────────────────
  const filteredWarehouses = warehouses.filter(w => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.collection_centres?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.collection_centres?.district || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && w.is_active) ||
      (statusFilter === 'inactive' && !w.is_active);

    return matchesSearch && matchesStatus;
  });

  // Summary Metrics
  const activeWarehousesCount = warehouses.filter(w => w.is_active).length;
  const totalCapacitySum = warehouses.reduce((s, w) => s + (w.capacity_kg || 0), 0);
  const usedCapacitySum = warehouses.reduce((s, w) => s + w.used_capacity_kg, 0);
  const totalLocationsCount = warehouses.reduce((s, w) => s + (w.storage_locations?.length || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title flex items-center gap-2">
              <Warehouse className="text-primary-600" size={28} />
              Warehouses & Storage Hub
            </h1>
            {isRealtimeConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Real-time Live DB
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Activity size={12} className="animate-spin text-amber-500" />
                Syncing Real-time...
              </span>
            )}
          </div>
          <p className="page-subtitle">Manage warehouse capacity, edit facility details, inspect stored inventory batches & live location assignments</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            onClick={() => { setShowCreateWarehouse(true); warehouseForm.reset(); }}
            className="btn-primary flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} />
            New Warehouse
          </button>
        </div>
      </div>

      {/* ─── Summary Stats Bar ────────────────────────────────────────────── */}
      {!isLoading && warehouses.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card border-l-4 border-l-primary-500">
            <div className="stat-icon bg-primary-50 text-primary-600"><Warehouse size={20} /></div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Total Warehouses</p>
              <p className="text-xl font-bold text-surface-900">{warehouses.length} <span className="text-xs font-normal text-surface-500">({activeWarehousesCount} active)</span></p>
            </div>
          </div>
          <div className="stat-card border-l-4 border-l-blue-500">
            <div className="stat-icon bg-blue-50 text-blue-600"><Box size={20} /></div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Total Storage Capacity</p>
              <p className="text-xl font-bold text-surface-900">{totalCapacitySum.toLocaleString()} kg</p>
            </div>
          </div>
          <div className="stat-card border-l-4 border-l-amber-500">
            <div className="stat-icon bg-amber-50 text-amber-600"><Layers size={20} /></div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Currently Utilized</p>
              <p className="text-xl font-bold text-surface-900">{usedCapacitySum.toLocaleString()} kg</p>
            </div>
          </div>
          <div className="stat-card border-l-4 border-l-emerald-500">
            <div className="stat-icon bg-emerald-50 text-emerald-600"><MapPin size={20} /></div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Storage Location Zones</p>
              <p className="text-xl font-bold text-surface-900">{totalLocationsCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Filter & Search Bar ─────────────────────────────────────────── */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search warehouse, code, district..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-9 pr-3 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs text-surface-500 font-medium">Filter Status:</span>
          <div className="flex bg-surface-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-all ${statusFilter === 'all' ? 'bg-white text-surface-900 shadow-sm font-semibold' : 'text-surface-600 hover:text-surface-900'}`}
            >
              All ({warehouses.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm font-semibold' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Active ({activeWarehousesCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-md transition-all ${statusFilter === 'inactive' ? 'bg-white text-surface-700 shadow-sm font-semibold' : 'text-surface-600 hover:text-surface-900'}`}
            >
              Inactive ({warehouses.length - activeWarehousesCount})
            </button>
          </div>
        </div>
      </div>

      {/* ─── Warehouses Grid / List ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="card">
          <div className="empty-state py-12">
            <Warehouse className="w-12 h-12 text-surface-300 mb-3" />
            <p className="text-surface-700 font-semibold text-base mb-1">
              {searchQuery || statusFilter !== 'all' ? 'No matching warehouses found' : 'No warehouses configured'}
            </p>
            <p className="text-surface-400 text-sm mb-5 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or clearing filters'
                : 'Create a warehouse facility to start managing inventory storage and location assignments.'}
            </p>
            {(!searchQuery && statusFilter === 'all') && (
              <button
                onClick={() => { setShowCreateWarehouse(true); warehouseForm.reset(); }}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                <Plus size={16} /> Create First Warehouse
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarehouses.map((w) => {
            const isOpen = expanded[w.id];
            const activeLocs = w.storage_locations?.filter(l => l.is_active) || [];
            const allLocs = w.storage_locations || [];
            return (
              <div key={w.id} className={`card overflow-hidden transition-all border ${w.is_active ? 'border-surface-200 hover:border-primary-300' : 'border-surface-200 bg-surface-50/60 opacity-85'}`}>
                {/* Warehouse Header Card Content */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${w.is_active ? 'bg-primary-100 text-primary-700' : 'bg-surface-200 text-surface-500'}`}>
                        <Warehouse size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-surface-900 text-lg">{w.name}</h3>
                          <span className="text-xs font-mono font-semibold bg-surface-100 text-surface-700 px-2 py-0.5 rounded border border-surface-200">{w.code}</span>
                          {w.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={12} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-surface-200 text-surface-600">
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </div>
                        {w.collection_centres && (
                          <div className="flex items-center gap-2 text-xs text-surface-600 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 font-medium">
                              <Building2 size={13} className="text-surface-400" />
                              {w.collection_centres.name} ({w.collection_centres.code})
                            </span>
                            <span className="text-surface-300">•</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-surface-400" />
                              {w.collection_centres.district}
                            </span>
                          </div>
                        )}
                        {w.address && <p className="text-xs text-surface-500 mt-1 italic">{w.address}</p>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => setViewingWarehouseId(w.id)}
                        className="btn-secondary btn-sm flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50/70 border-primary-200 hover:bg-primary-100"
                        title="View details & stored batches"
                      >
                        <Eye size={14} /> View Details
                      </button>
                      <button
                        onClick={() => openEditWarehouse(w)}
                        className="btn-secondary btn-sm flex items-center gap-1.5 text-xs"
                        title="Edit warehouse details"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => toggleWarehouseActiveMutation.mutate({ id: w.id, is_active: !w.is_active })}
                        className={`btn-secondary btn-sm p-1.5 ${w.is_active ? 'hover:bg-amber-50 text-amber-700' : 'hover:bg-emerald-50 text-emerald-700'}`}
                        title={w.is_active ? 'Deactivate Warehouse' : 'Activate Warehouse'}
                      >
                        {w.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddLocation({ warehouseId: w.id, warehouseName: w.name });
                          locationForm.reset();
                        }}
                        className="btn-secondary btn-sm flex items-center gap-1 text-xs"
                      >
                        <Plus size={13} /> Add Zone
                      </button>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <CapacityBar used={w.used_capacity_kg} total={w.capacity_kg} pct={w.utilisation_pct} />

                  {/* Quick Pills */}
                  <div className="flex gap-2 flex-wrap mt-3.5 pt-2 border-t border-surface-100">
                    <span className="text-xs bg-surface-100 px-2.5 py-1 rounded-lg text-surface-700 font-medium">
                      Total Capacity: <strong>{w.capacity_kg ? `${w.capacity_kg.toLocaleString()} kg` : 'Unlimited'}</strong>
                    </span>
                    <span className="text-xs bg-amber-50 px-2.5 py-1 rounded-lg text-amber-800 font-medium border border-amber-100">
                      In Use: <strong>{w.used_capacity_kg.toLocaleString()} kg</strong>
                    </span>
                    {w.capacity_kg && (
                      <span className="text-xs bg-emerald-50 px-2.5 py-1 rounded-lg text-emerald-800 font-medium border border-emerald-100">
                        Available: <strong>{(w.available_space_kg || 0).toLocaleString()} kg</strong>
                      </span>
                    )}
                    <span className="text-xs bg-blue-50 px-2.5 py-1 rounded-lg text-blue-800 font-medium border border-blue-100">
                      Locations: <strong>{activeLocs.length} active</strong> / {allLocs.length} total
                    </span>
                  </div>
                </div>

                {/* Storage Locations Expandable Section */}
                {allLocs.length > 0 && (
                  <div className="border-t border-surface-100 bg-surface-50/40">
                    <button
                      onClick={() => toggleExpand(w.id)}
                      className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-surface-700 hover:bg-surface-100/70 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Box size={14} className="text-primary-600" />
                        Storage Location Zones ({allLocs.length})
                      </span>
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-2">
                        {allLocs.map(loc => (
                          <LocationRow
                            key={loc.id}
                            loc={loc}
                            warehouseId={w.id}
                            onEdit={(l) => openEditLocation(l, w.id)}
                            onToggle={(l) => toggleLocationMutation.mutate({ warehouseId: w.id, locId: l.id, is_active: !l.is_active })}
                            onDelete={(l) => {
                              if (window.confirm(`Deactivate storage zone "${l.code}"?`)) {
                                deleteLocationMutation.mutate({ warehouseId: w.id, locId: l.id });
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {allLocs.length === 0 && (
                  <div className="border-t border-surface-100 px-5 py-2.5 bg-amber-50/30">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                      No storage location zones configured — click "+ Add Zone" to define physical bays/cold rooms.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 1. View Warehouse Details Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={!!viewingWarehouseId}
        onClose={() => setViewingWarehouseId(null)}
        title={viewingWarehouse ? `Warehouse Details — ${viewingWarehouse.name}` : 'Warehouse Details'}
        subtitle={viewingWarehouse ? `Code: ${viewingWarehouse.code} • ${viewingWarehouse.collection_centres?.name || 'Collection Centre'}` : ''}
        maxWidth="max-w-3xl"
      >
        {isLoadingDetail || !viewingWarehouse ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-primary-600 mx-auto" />
            <p className="text-sm text-surface-500">Loading complete warehouse information & stored inventory...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs Header */}
            <div className="flex border-b border-surface-200 gap-4 text-sm font-semibold">
              <button
                onClick={() => setDetailsTab('overview')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${detailsTab === 'overview' ? 'border-primary-600 text-primary-700' : 'border-transparent text-surface-500 hover:text-surface-800'}`}
              >
                <Info size={16} /> Overview & Capacity
              </button>
              <button
                onClick={() => setDetailsTab('locations')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${detailsTab === 'locations' ? 'border-primary-600 text-primary-700' : 'border-transparent text-surface-500 hover:text-surface-800'}`}
              >
                <Box size={16} /> Storage Zones ({(viewingWarehouse.storage_locations || []).length})
              </button>
              <button
                onClick={() => setDetailsTab('batches')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${detailsTab === 'batches' ? 'border-primary-600 text-primary-700' : 'border-transparent text-surface-500 hover:text-surface-800'}`}
              >
                <Layers size={16} /> Stored Batches ({(viewingWarehouse.batches || []).length})
              </button>
            </div>

            {/* Tab 1: Overview */}
            {detailsTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-xs text-surface-500">Status</p>
                    <p className="font-bold text-sm text-surface-900 mt-0.5 flex items-center gap-1">
                      {viewingWarehouse.is_active ? (
                        <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> Active</span>
                      ) : (
                        <span className="text-surface-500 flex items-center gap-1"><XCircle size={14} /> Inactive</span>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-xs text-surface-500">Total Capacity</p>
                    <p className="font-bold text-sm text-surface-900 mt-0.5">
                      {viewingWarehouse.capacity_kg ? `${viewingWarehouse.capacity_kg.toLocaleString()} kg` : 'Unlimited'}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-xs text-surface-500">Used Capacity</p>
                    <p className="font-bold text-sm text-amber-700 mt-0.5">
                      {viewingWarehouse.used_capacity_kg.toLocaleString()} kg ({viewingWarehouse.utilisation_pct}%)
                    </p>
                  </div>
                </div>

                <div className="card p-4 space-y-2 bg-surface-50/50">
                  <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Capacity Meter</h4>
                  <CapacityBar used={viewingWarehouse.used_capacity_kg} total={viewingWarehouse.capacity_kg} pct={viewingWarehouse.utilisation_pct} />
                </div>

                <div className="card p-4 space-y-2 border border-surface-200">
                  <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={14} className="text-primary-600" />
                    Associated Collection Centre
                  </h4>
                  {viewingWarehouse.collection_centres ? (
                    <div className="text-sm text-surface-800 space-y-1">
                      <p><strong>Name:</strong> {viewingWarehouse.collection_centres.name} ({viewingWarehouse.collection_centres.code})</p>
                      <p><strong>District:</strong> {viewingWarehouse.collection_centres.district}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-surface-500">No collection centre linked</p>
                  )}
                  {viewingWarehouse.address && (
                    <p className="text-xs text-surface-600 pt-1 border-t border-surface-100">
                      <strong>Address / Facility Notes:</strong> {viewingWarehouse.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Storage Locations */}
            {detailsTab === 'locations' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-surface-500">Storage locations/zones defined inside this warehouse facility.</p>
                  <button
                    onClick={() => {
                      setShowAddLocation({ warehouseId: viewingWarehouse.id, warehouseName: viewingWarehouse.name });
                      locationForm.reset();
                    }}
                    className="btn-primary btn-sm flex items-center gap-1 text-xs"
                  >
                    <Plus size={13} /> Add Zone
                  </button>
                </div>
                {(viewingWarehouse.storage_locations || []).length === 0 ? (
                  <div className="text-center py-8 bg-surface-50 rounded-xl border border-dashed border-surface-300">
                    <Box className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-xs text-surface-500 font-medium">No storage location zones configured yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(viewingWarehouse.storage_locations || []).map(loc => (
                      <LocationRow
                        key={loc.id}
                        loc={loc}
                        warehouseId={viewingWarehouse.id}
                        onEdit={(l) => openEditLocation(l, viewingWarehouse.id)}
                        onToggle={(l) => toggleLocationMutation.mutate({ warehouseId: viewingWarehouse.id, locId: l.id, is_active: !l.is_active })}
                        onDelete={(l) => {
                          if (window.confirm(`Deactivate storage zone "${l.code}"?`)) {
                            deleteLocationMutation.mutate({ warehouseId: viewingWarehouse.id, locId: l.id });
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Stored Inventory Batches */}
            {detailsTab === 'batches' && (
              <div className="space-y-3">
                <p className="text-xs text-surface-500">Live inventory produce batches currently assigned to this warehouse.</p>
                {(viewingWarehouse.batches || []).length === 0 ? (
                  <div className="text-center py-8 bg-surface-50 rounded-xl border border-dashed border-surface-300">
                    <Layers className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-xs text-surface-500 font-medium">No active inventory batches stored in this warehouse.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-80 overflow-y-auto border border-surface-200 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-surface-100 text-surface-700 sticky top-0 font-bold">
                        <tr>
                          <th className="p-2.5">Batch No</th>
                          <th className="p-2.5">Crop</th>
                          <th className="p-2.5">Grade</th>
                          <th className="p-2.5">Zone Location</th>
                          <th className="p-2.5">Available (kg)</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Stored Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {(viewingWarehouse.batches || []).map(b => (
                          <tr key={b.id} className="hover:bg-surface-50/80">
                            <td className="p-2.5 font-mono font-bold text-surface-800">{b.batch_no}</td>
                            <td className="p-2.5 font-medium">{b.crops?.name || 'Crop'}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{b.grade}</span>
                            </td>
                            <td className="p-2.5 font-mono">{b.storage_locations?.code || '—'}</td>
                            <td className="p-2.5 font-semibold text-emerald-700">{b.available_qty_kg?.toLocaleString()} kg</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-blue-100 text-blue-800">
                                {b.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-surface-500">{new Date(b.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200">
              <button
                type="button"
                onClick={() => openEditWarehouse(viewingWarehouse)}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <Edit3 size={14} /> Edit Warehouse
              </button>
              <button
                type="button"
                onClick={() => setViewingWarehouseId(null)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── 2. Create Warehouse Modal ───────────────────────────────────────── */}
      <Modal
        isOpen={showCreateWarehouse}
        onClose={() => { setShowCreateWarehouse(false); warehouseForm.reset(); }}
        title="Create New Warehouse"
        subtitle="Add a storage facility linked to a collection centre"
        maxWidth="max-w-lg"
      >
        <form onSubmit={warehouseForm.handleSubmit(handleCreateWarehouse)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Warehouse Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="e.g. Dambulla Main Warehouse A"
              {...warehouseForm.register('name', { required: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Collection Centre <span className="text-red-500">*</span>
              </label>
              <select
                className="form-select w-full"
                {...warehouseForm.register('centre_id', { required: true })}
              >
                <option value="">Select centre...</option>
                {centres.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Warehouse Code
              </label>
              <input
                type="text"
                className="form-input w-full uppercase font-mono"
                placeholder="Auto-generated if empty"
                {...warehouseForm.register('code')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Total Capacity (kg)
              </label>
              <input
                type="number"
                min="1"
                className="form-input w-full"
                placeholder="e.g. 500000"
                {...warehouseForm.register('capacity_kg')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Address *
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="e.g. 45 Kandy Road, Dambulla"
                {...warehouseForm.register('address', { required: 'Address is required', minLength: { value: 5, message: 'Enter the full address (at least 5 characters)' }, validate: (v: string) => v.trim().length >= 5 || 'Address cannot be blank' })}
              />
              {warehouseForm.formState.errors.address && <p className="text-xs text-red-600 mt-1">{warehouseForm.formState.errors.address.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setShowCreateWarehouse(false); warehouseForm.reset(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createWarehouseMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {createWarehouseMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Creating...</>
              ) : (
                <><Plus size={14} /> Create Warehouse</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── 3. Edit Warehouse Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingWarehouse}
        onClose={() => { setEditingWarehouse(null); editWarehouseForm.reset(); }}
        title={`Edit Warehouse — ${editingWarehouse?.name}`}
        subtitle={`ID: ${editingWarehouse?.id}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={editWarehouseForm.handleSubmit(handleUpdateWarehouse)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Warehouse Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="e.g. Dambulla Cold Store A"
              {...editWarehouseForm.register('name', { required: true })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Collection Centre <span className="text-red-500">*</span>
              </label>
              <select
                className="form-select w-full"
                {...editWarehouseForm.register('centre_id', { required: true })}
              >
                <option value="">Select collection centre...</option>
                {centres.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Warehouse Code
              </label>
              <input
                type="text"
                className="form-input w-full font-mono uppercase"
                {...editWarehouseForm.register('code')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Total Storage Capacity (kg)
              </label>
              <input
                type="number"
                min="1"
                className="form-input w-full"
                placeholder="e.g. 500000"
                {...editWarehouseForm.register('capacity_kg')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                Address *
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="e.g. Plot 14, Main Complex"
                {...editWarehouseForm.register('address', { required: 'Address is required', minLength: { value: 5, message: 'Enter the full address (at least 5 characters)' }, validate: (v: string) => v.trim().length >= 5 || 'Address cannot be blank' })}
              />
              {editWarehouseForm.formState.errors.address && <p className="text-xs text-red-600 mt-1">{editWarehouseForm.formState.errors.address.message}</p>}
            </div>
          </div>

          <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-800">Warehouse Operational Status</p>
              <p className="text-xs text-surface-500">Inactive warehouses stop receiving new batch assignments</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                {...editWarehouseForm.register('is_active')}
              />
              <span className="text-xs font-bold text-surface-700">Is Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setEditingWarehouse(null); editWarehouseForm.reset(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateWarehouseMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateWarehouseMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Saving Changes...</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── 4. Add Storage Location Modal ──────────────────────────────────── */}
      <Modal
        isOpen={!!showAddLocation}
        onClose={() => { setShowAddLocation(null); locationForm.reset(); }}
        title="Add Storage Zone Location"
        subtitle={showAddLocation ? `Inside warehouse: ${showAddLocation.warehouseName}` : ''}
        maxWidth="max-w-md"
      >
        <form onSubmit={locationForm.handleSubmit(handleAddLocation)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">
              Zone Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="form-input w-full uppercase font-mono"
              placeholder="e.g. ROW-A-BAY-1 or COLD-ROOM-2"
              {...locationForm.register('code', { required: true })}
            />
            <p className="text-xs text-surface-400 mt-1">Short unique code used during batch physical placement</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Description</label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="e.g. Row A Bay 1 — Temperature controlled"
              {...locationForm.register('description')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Zone Capacity (kg) — optional</label>
            <input
              type="number"
              min="1"
              className="form-input w-full"
              placeholder="Leave blank for unlimited"
              {...locationForm.register('capacity_kg')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setShowAddLocation(null); locationForm.reset(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addLocationMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {addLocationMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Adding...</>
              ) : (
                <><Plus size={14} /> Add Zone</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── 5. Edit Storage Location Modal ─────────────────────────────────── */}
      <Modal
        isOpen={!!editingLocation}
        onClose={() => { setEditingLocation(null); locationForm.reset(); }}
        title={`Edit Storage Zone — ${editingLocation?.loc.code}`}
        subtitle="Update description or capacity limit"
        maxWidth="max-w-md"
      >
        <form onSubmit={locationForm.handleSubmit(handleUpdateLocation)} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Zone Code</label>
            <input
              type="text"
              className="form-input w-full font-mono bg-surface-100 cursor-not-allowed"
              disabled
              {...locationForm.register('code')}
            />
            <p className="text-xs text-surface-400 mt-1">Zone code cannot be modified</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Description</label>
            <input
              type="text"
              className="form-input w-full"
              placeholder="e.g. Ambient bay"
              {...locationForm.register('description')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-surface-700 mb-1.5">Zone Capacity (kg)</label>
            <input
              type="number"
              min="1"
              className="form-input w-full"
              placeholder="Leave blank for unlimited"
              {...locationForm.register('capacity_kg')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-surface-100">
            <button
              type="button"
              onClick={() => { setEditingLocation(null); locationForm.reset(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateLocationMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateLocationMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
