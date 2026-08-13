import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, iconBg = 'bg-primary-100',
  iconColor = 'text-primary-600', trend, loading = false,
}) => {
  if (loading) {
    return (
      <div className="stat-card">
        <div className={`stat-icon ${iconBg} ${iconColor} skeleton`} />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-7 w-16 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconBg} ${iconColor}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-surface-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-surface-900 font-display mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-surface-400 mt-0.5 truncate">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{Math.abs(trend.value)}% {trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};
