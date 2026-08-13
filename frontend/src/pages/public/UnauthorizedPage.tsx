import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => (
  <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
    <div className="text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldOff className="w-10 h-10 text-red-600" />
      </div>
      <h1 className="text-3xl font-bold text-surface-900 font-display mb-2">Access Denied</h1>
      <p className="text-surface-500 mb-8 max-w-sm">You don't have permission to access this page.</p>
      <Link to="/" className="btn-primary">Go to Home</Link>
    </div>
  </div>
);

export const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
    <div className="text-center">
      <div className="text-8xl font-extrabold text-primary-200 font-display mb-4">404</div>
      <h1 className="text-3xl font-bold text-surface-900 font-display mb-2">Page Not Found</h1>
      <p className="text-surface-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Go to Home</Link>
    </div>
  </div>
);
