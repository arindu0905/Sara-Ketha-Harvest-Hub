import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api';
import { Bell, Check, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: notifRes, isLoading } = useQuery({
    queryKey: ['user-notifications'],
    queryFn: () => notificationsApi.getAll({}),
  });

  const notifications = notifRes?.data?.data || [];
  const unreadCount = notifRes?.data?.meta?.unread_count || 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending} className="btn-secondary btn-sm">
            <CheckCheck size={14} /> Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="card"><div className="empty-state"><Bell className="w-8 h-8 text-surface-300 mb-2" /><p className="text-surface-400 text-sm">No notifications</p></div></div>
      ) : (
        <div className="card overflow-hidden divide-y divide-surface-50">
          {notifications.map((n: any) => (
            <div key={n.id} className={`p-4 flex items-start justify-between gap-4 transition-colors ${n.is_read ? 'bg-white' : 'bg-primary-50/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${n.is_read ? 'bg-surface-100 text-surface-500' : 'bg-primary-100 text-primary-600'}`}>
                  <Bell size={18} />
                </div>
                <div>
                  <p className={`text-sm ${n.is_read ? 'text-surface-700' : 'font-semibold text-surface-900'}`}>{n.title || n.message}</p>
                  {n.title && n.message && <p className="text-xs text-surface-500 mt-0.5">{n.message}</p>}
                  <p className="text-xs text-surface-400 mt-1">{new Date(n.created_at).toLocaleString('en-LK')}</p>
                </div>
              </div>
              {!n.is_read && (
                <button onClick={() => markReadMutation.mutate(n.id)} className="btn-ghost p-1 text-surface-400 hover:text-surface-700" title="Mark as read">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
