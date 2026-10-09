import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from '../components/ui/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ROLE_DASHBOARDS: Record<string, string> = {
  farmer: '/farmer/dashboard',
  collection_centre_officer: '/officer/dashboard',
  quality_inspector: '/inspector/dashboard',
  inventory_manager: '/inventory/dashboard',
  buyer: '/buyer/dashboard',
  finance_officer: '/finance/dashboard',
  transport_coordinator: '/transport/dashboard',
  manager: '/manager/dashboard',
  administrator: '/admin/dashboard',
  admin: '/admin/dashboard',
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their correct dashboard
    const dashboard = ROLE_DASHBOARDS[user.role] || '/login';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
};

/**
 * Route guard for public routes (login, register) — redirects to dashboard if already authenticated.
 */
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (user) {
    const dashboard = ROLE_DASHBOARDS[user.role] || '/farmer/dashboard';
    return <Navigate to={dashboard} replace />;
  }

  return <>{children}</>;
};
