import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, TextField, CircularProgress, Alert, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';
import InlineChatSection from './InlineChatSection';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

/**
 * 売却スケジュールカード。ユーザーが「売りたい価格」「最低の価格」「いつまでに売りたいか」を入力し、
 * 決済・引渡し希望日から逆算した各ステップの時期を表示する。
 * 既存の資料生成「売却スケジュール」の期間オフセットをそのまま使う（逆算のみ新規）。
 */
export default function ScheduleCard({
  token,
  valuation,
  hasUnreadReply,
  onMessagesRead,
}: {
  token: string;
  valuation: ValuationSummary | null;
  /** スタッフからこの相談元への未読返信があるか（あれば赤丸を表示する） */
  hasUnreadReply?: boolean;
  onMessagesRead?: () => void;
}) {
  const [desiredPriceMan, setDesiredPriceMan] = useState('');
  const [minPriceMan, setMinPriceMan] = useState('');
  const [settlementYearMonth, setSettlementYearMonth] = useState(''); // 'YYYY-MM'
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [buyoutRequesting, setBuyoutRequesting] = useState(false);
  const [buyoutRequested, setBuyoutRequested] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await sellerPortalApi.getSchedule(token);
        if (res.schedule.hasSettlementDate) {
          setSchedule(res.schedule);
          setDesiredPriceMan(Math.round(res.schedule.desiredSalePrice / 10000).toString());
          setMinPriceMan(Math.round(res.schedule.minimumSalePrice / 10000).toString());
          setSettlementYearMonth(`${res.schedule.settlementYear}-${String(res.schedule.settlementMonth).padStart(2, '0')}`);
        } else if (valuation) {
          // 初期値（未入力時）：売りたい価格＝チャレンジ価格、最低の価格＝成約想定価格（真ん中の価格）
          setDesiredPriceMan(Math.round(valuation.maximumPrice / 10000).toString());
          setMinPriceMan(Math.round(valuation.midPrice / 10000).toString());
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const recalculate = async () => {
    if (!settlementYearMonth) return;
    setSaving(true);
    setBuyoutRequested(false);
    try {
      await sellerPortalApi.updatePreferences(token, {
        desiredSalePrice: Math.round(parseFloat(desiredPriceMan || '0') * 10000),
        minimumSalePrice: Math.round(parseFloat(minPriceMan || '0') * 10000),
        desiredSettlementYearMonth: `${settlementYearMonth}-01`,
      });
      const res = await sellerPortalApi.getSchedule(token);
      setSchedule(res.schedule);
    } finally {
      setSaving(false);
    }
  };

  const handleBuyoutRequest = async () => {
    setBuyoutRequesting(true);
    try {
      await sellerPortalApi.requestBuyout(token);
      setBuyoutRequested(true);
    } finally {
      setBuyoutRequesting(false);
    }
  };

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }} elevation={0} variant="outlined">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
        売却スケジュール
      </Typography>

      <Box
        onClick={() => setShowComparison((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none', mb: 1.5 }}
      >
        <Typography variant="body2" color="primary" fontWeight="bold">
          「仲介売却」「直接買取」の違いはこちら
        </Typography>
        <IconButton size="small">
          {showComparison ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={showComparison}>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
            仲介売却
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            不動産会社が広告やインターネットへの掲載などを行い、購入希望者を探して売却する方法です。
            直接買取に比べて<strong>高く売れる可能性がある</strong>一方、購入希望者が見つかるまで時間がかかる場合があります。
          </Typography>

          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
            直接買取
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            不動産会社が買主となり、物件を直接買い取る方法です。
            購入希望者を探す必要がないため、<strong>早く・確実に売却しやすい</strong>のが特徴です。一方、買取価格は仲介で売却する場合より低くなるのが一般的です。
          </Typography>

          <Typography variant="body2">
            <strong>高く売りたい方 → 仲介売却</strong>
          </Typography>
          <Typography variant="body2">
            <strong>早く売りたい方 → 直接買取</strong>
          </Typography>
        </Box>
      </Collapse>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            査定額を初期値として入力しています。ご希望があれば自由に変更できます。
          </Typography>
          <TextField
            label="売りたい価格（万円）"
            type="number"
            size="small"
            value={desiredPriceMan}
            onChange={(e) => setDesiredPriceMan(e.target.value)}
          />
          <TextField
            label="最低の価格（万円）"
            type="number"
            size="small"
            value={minPriceMan}
            onChange={(e) => setMinPriceMan(e.target.value)}
          />
          <TextField
            label="いつまでに売りたいですか？"
            type="month"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={settlementYearMonth}
            onChange={(e) => setSettlementYearMonth(e.target.value)}
          />

          <Button variant="contained" onClick={recalculate} disabled={saving || !settlementYearMonth}>
            {saving ? '計算中...' : 'スケジュールを計算する'}
          </Button>

          {schedule?.hasSettlementDate && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1.5 }}>
                下記は「仲介売却」の場合のスケジュールです。
              </Typography>
              {schedule.isCompressed && (
                <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
                  ご希望の時期までの期間が短いため、販売開始を今月からとし、スケジュールを詰めて計算しています。
                </Alert>
              )}
              <ScheduleStep label="販売開始" detail={`売出価格：${fmtMan(schedule.desiredSalePrice)}`} yearMonth={`${schedule.startYear}年${schedule.startMonth}月`} />
              {schedule.marketingYear && (
                <ScheduleStep label="販売活動強化" yearMonth={`${schedule.marketingYear}年${schedule.marketingStartMonth}月〜${schedule.marketingEndYear}年${schedule.marketingEndMonth}月`} />
              )}
              <ScheduleStep
                label="売買契約"
                detail={`成約想定価格：${fmtMan(schedule.desiredSalePrice)}～${fmtMan(schedule.minimumSalePrice)}`}
                yearMonth={`${schedule.contractYear}年${schedule.contractMonth}月`}
              />
              <ScheduleStep label="決済・引き渡し" yearMonth={`${schedule.settlementYear}年${schedule.settlementMonth}月`} isLast />
            </Box>
          )}
        </Box>
      )}

      {/* 買取査定の案内は「このスケジュールについて相談する」の直上に配置する */}
      {schedule?.isCompressed && (
        <Box sx={{ p: 1.5, mt: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            3ヶ月以内の売却でしたら、買取をオススメ致します。
          </Typography>
          {buyoutRequested ? (
            <Alert severity="success" sx={{ fontSize: '0.75rem' }}>
              買取依頼を受け付けました。担当スタッフよりご連絡いたします。
            </Alert>
          ) : (
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={handleBuyoutRequest}
              disabled={buyoutRequesting}
            >
              {buyoutRequesting ? '送信中...' : '買取依頼'}
            </Button>
          )}
        </Box>
      )}

      <InlineChatSection
        token={token}
        contextTag="schedule"
        label="このスケジュールについて相談する"
        hasUnreadReply={hasUnreadReply}
        onMessagesRead={onMessagesRead}
      />
    </Paper>
  );
}

function ScheduleStep({
  label,
  detail,
  yearMonth,
  isLast,
}: {
  label: string;
  detail?: string;
  yearMonth: string;
  isLast?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, pb: isLast ? 0 : 1.5 }}>
      <Box sx={{ width: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#0B2545' }} />
        {!isLast && <Box sx={{ flex: 1, width: 2, bgcolor: '#ddd', mt: 0.5 }} />}
      </Box>
      <Box>
        <Typography variant="body2" fontWeight="bold">
          {label}（{yearMonth}）
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
