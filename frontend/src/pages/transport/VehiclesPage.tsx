import React from 'react';
import { Truck } from 'lucide-react';

export const VehiclesPage: React.FC = () => {
  const fleet = [
    { id: '1', number: 'WP-DA-4521', type: 'Refrigerated Truck 5T', driver: 'Saman Kumara', status: 'active', location: 'Colombo' },
    { id: '2', number: 'WP-LB-8890', type: 'Covered Lorry 10T', driver: 'Nimal Bandara', status: 'in_transit', location: 'Kandy Road' },
    { id: '3', number: 'CP-GA-1204', type: 'Pick-up Truck 1.5T', driver: 'Sunil Rathnayake', status: 'active', location: 'Dambulla' },
    { id: '4', number: 'SP-KA-9012', type: 'Refrigerated Van 2T', driver: 'Kamal Silva', status: 'maintenance', location: 'Garage' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Management</h1>
          <p className="page-subtitle">Registered logistics vehicles and transport assets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {fleet.map(v => (
          <div key={v.id} className="card-hover p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <Truck size={20} className="text-primary-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-surface-900 font-mono">{v.number}</h3>
                <p className="text-xs text-surface-500">{v.type}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-surface-600">
              <p>Driver: <span className="font-medium text-surface-800">{v.driver}</span></p>
              <p>Location: <span className="text-surface-700">{v.location}</span></p>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-100">
              <span className={`badge text-xs ${v.status === 'active' ? 'badge-success' : v.status === 'in_transit' ? 'badge-primary' : 'badge-warning'}`}>
                {v.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
