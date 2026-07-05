import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { warmupApi } from './utils/apiWarmup';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import SellersPage from './pages/SellersPage';
import NewSellerPage from './pages/NewSellerPage';
import SellerDetailPage from './pages/SellerDetailPage';
import CallModePage from './pages/CallModePage';
import CallTranscriptionPage from './pages/CallTranscriptionPage';
import MeetingTranscriptionPage from './pages/MeetingTranscriptionPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import SettingsPage from './pages/SettingsPage';
import { PhoneSettingsPage } from './pages/PhoneSettingsPage';
import { CallHistoryPage } from './pages/CallHistoryPage';
import SalesSchedulePage from './pages/SalesSchedulePage';
import { CallStatisticsPage } from './pages/CallStatisticsPage';
import EmployeeCalendarStatusPage from './pages/EmployeeCalendarStatusPage';
import WorkTasksPage from './pages/WorkTasksPage';
import PropertyListingsPage from './pages/PropertyListingsPage';
import PropertyListingDetailPage from './pages/PropertyListingDetailPage';
import PropertyReportPage from './pages/PropertyReportPage';
import TsubotankaCalcPage from './pages/TsubotankaCalcPage';
import NearbyCasesPage from './pages/NearbyCasesPage';
import BuyersPage from './pages/BuyersPage';
import NewBuyerPage from './pages/NewBuyerPage';
import BuyerDetailPage from './pages/BuyerDetailPage';
import BuyerInquiryHistoryPage from './pages/BuyerInquiryHistoryPage';
import BuyerDesiredConditionsPage from './pages/BuyerDesiredConditionsPage';
import BuyerViewingResultPage from './pages/BuyerViewingResultPage';
import BuyerPurchaseRateStatisticsPage from './pages/BuyerPurchaseRateStatisticsPage';
import PublicPropertyListingPage from './pages/PublicPropertyListingPage';
import PublicPropertiesPage from './pages/PublicPropertiesPage';
import PublicPropertyDetailPage from './pages/PublicPropertyDetailPage';
import { PropertyListingSyncDashboard } from './pages/PropertyListingSyncDashboard';
import AreaReportPage from './pages/AreaReportPage';
import PortalMeritsPage from './pages/PortalMeritsPage';
import TemodoriCalcPage from './pages/TemodoriCalcPage';
import BuyerCandidateListPage from './pages/BuyerCandidateListPage';
import SharedItemsPage from './pages/SharedItemsPage';
import SharedItemDetailPage from './pages/SharedItemDetailPage';
import NewSharedItemPage from './pages/NewSharedItemPage';
import ReviewCampaignStatsPage from './pages/ReviewCampaignStatsPage';
import BuyerNearbyPropertiesPage from './pages/BuyerNearbyPropertiesPage';
import NearbyBuyersPage from './pages/NearbyBuyersPage';
import OtherCompanyDistributionPage from './pages/OtherCompanyDistributionPage';
import BuyerNearbyMapPage from './pages/BuyerNearbyMapPage';
import ReinsRegistrationPage from './pages/ReinsRegistrationPage';
import ManagementRulesTestPage from './pages/ManagementRulesTestPage';
import MansionJyuchoPage from './pages/MansionJyuchoPage';
import KenchikuGaiyoshoPage from './pages/KenchikuGaiyoshoPage';
import KoteiKazeiComparePage from './pages/KoteiKazeiComparePage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import SellerExclusiveAnalysisPage from './pages/SellerExclusiveAnalysisPage';
import SellerOtherDecisionAnalysisPage from './pages/SellerOtherDecisionAnalysisPage';
import AnalysisSummaryPage from './pages/AnalysisSummaryPage';
import SalesLearningLibraryPage from './pages/SalesLearningLibraryPage';
import PropertyPreviewPage from './pages/PropertyPreviewPage';
import TateuriPage from './pages/TateuriPage';
import TateuriManagePage from './pages/TateuriManagePage';
import FukuokaTateuriPage from './pages/FukuokaTateuriPage';
import FukuokaTateuriManagePage from './pages/FukuokaTateuriManagePage';
import TateuriRootPage from './pages/TateuriRootPage';
// FloorPlanComparePage は遅延読み込み（他ページへの影響を完全に分離）
const FloorPlanComparePage = lazy(() => import('./pages/FloorPlanComparePage'));
import ProtectedRoute from './components/ProtectedRoute';
import { GoogleMapsProvider } from './contexts/GoogleMapsContext';

// 認証不要の公開ページパス（checkAuth・warmupApiをスキップ）
const PUBLIC_PATHS = [
  '/property-preview/',
  '/public/',
  '/tateuri',
  '/fukuoka-tateuri',
  '/floor-plan-compare',
  '/login',
  '/auth/callback',
];

function App() {
  const location = useLocation();

  // 公開ページかどうか判定
  const isPublicPage = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));

  // アプリ起動時にウォームアップのみ実行（checkAuthはProtectedRouteに任せる）
  useEffect(() => {
    if (isPublicPage) return;
    // Vercelコールドスタート対策：バックエンドAPIをウォームアップ
    warmupApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <GoogleMapsProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Public routes - no authentication required */}
        <Route path="/public/properties" element={<PublicPropertiesPage />} />
        <Route path="/public/properties/:id" element={<PublicPropertyDetailPage />} />
        {/* 物件プレビュー（認証不要・買主向け公開ページ） */}
        <Route path="/property-preview/:slug" element={<PropertyPreviewPage />} />
        {/* 間取り図比較チェック（認証不要・外部公開） */}
        <Route path="/floor-plan-compare" element={
          <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>読み込み中...</div>}>
            <FloorPlanComparePage />
          </Suspense>
        } />
        {/* 建売専門HP（認証不要・公開） - ドメイン判定でルートパスに表示 */}
        <Route path="/tateuri-root" element={<TateuriRootPage />} />
        {/* 建売専門HP（認証不要・公開） - 大分専用パス（後方互換性） */}
        <Route path="/tateuri" element={<TateuriPage />} />
        {/* 建売専門HP管理（認証不要・スタッフ向け） */}
        <Route path="/tateuri/manage" element={<TateuriManagePage />} />
        {/* 福岡建売専門HP（認証不要・公開） - 福岡専用パス（後方互換性） */}
        <Route path="/fukuoka-tateuri" element={<FukuokaTateuriPage />} />
        {/* 福岡建売専門HP管理（認証不要・スタッフ向け） */}
        <Route path="/fukuoka-tateuri/manage" element={<FukuokaTateuriManagePage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SellersPage />
            </ProtectedRoute>
          }
        />
      <Route
        path="/sellers/new"
        element={
          <ProtectedRoute>
            <NewSellerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id"
        element={
          <ProtectedRoute>
            <SellerDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/call"
        element={
          <ProtectedRoute>
            <CallModePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/transcription"
        element={
          <ProtectedRoute>
            <CallTranscriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/sales-schedule"
        element={
          <ProtectedRoute>
            <SalesSchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meeting-transcription"
        element={
          <ProtectedRoute>
            <MeetingTranscriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity-logs"
        element={
          <ProtectedRoute>
            <ActivityLogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/phone"
        element={
          <ProtectedRoute>
            <PhoneSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calls/history"
        element={
          <ProtectedRoute>
            <CallHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calls/statistics"
        element={
          <ProtectedRoute>
            <CallStatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees/calendar-status"
        element={
          <ProtectedRoute>
            <EmployeeCalendarStatusPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/work-tasks"
        element={
          <ProtectedRoute>
            <WorkTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings"
        element={
          <ProtectedRoute>
            <PropertyListingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/sync/dashboard"
        element={
          <ProtectedRoute>
            <PropertyListingSyncDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber/buyer-candidates"
        element={
          <ProtectedRoute>
            <BuyerCandidateListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber/report"
        element={
          <ProtectedRoute>
            <PropertyReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber/tsubotanka"
        element={
          <ProtectedRoute>
            <TsubotankaCalcPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber/nearby-cases"
        element={
          <ProtectedRoute>
            <NearbyCasesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber/reins-registration"
        element={
          <ProtectedRoute>
            <ReinsRegistrationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/property-listings/:propertyNumber"
        element={
          <ProtectedRoute>
            <PropertyListingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers"
        element={
          <ProtectedRoute>
            <BuyersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/other-company-distribution"
        element={
          <ProtectedRoute>
            <OtherCompanyDistributionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/nearby-map"
        element={
          <ProtectedRoute>
            <BuyerNearbyMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/new"
        element={
          <ProtectedRoute>
            <NewBuyerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/purchase-rate-statistics"
        element={
          <ProtectedRoute>
            <BuyerPurchaseRateStatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/:buyer_number"
        element={
          <ProtectedRoute>
            <BuyerDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/:buyer_number/inquiry-history"
        element={
          <ProtectedRoute>
            <BuyerInquiryHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/:buyer_number/desired-conditions"
        element={
          <ProtectedRoute>
            <BuyerDesiredConditionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/:buyer_number/viewing-result"
        element={
          <ProtectedRoute>
            <BuyerViewingResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared-items"
        element={
          <ProtectedRoute>
            <SharedItemsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared-items/new"
        element={
          <ProtectedRoute>
            <NewSharedItemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared-items/review-stats"
        element={
          <ProtectedRoute>
            <ReviewCampaignStatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shared-items/:id"
        element={
          <ProtectedRoute>
            <SharedItemDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/buyers/:buyer_number/nearby-properties"
        element={
          <ProtectedRoute>
            <BuyerNearbyPropertiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/nearby-buyers"
        element={
          <ProtectedRoute>
            <NearbyBuyersPage />
          </ProtectedRoute>
        }
      />
      <Route path="/sellers/:sellerId/area-report" element={<AreaReportPage />} />
      <Route path="/sellers/:sellerId/portal-merits" element={<PortalMeritsPage />} />
      <Route path="/sellers/:sellerId/temodori-calc" element={<TemodoriCalcPage />} />
      <Route
        path="/sellers/:id/sales-history"
        element={
          <ProtectedRoute>
            <SalesHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/exclusive-analysis"
        element={
          <ProtectedRoute>
            <SellerExclusiveAnalysisPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/exclusive-analysis/summary"
        element={
          <ProtectedRoute>
            <AnalysisSummaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/other-decision-analysis"
        element={
          <ProtectedRoute>
            <SellerOtherDecisionAnalysisPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers/:id/other-decision-analysis/summary"
        element={
          <ProtectedRoute>
            <AnalysisSummaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales-learning-library"
        element={
          <ProtectedRoute>
            <SalesLearningLibraryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management-rules-test"
        element={
          <ProtectedRoute>
            <ManagementRulesTestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mansion-jyucho"
        element={
          <ProtectedRoute>
            <MansionJyuchoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kenchiku-gaiyosho"
        element={
          <ProtectedRoute>
            <KenchikuGaiyoshoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kotei-kazei-compare"
        element={
          <ProtectedRoute>
            <KoteiKazeiComparePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </GoogleMapsProvider>
  );
}

export default App;
