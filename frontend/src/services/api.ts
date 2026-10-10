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

  getDocuments: (id: string) =>
    apiClient.get(`/farmers/${id}/documents`),

  uploadDocument: (id: string, data: { doc_type: string; file_name: string; data: string; notes?: string }) =>
    apiClient.post(`/farmers/${id}/documents`, data),

  verifyDocument: (id: string, docId: string, is_verified = true) =>
    apiClient.patch(`/farmers/${id}/documents/${docId}/verify`, { is_verified }),

  deleteDocument: (id: string, docId: string) =>
    apiClient.delete(`/farmers/${id}/documents/${docId}`),
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

  getVarietiesByCategory: (categoryId: string) =>
    apiClient.get(`/crops/categories/${categoryId}`),

  uploadVarietyImage: (id: string, image: string) =>
    apiClient.post(`/crops/varieties/${id}/image`, { image }),

  removeVarietyImage: (id: string) =>
    apiClient.delete(`/crops/varieties/${id}/image`),

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

  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status, reason }),

  cancel: (id: string, reason?: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status: 'cancelled', reason }),
};

// ─── Collections ─────────────────────────────────────────────────
export const collectionsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/collections', { params }),

  getById: (id: string) =>
    apiClient.get(`/collections/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/collections', data),

  weigh: (id: string, data: { gross_weight_kg: number; container_weight_kg: number; container_count?: number; container_type?: string }) =>
    apiClient.post(`/collections/${id}/weigh`, data),

  updateStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/collections/${id}/status`, { status, notes }),

  complete: (id: string) =>
    apiClient.post(`/collections/${id}/complete`),

  // E1-US8 / E2-US5 digital receipts
  getReceipts: (params?: Record<string, string>) =>
    apiClient.get('/collections/receipts', { params }),

  getReceipt: (id: string) =>
    apiClient.get(`/collections/${id}/receipt`),

  // quality inspection report (batch code, weights, quality, farmer)
  getReport: (id: string) =>
    apiClient.get(`/collections/${id}/report`),

  issueReceipt: (id: string) =>
    apiClient.post(`/collections/${id}/receipt`),

  confirmReceipt: (id: string, data: { accept: boolean; note?: string }) =>
    apiClient.post(`/collections/${id}/receipt/confirm`, data),
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

  uploadImages: (id: string, images: { data: string; caption?: string; image_type?: string }[]) =>
    apiClient.post(`/inspections/${id}/images`, { images }),

  getImages: (id: string) =>
    apiClient.get(`/inspections/${id}/images`),

  deleteImage: (id: string, imageId: string) =>
    apiClient.delete(`/inspections/${id}/images/${imageId}`),
};

// ─── Inventory ───────────────────────────────────────────────────
export const inventoryApi = {
  getSummary: () =>
    apiClient.get('/inventory/summary'),

  getMarketplace: (categoryId: string) =>
    apiClient.get(`/inventory/marketplace/${categoryId}`),

  getAll: (params?: Record<string, string>) =>
    apiClient.get('/inventory', { params }),

  getById: (id: string) =>
    apiClient.get(`/inventory/${id}`),

  adjust: (id: string, data: Record<string, unknown>) =>
    apiClient.post(`/inventory/${id}/adjust`, data),

  transfer: (id: string, data: { warehouse_id: string; storage_location_id?: string; notes?: string }) =>
    apiClient.post(`/inventory/${id}/transfer`, data),

  assignLocation: (id: string, data: { warehouse_id: string; storage_location_id?: string; notes?: string }) =>
    apiClient.post(`/inventory/${id}/assign-location`, data),

  getExpiry: () =>
    apiClient.get('/inventory/expiry'),

  getExpiryRecords: (params?: Record<string, string>) =>
    apiClient.get('/inventory/expiry/records', { params }),

  runExpirySweep: () =>
    apiClient.post('/inventory/expiry/sweep'),

  getWastage: (params?: Record<string, string>) =>
    apiClient.get('/inventory/wastage', { params }),

  updateExpiry: (id: string, data: { expected_expiry_date: string; reason?: string }) =>
    apiClient.patch(`/inventory/${id}/expiry`, data),

  applyClearance: (id: string, discount_pct: number) =>
    apiClient.post(`/inventory/${id}/clearance`, { discount_pct }),

  recordWastage: (id: string, data: { quantity_kg: number; reason: string; notes?: string }) =>
    apiClient.post(`/inventory/${id}/wastage`, data),
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

  getFeedback: (id: string) =>
    apiClient.get(`/orders/${id}/feedback`),

  submitFeedback: (id: string, data: { rating: number; quality_rating?: number; delivery_rating?: number; comment?: string }) =>
    apiClient.post(`/orders/${id}/feedback`, data),
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

  getOutstanding: () =>
    apiClient.get('/invoices/outstanding'),

  getReceipts: (params?: Record<string, string>) =>
    apiClient.get('/invoices/receipts', { params }),
};

// ─── Farmer Payments ─────────────────────────────────────────────
export const farmerPaymentsApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/farmer-payments', { params }),

  getInvoices: (params?: Record<string, string>) =>
    apiClient.get('/farmer-payments/invoices', { params }),

  getById: (id: string) =>
    apiClient.get(`/farmer-payments/${id}`),

  calculate: (data: Record<string, unknown>) =>
    apiClient.post('/farmer-payments/calculate', data),

  approve: (id: string) =>
    apiClient.patch(`/farmer-payments/${id}/approve`),

  markPaid: (id: string, data: { payment_method: string; payment_date: string; reference_no?: string }) =>
    apiClient.patch(`/farmer-payments/${id}/mark-paid`, data),

  reject: (id: string, reason: string) =>
    apiClient.patch(`/farmer-payments/${id}/reject`, { reason }),

  getReceipt: (id: string) =>
    apiClient.get(`/farmer-payments/${id}/receipt`),
};

// ─── Deliveries ──────────────────────────────────────────────────
export const deliveriesApi = {
  getAll: (params?: Record<string, string>) =>
    apiClient.get('/deliveries', { params }),

  getById: (id: string) =>
    apiClient.get(`/deliveries/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/deliveries', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/deliveries/${id}`, data),

  updateStatus: (id: string, data: { status: string; location?: string; notes?: string }) =>
    apiClient.patch(`/deliveries/${id}/status`, data),

  delete: (id: string) =>
    apiClient.delete(`/deliveries/${id}`),

  // Fleet Vehicles
  getVehicles: () =>
    apiClient.get('/deliveries/vehicles'),

  createVehicle: (data: Record<string, unknown>) =>
    apiClient.post('/deliveries/vehicles', data),

  updateVehicle: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/deliveries/vehicles/${id}`, data),

  deleteVehicle: (id: string) =>
    apiClient.delete(`/deliveries/vehicles/${id}`),

  // Drivers
  getAvailability: (date: string, time?: string, exclude?: string) =>
    apiClient.get('/deliveries/availability', { params: { date, time: time || undefined, exclude } }),

  getDrivers: () =>
    apiClient.get('/deliveries/drivers'),

  createDriver: (data: Record<string, unknown>) =>
    apiClient.post('/deliveries/drivers', data),

  updateDriver: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/deliveries/drivers/${id}`, data),

  deleteDriver: (id: string) =>
    apiClient.delete(`/deliveries/drivers/${id}`),

  // Orders available for delivery
  getAvailableOrders: () =>
    apiClient.get('/deliveries/orders'),
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

  getFinancial: (params?: Record<string, string | undefined>) =>
    apiClient.get('/reports/financial', { params }),

  getWastage: () =>
    apiClient.get('/reports/wastage'),

  getOrders: () =>
    apiClient.get('/reports/orders'),

  /** Manager dashboard: operations, farmer/buyer performance, waste, forecast, prices, financials */
  getManagement: (params?: { from?: string; to?: string }) =>
    apiClient.get('/reports/management', { params }),

  /** CSV download (E4-US9). Returns a Blob. */
  exportCsv: (type: string, params?: { from?: string; to?: string }) =>
    apiClient.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
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

  deleteUser: (id: string) =>
    apiClient.delete(`/admin/users/${id}`),

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

  // ─── Farmer Verification ────────────────────────────────────────
  getPendingFarmers: (params?: Record<string, string>) =>
    apiClient.get('/admin/pending-farmers', { params }),

  verifyFarmer: (id: string, data: { verification_status: 'verified' | 'rejected' | 'pending'; notes?: string }) =>
    apiClient.patch(`/admin/farmers/${id}/verify`, data),
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

  getById: (id: string) =>
    apiClient.get(`/warehouses/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/warehouses', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/warehouses/${id}`, data),

  addLocation: (warehouseId: string, data: { code: string; description?: string; capacity_kg?: number }) =>
    apiClient.post(`/warehouses/${warehouseId}/locations`, data),

  updateLocation: (warehouseId: string, locId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/warehouses/${warehouseId}/locations/${locId}`, data),

  deleteLocation: (warehouseId: string, locId: string) =>
    apiClient.delete(`/warehouses/${warehouseId}/locations/${locId}`),
};

// ─── Collection Centres (Officer + Admin) ────────────────────────
export const centresApi = {
  getAll: () =>
    apiClient.get('/centres'),

  getById: (id: string) =>
    apiClient.get(`/centres/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/centres', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/centres/${id}`, data),
};
