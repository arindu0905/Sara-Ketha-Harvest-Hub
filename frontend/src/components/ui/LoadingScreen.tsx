import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">🌾</span>
        </div>
        <span className="text-xl font-bold text-surface-800 font-display">HarvestHub</span>
      </div>
      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      <p className="text-sm text-surface-500">Loading...</p>
    </div>
  );
};
