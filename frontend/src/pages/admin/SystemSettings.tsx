import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { Settings, Save, RefreshCw, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingItem {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

export const SystemSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const { data: response, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const res = await adminApi.getSettings();
      const items: SettingItem[] = res.data.data || [];
      const initial: Record<string, string> = {};
      items.forEach(i => { initial[i.key] = i.value; });
      setEditingValues(initial);
      return items;
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => adminApi.updateSetting(key, value),
    onSuccess: () => {
      toast.success('Setting updated');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update setting');
    },
  });

  const settingsList = response || [];

  const handleChange = (key: string, val: string) => {
    setEditingValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = (key: string) => {
    const value = editingValues[key];
    if (value !== undefined) {
      updateSettingMutation.mutate({ key, value });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings className="text-primary-600" size={28} /> System Settings
          </h1>
          <p className="page-subtitle">Configure global environment constants and business parameters</p>
        </div>

        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-surface-500">
            <RefreshCw className="animate-spin mx-auto mb-2 text-primary-600" size={24} />
            Loading settings...
          </div>
        ) : settingsList.length === 0 ? (
          <div className="p-12 text-center text-surface-500">
            No settings configured.
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {settingsList.map((s) => (
              <div key={s.key} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-50/50">
                <div className="max-w-md">
                  <div className="font-semibold text-surface-900 font-mono text-sm">{s.key}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{s.description || 'System setting'}</div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <input
                    type="text"
                    value={editingValues[s.key] ?? s.value}
                    onChange={(e) => handleChange(s.key, e.target.value)}
                    className="form-input text-sm py-1.5 px-3 w-full md:w-64"
                  />
                  <button
                    onClick={() => handleSave(s.key)}
                    disabled={updateSettingMutation.isPending || editingValues[s.key] === s.value}
                    className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
