import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { auctionApi } from '../services/auctionApi';
import toast from 'react-hot-toast';
import type {
  Auction, AuctionLot, AuctionBid, AuctionWinner,
  AuctionWatchlistItem, AuctionSettlement, PlaceBidFormData,
  CreateAuctionFormData, CreateLotFormData, ConfirmPaymentFormData,
  AuctionReportSummary,
} from '../types/auction';

// ─── Query key factory ────────────────────────────────────────────────────────

export const auctionKeys = {
  all:           ['auctions']                       as const,
  list:          (p?: object) => ['auctions', 'list', p] as const,
  detail:        (id: string) => ['auctions', 'detail', id] as const,
  bids:          (id: string) => ['auctions', 'bids', id] as const,
  events:        (id: string) => ['auctions', 'events', id] as const,
  myBids:        ['auctions', 'my-bids']            as const,
  won:           ['auctions', 'won']                as const,
  watchlist:     ['auctions', 'watchlist']          as const,
  myProduce:     ['auctions', 'my-produce']         as const,
  settlement:    (id: string) => ['auctions', 'settlement', id] as const,
  centre:        (p?: object) => ['auctions', 'centre', p] as const,
  reports:       (p?: object) => ['auctions', 'reports', p] as const,
  disputes:      ['auctions', 'disputes']           as const,
  creditLimits:  ['auctions', 'credit-limits']      as const,
  eligibility:   ['auctions', 'eligibility']        as const,
  auditLogs:     ['auctions', 'audit-logs']         as const,
};

// ─── Auction list ─────────────────────────────────────────────────────────────

export function useAuctions(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: auctionKeys.list(params),
    queryFn:  () => auctionApi.list(params).then((r) => r.data.data as Auction[]),
    staleTime: 15000,
  });
}

// ─── Single auction ───────────────────────────────────────────────────────────

export function useAuction(id: string, options?: Partial<UseQueryOptions<Auction>>) {
  return useQuery<Auction>({
    queryKey: auctionKeys.detail(id),
    queryFn:  () => auctionApi.getById(id).then((r) => r.data.data),
    enabled:  !!id,
    staleTime: 10000,
    refetchInterval: 15000,  // auto-refresh for live price updates
    ...options,
  });
}

// ─── Auction bids ─────────────────────────────────────────────────────────────

export function useAuctionBids(auctionId: string) {
  return useQuery<AuctionBid[]>({
    queryKey: auctionKeys.bids(auctionId),
    queryFn:  () => auctionApi.getBids(auctionId).then((r) => r.data.data),
    enabled:  !!auctionId,
    refetchInterval: 8000,
  });
}

// ─── Place bid ────────────────────────────────────────────────────────────────

export function usePlaceBid(auctionId: string, lotId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaceBidFormData) =>
      auctionApi.placeBid(auctionId, lotId, data).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Bid placed successfully!');
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
      queryClient.invalidateQueries({ queryKey: auctionKeys.bids(auctionId) });
      queryClient.invalidateQueries({ queryKey: auctionKeys.myBids });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Bid failed. Please try again.');
    },
  });
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export function useWatchlist() {
  return useQuery<AuctionWatchlistItem[]>({
    queryKey: auctionKeys.watchlist,
    queryFn:  () => auctionApi.getWatchlist().then((r) => r.data.data),
  });
}

export function useToggleWatchlist(auctionId: string) {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: () => auctionApi.addToWatchlist(auctionId),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: auctionKeys.watchlist }); },
  });
  const remove = useMutation({
    mutationFn: () => auctionApi.removeFromWatchlist(auctionId),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: auctionKeys.watchlist }); },
  });
  return { add, remove };
}

// ─── My bids & won auctions ───────────────────────────────────────────────────

export function useMyBids() {
  return useQuery<AuctionBid[]>({
    queryKey: auctionKeys.myBids,
    queryFn:  () => auctionApi.getMyBids().then((r) => r.data.data),
  });
}

export function useWonAuctions() {
  return useQuery<AuctionWinner[]>({
    queryKey: auctionKeys.won,
    queryFn:  () => auctionApi.getWonAuctions().then((r) => r.data.data),
  });
}

// ─── Farmer ───────────────────────────────────────────────────────────────────

export function useMyProduceAuctions() {
  return useQuery({
    queryKey: auctionKeys.myProduce,
    queryFn:  () => auctionApi.getMyProduceAuctions().then((r) => r.data.data),
  });
}

export function useAuctionSettlement(settlementId: string) {
  return useQuery<AuctionSettlement>({
    queryKey: auctionKeys.settlement(settlementId),
    queryFn:  () => auctionApi.getSettlement(settlementId).then((r) => r.data.data),
    enabled:  !!settlementId,
  });
}

// ─── Inventory Manager – create / manage ─────────────────────────────────────

export function useCentreAuctions(params?: Record<string, string>) {
  return useQuery<Auction[]>({
    queryKey: auctionKeys.centre(params),
    queryFn:  () => auctionApi.getCentreAuctions(params).then((r) => r.data.data),
    staleTime: 20000,
  });
}

export function useCreateAuction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAuctionFormData) =>
      auctionApi.create(data).then((r) => r.data.data as Auction),
    onSuccess: (data) => {
      toast.success(`Auction "${data.auction_number}" created`);
      queryClient.invalidateQueries({ queryKey: auctionKeys.all });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Failed to create auction');
    },
  });
}

export function useCreateLot(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLotFormData) =>
      auctionApi.createLot(auctionId, data).then((r) => r.data.data as AuctionLot),
    onSuccess: () => {
      toast.success('Lot added to auction');
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Failed to add lot');
    },
  });
}

// ─── Auction workflow actions ─────────────────────────────────────────────────

function useAuctionAction(fn: (id: string) => Promise<unknown>, successMsg: string, auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fn(auctionId),
    onSuccess: () => {
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
      queryClient.invalidateQueries({ queryKey: auctionKeys.centre() });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Action failed');
    },
  });
}

export const useSubmitAuction  = (id: string) => useAuctionAction((i) => auctionApi.submit(i),  'Auction submitted for approval', id);
export const useApproveAuction = (id: string) => useAuctionAction((i) => auctionApi.approve(i), 'Auction approved',               id);
export const usePublishAuction = (id: string) => useAuctionAction((i) => auctionApi.publish(i), 'Auction published',              id);
export const useOpenAuction    = (id: string) => useAuctionAction((i) => auctionApi.open(i),    'Auction is now open',            id);
export const usePauseAuction   = (id: string) => useAuctionAction((i) => auctionApi.pause(i),   'Auction paused',                 id);
export const useResumeAuction  = (id: string) => useAuctionAction((i) => auctionApi.resume(i),  'Auction resumed',                id);
export const useCloseAuction   = (id: string) => useAuctionAction((i) => auctionApi.close(i),   'Auction closed',                 id);

export function useCancelAuction(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => auctionApi.cancel(auctionId, reason),
    onSuccess: () => {
      toast.success('Auction cancelled');
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Cancel failed');
    },
  });
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function useConfirmPayment(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConfirmPaymentFormData) =>
      auctionApi.confirmPayment(auctionId, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Payment confirmed');
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(auctionId) });
      queryClient.invalidateQueries({ queryKey: auctionKeys.won });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Payment confirmation failed');
    },
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function useAuctionReports(params?: { from?: string; to?: string }) {
  return useQuery<AuctionReportSummary>({
    queryKey: auctionKeys.reports(params),
    queryFn:  () => auctionApi.getReports(params).then((r) => r.data.data),
    staleTime: 60000,
  });
}

export function useAuctionDisputes() {
  return useQuery({
    queryKey: auctionKeys.disputes,
    queryFn:  () => auctionApi.getAllDisputes().then((r) => r.data.data),
  });
}

export function useBuyerEligibility() {
  return useQuery({
    queryKey: auctionKeys.eligibility,
    queryFn:  () => auctionApi.getBuyerEligibility().then((r) => r.data.data),
  });
}

export function useCreditLimits() {
  return useQuery({
    queryKey: auctionKeys.creditLimits,
    queryFn:  () => auctionApi.getCreditLimits().then((r) => r.data.data),
  });
}

export function useSetCreditLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ buyerId, data }: { buyerId: string; data: { credit_limit_lkr: number; notes?: string } }) =>
      auctionApi.setCreditLimit(buyerId, data),
    onSuccess: () => {
      toast.success('Credit limit updated');
      queryClient.invalidateQueries({ queryKey: auctionKeys.creditLimits });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Failed to update credit limit');
    },
  });
}

export function useAuctionAuditLogs() {
  return useQuery({
    queryKey: auctionKeys.auditLogs,
    queryFn:  () => auctionApi.getAuditLogs().then((r) => r.data.data),
    staleTime: 30000,
  });
}
