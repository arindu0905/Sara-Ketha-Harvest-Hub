import React, { useState } from 'react';
import { roleBasePath } from '../utils/roleBase';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingCart, DollarSign,
  Truck, BarChart3, Settings, Bell, LogOut, Menu, Calendar,
  Leaf, ClipboardList, CheckSquare, Warehouse, FileText, MessageSquare,
  User, Scale, Search, Shield, Building2, Gavel, Star, TrendingUp, Wifi, Clock, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../services/api';
import toast from 'react-hot-toast';

type Role = string;

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const getNavItems = (role: Role): NavItem[] => {
  switch (role) {
    case 'farmer':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/farmer/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'my_profile', label: 'My Profile', path: '/farmer/profile', icon: <User size={18} /> },
        { key: 'my_crops', label: 'My Crops', path: '/farmer/crops', icon: <Leaf size={18} /> },
        { key: 'schedule_delivery', label: 'Schedule Delivery', path: '/farmer/schedule', icon: <Calendar size={18} /> },
        { key: 'appointments', label: 'Appointments', path: '/farmer/appointments', icon: <ClipboardList size={18} /> },
        { key: 'collections', label: 'Collections', path: '/farmer/collections', icon: <Package size={18} /> },
        { key: 'payments', label: 'Payments', path: '/farmer/payments', icon: <DollarSign size={18} /> },
        { key: 'live_auctions', label: 'Live Auctions', path: '/farmer/auction/live', icon: <Gavel size={18} /> },
        { key: 'produce_auctions', label: 'My Produce Auctions', path: '/farmer/auction/my-produce', icon: <TrendingUp size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/farmer/complaints', icon: <MessageSquare size={18} /> },
      ];
    case 'collection_centre_officer':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/officer/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'users', label: 'Farmer Directory', path: '/officer/farmers', icon: <Users size={18} /> },
        { key: 'appointments', label: 'Appointments', path: '/officer/appointments', icon: <Calendar size={18} /> },
        { key: 'collections', label: 'Collections History', path: '/officer/collections', icon: <ClipboardList size={18} /> },
        { key: 'register_collection', label: 'Register Collection', path: '/officer/collections/register', icon: <Package size={18} /> },
        { key: 'price_management', label: 'Price Management', path: '/officer/prices', icon: <DollarSign size={18} /> },
        { key: 'collection_centres', label: 'Collection Centres', path: '/officer/centres', icon: <Building2 size={18} /> },
        { key: 'start_live_auction', label: 'Start Live Auction', path: '/officer/auctions/create-live', icon: <Gavel size={18} /> },
        { key: 'live_auctions', label: 'View Live Auctions', path: '/officer/auctions/live', icon: <TrendingUp size={18} /> },
      ];
    case 'quality_inspector':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/inspector/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'appointments', label: 'Pending Inspections', path: '/inspector/pending', icon: <ClipboardList size={18} /> },
        { key: 'reports', label: 'Inspection History', path: '/inspector/history', icon: <CheckSquare size={18} /> },
        { key: 'quality_analytics', label: 'Quality Analytics', path: '/inspector/analytics', icon: <BarChart3 size={18} /> },
        { key: 'start_live_auction', label: 'Start Live Auction', path: '/inspector/auctions/create-live', icon: <Gavel size={18} /> },
        { key: 'live_auctions', label: 'View Live Auctions', path: '/inspector/auctions/live', icon: <TrendingUp size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/inspector/complaints', icon: <MessageSquare size={18} /> },
      ];
    case 'inventory_manager':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/inventory/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'current_inventory', label: 'Current Inventory', path: '/inventory/current', icon: <Package size={18} /> },
        { key: 'near_expiry', label: 'Near-Expiry Stock', path: '/inventory/near-expiry', icon: <Clock size={18} /> },
        { key: 'wastage', label: 'Wastage Records', path: '/inventory/wastage', icon: <Trash2 size={18} /> },
        { key: 'orders', label: 'Order Management', path: '/inventory/orders', icon: <ClipboardList size={18} /> },
        { key: 'warehouses', label: 'Warehouses', path: '/inventory/warehouses', icon: <Warehouse size={18} /> },
        { key: 'auctions', label: 'Auction Dashboard', path: '/inventory/auction/dashboard', icon: <Gavel size={18} /> },
        { key: 'live_auction_monitor', label: 'Live Auction Monitor', path: '/inventory/auction/monitor', icon: <TrendingUp size={18} /> },
        { key: 'auction_reports', label: 'Auction Reports', path: '/inventory/auction/reports', icon: <BarChart3 size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/inventory/complaints', icon: <MessageSquare size={18} /> },
      ];
    case 'buyer':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/buyer/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'marketplace', label: 'Marketplace', path: '/buyer/marketplace', icon: <ShoppingCart size={18} /> },
        { key: 'my_orders', label: 'My Orders', path: '/buyer/orders', icon: <ClipboardList size={18} /> },
        { key: 'invoices', label: 'My Invoices', path: '/buyer/invoices', icon: <FileText size={18} /> },
        { key: 'auctions', label: 'Auction Marketplace', path: '/buyer/auction', icon: <Gavel size={18} /> },
      ];
    case 'finance_officer':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/finance/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'payments', label: 'Pending Payments', path: '/finance/payments/pending', icon: <DollarSign size={18} /> },
        { key: 'approve_disburse_payments', label: 'Approve & Disburse Payments', path: '/finance/approve', icon: <CheckSquare size={18} /> },
        { key: 'payment_history', label: 'Payment History', path: '/finance/history', icon: <ClipboardList size={18} /> },
        { key: 'farmer_invoices', label: 'Farmer Invoices', path: '/finance/farmer-invoices', icon: <FileText size={18} /> },
        { key: 'buyer_invoices', label: 'Buyer Invoices', path: '/finance/invoices', icon: <FileText size={18} /> },
        { key: 'outstanding_payments', label: 'Outstanding Payments', path: '/finance/outstanding', icon: <DollarSign size={18} /> },
        { key: 'reports', label: 'Reports', path: '/finance/reports', icon: <BarChart3 size={18} /> },
        { key: 'management_reports', label: 'Management Reports', path: '/finance/management-reports', icon: <TrendingUp size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/finance/complaints', icon: <MessageSquare size={18} /> },
      ];
    case 'transport_coordinator':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/transport/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'schedule_delivery', label: 'Delivery Schedule', path: '/transport/schedule', icon: <Calendar size={18} /> },
        { key: 'active_deliveries', label: 'Active Shipments', path: '/transport/active', icon: <Truck size={18} /> },
        { key: 'fleet_vehicles', label: 'Fleet & Drivers', path: '/transport/vehicles', icon: <Warehouse size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/transport/complaints', icon: <MessageSquare size={18} /> },
      ];
    case 'manager':
      return [
        { key: 'dashboard', label: 'Management Dashboard', path: '/manager/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'management_reports', label: 'Management Reports', path: '/manager/management-reports', icon: <TrendingUp size={18} /> },
        { key: 'outstanding_payments', label: 'Outstanding Payments', path: '/manager/outstanding', icon: <DollarSign size={18} /> },
        { key: 'orders', label: 'Orders', path: '/manager/orders', icon: <ClipboardList size={18} /> },
      ];
    case 'administrator':
      return [
        { key: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
        { key: 'users', label: 'User Management', path: '/admin/users', icon: <Users size={18} /> },
        { key: 'orders', label: 'Order Management', path: '/admin/orders', icon: <ClipboardList size={18} /> },
        { key: 'crop_categories', label: 'Crop Categories', path: '/admin/categories', icon: <Leaf size={18} /> },
        { key: 'price_management', label: 'Price Management', path: '/admin/prices', icon: <DollarSign size={18} /> },
        { key: 'collection_centres', label: 'Collection Centres', path: '/admin/centres', icon: <Building2 size={18} /> },
        { key: 'complaints', label: 'Complaints', path: '/admin/complaints', icon: <MessageSquare size={18} /> },
        { key: 'audit_logs', label: 'Audit Logs', path: '/admin/audit-logs', icon: <Shield size={18} /> },
        { key: 'reports', label: 'Reports', path: '/admin/reports', icon: <BarChart3 size={18} /> },
        { key: 'management_reports', label: 'Management Reports', path: '/admin/management-reports', icon: <TrendingUp size={18} /> },
        { key: 'auctions', label: 'Auction Approval', path: '/admin/auction/approval', icon: <Gavel size={18} /> },
        { key: 'auction_monitor', label: 'Live Auction Monitor', path: '/admin/auction/monitor', icon: <Wifi size={18} /> },
        { key: 'settings', label: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
      ];
    default:
      return [];
  }
};

interface DashboardLayoutProps {
  role: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ role }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t, getRoleLabel } = useLanguage();
  const navigate = useNavigate();
  const navItems = getNavItems(role);

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.getAll({ unread_only: 'true', limit: '5' }),
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.data?.meta?.unread_count || 0;

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const Sidebar = ({ mobile = false }) => (
    <aside className={`
      ${mobile ? 'fixed inset-0 z-50 flex' : `${sidebarOpen ? 'w-64' : 'w-16'} hidden lg:flex flex-col`}
      bg-white border-r border-surface-100 shadow-sidebar flex-col transition-all duration-300
    `}>
      {mobile && (
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <div className={`relative flex flex-col h-full ${mobile ? 'w-64 bg-white' : 'w-full'} z-10`}>
        {/* Logo with Sara Ketha Harvest Hub title */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-100 h-16" style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(13,148,136,0.08) 100%)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
            <span className="text-lg">🌾</span>
          </div>
          {(sidebarOpen || mobile) && (
            <div>
              <p className="text-xs font-extrabold text-surface-900 font-display leading-tight truncate">
                {t('system_name')}
              </p>
              <p className="text-2xs text-primary-600 font-semibold">{getRoleLabel(role)}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/officer/collections' || item.path.endsWith('/collections')}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileSidebarOpen(false)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {(sidebarOpen || mobile) && (
                <span className="truncate">{t(item.key) === item.key ? item.label : t(item.key)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Notifications link */}
        <div className="p-3 border-t border-surface-100">
          <NavLink
            to={`${roleBasePath(role)}/notifications`}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <div className="relative flex-shrink-0">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-2xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {(sidebarOpen || mobile) && <span>{t('notifications')}</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar */}
      {mobileSidebarOpen && <Sidebar mobile />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-white border-b border-surface-100 flex items-center justify-between px-4 gap-4 flex-shrink-0" style={{ borderImage: 'linear-gradient(90deg, #059669, #0d9488) 1', borderBottomWidth: '1.5px' }}>
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden btn-ghost p-2 rounded-lg"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            {/* Desktop sidebar collapse */}
            <button
              className="hidden lg:flex btn-ghost p-2 rounded-lg"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Search placeholder */}
            <div className="hidden md:flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 w-64">
              <Search size={16} className="text-surface-400" />
              <span className="text-sm text-surface-400">{t('quick_search')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ─── Language Selector Bar ────────────────── */}
            <LanguageSelector />

            {/* Notifications */}
            <button
              className="relative btn-ghost p-2 rounded-xl"
              onClick={() => navigate(`${roleBasePath(role)}/notifications`)}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-2xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Menu with Localized Role */}
            <div className="flex items-center gap-3 pl-3 border-l border-surface-100">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-surface-800 leading-tight">{user?.full_name}</p>
                <p className="text-xs text-primary-600 font-medium">{getRoleLabel(user?.role || role)}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="btn-ghost p-2 rounded-xl text-surface-500 hover:text-red-600"
                title={t('logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
