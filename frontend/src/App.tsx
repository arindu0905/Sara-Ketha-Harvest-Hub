import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InspectionReport } from './pages/shared/InspectionReport';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute';

// Layouts
import { DashboardLayout } from './layouts/DashboardLayout';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { UnauthorizedPage } from './pages/public/UnauthorizedPage';
import { NotFoundPage } from './pages/public/NotFoundPage';
import { PricesPublicPage } from './pages/public/PricesPublicPage';

// Farmer Pages
import { FarmerDashboard } from './pages/farmer/FarmerDashboard';
import { FarmerProfile } from './pages/farmer/FarmerProfile';
import { FarmerCrops } from './pages/farmer/FarmerCrops';
import { RegisterCrop } from './pages/farmer/RegisterCrop';
import { ScheduleDelivery } from './pages/farmer/ScheduleDelivery';
import { MyAppointments } from './pages/farmer/MyAppointments';
import { MyCollections } from './pages/farmer/MyCollections';
import { CollectionDetail } from './pages/farmer/CollectionDetail';
import { MyPayments } from './pages/farmer/MyPayments';
import { MyComplaints } from './pages/farmer/MyComplaints';
import { SubmitComplaint } from './pages/farmer/SubmitComplaint';
import { MyProduceAuctions } from './pages/farmer/MyProduceAuctions';

// Officer Pages
import { OfficerDashboard } from './pages/officer/OfficerDashboard';
import { FarmerDirectory } from './pages/officer/FarmerDirectory';
import { RegisterFarmer } from './pages/officer/RegisterFarmer';
import { FarmerVerification } from './pages/officer/FarmerVerification';
import { DeliveryAppointments } from './pages/officer/DeliveryAppointments';
import { RegisterCollection } from './pages/officer/RegisterCollection';
import { WeighProduce } from './pages/officer/WeighProduce';
import { CollectionHistory } from './pages/officer/CollectionHistory';
import { CollectionCentresOfficer } from './pages/officer/CollectionCentresOfficer';
import { CreateLiveAuction } from './pages/officer/CreateLiveAuction';

// Inspector Pages
import { InspectorDashboard } from './pages/inspector/InspectorDashboard';
import { PendingInspections } from './pages/inspector/PendingInspections';
import { CreateInspection } from './pages/inspector/CreateInspection';
import { InspectionHistory } from './pages/inspector/InspectionHistory';
import { QualityAnalytics } from './pages/inspector/QualityAnalytics';

// Inventory Pages
import { InventoryDashboard } from './pages/inventory/InventoryDashboard';
import { CurrentInventory } from './pages/inventory/CurrentInventory';
import { BatchDetails } from './pages/inventory/BatchDetails';
import { WarehousesPage } from './pages/inventory/WarehousesPage';
import { NearExpiryStock } from './pages/inventory/NearExpiryStock';
import { WastageRecords } from './pages/inventory/WastageRecords';

// Buyer Pages
import { BuyerDashboard } from './pages/buyer/BuyerDashboard';
import { ProductMarketplace } from './pages/buyer/ProductMarketplace';
import { CreateOrder } from './pages/buyer/CreateOrder';
import { MyOrders } from './pages/buyer/MyOrders';
import { OrderDetails } from './pages/buyer/OrderDetails';
import { BuyerInvoices } from './pages/buyer/BuyerInvoices';

// Finance Pages
import { FinanceDashboard } from './pages/finance/FinanceDashboard';
import { PendingPayments } from './pages/finance/PendingPayments';
import { CalculatePayment } from './pages/finance/CalculatePayment';
import { ApprovePayments } from './pages/finance/ApprovePayments';
import { PaymentHistory } from './pages/finance/PaymentHistory';
import { BuyerInvoicesFinance } from './pages/finance/BuyerInvoicesFinance';
import { FarmerInvoicesFinance } from './pages/finance/FarmerInvoicesFinance';
import { FinancialReports } from './pages/finance/FinancialReports';

// Transport Pages
import { TransportDashboard } from './pages/transport/TransportDashboard';
import { DeliverySchedule } from './pages/transport/DeliverySchedule';
import { ActiveDeliveries } from './pages/transport/ActiveDeliveries';
import { VehiclesPage } from './pages/transport/VehiclesPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { CropCategories } from './pages/admin/CropCategories';
import { CategoryProductsPage } from './pages/admin/CategoryProductsPage';
import { PriceManagement } from './pages/admin/PriceManagement';
import { CollectionCentres } from './pages/admin/CollectionCentres';
import { AuditLogs } from './pages/admin/AuditLogs';
import { SystemSettings } from './pages/admin/SystemSettings';
import { AdminReports } from './pages/admin/AdminReports';
import { ManagementReports } from './pages/admin/ManagementReports';
import { OutstandingPayments } from './pages/finance/OutstandingPayments';
import { AdminAuctionDetailPage } from './pages/admin/AdminAuctionDetailPage';

// Shared
import { NotificationsPage } from './pages/shared/NotificationsPage';

// ─── Auction Module Pages ────────────────────────────────────────────────────
import { AuctionMarketplacePage } from './pages/public/AuctionMarketplacePage';
import { AuctionDetailPage } from './pages/buyer/AuctionDetailPage';
import { MyBidsPage } from './pages/buyer/MyBidsPage';
import { WonAuctionsPage } from './pages/buyer/WonAuctionsPage';
import { AuctionPaymentPage } from './pages/buyer/AuctionPaymentPage';
import { AuctionDashboardPage } from './pages/inventory/AuctionDashboardPage';
import { AuctionAwardPage } from './pages/inventory/AuctionAwardPage';
import { CreateAuctionPage } from './pages/inventory/CreateAuctionPage';
import { AuctionReportsPage } from './pages/admin/AuctionReportsPage';
import { LiveAuctionMonitor } from './pages/admin/LiveAuctionMonitor';
import { LiveAuctionView } from './components/auction/LiveAuctionView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ─── Public Routes ───────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/prices" element={<PricesPublicPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />

            {/* ─── Farmer Routes ───────────────────────────────── */}
            <Route path="/farmer" element={
              <ProtectedRoute allowedRoles={['farmer']}>
                <DashboardLayout role="farmer" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<FarmerDashboard />} />
              <Route path="profile" element={<FarmerProfile />} />
              <Route path="crops" element={<FarmerCrops />} />
              <Route path="crops/register" element={<RegisterCrop />} />
              <Route path="schedule" element={<ScheduleDelivery />} />
              <Route path="appointments" element={<MyAppointments />} />
              <Route path="collections" element={<MyCollections />} />
              <Route path="collections/:id" element={<CollectionDetail />} />
              <Route path="payments" element={<MyPayments />} />
              <Route path="complaints" element={<MyComplaints />} />
              <Route path="complaints/submit" element={<SubmitComplaint />} />
              {/* Auction routes for farmers */}
              <Route path="auction/my-produce" element={<MyProduceAuctions />} />
              <Route path="auction/live" element={<LiveAuctionView role="farmer" basePath="/farmer" />} />
              <Route path="auction/:id" element={<AuctionDetailPage />} />
              <Route path="auction/settlements" element={<AuctionMarketplacePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Officer Routes ──────────────────────────────── */}
            <Route path="/officer" element={
              <ProtectedRoute allowedRoles={['collection_centre_officer']}>
                <DashboardLayout role="collection_centre_officer" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<OfficerDashboard />} />
              <Route path="farmers" element={<FarmerDirectory />} />
              <Route path="farmers/register" element={<RegisterFarmer />} />
              <Route path="farmers/:id/verify" element={<FarmerVerification />} />
              <Route path="appointments" element={<DeliveryAppointments />} />
              <Route path="collections/register" element={<RegisterCollection />} />
              <Route path="collections/:id/weigh" element={<WeighProduce />} />
              <Route path="collection/:id/weigh" element={<WeighProduce />} />
              <Route path="inspect/:collectionId" element={<CreateInspection />} />
              <Route path="inspections/create/:collectionId" element={<CreateInspection />} />
              <Route path="collections" element={<CollectionHistory />} />
              <Route path="centres" element={<CollectionCentresOfficer />} />
              <Route path="centres/register" element={<CollectionCentresOfficer />} />
              <Route path="auctions/create-live" element={<CreateLiveAuction />} />
              <Route path="auctions/live" element={<LiveAuctionView role="buyer" basePath="/officer" />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Inspector Routes ────────────────────────────── */}
            <Route path="/inspector" element={
              <ProtectedRoute allowedRoles={['quality_inspector']}>
                <DashboardLayout role="quality_inspector" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<InspectorDashboard />} />
              <Route path="pending" element={<PendingInspections />} />
              <Route path="inspect/:collectionId" element={<CreateInspection />} />
              <Route path="inspections/create/:collectionId" element={<CreateInspection />} />
              <Route path="history" element={<InspectionHistory />} />
              <Route path="analytics" element={<QualityAnalytics />} />
              <Route path="auctions/create-live" element={<CreateLiveAuction />} />
              <Route path="auctions/live" element={<LiveAuctionView role="buyer" basePath="/inspector" />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Inventory Routes ────────────────────────────── */}
            <Route path="/inventory" element={
              <ProtectedRoute allowedRoles={['inventory_manager']}>
                <DashboardLayout role="inventory_manager" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<InventoryDashboard />} />
              <Route path="current" element={<CurrentInventory />} />
              <Route path="stock" element={<CurrentInventory />} />
              <Route path="stock/:id" element={<BatchDetails />} />
              <Route path="batch/:id" element={<BatchDetails />} />
              <Route path="batches/:id" element={<BatchDetails />} />
              <Route path="orders" element={<MyOrders />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="warehouses" element={<WarehousesPage />} />
              <Route path="near-expiry" element={<NearExpiryStock />} />
              <Route path="wastage" element={<WastageRecords />} />
              {/* Auction routes for inventory managers */}
              <Route path="auction/dashboard" element={<AuctionDashboardPage />} />
              <Route path="auction/create" element={<CreateAuctionPage />} />
              <Route path="auction/monitor" element={<LiveAuctionMonitor />} />
              <Route path="auction/reports" element={<AuctionReportsPage />} />
              <Route path="auction/approval" element={<AuctionReportsPage />} />
              <Route path="auction/:id" element={<AdminAuctionDetailPage />} />
              <Route path="auction/award" element={<AuctionDashboardPage />} />
              <Route path="auction/:id/award" element={<AuctionAwardPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Buyer Routes ────────────────────────────────── */}
            <Route path="/buyer" element={
              <ProtectedRoute allowedRoles={['buyer']}>
                <DashboardLayout role="buyer" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<BuyerDashboard />} />
              <Route path="marketplace" element={<ProductMarketplace />} />
              <Route path="orders/new" element={<CreateOrder />} />
              <Route path="orders/create" element={<CreateOrder />} />
              <Route path="orders" element={<MyOrders />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="invoices" element={<BuyerInvoices />} />
              {/* Auction routes for buyers */}
              <Route path="auction" element={<LiveAuctionView role="buyer" basePath="/buyer" />} />
              <Route path="auction/:id" element={<AuctionDetailPage />} />
              <Route path="auction/my-bids" element={<MyBidsPage />} />
              <Route path="auction/won" element={<WonAuctionsPage />} />
              <Route path="auction/watchlist" element={<AuctionMarketplacePage />} />
              <Route path="auction/:id/pay" element={<AuctionPaymentPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Finance Routes ──────────────────────────────── */}
            <Route path="/finance" element={
              <ProtectedRoute allowedRoles={['finance_officer']}>
                <DashboardLayout role="finance_officer" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<FinanceDashboard />} />
              <Route path="payments/pending" element={<PendingPayments />} />
              <Route path="pending" element={<PendingPayments />} />
              <Route path="payments/calculate" element={<CalculatePayment />} />
              <Route path="payments/calculate/:collectionId" element={<CalculatePayment />} />
              <Route path="calculate/:collectionId" element={<CalculatePayment />} />
              <Route path="payments/approve" element={<ApprovePayments />} />
              <Route path="approve" element={<ApprovePayments />} />
              <Route path="payments/history" element={<PaymentHistory />} />
              <Route path="history" element={<PaymentHistory />} />
              <Route path="invoices" element={<BuyerInvoicesFinance />} />
              <Route path="farmer-invoices" element={<FarmerInvoicesFinance />} />
              <Route path="reports" element={<FinancialReports />} />
              <Route path="management-reports" element={<ManagementReports />} />
              <Route path="outstanding" element={<OutstandingPayments />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Transport Routes ────────────────────────────── */}
            <Route path="/transport" element={
              <ProtectedRoute allowedRoles={['transport_coordinator']}>
                <DashboardLayout role="transport_coordinator" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<TransportDashboard />} />
              <Route path="schedule" element={<DeliverySchedule />} />
              <Route path="active" element={<ActiveDeliveries />} />
              <Route path="vehicles" element={<VehiclesPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Admin Routes ────────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['administrator']}>
                <DashboardLayout role="administrator" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="orders" element={<MyOrders />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="categories" element={<CropCategories />} />
              <Route path="categories/:id" element={<CategoryProductsPage />} />
              <Route path="prices" element={<PriceManagement />} />
              <Route path="centres" element={<CollectionCentres />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<SystemSettings />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="management-reports" element={<ManagementReports />} />
              {/* Auction routes for administrators */}
              <Route path="auction/approval" element={<AuctionReportsPage />} />
              <Route path="auction/monitor" element={<LiveAuctionMonitor />} />
              <Route path="auction/monitoring" element={<LiveAuctionMonitor />} />
              <Route path="auction/reports" element={<AuctionReportsPage />} />
              <Route path="auction/create" element={<CreateAuctionPage />} />
              <Route path="auction/:id" element={<AdminAuctionDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Manager Routes (read-only management reporting) ─ */}
            <Route path="/manager" element={
              <ProtectedRoute allowedRoles={['manager']}>
                <DashboardLayout role="manager" />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="inspection-report/:collectionId" element={<InspectionReport />} />
              <Route path="dashboard" element={<ManagementReports />} />
              <Route path="management-reports" element={<ManagementReports />} />
              <Route path="orders" element={<MyOrders />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="outstanding" element={<OutstandingPayments />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* ─── Catch All ───────────────────────────────────── */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#1e293b',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
            },
          }}
        />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
