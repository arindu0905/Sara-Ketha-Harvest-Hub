import apiClient from './apiClient';
import type {
  CreateAuctionFormData, CreateLotFormData, PlaceBidFormData,
  ConfirmPaymentFormData,
} from '../types/auction';

// ─── Auction CRUD ─────────────────────────────────────────────────────────────

export const auctionApi = {
  // Public / marketplace
  list: (params?: Record<string, string | number>) =>
    apiClient.get('/auctions', { params }),

  getById: (id: string) =>
    apiClient.get(`/auctions/${id}`),

  getBids: (id: string) =>
    apiClient.get(`/auctions/${id}/bids`),

  getEvents: (id: string) =>
    apiClient.get(`/auctions/${id}/events`),

  getResults: (params?: Record<string, string>) =>
    apiClient.get('/auctions/results', { params: { status: 'completed', ...params } }),

  // Buyer self-service
  getMyBids: () =>
    apiClient.get('/auctions/my-bids'),

  getWonAuctions: () =>
    apiClient.get('/auctions/won'),

  // Watchlist
  addToWatchlist: (auctionId: string) =>
    apiClient.post(`/auctions/${auctionId}/watch`),

  removeFromWatchlist: (auctionId: string) =>
    apiClient.delete(`/auctions/${auctionId}/watch`),

  getWatchlist: () =>
    apiClient.get('/auctions/watchlist'),

  // Farmer
  getMyProduceAuctions: () =>
    apiClient.get('/auctions/my-produce'),

  getSettlement: (settlementId: string) =>
    apiClient.get(`/auctions/settlements/${settlementId}`),

  calculateSettlement: (data: { auction_id: string; lot_id: string }) =>
    apiClient.post('/auctions/settlements/calculate', data),

  // Inventory Manager
  create: (data: CreateAuctionFormData) =>
    apiClient.post('/auctions', data),

  update: (id: string, data: Partial<CreateAuctionFormData>) =>
    apiClient.put(`/auctions/${id}`, data),

  getCentreAuctions: (params?: Record<string, string>) =>
    apiClient.get('/auctions/my-centre', { params }),

  // Lots
  createLot: (auctionId: string, data: CreateLotFormData) =>
    apiClient.post(`/auctions/${auctionId}/lots`, data),

  updateLot: (auctionId: string, lotId: string, data: Partial<CreateLotFormData>) =>
    apiClient.put(`/auctions/${auctionId}/lots/${lotId}`, data),

  deleteLot: (auctionId: string, lotId: string) =>
    apiClient.delete(`/auctions/${auctionId}/lots/${lotId}`),

  // Workflow transitions
  submit: (id: string) =>
    apiClient.post(`/auctions/${id}/submit`),

  approve: (id: string) =>
    apiClient.post(`/auctions/${id}/approve`),

  publish: (id: string) =>
    apiClient.post(`/auctions/${id}/publish`),

  open: (id: string) =>
    apiClient.post(`/auctions/${id}/open`),

  pause: (id: string) =>
    apiClient.post(`/auctions/${id}/pause`),

  resume: (id: string) =>
    apiClient.post(`/auctions/${id}/resume`),

  close: (id: string) =>
    apiClient.post(`/auctions/${id}/close`),

  cancel: (id: string, reason: string) =>
    apiClient.post(`/auctions/${id}/cancel`, { cancellation_reason: reason }),

  // Bidding
  placeBid: (auctionId: string, lotId: string, data: PlaceBidFormData) =>
    apiClient.post(`/auctions/${auctionId}/lots/${lotId}/bids`, data),

  // Award
  getAwardBoard: (auctionId: string) =>
    apiClient.get(`/auctions/${auctionId}/award-board`),

  awardLot: (auctionId: string, lotId: string) =>
    apiClient.post(`/auctions/${auctionId}/lots/${lotId}/award`),

  offerToNextBidder: (auctionId: string, lotId: string, reason: string) =>
    apiClient.post(`/auctions/${auctionId}/lots/${lotId}/offer-next`, { reason }),

  // Invoice
  getInvoice: (auctionId: string, lotId: string) =>
    apiClient.get(`/auctions/${auctionId}/lots/${lotId}/invoice`),

  // Payment
  confirmPayment: (auctionId: string, data: ConfirmPaymentFormData) =>
    apiClient.post(`/auctions/${auctionId}/payment`, data),

  markPaymentDefault: (auctionId: string, data: { winner_id: string; reason: string }) =>
    apiClient.post(`/auctions/${auctionId}/payment-default`, data),

  // Disputes
  submitDispute: (data: {
    auction_id: string;
    auction_lot_id?: string;
    dispute_type: string;
    description: string;
    evidence_urls?: string[];
  }) =>
    apiClient.post(`/auctions/${data.auction_id}/disputes`, data),

  resolveDispute: (auctionId: string, disputeId: string, data: {
    status: string;
    resolution?: string;
  }) =>
    apiClient.patch(`/auctions/${auctionId}/disputes/${disputeId}`, data),

  getAllDisputes: () =>
    apiClient.get('/auctions/disputes'),

  // Admin
  getAuditLogs: () =>
    apiClient.get('/auctions/admin/audit'),

  getReports: (params?: { from?: string; to?: string }) =>
    apiClient.get('/auctions/admin/reports', { params }),

  getBuyerEligibility: () =>
    apiClient.get('/auctions/buyers/eligibility'),

  getCreditLimits: () =>
    apiClient.get('/auctions/credit-limits'),

  setCreditLimit: (buyerId: string, data: { credit_limit_lkr: number; notes?: string }) =>
    apiClient.put(`/auctions/buyers/${buyerId}/credit-limit`, data),
};
