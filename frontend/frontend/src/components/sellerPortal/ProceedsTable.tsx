import { Box, Typography } from '@mui/material';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

export interface ProceedsTableRow {
  priceYen: number;
  netProceeds: number;
  /** 内訳（仲介手数料・印紙代・ローン残高など）。ラベルと金額のペアを常時表示する */
  details: Array<{ label: string; value: number }>;
}

/**
 * 「売却価格」と「手残り」を一覧表のように一目で見せる共通コンポーネント。
 * ざっくり手残り（NetProceedsCard）・詳細手残り（DetailedProceedsWizard）の両方で使い、
 * 見た目を統一する（矢印での開閉はやめて、内訳も常時表示する）。
 * スマホでの横スクロールを避けるため、テーブルタグではなくカード形式の縦積みにする。
 */
export default function ProceedsTable({ rows }: { rows: ProceedsTableRow[] }) {
  return (
    <Box>
      {rows.map((row, idx) => (
        <Box
          key={row.priceYen}
          sx={{
            py: 1.5,
            borderBottom: idx < rows.length - 1 ? '1px solid #eee' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="body2">{fmtMan(row.priceYen)}で売却</Typography>
            <Typography variant="body1" fontWeight="bold" color="primary">
              手残り {fmtMan(row.netProceeds)}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 0.25,
              mt: 0.5,
            }}
          >
            {row.details.map((d) => (
              <Box key={d.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  {d.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.value.toLocaleString()}円
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
