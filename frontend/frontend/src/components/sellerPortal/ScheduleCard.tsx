import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, TextField, CircularProgress } from '@mui/material';
import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

/**
 * 売却スケジュールカード。ユーザーが「売りたい価格」「最低の価格」「いつまでに売りたいか」を入力し、
 * 決済・引渡し希望日から逆算した各ステップの時期を表示する。
 * 既存の資料生成「売却スケジュール」の期間オフセットをそのまま使う（逆算のみ新規）。
 */
export default function ScheduleCard({
  token,
  valuation,
  onAskQuestion,
}: {
  token: string;
  valuation: ValuationSummary | null;
  onAskQuestion: () => void;
}) {
  const [desiredPriceMan, setDesiredPriceMan] = useState('');
  const [minPriceMan, setMinPriceMan] = useState('');
  const [settlementYearMonth, setSettlementYearMonth] = useState(''); // 'YYYY-MM'
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          setDesiredPriceMan(Math.round(valuation.maximumPrice / 10000).toString());
          setMinPriceMan(Math.round(valuation.minimumPrice / 10000).toString());
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

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }} elevation={0} variant="outlined">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
        売却スケジュール
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
              <ScheduleStep label="販売開始" detail={`売出価格：${fmtMan(schedule.desiredSalePrice)}`} yearMonth={`${schedule.startYear}年${schedule.startMonth}月`} />
              <ScheduleStep label="販売活動強化" yearMonth={`${schedule.marketingYear}年${schedule.marketingStartMonth}月〜${schedule.marketingEndYear}年${schedule.marketingEndMonth}月`} />
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

      <Button size="small" variant="text" onClick={onAskQuestion} sx={{ mt: 1 }}>
        このスケジュールについて相談する
      </Button>
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
