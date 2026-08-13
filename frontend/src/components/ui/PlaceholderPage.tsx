/**
 * Generates a simple placeholder page component.
 * Used during development to stub out not-yet-implemented pages.
 */
import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => (
  <div className="space-y-6">
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
    </div>
    <div className="card">
      <div className="empty-state">
        <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
          <Construction className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-700 mb-2">{title}</h3>
        <p className="text-surface-400 text-sm max-w-sm">
          {description || 'This page is under construction. Full implementation coming soon.'}
        </p>
      </div>
    </div>
  </div>
);
