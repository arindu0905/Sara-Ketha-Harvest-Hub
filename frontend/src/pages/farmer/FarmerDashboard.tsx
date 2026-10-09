import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmerPaymentsApi, collectionsApi } from '../../services/api';
import { StatCard } from '../../components/ui/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { farmersApi } from '../../services/api';
import { Link } from 'react-router-dom';
import { Package, DollarSign, Leaf, ChevronRight, TrendingUp, AlertCircle, Bot, Sparkles, Sprout, MessageSquare } from 'lucide-react';
import { FarmerCropBotModal } from '../../components/bot/FarmerCropBotModal';

export const FarmerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showBotModal, setShowBotModal] = useState(false);

  // Get farmer record
  const { data: farmerData } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      return res.data?.data;
    },
  });

  const farmerId = farmerData?.id;

  const { data: collectionsData, isLoading: loadingColl } = useQuery({
    queryKey: ['farmer-collections', farmerId],
    queryFn: () => collectionsApi.getAll({ farmer_id: farmerId!, limit: '5' }),
    enabled: !!farmerId,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['farmer-payments-recent', farmerId],
    queryFn: () => farmerPaymentsApi.getAll({ farmer_id: farmerId! }),
    enabled: !!farmerId,
  });

  const collections = collectionsData?.data?.data || [];
  const payments = paymentsData?.data?.data || [];

  const totalPaid = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + (p.net_amount_lkr || 0), 0);
  const totalPending = payments.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + (p.net_amount_lkr || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Welcome & AI Advisor Launcher */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            {t('welcome')}, {user?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="page-subtitle">{t('farmer_dashboard_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBotModal(true)}
            className="btn-primary bg-gradient-to-r from-emerald-600 to-primary-700 hover:from-emerald-700 hover:to-primary-800 text-white shadow-md flex items-center gap-2 px-4 py-2 rounded-xl transition-all border border-emerald-500/30"
          >
            <Bot size={18} className="text-emerald-200 animate-pulse" />
            <span className="font-semibold text-sm">{t('ask_sara_ketha_bot')}</span>
            <Sparkles size={14} className="text-amber-300" />
          </button>
          <Link to="/farmer/schedule" className="btn-secondary btn-sm">+ {t('schedule_delivery')}</Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('total_collections')} value={collectionsData?.data?.meta?.total ?? '—'} icon={<Package size={22} />} iconBg="bg-primary-100" iconColor="text-primary-600" loading={loadingColl} />
        <StatCard title={t('active_crops')} value={farmerData?.farmer_crops?.length ?? '—'} icon={<Leaf size={22} />} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatCard title={t('paid_amount')} value={totalPaid > 0 ? `LKR ${totalPaid.toLocaleString('en-LK')}` : '—'} icon={<DollarSign size={22} />} iconBg="bg-earth-100" iconColor="text-earth-600" />
        <StatCard title={t('pending_payment')} value={totalPending > 0 ? `LKR ${totalPending.toLocaleString('en-LK')}` : '—'} icon={<TrendingUp size={22} />} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
      </div>

      {/* Farmer Verification Alert */}
      {farmerData && farmerData.verification_status !== 'verified' && (
        <div className="alert-warning">
          <AlertCircle size={16} className="flex-shrink-0" />
          <div>
            <p className="font-medium">{t('account_pending_verification')}</p>
            <p className="text-xs mt-0.5">{t('account_pending_verification_desc')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collections */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-surface-800">{t('recent_collections')}</h2>
            <Link to="/farmer/collections" className="text-xs text-primary-600 flex items-center gap-1 hover:text-primary-700">{t('view_all')} <ChevronRight size={14} /></Link>
          </div>
          <div className="divide-y divide-surface-50">
            {collections.length === 0 ? (
              <div className="empty-state py-8">
                <Package className="w-8 h-8 text-surface-300 mb-2" />
                <p className="text-surface-400 text-sm">{t('no_collections_yet')}</p>
                <Link to="/farmer/schedule" className="btn-primary btn-sm mt-3">{t('schedule_first_delivery')}</Link>
              </div>
            ) : collections.map((c: any) => (
              <Link key={c.id} to={`/farmer/collections/${c.id}`} className="flex items-center justify-between p-4 hover:bg-surface-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-surface-800">{c.collection_no}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{c.crop_categories?.name} · {c.net_weight_kg ? `${c.net_weight_kg} kg` : t('not_weighed')}</p>
                </div>
                <div className="text-right">
                  <span className={`badge text-xs ${c.status === 'completed' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-neutral'}`}>
                    {c.status?.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-surface-400 mt-1">{new Date(c.created_at).toLocaleDateString('en-LK')}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions & Recent Payments */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">{t('quick_actions')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowBotModal(true)}
                className="flex flex-col items-center gap-2 p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-colors text-center col-span-2 text-emerald-900 font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Bot size={22} className="text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-900">{t('ask_crop_ai_advisor')}</span>
                  <Sparkles size={14} className="text-amber-500" />
                </div>
                <span className="text-[11px] font-normal text-emerald-700">{t('predict_optimal_crops_desc')}</span>
              </button>
              {[
                { labelKey: 'register_crop', icon: '🌱', path: '/farmer/crops/register' },
                { labelKey: 'schedule_delivery', icon: '📅', path: '/farmer/schedule' },
                { labelKey: 'view_prices', icon: '💰', path: '/prices' },
                { labelKey: 'submit_complaint', icon: '📋', path: '/farmer/complaints/submit' },
              ].map(a => (
                <Link key={a.path} to={a.path} className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors text-center">
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-xs font-medium text-surface-700">{t(a.labelKey)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-surface-800">{t('recent_payments')}</h2>
              <Link to="/farmer/payments" className="text-xs text-primary-600 flex items-center gap-1">{t('view_all')} <ChevronRight size={14} /></Link>
            </div>
            {payments.length === 0 ? (
              <div className="empty-state py-6">
                <p className="text-surface-400 text-sm">{t('no_payments_yet')}</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-50">
                {payments.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{p.payment_no}</p>
                      <p className="text-xs text-surface-500">{p.accepted_qty_kg} kg · {p.produce_collections?.crop_categories?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary-700">LKR {p.net_amount_lkr?.toLocaleString('en-LK')}</p>
                      <span className={`badge text-xs ${p.status === 'paid' ? 'badge-success' : p.status === 'approved' ? 'badge-info' : 'badge-neutral'}`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Animated Corn Bot Floating Button (Bottom Right) ──────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        <button
          onClick={() => setShowBotModal(true)}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-amber-400 via-emerald-600 to-emerald-700 hover:from-amber-300 hover:to-emerald-600 text-white font-extrabold px-4.5 py-3 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/90 animate-corn-pulse"
          title={t('ask_sara_ketha_bot')}
        >
          {/* Animated corn icon badge container */}
          <div className="relative w-10 h-10 bg-white/95 rounded-full flex items-center justify-center shadow-md animate-corn-float">
            <span className="text-2xl select-none transform group-hover:rotate-12 transition-transform duration-300">🌽</span>
            <Sparkles size={12} className="absolute -top-1 -right-1 text-amber-500 animate-kernel-sparkle" />
          </div>

          <div className="flex flex-col text-left pr-1.5">
            <span className="text-xs font-black tracking-tight text-white leading-tight flex items-center gap-1">
              Ask Sara Ketha Bot
              <Sparkles size={12} className="text-amber-300 inline-block" />
            </span>
            <span className="text-[10px] font-semibold text-emerald-100/90">Smart Crop Advisor</span>
          </div>

          {/* Glowing aura behind corn */}
          <span className="absolute -inset-1 bg-amber-400/30 rounded-full blur-md group-hover:bg-amber-400/50 transition-all -z-10 animate-pulse" />
        </button>
      </div>

      {/* ─── Crop AI Conversational Assistant Modal Component ─────────────────── */}
      <FarmerCropBotModal isOpen={showBotModal} onClose={() => setShowBotModal(false)} />
    </div>
  );
};
