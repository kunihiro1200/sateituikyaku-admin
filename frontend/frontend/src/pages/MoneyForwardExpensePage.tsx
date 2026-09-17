import { useMemo, useState, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  UploadFile as UploadFileIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * マネーフォワード 経費集計ページ
 *
 * 共有ページ「事務会議」カテゴリーに追加する経費の自動集計。
 * マネーフォワードからエクスポートしたCSVを読み込むと、
 * - 勘定科目ごとの合計（税込・税抜）
 * - 月ごとの合計
 * - 科目×月のクロス集計
 * をすべてブラウザ内で自動計算する（バックエンド不要・データは外部送信しない）。
 *
 * CSVは Shift-JIS / UTF-8 の両方に対応。金額はカンマや円記号を除去して数値化する。
 */

// ---- パースした1行の経費データ ----
interface ExpenseRow {
  date: string; // 元の日付文字列
  year: number;
  month: number; // 1-12
  ym: string; // 'YYYY/MM'
  account: string; // 勘定科目
  description: string; // 摘要
  amountInclTax: number; // 税込金額
  amountExclTax: number; // 税抜金額
}

type Metric = 'incl' | 'excl';

// ---- ユーティリティ ----

// 数値文字列を数値化（カンマ・円記号・空白・全角を吸収）
function toNumber(raw: string): number {
  if (!raw) return 0;
  const normalized = raw
    .replace(/[，,]/g, '')
    .replace(/[¥￥\s円]/g, '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[△▲]/g, '-') // 会計のマイナス表記
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

// 日付文字列を year / month に分解（YYYY/M/D, YYYY-MM-DD, YYYY/MM/DD 等に対応）
function parseDate(raw: string): { year: number; month: number } | null {
  if (!raw) return null;
  const m = raw.trim().match(/(\d{4})[/\-.年](\d{1,2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

// CSVを行・セルに分解（ダブルクオート対応の簡易パーサ）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else if (ch === '\r') {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ヘッダー行から各列のインデックスを推定
function detectColumns(header: string[]): {
  date: number;
  account: number;
  description: number;
  incl: number;
  excl: number;
} | null {
  const idx = (keywords: string[]): number =>
    header.findIndex((h) => keywords.some((k) => h.includes(k)));

  const date = idx(['日付', '取引日', '計上日', '日時']);
  const account = idx(['勘定科目', '科目', '大項目']);
  const description = idx(['摘要', '内容', '取引内容', '備考', '中項目']);
  // 税込・税抜金額の列
  let incl = header.findIndex((h) => h.includes('税込') || (h.includes('金額') && !h.includes('税抜')));
  let excl = header.findIndex((h) => h.includes('税抜'));
  if (incl === -1) incl = idx(['金額', '支出', '出金']);

  if (date === -1 || account === -1) return null;
  return {
    date,
    account,
    description: description === -1 ? account : description,
    incl: incl === -1 ? excl : incl,
    excl: excl === -1 ? incl : excl,
  };
}

// マネーフォワードCSVをExpenseRow[]に変換
function parseExpenses(text: string): { rows: ExpenseRow[]; error: string | null } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: 'CSVが空です。' };

  const header = table[0].map((h) => h.trim());
  const cols = detectColumns(header);

  if (!cols) {
    return {
      rows: [],
      error:
        'ヘッダー行から「日付」「勘定科目」の列を特定できませんでした。マネーフォワードの仕訳/取引CSV（1行目が見出し）を使用してください。',
    };
  }

  const rows: ExpenseRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const dateRaw = (r[cols.date] ?? '').trim();
    const d = parseDate(dateRaw);
    if (!d) continue;
    const account = (r[cols.account] ?? '').trim();
    if (!account) continue;
    const incl = toNumber(r[cols.incl] ?? '');
    const excl = toNumber(r[cols.excl] ?? '');
    rows.push({
      date: dateRaw,
      year: d.year,
      month: d.month,
      ym: `${d.year}/${String(d.month).padStart(2, '0')}`,
      account,
      description: (r[cols.description] ?? '').trim(),
      amountInclTax: incl,
      amountExclTax: excl || incl,
    });
  }

  if (rows.length === 0) {
    return { rows: [], error: '有効なデータ行が見つかりませんでした（日付・勘定科目を確認してください）。' };
  }
  return { rows, error: null };
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

export default function MoneyForwardExpensePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [metric, setMetric] = useState<Metric>('incl');
  const [keyword, setKeyword] = useState('');

  const amountOf = useCallback(
    (row: ExpenseRow) => (metric === 'incl' ? row.amountInclTax : row.amountExclTax),
    [metric]
  );

  // ファイル読み込み（Shift-JIS / UTF-8 両対応）
  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      let text = '';
      try {
        // まず Shift-JIS（マネーフォワードの既定）
        text = new TextDecoder('shift-jis', { fatal: false }).decode(buffer);
        // 文字化けの疑いがあれば UTF-8 で再デコード
        if (text.includes('\uFFFD')) {
          const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
          if (!utf8.includes('\uFFFD')) text = utf8;
        }
      } catch {
        text = new TextDecoder('utf-8').decode(buffer);
      }
      const result = parseExpenses(text);
      if (result.error) {
        setError(result.error);
        setRows([]);
      } else {
        setRows(result.rows);
      }
    } catch (e: any) {
      setError('ファイルの読み込みに失敗しました: ' + (e?.message ?? String(e)));
      setRows([]);
    }
  };

  // キーワードで絞り込んだ行
  const filteredRows = useMemo(() => {
    if (!keyword.trim()) return rows;
    const kw = keyword.trim();
    return rows.filter(
      (r) => r.account.includes(kw) || r.description.includes(kw)
    );
  }, [rows, keyword]);

  // 対象の月一覧（昇順）
  const months = useMemo(() => {
    const set = new Set<string>();
    filteredRows.forEach((r) => set.add(r.ym));
    return Array.from(set).sort();
  }, [filteredRows]);

  // 勘定科目一覧（合計が大きい順）
  const accountTotals = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach((r) => {
      map.set(r.account, (map.get(r.account) ?? 0) + amountOf(r));
    });
    return Array.from(map.entries())
      .map(([account, total]) => ({ account, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows, amountOf]);

  // 科目 × 月 クロス集計
  const crossTable = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    filteredRows.forEach((r) => {
      if (!map.has(r.account)) map.set(r.account, new Map());
      const inner = map.get(r.account)!;
      inner.set(r.ym, (inner.get(r.ym) ?? 0) + amountOf(r));
    });
    return map;
  }, [filteredRows, amountOf]);

  // 月別合計
  const monthTotals = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach((r) => {
      map.set(r.ym, (map.get(r.ym) ?? 0) + amountOf(r));
    });
    return map;
  }, [filteredRows, amountOf]);

  const grandTotal = useMemo(
    () => filteredRows.reduce((s, r) => s + amountOf(r), 0),
    [filteredRows, amountOf]
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/shared-items')}
          size="small"
        >
          共有ページへ戻る
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 'bold', ml: 1 }}>
          経費集計（マネーフォワードCSV）
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadFileIcon />}
          >
            CSVを読み込む
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </Button>
          {fileName && (
            <Chip label={fileName} onDelete={() => { setRows([]); setFileName(''); setError(null); }} />
          )}
          <Box sx={{ flex: 1 }} />
          {rows.length > 0 && (
            <>
              <TextField
                size="small"
                placeholder="科目・摘要で絞り込み"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 220 }}
              />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={metric}
                onChange={(_, v) => v && setMetric(v)}
              >
                <ToggleButton value="incl">税込</ToggleButton>
                <ToggleButton value="excl">税抜</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          ※ マネーフォワードからエクスポートした仕訳/取引CSV（1行目が見出し）を選択してください。
          データはブラウザ内で処理され、外部には送信されません。
        </Typography>
      </Paper>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {rows.length > 0 && (
        <>
          {/* サマリー */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">
                取込件数
              </Typography>
              <Typography variant="h6">{filteredRows.length.toLocaleString()} 件</Typography>
            </Paper>
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">
                対象期間
              </Typography>
              <Typography variant="h6">
                {months.length > 0 ? `${months[0]} 〜 ${months[months.length - 1]}` : '-'}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, minWidth: 160 }}>
              <Typography variant="caption" color="text.secondary">
                合計（{metric === 'incl' ? '税込' : '税抜'}）
              </Typography>
              <Typography variant="h6" color="primary">
                {yen(grandTotal)}
              </Typography>
            </Paper>
          </Box>

          {/* 勘定科目別 合計 */}
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            勘定科目別 合計
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>勘定科目</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>件数</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    合計（{metric === 'incl' ? '税込' : '税抜'}）
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>構成比</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accountTotals.map(({ account, total }) => {
                  const count = filteredRows.filter((r) => r.account === account).length;
                  const pct = grandTotal !== 0 ? (total / grandTotal) * 100 : 0;
                  return (
                    <TableRow key={account} hover>
                      <TableCell>{account}</TableCell>
                      <TableCell align="right">{count}</TableCell>
                      <TableCell align="right">{yen(total)}</TableCell>
                      <TableCell align="right">{pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>合計</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {filteredRows.length}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {yen(grandTotal)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* 科目 × 月 クロス集計 */}
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            勘定科目 × 月 クロス集計
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', position: 'sticky', left: 0, zIndex: 3 }}>
                    勘定科目
                  </TableCell>
                  {months.map((m) => (
                    <TableCell key={m} align="right" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', whiteSpace: 'nowrap' }}>
                      {m}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#bbdefb', whiteSpace: 'nowrap' }}>
                    合計
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accountTotals.map(({ account, total }) => {
                  const inner = crossTable.get(account);
                  return (
                    <TableRow key={account} hover>
                      <TableCell sx={{ position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1, fontWeight: 500 }}>
                        {account}
                      </TableCell>
                      {months.map((m) => {
                        const v = inner?.get(m) ?? 0;
                        return (
                          <TableCell key={m} align="right" sx={{ color: v === 0 ? '#ccc' : 'inherit', whiteSpace: 'nowrap' }}>
                            {v === 0 ? '-' : yen(v)}
                          </TableCell>
                        );
                      })}
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f5faff', whiteSpace: 'nowrap' }}>
                        {yen(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell sx={{ fontWeight: 'bold', position: 'sticky', left: 0, bgcolor: '#fafafa', zIndex: 1 }}>
                    月合計
                  </TableCell>
                  {months.map((m) => (
                    <TableCell key={m} align="right" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {yen(monthTotals.get(m) ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#bbdefb', whiteSpace: 'nowrap' }}>
                    {yen(grandTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {rows.length === 0 && !error && (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <UploadFileIcon sx={{ fontSize: 48, color: '#90caf9', mb: 1 }} />
          <Typography>マネーフォワードのCSVを読み込むと、経費が自動で集計されます。</Typography>
        </Paper>
      )}
    </Container>
  );
}
