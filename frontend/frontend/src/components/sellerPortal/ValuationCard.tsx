import { Paper, Typography, Box, Button, Badge } from '@mui/material';
import { ValuationSummary } from '../../services/sellerPortalApi';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

/**
 * 査定額カード。3つの査定額（最低/中間/最高）を、それぞれの意味が
 * 伝わるラベルとともに表示する。既存の sellers.valuation_amount_1/2/3 をそのまま使う。
 */
export default function ValuationCard({
  valuation,
  hasUnreadReply,
  onAskQuestion,
}: {
  valuation: ValuationSummary;
  /** スタッフからこの相談元への未読返信があるか（あれば質問ボタンに赤丸を表示する） */
  hasUnreadReply?: boolean;
  onAskQuestion: () => void;
}) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3 }} elevation={0} variant="outlined">
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
        査定額
      </Typography>

      <PriceRow
        label="チャレンジ価格"
        description="時間をかけて高値での売却を目指す場合の価格"
        amount={valuation.maximumPrice}
        color="#C99A3D"
      />
      <PriceRow
        label="成約想定価格"
        description="実際に成約しやすいと見込まれる価格"
        amount={valuation.midPrice}
        color="#0B2545"
        emphasized
      />
      <PriceRow
        label="早期売却を重視した価格"
        description="売却期間を短くすることを優先する場合の価格"
        amount={valuation.minimumPrice}
        color="#607d8b"
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        価格に幅があるのは、売却にかけられる期間や市場の状況によって、目指せる価格が変わるためです。詳しくは下の「査定額の計算根拠」をご確認ください。
      </Typography>

      <Badge color="error" variant="dot" invisible={!hasUnreadReply} sx={{ mt: 1 }}>
        <Button size="small" variant="text" onClick={onAskQuestion}>
          この査定額について質問する
        </Button>
      </Badge>
    </Paper>
  );
}

function PriceRow({
  label,
  description,
  amount,
  color,
  emphasized,
}: {
  label: string;
  description: string;
  amount: number;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <Box
      sx={{
        mb: 1.5,
        p: emphasized ? 1.5 : 1,
        borderRadius: 2,
        bgcolor: emphasized ? '#f0f4f8' : 'transparent',
      }}
    >
      <Typography variant="caption" sx={{ color, fontWeight: 'bold' }}>
        {label}
      </Typography>
      <Typography variant={emphasized ? 'h5' : 'h6'} fontWeight="bold" sx={{ color: '#111' }}>
        {fmtMan(amount)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}
