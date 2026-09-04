import { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { sellerPortalApi } from '../../services/sellerPortalApi';
import InlineChatSection from './InlineChatSection';

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
  hasUnreadReply,
  onMessagesRead,
}: {
  token: string;
  propertyType: 'land' | 'detached_house' | 'apartment' | 'other';
  /** スタッフからこの相談元への未読返信があるか（あれば赤丸を表示する） */
  hasUnreadReply?: boolean;
  onMessagesRead?: () => void;
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

      <InlineChatSection
        token={token}
        contextTag="valuation_breakdown"
        label="査定の理由について質問する"
        hasUnreadReply={hasUnreadReply}
        onMessagesRead={onMessagesRead}
      />
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
      {/* ① 土地価格：固定資産税路線価 × 土地面積 ÷ 0.6（路線価は実勢価格の約60%という前提で市場価格に割り戻す） */}
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        土地価格については、前面道路の固定資産税路線価を基準に、土地面積を掛け合わせ、実勢価格への割り戻し（÷0.6）を行って算出しています。
      </Typography>

      <Box sx={{ p: 1.5, bgcolor: '#f0f4f8', borderRadius: 2, mb: 1.5 }}>
        <Row label="固定資産税路線価" value={`${fmtYenPerSqm(breakdown.fixedAssetTaxRoadPriceUsed)}／㎡`} />
        <Row label="土地面積" value={`${breakdown.landAreaUsed}㎡`} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {fmtYenPerSqm(breakdown.fixedAssetTaxRoadPriceUsed)} × {breakdown.landAreaUsed}㎡ ÷ 0.6（実勢価格への割り戻し）
        </Typography>
        <Row label="路線価を基準とした土地価格" value={fmtMan(breakdown.landPrice)} emphasized />
      </Box>

      {/* ② 建物価格：構造・築年数を踏まえた既存ロジック */}
      {breakdown.buildingPrice > 0 && (
        <Box sx={{ p: 1.5, bgcolor: '#f0f4f8', borderRadius: 2, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            建物価格（建築単価・構造・築年数（{breakdown.buildingAgeUsed}年）を踏まえて算出）
          </Typography>
          <Row label="建物面積" value={`${breakdown.buildingAreaUsed}㎡`} />
          <Row label="建物価格" value={fmtMan(breakdown.buildingPrice)} emphasized />
        </Box>
      )}

      {/* ③〜⑥ 小計から最低価格までの計算ステップをそのまま表示する（後付けの差分ではなく実際の計算式） */}
      <Box sx={{ p: 1.5, bgcolor: '#fff8e1', borderRadius: 2, mb: 1.5 }}>
        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          土地価格・建物価格から最終的な査定額までの計算
        </Typography>
        <Row label="小計（土地価格＋建物価格）" value={fmtMan(breakdown.subtotal)} />
        <Row label="小計 × 1.2（市場性を考慮した調整）" value={fmtMan(breakdown.afterMultiplier)} />
        {breakdown.largeAmountBonus > 0 && (
          <>
            <Row label="販売期待値の加算" value={`+${fmtMan(breakdown.largeAmountBonus)}`} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 0.5 }}>
              当該エリアにおける当社の反響実績および購入希望顧客の蓄積を勘案し、通常の市場査定額に販売期待値を加味しております。
            </Typography>
          </>
        )}
        <Row label="早期売却を重視した価格（最低価格）" value={fmtMan(breakdown.minimumPrice)} emphasized />
      </Box>

      {breakdown.additionAmount2 > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            さらに、周辺エリアの需要や当社への問い合わせ状況を踏まえ、早期売却を重視した価格に金額を加算しています。
          </Typography>
          <Row
            label="成約想定価格（早期売却重視価格 + 加算）"
            value={`${fmtMan(breakdown.minimumPrice)} +${fmtMan(breakdown.additionAmount2)} = ${fmtMan(breakdown.midPrice)}`}
          />
          <Row
            label="チャレンジ価格（早期売却重視価格 + 加算）"
            value={`${fmtMan(breakdown.minimumPrice)} +${fmtMan(breakdown.additionAmount3)} = ${fmtMan(breakdown.maximumPrice)}`}
          />
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
