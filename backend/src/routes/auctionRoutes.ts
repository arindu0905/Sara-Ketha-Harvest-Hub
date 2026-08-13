import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../middleware/auth';
import * as auction from '../controllers/auctionController';

const router = Router();

// ─── Bid-specific rate limiter (tighter: 30 bids/min per IP) ─────────────────
const bidLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: parseInt(process.env.AUCTION_BID_RATE_LIMIT_MAX || '30', 10),
  message: { success: false, message: 'Too many bids. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
});

// ─── Public / authenticated read endpoints ────────────────────────────────────

// GET /api/auctions – marketplace listing
router.get('/', authenticate, auction.listAuctions);

// GET /api/auctions/results – closed auction results
router.get('/results', authenticate, auction.listAuctions); // filtered by status in controller via query

// ─── Buyer self-service ───────────────────────────────────────────────────────

// GET /api/auctions/my-bids
router.get('/my-bids',
  authenticate,
  requireRole('buyer'),
  auction.getMyBids
);

// GET /api/auctions/won
router.get('/won',
  authenticate,
  requireRole('buyer'),
  auction.getWonAuctions
);

// GET /api/auctions/watchlist
router.get('/watchlist',
  authenticate,
  requireRole('buyer'),
  auction.getWatchlist
);

// ─── Inventory Manager centre auctions ───────────────────────────────────────

// GET /api/auctions/my-centre
router.get('/my-centre',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.getCentreAuctions
);

// ─── Farmer produce auctions ─────────────────────────────────────────────────

// GET /api/auctions/my-produce
router.get('/my-produce',
  authenticate,
  requireRole('farmer'),
  auction.getMyProduceAuctions
);

// ─── Admin & Finance ──────────────────────────────────────────────────────────

// GET /api/auctions/admin/audit
router.get('/admin/audit',
  authenticate,
  requireRole('administrator'),
  auction.getAuctionAuditLogs
);

// GET /api/auctions/admin/reports
router.get('/admin/reports',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.getAuctionReports
);

// GET /api/auctions/buyers/eligibility
router.get('/buyers/eligibility',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.getBuyerEligibility
);

// GET /api/auctions/disputes
router.get('/disputes',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.getAllDisputes
);

// PUT /api/auctions/buyers/:buyerId/credit-limit
router.put('/buyers/:buyerId/credit-limit',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.setCreditLimit
);

// GET /api/auctions/credit-limits
router.get('/credit-limits',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.getCreditLimits
);

// ─── Create auction (Inventory Manager) ──────────────────────────────────────

// POST /api/auctions
router.post('/',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.createAuction
);

// ─── Single auction endpoints ─────────────────────────────────────────────────

// GET /api/auctions/:id
router.get('/:id', authenticate, auction.getAuction);

// PUT /api/auctions/:id
router.put('/:id',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.updateAuction
);

// GET /api/auctions/:id/bids – bid history
router.get('/:id/bids', authenticate, auction.getAuctionBids);

// GET /api/auctions/:id/events – timeline
router.get('/:id/events',
  authenticate,
  requireRole('inventory_manager', 'finance_officer', 'administrator', 'collection_centre_officer'),
  auction.getAuctionEvents
);

// ─── Watchlist ────────────────────────────────────────────────────────────────

// POST /api/auctions/:id/watch
router.post('/:id/watch',
  authenticate,
  requireRole('buyer'),
  auction.addToWatchlist
);

// DELETE /api/auctions/:id/watch
router.delete('/:id/watch',
  authenticate,
  requireRole('buyer'),
  auction.removeFromWatchlist
);

// ─── Workflow transitions (officer / admin / inventory manager) ───────────────

// POST /api/auctions/:id/submit
router.post('/:id/submit',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.submitAuction
);

// POST /api/auctions/:id/approve
router.post('/:id/approve',
  authenticate,
  requireRole('administrator', 'collection_centre_officer'),
  auction.approveAuction
);

// POST /api/auctions/:id/publish
router.post('/:id/publish',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.publishAuction
);

// POST /api/auctions/:id/open
router.post('/:id/open',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.openAuction
);

// POST /api/auctions/:id/pause
router.post('/:id/pause',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.pauseAuction
);

// POST /api/auctions/:id/resume
router.post('/:id/resume',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.resumeAuction
);

// POST /api/auctions/:id/close
router.post('/:id/close',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.closeAuction
);

// POST /api/auctions/:id/cancel
router.post('/:id/cancel',
  authenticate,
  requireRole('administrator', 'inventory_manager'),
  auction.cancelAuction
);

// ─── Dispute endpoints ────────────────────────────────────────────────────────

// POST /api/auctions/:id/disputes
router.post('/:id/disputes',
  authenticate,
  auction.submitDispute
);

// PATCH /api/auctions/:id/disputes/:disputeId
router.patch('/:id/disputes/:disputeId',
  authenticate,
  requireRole('administrator'),
  auction.resolveDispute
);

// ─── Lot management ───────────────────────────────────────────────────────────

// POST /api/auctions/:id/lots
router.post('/:id/lots',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.createLot
);

// PUT /api/auctions/:id/lots/:lotId
router.put('/:id/lots/:lotId',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.updateLot
);

// DELETE /api/auctions/:id/lots/:lotId
router.delete('/:id/lots/:lotId',
  authenticate,
  requireRole('inventory_manager', 'administrator'),
  auction.deleteLot
);

// ─── Bid placement ────────────────────────────────────────────────────────────

// POST /api/auctions/:auctionId/lots/:lotId/bids
router.post('/:auctionId/lots/:lotId/bids',
  authenticate,
  requireRole('buyer'),
  bidLimiter,
  auction.placeBid
);

// ─── Award & Payment ──────────────────────────────────────────────────────────

// POST /api/auctions/:id/lots/:lotId/award
router.post('/:id/lots/:lotId/award',
  authenticate,
  requireRole('administrator', 'inventory_manager', 'finance_officer'),
  auction.awardLot
);

// POST /api/auctions/:id/lots/:lotId/offer-next
router.post('/:id/lots/:lotId/offer-next',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.offerToNextBidder
);

// GET /api/auctions/:id/lots/:lotId/invoice
router.get('/:id/lots/:lotId/invoice',
  authenticate,
  auction.getAuctionInvoice
);

// POST /api/auctions/:id/payment
router.post('/:id/payment',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.confirmPayment
);

// POST /api/auctions/:id/payment-default
router.post('/:id/payment-default',
  authenticate,
  requireRole('administrator', 'finance_officer'),
  auction.markPaymentDefault
);

// ─── Settlement ───────────────────────────────────────────────────────────────

// GET /api/auctions/settlements/:settlementId
router.get('/settlements/:settlementId',
  authenticate,
  auction.getFarmerSettlement
);

// POST /api/auctions/settlements/calculate
router.post('/settlements/calculate',
  authenticate,
  requireRole('finance_officer', 'administrator'),
  auction.calculateSettlement
);

export default router;
