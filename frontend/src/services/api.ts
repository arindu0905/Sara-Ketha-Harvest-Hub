// ─── API Service Modules ────────────────────────────────────────
// All API calls go through apiClient which automatically injects the JWT token

import apiClient from './apiClient';

// ─── Auth ───────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; full_name: string; role?: string; phone?: string }) =>
    apiClient.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),

  logout: () =>
    apiClient.post('/auth/logout'),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  getMe: () =>
    apiClient.get('/auth/me'),

  refresh: (refresh_token: string) =>
    apiClient.post('/auth/refresh', { refresh_token }),
};

// ─── Farmers ────────────────────────────────────────────────────
export const farmersApi = {
  getMe: () =>
    apiClient.get('/farmers/me'),

  getAll: (params?: Record<string, string>) =>
    apiClient.get('/farmers', { params }),

  getById: (id: string) =>
    apiClient.get(`/farmers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/farmers', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/farmers/${id}`, data),

  updateStatus: (id: string, data: { verification_status?: string; account_status?: string; notes?: string }) =>
    apiClient.patch(`/farmers/${id}/status`, data),

  getCrops: (id: string) =>
    apiClient.get(`/farmers/${id}/crops`),

  getCollections: (id: string, params?: Record<string, string>) =>
    apiClient.get(`/farmers/${id}/collections`, { params }),

  getPayments: (id: string) =>
    apiClient.get(`/farmers/${id}/payments`),

  getDistricts: () =>
    apiClient.get('/farmers/districts'),
};

// ─── Crops ──────────────────────────────────────────────────────
export const cropsApi = {
  getCategories: () =>
    apiClient.get('/crops/categories'),

  getCategoryById: (id: string) =>
    apiClient.get(`/crops/categories/${id}`),

  createCategory: (data: Record<string, unknown>) =>
    apiClient.post('/crops/categories', data),

  updateCategory: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/crops/categories/${id}`, data),

  deleteCategory: (id: string) =>
    apiClient.delete(`/crops/categories/${id}`),

  createVariety: (categoryId: string, data: { name: string; description?: string }) =>
    apiClient.post(`/crops/categories/${categoryId}/varieties`, data),

  updateVariety: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/crops/varieties/${id}`, data),

  deleteVariety: (id: string) =>
    apiClient.delete(`/crops/varieties/${id}`),

  getAll: (params?: Record<string, string>) =>
    apiClient.get('/crops', { params }),

  getById: (id: string) =>
    apiClient.get(`/crops/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/crops', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/crops/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/crops/${id}`),
};

// ─── Prices ─────────────────────────────────────────────────────
export const pricesApi = {
  getCurrent: (params?: Record<string, string>) =>
    apiClient.get('/prices/current', { params }),

  getHistory: (params?: Record<string, string>) =>
    apiClient.get('/prices/history', { params }),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/prices', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/prices/${id}`, data),

  updateStatus: (id: string, status: string) =>
    apiClient.put(`/prices/${id}/status`, { status }),

  delete: (id: string) =>
    apiClient.delete(`/prices/${id}`),
};

// ─── Appointments ────────────────────────────────────────────────
export const appointmentsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/appointments', { params }),

  getById: (id: string) =>
    apiClient.get(`/appointments/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/appointments', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/appointments/${id}`, data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status }),
};

// ─── Collections ─────────────────────────────────────────────────
export const collectionsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/collections', { params }),

  getById: (id: string) =>
    apiClient.get(`/collections/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/collections', data),

  weigh: (id: string, data: { gross_weight_kg: number; container_weight_kg: number }) =>
    apiClient.post(`/collections/${id}/weigh`, data),

  updateStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/collections/${id}/status`, { status, notes }),

  complete: (id: string) =>
    apiClient.post(`/collections/${id}/complete`),
};

// ─── Inspections ─────────────────────────────────────────────────
export const inspectionsApi = {
  getPending: () =>
    apiClient.get('/inspections'),

  getById: (id: string) =>
    apiClient.get(`/inspections/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/inspections', data),

  approve: (id: string) =>
    apiClient.post(`/inspections/${id}/approve`),
};

// ─── Inventory ───────────────────────────────────────────────────
export const inventoryApi = {
  getSummary: () =>
    apiClient.get('/inventory/summary'),

  getAll: (params?: Record<string, string>) =>
    apiClient.get('/inventory', { params }),

  getById: (id: string) =>
    apiClient.get(`/inventory/${id}`),

  adjust: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/inventory/${id}/adjust`, data),

  transfer: (id: string, data: { warehouse_id: string; storage_location_id?: string; notes?: string }) =>
    apiClient.post(`/inventory/${id}/transfer`, data),
};

// ─── Orders ──────────────────────────────────────────────────────
export const ordersApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/orders', { params }),

  getById: (id: string) =>
    apiClient.get(`/orders/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/orders', data),

  updateStatus: (id: string, status: string, data?: Record<string, unknown>) =>
    apiClient.patch(`/orders/${id}/status`, { status, ...data }),

  allocate: (id: string) =>
    apiClient.post(`/orders/${id}/allocate`),

  cancel: (id: string, reason: string) =>
    apiClient.post(`/orders/${id}/cancel`, { reason }),
};

// ─── Invoices ────────────────────────────────────────────────────
export const invoicesApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/invoices', { params }),

  getById: (id: string) =>
    apiClient.get(`/invoices/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/invoices', data),

  recordPayment: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/invoices/${id}/payment`, data),
};

// ─── Farmer Payments ─────────────────────────────────────────────
export const farmerPaymentsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/farmer-payments', { params }),

  getById: (id: string) =>
    apiClient.get(`/farmer-payments/${id}`),

  calculate: (data: Record<string, unknown>) =>
    apiClient.post('/farmer-payments/calculate', data),

  approve: (id: string) =>
    apiClient.patch(`/farmer-payments/${id}/approve`),

  markPaid: (id: string, data: { payment_method: string; payment_date: string }) =>
    apiClient.patch(`/farmer-payments/${id}/mark-paid`, data),
};

// ─── Deliveries ──────────────────────────────────────────────────
export const deliveriesApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/deliveries', { params }),

  getById: (id: string) =>
    apiClient.get(`/deliveries/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/deliveries', data),

  updateStatus: (id: string, data: { status: string; location?: string; notes?: string }) =>
    apiClient.patch(`/deliveries/${id}/status`, data),
};

// ─── Complaints ──────────────────────────────────────────────────
export const complaintsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/complaints', { params }),

  getById: (id: string) =>
    apiClient.get(`/complaints/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/complaints', data),

  updateStatus: (id: string, data: { status: string; resolution?: string }) =>
    apiClient.patch(`/complaints/${id}/status`, data),

  addComment: (id: string, comment: string, is_internal = false) =>
    apiClient.post(`/complaints/${id}/comments`, { comment, is_internal }),
};

// ─── Reports ─────────────────────────────────────────────────────
export const reportsApi = {
  getDashboard: () =>
    apiClient.get('/reports/dashboard'),

  getCollections: (params?: Record<string, string>) =>
    apiClient.get('/reports/collections', { params }),

  getInventory: () =>
    apiClient.get('/reports/inventory'),

  getPayments: (params?: Record<string, string>) =>
    apiClient.get('/reports/payments', { params }),

  getFinancial: (params?: Record<string, string>) =>
    apiClient.get('/reports/financial', { params }),

  getWastage: () =>
    apiClient.get('/reports/wastage'),

  getOrders: () =>
    apiClient.get('/reports/orders'),
};

// ─── Admin ───────────────────────────────────────────────────────
export const adminApi = {
  getUsers: (params?: Record<string, string>) =>
    apiClient.get('/admin/users', { params }),

  createUser: (data: Record<string, unknown>) =>
    apiClient.post('/admin/users', data),

  updateRole: (id: string, role: string) =>
    apiClient.patch(`/admin/users/${id}/role`, { role }),

  updateStatus: (id: string, account_status: string) =>
    apiClient.patch(`/admin/users/${id}/status`, { account_status }),

  getAuditLogs: (params?: Record<string, string>) =>
    apiClient.get('/admin/audit-logs', { params }),

  getSettings: () =>
    apiClient.get('/admin/settings'),

  updateSetting: (key: string, value: string) =>
    apiClient.put(`/admin/settings/${key}`, { value }),

  getCentres: () =>
    apiClient.get('/admin/centres'),

  createCentre: (data: Record<string, unknown>) =>
    apiClient.post('/admin/centres', data),

  updateCentre: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/centres/${id}`, data),
};

// ─── Notifications ───────────────────────────────────────────────
export const notificationsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/notifications', { params }),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),
};

// ─── Buyers ──────────────────────────────────────────────────────
export const buyersApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/buyers', { params }),

  getById: (id: string) =>
    apiClient.get(`/buyers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/buyers', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/buyers/${id}`, data),
};

// ─── Warehouses ──────────────────────────────────────────────────
export const warehousesApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/warehouses', { params }),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/warehouses', data),
};
