import { useEffect, useState } from 'react';
import { Paper, Typography, Box, Button, CircularProgress, Alert } from '@mui/material';
import { sellerPortalApi } from '../../services/sellerPortalApi';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;
const fmtYenPerSqm = (yen: number) => `${yen.toLocaleString()}円`;

/**
 * 査定額の計算根拠カード。物件種別によって表示内容を分ける。
 * - 土地・戸建：固定資産税路線価×面積の内訳（保存済みデータがある場合のみ。なければ総額のみ表示）
 * - マンション：査定額÷専有面積で㎡単価をその場で計算して表示
 */
export default function ValuationBreakdownCard({
  token,
  propertyType,
  onAskQuestion,
}: {
  token: string;
  propertyType: 'land' | 'detached_house' | 'apartment' | 'other';
  onAskQuestion: () => void;
}) {
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await sellerPortalApi.getValuationBreakdown(token);
        setBreakdown(res.breakdown);
      } catch (err: any) {
        setError(err.message || '取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }} elevation={0} variant="outlined">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
        査定額の計算根拠
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && breakdown && propertyType === 'apartment' && (
        <ApartmentBreakdown breakdown={breakdown} />
      )}

      {!loading && !error && breakdown && propertyType !== 'apartment' && (
        <LandOrHouseBreakdown breakdown={breakdown} />
      )}

      <Button size="small" variant="text" onClick={onAskQuestion} sx={{ mt: 1 }}>
        査定の理由について質問する
      </Button>
    </Paper>
  );
}

function ApartmentBreakdown({ breakdown }: { breakdown: any }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        同マンションの売買事例を参考に、対象のお部屋の専有面積をもとに算出しています。
      </Typography>

      {breakdown.unitPricePerSqm && (
        <Box sx={{ p: 1.5, bgcolor: '#f0f4f8', borderRadius: 2, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            成約想定価格 ÷ 専有面積
          </Typography>
          <Typography variant="body2">
            {fmtMan(breakdown.midPrice)} ÷ {breakdown.exclusiveArea}㎡
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 0.5 }}>
            査定㎡単価：約{(breakdown.unitPricePerSqm / 10000).toFixed(1)}万円／㎡
          </Typography>
        </Box>
      )}

      <Typography variant="body2" sx={{ mb: 1 }}>
        周辺にある築年数や専有面積が近いマンションの売買事例も参考にしています。また、当社へのお問い合わせ状況も考慮し、通常の成約想定価格より高めのチャレンジ価格を算出しています。
      </Typography>

      <Typography variant="body2" color="text.secondary">
        早期売却を重視した価格は、売却期間を短くすることを優先する場合に検討する価格帯です。
      </Typography>
    </Box>
  );
}

function LandOrHouseBreakdown({ breakdown }: { breakdown: any }) {
  if (!breakdown.hasBreakdown) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          現時点では詳しい算出根拠のデータがありません。査定額についてご質問があれば、下のボタンからお気軽にお尋ねください。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        土地価格については、前面道路の固定資産税路線価を基準に、土地面積を掛け合わせて算出しています。
      </Typography>

      <Box sx={{ p: 1.5, bgcolor: '#f0f4f8', borderRadius: 2, mb: 1.5 }}>
        <Row label="固定資産税路線価" value={`${fmtYenPerSqm(breakdown.fixedAssetTaxRoadPriceUsed)}／㎡`} />
        <Row label="土地面積" value={`${breakdown.landAreaUsed}㎡`} />
        <Row label="路線価を基準とした土地価格" value={fmtMan(breakdown.landPrice)} emphasized />
      </Box>

      {breakdown.buildingPrice > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#f0f4f8', borderRadius: 2, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            建物価格（構造・築年数を踏まえて算出）
          </Typography>
          <Row label="建物価格" value={fmtMan(breakdown.buildingPrice)} emphasized />
        </Box>
      )}

      {breakdown.additionAmount2 > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            現在の不動産市場の価格動向や周辺エリアの需要を考慮し、路線価を基準として算出した価格に金額を加算しています。
          </Typography>
          <Row label="市場動向・需要を考慮した加算（成約想定価格）" value={`+${fmtMan(breakdown.additionAmount2)}`} />
          <Row label="市場動向・需要を考慮した加算（チャレンジ価格）" value={`+${fmtMan(breakdown.additionAmount3)}`} />
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.75rem' }}>
        固定資産税路線価は売却価格そのものではありません。路線価を基準価格として、市場動向や実際の需要を加味して査定しています。
      </Alert>
    </Box>
  );
}

function Row({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={emphasized ? 'bold' : 'normal'}>
        {value}
      </Typography>
    </Box>
  );
}
