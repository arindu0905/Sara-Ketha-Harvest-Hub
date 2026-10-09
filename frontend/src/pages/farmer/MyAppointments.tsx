import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '../../utils/apiError';
import { farmersApi, appointmentsApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCategoryForLanguage } from '../../utils/categoryUtils';
import { Calendar, Clock, MapPin, Leaf, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MyAppointments: React.FC = () => {
  const { t, language, formatDate } = useLanguage();

  const { data: farmerData } = useQuery({
    queryKey: ['farmer-me'],
    queryFn: async () => {
      const res = await farmersApi.getMe();
      return res.data?.data;
    },
  });

  const farmerId = farmerData?.id;
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: (id: string) => appointmentsApi.cancel(id),
    onSuccess: () => { toast.success('Appointment cancelled'); qc.invalidateQueries({ queryKey: ['farmer-appointments'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const { data: appointmentsRes, isLoading } = useQuery({
    queryKey: ['farmer-appointments', farmerId],
    queryFn: () => appointmentsApi.getAll({ farmer_id: farmerId! }),
    enabled: !!farmerId,
  });

  const appointments = appointmentsRes?.data?.data || [];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'scheduled': return <span className="badge-info">Awaiting confirmation</span>;
      case 'confirmed': return <span className="badge-success">Confirmed</span>;
      case 'completed': return <span className="badge-success">Completed</span>;
      case 'cancelled': return <span className="badge-danger">Cancelled</span>;
      case 'no_show': return <span className="badge-warning">Missed</span>;
      default: return <span className="badge-neutral">{String(status).replace(/_/g, ' ')}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="text-primary-600" size={26} /> {t('appointments')}
          </h1>
          <p className="page-subtitle">{t('appointments_subtitle') || 'Track your delivery appointments'}</p>
        </div>
        <Link to="/farmer/schedule" className="btn-primary btn-sm flex items-center gap-1.5">
          <Calendar size={14} /> + {t('schedule_delivery')}
        </Link>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : appointments.length === 0 ? (
        <div className="card">
          <div className="empty-state py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-surface-700 mb-2">{t('no_appointments') || 'No Appointments'}</h3>
            <p className="text-surface-400 text-sm max-w-sm mb-4">{t('schedule_delivery_subtitle') || 'Schedule a delivery to get started.'}</p>
            <Link to="/farmer/schedule" className="btn-primary btn-sm">{t('schedule_delivery')}</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <div key={apt.id} className="card p-5 hover:shadow-card-hover transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-surface-900">{apt.reference_no}</p>
                      {statusBadge(apt.status)}
                    </div>
                    <div className="space-y-1 text-sm text-surface-600">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-surface-400" />
                        <span>{formatDate(apt.scheduled_date)}</span>
                      </div>
                      {apt.crop_categories && (
                        <div className="flex items-center gap-2">
                          <Leaf size={14} className="text-surface-400" />
                          <span>{formatCategoryForLanguage(apt.crop_categories, language)}</span>
                        </div>
                      )}
                      {apt.collection_centres?.name && (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-surface-400" />
                          <span>{apt.collection_centres.name}</span>
                        </div>
                      )}
                      {apt.estimated_quantity_kg && (
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-surface-400" />
                          <span>{apt.estimated_quantity_kg} kg ({t('expected')})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {['scheduled', 'confirmed'].includes(apt.status) && (
                  <button className="btn-secondary btn-sm text-red-600" disabled={cancel.isPending}
                    onClick={() => { if (window.confirm(`Cancel appointment ${apt.reference_no}?`)) cancel.mutate(apt.id); }}>{t('cancel_appointment')}</button>
                )}
              </div>
              {apt.notes && (
                <p className="text-xs text-surface-400 mt-3 pl-16 italic">"{apt.notes}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
