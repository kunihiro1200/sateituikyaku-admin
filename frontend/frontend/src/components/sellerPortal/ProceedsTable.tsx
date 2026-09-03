import { Box, Typography } from '@mui/material';

const fmtMan = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;
const fmtYen = (yen: number) => `${yen.toLocaleString()}円`;

export interface ProceedsTableRow {
  priceYen: number;
  netProceeds: number;
  /** 内訳（仲介手数料・印紙代・ローン残高など）。全行で同じ項目・同じ順序で渡すこと（見出しを1回だけ表示するため） */
  details: Array<{ label: string; value: number }>;
}

/**
 * 「売却価格」と「手残り」を表形式で一目で見せる共通コンポーネント。
 * ざっくり手残り（NetProceedsCard）・詳細手残り（DetailedProceedsWizard）の両方で使い、見た目を統一する。
 * 見出し（仲介手数料・印紙代等）は1行目だけに表示し、以降の行は数字のみを横一列に並べる。
 * 列数が多い場合（詳細手残り）はスマホで横スクロールできるようにする。
 */
export default function ProceedsTable({ rows }: { rows: ProceedsTableRow[] }) {
  if (rows.length === 0) return null;
  const detailLabels = rows[0].details.map((d) => d.label);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <Box component="thead">
          <Box component="tr">
            <HeaderCell align="left">売却価格</HeaderCell>
            {detailLabels.map((label) => (
              <HeaderCell key={label}>{label}</HeaderCell>
            ))}
            <HeaderCell>手残り</HeaderCell>
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <Box component="tr" key={row.priceYen} sx={{ borderTop: '1px solid #eee' }}>
              <DataCell align="left">{fmtMan(row.priceYen)}</DataCell>
              {row.details.map((d) => (
                <DataCell key={d.label}>{fmtYen(d.value)}</DataCell>
              ))}
              <DataCell>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  {fmtMan(row.netProceeds)}
                </Typography>
              </DataCell>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function HeaderCell({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <Box
      component="th"
      sx={{
        textAlign: align,
        py: 0.75,
        px: 0.75,
        whiteSpace: 'nowrap',
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight="bold">
        {children}
      </Typography>
    </Box>
  );
}

function DataCell({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <Box
      component="td"
      sx={{
        textAlign: align,
        py: 1,
        px: 0.75,
        whiteSpace: 'nowrap',
      }}
    >
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}
