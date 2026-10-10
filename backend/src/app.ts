import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { serveProductImage } from './controllers/cropController';
import { syncAuctionStatuses } from './services/auctionScheduler';
import morgan from 'morgan';
import compression from 'compression';

import { config } from './config/config';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/authRoutes';
import farmerRoutes from './routes/farmerRoutes';
import cropRoutes from './routes/cropRoutes';
import priceRoutes from './routes/priceRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import collectionRoutes from './routes/collectionRoutes';
import inspectionRoutes from './routes/inspectionRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import orderRoutes from './routes/orderRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import farmerPaymentRoutes from './routes/farmerPaymentRoutes';
import deliveryRoutes from './routes/deliveryRoutes';
import complaintRoutes from './routes/complaintRoutes';
import reportRoutes from './routes/reportRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './routes/notificationRoutes';
import buyerRoutes from './routes/buyerRoutes';
import warehouseRoutes from './routes/warehouseRoutes';
import centreRoutes from './routes/centreRoutes';
import auctionRoutes from './routes/auctionRoutes';
import botRoutes from './routes/botRoutes';

const app: Application = express();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    // In development, allow all localhost ports
    if (config.nodeEnv === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    // In production, only allow configured frontend URL
    // FRONTEND_URL may hold several comma-separated origins; a trailing slash is ignored
    const allowed = config.frontendUrl.split(',').map((u) => u.trim().replace(/\/$/, ''));
    if (allowed.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── General Rate Limiting ──────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Auth-specific Rate Limiting ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.authMaxRequests,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── HTTP Logging ──────────────────────────────────────────────────────────
app.use(morgan(
  config.nodeEnv === 'production' ? 'combined' : 'dev',
  {
    stream: { write: (message) => logger.http(message.trim()) },
    skip: (req) => req.path === '/health',
  }
));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'HarvestHub API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
// Scheduled trigger for hosts without a long-running process (e.g. Vercel Cron or any external pinger).
// Call GET /api/cron/auctions with "Authorization: Bearer <CRON_SECRET>" every minute to open/close auctions on time.
app.get('/api/cron/auctions', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    await syncAuctionStatuses();
    res.json({ success: true, ranAt: new Date().toISOString() });
  } catch (e) { next(e); }
});

// product photos are public (plain <img> tags cannot send a login token) and come straight from the database
app.get('/api/product-images/:id', serveProductImage);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/farmer-payments', farmerPaymentRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bot', botRoutes);

// ─── 404 & Error Handlers ──────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
