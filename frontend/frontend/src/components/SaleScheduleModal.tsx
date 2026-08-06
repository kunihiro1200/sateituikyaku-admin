/**
 * 売却スケジュール資料生成モーダル
 *
 * 方式: 背景画像固定 + position:absolute テキストオーバーレイ
 * 背景: /sale-schedule/illustrations/template.png (210mm × 297mm)
 *
 * 座標系: A4左上=(0,0) 単位mm
 * 背景・オーバーレイ両方とも left:0;top:0 で完全一致
 *
 * プレビュー: transform:scale() でブラウザ表示を縮小（座標には影響しない）
 * 印刷: 別ウィンドウ方式（210mm原寸）
 *
 * ============================================================
 * 座標定数（FIELD_COORDS）
 * ここだけ変更すれば全項目の位置が変わる
 * 背景画像の空欄位置に合わせて1mm単位で調整する
 * ============================================================
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  CircularProgress, Alert, Divider, IconButton, Switch, FormControlLabel,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';

// ─────────────────────────────────────────
// 座標定数（ここを微調整する）
// A4左上原点(0,0) 単位:mm
// 背景画像の空欄に合わせて調整
// ─────────────────────────────────────────
const COORDS = {
  // 物件情報エリア
  propertyNo:   { left: 56,  top: 31.0, w: 90,  h: 5.5, fs: 8.5, fw: 600, color: '#1a1a1a', align: 'left'   as const },
  ownerName:    { left: 56,  top: 37.0, w: 90,  h: 5.5, fs: 8.5, fw: 600, color: '#1a1a1a', align: 'left'   as const },
  propertyAddr: { left: 56,  top: 43.0, w: 140, h: 10,  fs: 8.5, fw: 600, color: '#1a1a1a', align: 'left'   as const },

  // STEP1 売り出し開始
  listPrice:    { left: 89,  top: 67.5, w: 50,  h: 7,   fs: 15,  fw: 900, color: '#C99A3D', align: 'left'   as const },
  step1Year:    { left: 22,  top: 72.0, w: 32,  h: 5,   fs: 7,   fw: 700, color: '#ffffff', align: 'center' as const },
  step1Month:   { left: 22,  top: 77.0, w: 32,  h: 9,   fs: 14,  fw: 900, color: '#C99A3D', align: 'center' as const },

  // STEP2 販売活動を強化
  step2Year:    { left: 22,  top: 123.0, w: 32, h: 5,   fs: 7,   fw: 700, color: '#ffffff', align: 'center' as const },
  step2StartM:  { left: 22,  top: 128.0, w: 14, h: 8,   fs: 12,  fw: 900, color: '#C99A3D', align: 'center' as const },
  step2EndM:    { left: 38,  top: 128.0, w: 14, h: 8,   fs: 12,  fw: 900, color: '#C99A3D', align: 'center' as const },

  // STEP3 売買契約
  minimumPrice: { left: 89,  top: 161.0, w: 50, h: 7,   fs: 14,  fw: 900, color: '#C99A3D', align: 'left'   as const },
  step3Year:    { left: 22,  top: 165.0, w: 32, h: 5,   fs: 7,   fw: 700, color: '#ffffff', align: 'center' as const },
  step3Month:   { left: 22,  top: 170.0, w: 32, h: 9,   fs: 14,  fw: 900, color: '#C99A3D', align: 'center' as const },

  // STEP4 決済・お引渡し
  step4Year:    { left: 22,  top: 196.0, w: 32, h: 5,   fs: 7,   fw: 700, color: '#ffffff', align: 'center' as const },
  step4Month:   { left: 22,  top: 201.0, w: 32, h: 8,   fs: 12,  fw: 900, color: '#C99A3D', align: 'center' as const },
} as const;

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface SaleScheduleData {
  propertyNo: string;
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;
  listPrice?: number;
  minimumPrice?: number;
  startYear?: number;
  startMonth?: number;
  marketingYear?: number;
  marketingStartMonth?: number;
  marketingEndMonth?: number;
  contractYear?: number;
  contractMonth?: number;
  settlementYear?: number;
  settlementMonth?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialSellerNumber?: string;
  initialOwnerName?: string;
  initialPropertyAddress?: string;
  initialAssessPrice?: number;
}

function calcDates() {
  const now = new Date();
  const sy = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  const sm = now.getMonth() >= 11 ? 1 : now.getMonth() + 2;
  const cy = sm + 3 > 12 ? sy + 1 : sy;   const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
  const sety = cm + 1 > 12 ? cy + 1 : cy; const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
  const ms = sm + 1 > 12 ? 1 : sm + 1;
  const me = sm + 2 > 12 ? (sm + 2) - 12 : sm + 2;
  const my = ms < sm ? sy + 1 : sy;
  return { sy, sm, cy, cm, sety, setm, ms, me, my };
}

function convertDb(seller: Record<string, unknown>, pl: Record<string, unknown> | null): Partial<SaleScheduleData> {
  const { sy, sm, cy, cm, sety, setm, ms, me, my } = calcDates();
  const listRaw = (pl?.listing_price as number|null) || (pl?.sales_price as number|null) || null;
  const assessRaw = (seller?.valuation_amount_1 as number|null) || (seller?.valuation_amount_2 as number|null) || null;
  return {
    propertyNo: (seller?.seller_number as string)||'',
    ownerName: (seller?.name as string)||'',
    propertyAddress: (seller?.property_address as string)||'',
    assessPrice: assessRaw ? Math.round(assessRaw/10000) : undefined,
    listPrice: listRaw ? Math.round(listRaw/10000) : undefined,
    startYear:sy, startMonth:sm, marketingYear:my, marketingStartMonth:ms, marketingEndMonth:me,
    contractYear:cy, contractMonth:cm, settlementYear:sety, settlementMonth:setm,
  };
}

function withSama(name: string): string {
  const n = name.trim();
  return n ? (n.endsWith('様') ? n : n + '　様') : '';
}

const fmtNum = (v?: number) => v != null ? v.toLocaleString() : '';

// ─────────────────────────────────────────
// 1フィールド分のHTML生成（完全固定座標）
// ─────────────────────────────────────────
type CoordEntry = { left:number; top:number; w:number; h:number; fs:number; fw:number; color:string; align:'left'|'center'|'right' };

function field(c: CoordEntry, content: string, debug: boolean, extraCss = ''): string {
  const dbg = debug ? 'outline:1px solid red;background:rgba(255,0,0,0.05);' : '';
  return `<div style="
    position:absolute;
    left:${c.left}mm; top:${c.top}mm;
    width:${c.w}mm; height:${c.h}mm;
    font-size:${c.fs}pt; font-weight:${c.fw}; color:${c.color};
    text-align:${c.align}; line-height:1.0;
    overflow:hidden; white-space:nowrap;
    ${dbg}${extraCss}
  ">${content}</div>`;
}

// 物件所在地専用（折り返しあり・フォント可変）
function addrField(d: SaleScheduleData, debug: boolean): string {
  const c = COORDS.propertyAddr;
  const len = (d.propertyAddress||'').length;
  const fs = len > 36 ? 6.5 : len > 24 ? 7.5 : c.fs;
  const dbg = debug ? 'outline:1px solid red;background:rgba(255,0,0,0.05);' : '';
  return `<div style="
    position:absolute;
    left:${c.left}mm; top:${c.top}mm;
    width:${c.w}mm; height:${c.h}mm;
    font-size:${fs}pt; font-weight:${c.fw}; color:${c.color};
    text-align:${c.align}; line-height:1.35;
    overflow:hidden;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    word-break:break-all;
    ${dbg}
  ">${d.propertyAddress||''}</div>`;
}

// ─────────────────────────────────────────
// デバッググリッド（5mm間隔）
// ─────────────────────────────────────────
function debugGrid(): string {
  const lines: string[] = [];
  // 縦線（5mm間隔）
  for (let x = 0; x <= 210; x += 5) {
    const color = x % 10 === 0 ? 'rgba(255,0,0,0.3)' : 'rgba(255,0,0,0.15)';
    lines.push(`<div style="position:absolute;left:${x}mm;top:0;width:0;height:297mm;border-left:1px solid ${color};"></div>`);
    if (x % 10 === 0) {
      lines.push(`<div style="position:absolute;left:${x + 0.5}mm;top:1mm;font-size:5pt;color:red;opacity:0.6;">${x}</div>`);
    }
  }
  // 横線（5mm間隔）
  for (let y = 0; y <= 297; y += 5) {
    const color = y % 10 === 0 ? 'rgba(255,0,0,0.3)' : 'rgba(255,0,0,0.15)';
    lines.push(`<div style="position:absolute;left:0;top:${y}mm;width:210mm;height:0;border-top:1px solid ${color};"></div>`);
    if (y % 10 === 0) {
      lines.push(`<div style="position:absolute;left:1mm;top:${y + 0.5}mm;font-size:5pt;color:red;opacity:0.6;">${y}</div>`);
    }
  }
  return lines.join('');
}

// ─────────────────────────────────────────
// A4 HTML生成
// ─────────────────────────────────────────
function buildA4Html(d: SaleScheduleData, debug = false): string {
  const C = COORDS;
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>売却スケジュール</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm; height: 297mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: 'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;
  }
  /* A4ページ：背景と文字レイヤーの共通親 */
  .a4-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
  }
  /* 背景テンプレート：A4左上(0,0)に固定 */
  .template-background {
    position: absolute;
    left: 0; top: 0;
    width: 210mm; height: 297mm;
    object-fit: fill;
    z-index: 0;
  }
  /* オーバーレイレイヤー：背景と完全一致(0,0) */
  .overlay-layer {
    position: absolute;
    left: 0; top: 0;
    width: 210mm; height: 297mm;
    z-index: 10;
  }
</style>
</head><body>
<div class="a4-page">
  <img class="template-background"
    src="/sale-schedule/illustrations/template.png" alt="" />
  <div class="overlay-layer">
    ${debug ? debugGrid() : ''}

    ${field(C.propertyNo,   d.propertyNo || '', debug)}
    ${field(C.ownerName,    withSama(d.ownerName || ''), debug)}
    ${addrField(d, debug)}

    ${field(C.listPrice,    fmtNum(d.listPrice), debug)}

    ${field(C.step1Year,    d.startYear  ? String(d.startYear)  : '', debug)}
    ${field(C.step1Month,   d.startMonth ? String(d.startMonth) : '', debug)}

    ${field(C.step2Year,    d.marketingYear ? String(d.marketingYear) : '', debug)}
    ${field(C.step2StartM,  d.marketingStartMonth ? String(d.marketingStartMonth) : '', debug)}
    ${field(C.step2EndM,    d.marketingEndMonth   ? String(d.marketingEndMonth)   : '', debug)}

    ${field(C.minimumPrice, fmtNum(d.minimumPrice), debug)}

    ${field(C.step3Year,    d.contractYear  ? String(d.contractYear)  : '', debug)}
    ${field(C.step3Month,   d.contractMonth ? String(d.contractMonth) : '', debug)}

    ${field(C.step4Year,    d.settlementYear  ? String(d.settlementYear)  : '', debug)}
    ${field(C.step4Month,   d.settlementMonth ? String(d.settlementMonth) : '', debug)}
  </div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const SaleScheduleModal: React.FC<Props> = ({
  open, onClose,
  initialSellerNumber='', initialOwnerName='', initialPropertyAddress='', initialAssessPrice,
}) => {
  const NAVY = '#061D3B';
  const { sy, sm, cy, cm, sety, setm, ms, me, my } = calcDates();
  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [data, setData] = useState<SaleScheduleData>({
    propertyNo: initialSellerNumber, ownerName: initialOwnerName,
    propertyAddress: initialPropertyAddress,
    assessPrice: initialAssessPrice ? Math.round(initialAssessPrice/10000) : undefined,
    listPrice: undefined, minimumPrice: undefined,
    startYear:sy, startMonth:sm, marketingYear:my, marketingStartMonth:ms, marketingEndMonth:me,
    contractYear:cy, contractMonth:cm, settlementYear:sety, settlementMonth:setm,
  });

  const handleSearch = useCallback(async () => {
    if (!searchNo.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/api/sellers/by-number/${searchNo.trim().toUpperCase()}`);
      let pl: Record<string,unknown>|null = null;
      try { const pr = await api.get(`/api/property-listings/${searchNo.trim().toUpperCase()}`); pl = pr.data?.property||pr.data||null; } catch {}
      setData(prev => ({ ...prev, ...convertDb(res.data, pl) }));
    } catch (e: unknown) {
      setError((e as {response?:{data?:{message?:string}}})?.response?.data?.message || '売主番号が見つかりませんでした');
    } finally { setLoading(false); }
  }, [searchNo]);

  const setNum = (f: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData(p => ({ ...p, [f]: e.target.value===''?undefined:Number(e.target.value) }));
  const setStr = (f: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData(p => ({ ...p, [f]: e.target.value }));

  const handlePrint = useCallback(() => {
    const html = buildA4Html(data, false); // 印刷時はdebug=OFF
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
  }, [data]);

  // プレビュー用：210mmをpxに変換してscaleでコンテナに収める
  // 1mm = 3.7795px（96dpi基準）
  // プレビューコンテナ幅 ≒ 550px → scale = 550 / (210 * 3.7795) ≒ 0.693
  const A4_PX_W = 210 * 3.7795;
  const A4_PX_H = 297 * 3.7795;
  const PREVIEW_W = 550;
  const PREVIEW_H = 640;
  const scale = Math.min(PREVIEW_W / A4_PX_W, PREVIEW_H / A4_PX_H);

  const previewHtml = buildA4Html(data, debugMode);

  // iframeのsrcDoc変化でリロードを制御
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { maxHeight: '96vh' } }}>
      <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', pb:1 }}>
        <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <FormControlLabel
            control={<Switch size="small" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} />}
            label={<Typography variant="caption">デバッグ</Typography>}
            sx={{ mr:0 }}
          />
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p:2 }}>
        <Box sx={{ display:'flex', gap:1, mb:2, alignItems:'center' }}>
          <TextField label="売主番号" size="small" value={searchNo}
            onChange={e=>setSearchNo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}
            placeholder="例: FI737" sx={{ width:180 }} />
          <Button variant="contained" size="small"
            startIcon={loading?<CircularProgress size={16} color="inherit"/>:<SearchIcon/>}
            onClick={handleSearch} disabled={loading}>物件情報取得</Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* 左：編集フォーム */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb:1, color:NAVY }}>物件情報</Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}><TextField fullWidth size="small" label="物件番号" value={data.propertyNo} onChange={setStr('propertyNo')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="売主様氏名" value={data.ownerName} onChange={setStr('ownerName')} helperText="「様」は自動で付きます"/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="物件所在地" value={data.propertyAddress} onChange={setStr('propertyAddress')} multiline rows={2}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="売出価格（万円）" type="number" value={data.listPrice??''} onChange={setNum('listPrice')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="最低売却価格（万円）" type="number" value={data.minimumPrice??''} onChange={setNum('minimumPrice')}/></Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:2, mb:1, color:NAVY }}>STEP1 売り出し開始</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}><TextField fullWidth size="small" label="年" type="number" value={data.startYear??''} onChange={setNum('startYear')}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="月" type="number" value={data.startMonth??''} inputProps={{min:1,max:12}} onChange={setNum('startMonth')}/></Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:1.5, mb:1, color:NAVY }}>STEP2 販売活動強化</Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}><TextField fullWidth size="small" label="年" type="number" value={data.marketingYear??''} onChange={setNum('marketingYear')}/></Grid>
              <Grid item xs={4}><TextField fullWidth size="small" label="開始月" type="number" value={data.marketingStartMonth??''} inputProps={{min:1,max:12}} onChange={setNum('marketingStartMonth')}/></Grid>
              <Grid item xs={4}><TextField fullWidth size="small" label="終了月" type="number" value={data.marketingEndMonth??''} inputProps={{min:1,max:12}} onChange={setNum('marketingEndMonth')}/></Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:1.5, mb:1, color:NAVY }}>STEP3 売買契約</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}><TextField fullWidth size="small" label="年" type="number" value={data.contractYear??''} onChange={setNum('contractYear')}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="月" type="number" value={data.contractMonth??''} inputProps={{min:1,max:12}} onChange={setNum('contractMonth')}/></Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:1.5, mb:1, color:NAVY }}>STEP4 決済・引渡し</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}><TextField fullWidth size="small" label="年" type="number" value={data.settlementYear??''} onChange={setNum('settlementYear')}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="月" type="number" value={data.settlementMonth??''} inputProps={{min:1,max:12}} onChange={setNum('settlementMonth')}/></Grid>
            </Grid>
          </Grid>

          {/* 右：A4プレビュー
              ★ iframeではなくsrcDocを使ったiframe（サイズ問題対策）
              ★ コンテナはoverflow:hidden + position:relative
              ★ iframeはA4実寸(210mm×297mm相当px)で描画し、transformでscale縮小
          */}
          <Grid item xs={12} md={8}>
            <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ color:NAVY }}>
                プレビュー（A4）{debugMode && <span style={{color:'red',marginLeft:8}}>🔴 デバッグモード ON</span>}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                座標ズレは左フォームで確認後、コード内COORDSを調整
              </Typography>
            </Box>
            <Box sx={{
              width: PREVIEW_W, height: PREVIEW_H,
              overflow: 'hidden', border: '1px solid #ccc',
              borderRadius: 1, background: '#888',
              position: 'relative',
            }}>
              {/* iframeをA4実寸で配置し、transform:scaleで縮小表示 */}
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="preview"
                style={{
                  position: 'absolute',
                  left: 0, top: 0,
                  width: `${A4_PX_W}px`,
                  height: `${A4_PX_H}px`,
                  border: 'none',
                  transformOrigin: 'top left',
                  transform: `scale(${scale})`,
                  background: '#fff',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px:2, py:1.5, gap:1 }}>
        <Button onClick={onClose} color="inherit">閉じる</Button>
        <Button variant="contained" startIcon={<PrintIcon/>} onClick={handlePrint}
          sx={{ bgcolor:NAVY, '&:hover':{ bgcolor:'#082447' } }}>
          印刷 / PDF保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleScheduleModal;
