import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { sellerPortalApi, ValuationSummary, PropertySummary } from '../services/sellerPortalApi';
import SellerPortalHeader from '../components/sellerPortal/SellerPortalHeader';
import PropertySummaryCard from '../components/sellerPortal/PropertySummaryCard';
import ValuationCard from '../components/sellerPortal/ValuationCard';
import ValuationBreakdownCard from '../components/sellerPortal/ValuationBreakdownCard';
import NetProceedsCard from '../components/sellerPortal/NetProceedsCard';
import ScheduleCard from '../components/sellerPortal/ScheduleCard';
import ChatWidget from '../components/sellerPortal/ChatWidget';
import InstallPwaPrompt from '../components/sellerPortal/InstallPwaPrompt';
import InstallPwaBanner from '../components/sellerPortal/InstallPwaBanner';
import { setupPortalPwa } from '../utils/registerPortalPwa';

/**
 * 査定依頼者向け「売却サポートページ」トップ画面。
 * 認証不要（専用URLトークンで本人確認）。モバイルファースト。
 * ルート: /portal/:token
 */
export default function SellerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [sellerNumber, setSellerNumber] = useState('');
  const [valuation, setValuation] = useState<ValuationSummary | null>(null);
  const [propertySummary, setPropertySummary] = useState<PropertySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string>('general');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (!token) return;
    sellerPortalApi.saveToken(token);
    setupPortalPwa(token);

    (async () => {
      try {
        const res = await sellerPortalApi.getPortalTop(token);
        setSellerNumber(res.sellerNumber);
        setValuation(res.valuation);
        setPropertySummary(res.propertySummary);
      } catch (err: any) {
        setError(err.message || 'ページを表示できませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // 初回アクセス時、査定額を確認した後に「スマホに保存」の案内を出す（邪魔にならないタイミング）
  useEffect(() => {
    if (loading || error) return;
    const dismissed = localStorage.getItem('seller_portal_install_dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (dismissed || isStandalone) return;
    const timer = setTimeout(() => setShowInstallPrompt(true), 2500);
    return () => clearTimeout(timer);
  }, [loading, error]);

  const openChat = (contextTag: string) => {
    setChatContext(contextTag);
    setChatOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !token) {
    return (
      <Box sx={{ p: 3, maxWidth: 480, mx: 'auto', mt: 6 }}>
        <Alert severity="error">{error || 'URLが正しくありません'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f5f6f8', minHeight: '100vh', pb: 10 }}>
      <SellerPortalHeader sellerNumber={sellerNumber} />

      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {propertySummary && <PropertySummaryCard summary={propertySummary} />}

        {valuation && (
          <ValuationCard valuation={valuation} onAskQuestion={() => openChat('valuation')} />
        )}

        <ValuationBreakdownCard
          token={token}
          propertyType={valuation?.propertyType ?? 'other'}
          onAskQuestion={() => openChat('valuation_breakdown')}
        />

        <NetProceedsCard
          token={token}
          valuation={valuation}
          onAskQuestion={() => openChat('net_proceeds')}
        />

        <ScheduleCard
          token={token}
          valuation={valuation}
          onAskQuestion={() => openChat('schedule')}
        />

        <InstallPwaBanner />
      </Box>

      <ChatWidget
        token={token}
        open={chatOpen}
        contextTag={chatContext}
        onOpen={() => openChat('general')}
        onClose={() => setChatOpen(false)}
      />

      {showInstallPrompt && (
        <InstallPwaPrompt
          onDismiss={() => {
            localStorage.setItem('seller_portal_install_dismissed', '1');
            setShowInstallPrompt(false);
          }}
        />
      )}
    </Box>
  );
}
