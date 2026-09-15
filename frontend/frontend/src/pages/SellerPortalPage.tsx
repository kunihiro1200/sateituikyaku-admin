import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string>('general');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // 相談元（査定額/査定根拠/手残り/スケジュール/一般）ごとの未読件数。
  // スタッフはその相談元のセクションを見ながら返信するため、どのセクションに新しい返信があるか
  // 売主自身がひと目で分かるよう、各カードの「チャットで質問」ボタンに赤丸を表示する。
  const [unreadByContext, setUnreadByContext] = useState<Record<string, number>>({});

  // 未読件数を確認する（スタッフからの返信に売主が気づけるよう、チャットを開いていなくてもFABに表示する）
  const checkUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await sellerPortalApi.getMessages(token, { markAsRead: false });
      const byContext: Record<string, number> = {};
      let total = 0;
      for (const c of res.conversations) {
        const count = c.messages.filter((m: any) => m.sender_type === 'staff' && !m.read_at).length;
        if (count > 0) byContext[c.context_tag] = count;
        total += count;
      }
      setUnreadByContext(byContext);
      setUnreadCount(total);
    } catch {
      // 未読確認の失敗は画面に影響させない
    }
  }, [token]);

  // 初回表示時とページ復帰時（フォアグラウンド化）に未読を確認する
  useEffect(() => {
    checkUnread();
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkUnread]);

  useEffect(() => {
    if (!token) return;
    sellerPortalApi.saveToken(token);
    // sellerNumber（FI/AA判定）が分かるまでは、いふう表示で一旦セットアップする
    setupPortalPwa(token);

    (async () => {
      try {
        const res = await sellerPortalApi.getPortalTop(token);
        setSellerNumber(res.sellerNumber);
        setValuation(res.valuation);
        setPropertySummary(res.propertySummary);
        setPreferences(res.preferences);
        // FI売主番号ならホーム画面アイコン（apple-touch-icon）をくじら不動産のロゴに差し替える
        // （Androidのmanifest.jsonは同じ判定をバックエンド側で行っている）
        if ((res.sellerNumber || '').toUpperCase().includes('FI')) {
          setupPortalPwa(token, true);
        }
      } catch (err: any) {
        setError(err.message || 'ページを表示できませんでした');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // 初回アクセス時、査定額を確認した後に「保存」の案内を出す（邪魔にならないタイミング）
  // PC（Chrome/Edge等）でもPWAとしてインストールできるため、モバイルに限定せず案内する。
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
      {/*
        メールでURLを送った際に「大分の建売専門サイト｜株式会社いふう」（index.htmlのデフォルトタグ）が
        表示されてしまう問題への対応。このページ専用のタイトル・OGPタグで上書きする。
        LINE等でのプレビュー表示にも影響するため、メール件名と同じ「査定理由、手残り金額詳細」で統一する。
      */}
      <Helmet>
        <title>査定の根拠と手残りリスト</title>
        <meta name="description" content="査定額の根拠や手残り金額の詳細、売却スケジュールをご確認いただけます。" />
        <meta property="og:title" content="査定の根拠と手残りリスト" />
        <meta property="og:description" content="査定額の根拠や手残り金額の詳細、売却スケジュールをご確認いただけます。" />
        <meta property="og:site_name" content="査定の根拠と手残りリスト" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <SellerPortalHeader sellerNumber={sellerNumber} />

      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {propertySummary && <PropertySummaryCard summary={propertySummary} />}

        {valuation && (
          <ValuationCard
            token={token}
            valuation={valuation}
            hasUnreadReply={!!unreadByContext.valuation}
            onMessagesRead={checkUnread}
          />
        )}

        <ValuationBreakdownCard
          token={token}
          propertyType={valuation?.propertyType ?? 'other'}
          isRental={!!propertySummary?.currentStatus?.includes('賃')}
          hasUnreadReply={!!unreadByContext.valuation_breakdown}
          onMessagesRead={checkUnread}
        />

        <NetProceedsCard
          token={token}
          valuation={valuation}
          sellerNumber={sellerNumber}
          savedDetailedAnswers={preferences?.known_facts?.detailed_proceeds_answers?.value ?? null}
          hasUnreadReply={!!unreadByContext.net_proceeds}
          onMessagesRead={checkUnread}
        />

        <ScheduleCard
          token={token}
          valuation={valuation}
          hasUnreadReply={!!unreadByContext.schedule}
          onMessagesRead={checkUnread}
        />

        <InstallPwaBanner token={token} />

        {/* 会社情報（FI/AA判定で表示を切り替え） */}
        <CompanySignature sellerNumber={sellerNumber} />
      </Box>

      <ChatWidget
        token={token}
        open={chatOpen}
        contextTag={chatContext}
        unreadCount={unreadCount}
        onOpen={() => openChat('general')}
        onClose={() => setChatOpen(false)}
        onMessagesRead={checkUnread}
      />

      {showInstallPrompt && (
        <InstallPwaPrompt
          onDismiss={() => {
            localStorage.setItem('seller_portal_install_dismissed', '1');
            setShowInstallPrompt(false);
          }}
          token={token}
        />
      )}
    </Box>
  );
}

const IFOO_INFO = {
  name: '株式会社いふう',
  catchcopy: '',
  address: '〒870-0044 大分市舞鶴町1丁目3-30 STビル1F',
  telDisplay: 'TEL 097-533-2022',
  telHref: 'tel:0975332022',
  emailHref: 'mailto:tenant@ifoo-oita.com',
  hpDisplay: 'ifoo-oita.com',
  hpHref: 'https://ifoo-oita.com/',
};

const KUJIRA_INFO = {
  name: '株式会社くじら不動産',
  catchcopy: '福岡の不動産売却サポート',
  address: '〒810-0073 福岡市中央区舞鶴3－1－10',
  telDisplay: 'TEL 092-401-5331',
  telHref: 'tel:0924015331',
  emailHref: 'mailto:tenant@ifoo-oita.com',
  hpDisplay: 'kujira-fudosan.com',
  hpHref: 'https://kujira-fudosan.com/',
};

/** リンクテキスト共通スタイル */
const linkSx = {
  display: 'inline-block',
  color: '#1A237E',
  textDecoration: 'none',
  minHeight: 44,
  lineHeight: '44px',
  px: 0.5,
  '&:hover': {
    textDecoration: 'underline',
    textDecorationColor: '#C9A84C',
    textUnderlineOffset: '3px',
  },
};

function CompanySignature({ sellerNumber }: { sellerNumber: string }) {
  const isFi = sellerNumber.toUpperCase().startsWith('FI');
  const info = isFi ? KUJIRA_INFO : IFOO_INFO;

  return (
    <Box
      sx={{
        mt: 2,
        mb: 2,
        p: 3,
        borderRadius: 3,
        bgcolor: '#FAFAFA',
        border: '1px solid #E0E0E0',
        textAlign: 'center',
      }}
    >
      {/* ゴールドの横線 */}
      <Box sx={{ height: '1px', bgcolor: '#C9A84C', mb: 2, mx: 'auto', width: '40%' }} />

      {/* 会社名 */}
      <Typography
        variant="subtitle1"
        fontWeight="bold"
        sx={{ color: '#1A237E', letterSpacing: '0.05em', mb: 0.25 }}
      >
        {info.name}
      </Typography>

      {/* キャッチコピー */}
      {info.catchcopy && (
        <Typography
          variant="caption"
          sx={{ color: '#888', letterSpacing: '0.08em', display: 'block', mb: 1.5 }}
        >
          {info.catchcopy}
        </Typography>
      )}

      {/* 住所 */}
      <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5 }}>
        {info.address}
      </Typography>

      {/* ゴールドの横線（細め） */}
      <Box sx={{ height: '1px', bgcolor: '#E8D9AA', mb: 2, mx: 'auto', width: '60%' }} />

      {/* 連絡先（縦並び・中央揃え） */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* 電話 */}
        <Box
          component="a"
          href={info.telHref}
          sx={{ ...linkSx, fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.04em' }}
        >
          {info.telDisplay}
        </Box>

        {/* メール */}
        <Box
          component="a"
          href={info.emailHref}
          sx={{ ...linkSx, fontSize: '0.875rem' }}
        >
          {info.emailHref.replace('mailto:', '')}
        </Box>

        {/* Webサイト */}
        <Box
          component="a"
          href={info.hpHref}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ ...linkSx, fontSize: '0.875rem' }}
        >
          {info.hpDisplay}
        </Box>
      </Box>

      {/* ゴールドの横線 */}
      <Box sx={{ height: '1px', bgcolor: '#C9A84C', mt: 2, mx: 'auto', width: '40%' }} />
    </Box>
  );
}
