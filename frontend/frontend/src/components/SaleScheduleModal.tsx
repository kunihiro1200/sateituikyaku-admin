/**
 * 売却スケジュール資料生成モーダル
 *
 * 方式: 背景画像固定 + 透明BOX方式（position:absolute + flex中央配置）
 * 背景: /sale-schedule/illustrations/template.png (210mm × 297mm)
 *
 * ============================================================
 * BOX座標定数（BOXES）
 * 単位: mm / A4左上=(0,0)
 * 各BOXは背景画像の空欄に重ねる「透明な容器」
 * デバッグON時は赤い枠で表示
 * ============================================================
 *
 * スクリーンショット計測値（デバッググリッド基準）：
 *
 * 【物件情報エリア】
 *   売主名空欄:      left≈56, top≈33, w≈90, h≈6
 *   物件所在地空欄:  left≈56, top≈41, w≈140, h≈9
 *
 * 【STEP1】左側濃紺BOX内
 *   年の空欄:        left≈20, top≈76, w≈36, h≈5
 *   月の空欄:        left≈20, top≈82, w≈36, h≈10
 *   売出価格空欄:    left≈80, top≈65, w≈50, h≈7
 *
 * 【STEP2】左側濃紺BOX内
 *   年の空欄:        left≈20, top≈120, w≈36, h≈5
 *   開始月空欄:      left≈20, top≈126, w≈17, h≈9
 *   終了月空欄:      left≈38, top≈126, w≈17, h≈9
 *
 * 【STEP3】左側濃紺BOX内
 *   年の空欄:        left≈20, top≈164, w≈36, h≈5
 *   月の空欄:        left≈20, top≈170, w≈36, h≈9
 *   最低価格空欄:    left≈80, top≈160, w≈45, h≈7
 *
 * 【STEP4】左側濃紺BOX内
 *   年の空欄:        left≈20, top≈196, w≈36, h≈5
 *   月の空欄:        left≈20, top≈202, w≈36, h≈8
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  CircularProgress, Alert, Divider, IconButton,
  Switch, FormControlLabel,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// BOX座標定数（仮座標 - 個別調整中）
// 単位: mm / A4左上=(0,0)
// ─────────────────────────────────────────
const BOXES = {
  // ① 売主名：上へ3mm（40→37）
  ownerName:    { left: 56, top: 37.0, w: 130, h: 6.5 },
  // ② 物件所在地（2mm下げ → さらに2mm下げて計4mm → 1mm上げて計3mm）
  address:      { left: 56, top: 51.0, w: 130, h: 9.0 },
  // ③ 売出価格：2mm下げ
  listPrice:    { left: 78, top: 68.0, w: 52,  h: 7.0 },
  // ④ 最低価格：左4mm・下3mm
  minPrice:     { left: 54, top: 185.0, w: 57,  h: 7.0 },

  // STEP1年（5mm上、5mm左）
  step1Year:    { left: 14, top: 84.5, w: 36,  h: 5.5 },
  // STEP1月（4mm上、5mm左）
  step1Month:   { left: 14, top: 92.5, w: 36,  h: 10.0 },
  step2Year:    { left: 14, top: 139.0, w: 36, h: 5.5 },
  step2StartM:  { left: 21, top: 146.0, w: 20, h: 9.5 },
  step2EndM:    { left: 33, top: 154.0, w: 17, h: 9.5 },
  step3Year:    { left: 14, top: 198.5, w: 36, h: 5.5 },
  step3Month:   { left: 14, top: 204.5, w: 36, h: 9.5 },
  step4Year:    { left: 14, top: 230.5, w: 36, h: 5.5 },
  step4Month:   { left: 14, top: 237.5, w: 36, h: 8.0 },
} as const;

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface SaleScheduleData {
  propertyNo: string;       // 内部管理用（資料には表示しない）
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;
  listPrice?: number;      // 売出価格（査定額最高値）
  minimumPrice?: number;   // 最低価格（下限値・内部用）
  minPriceRange?: string;  // 最低価格範囲表示「5,890〜5,390」
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
  initialAssessPrice?: number;  // 円：売出価格（最高値）
  initialMinPrice?: number;     // 円：最低価格（最低値）
  initialValuation1?: number;   // 円：査定額1（低）
  initialValuation2?: number;   // 円：査定額2（中）
  initialValuation3?: number;   // 円：査定額3（高）
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

  // property_listings から売出価格取得（あれば優先）
  const listRaw = (pl?.listing_price as number|null) || (pl?.sales_price as number|null) || null;

  // sellers から査定額取得（camelCase: by-numberレスポンス形式）
  const v1 = (seller?.valuationAmount1 as number|null) || (seller?.valuation_amount_1 as number|null) || null;
  const v2 = (seller?.valuationAmount2 as number|null) || (seller?.valuation_amount_2 as number|null) || null;
  const v3 = (seller?.valuationAmount3 as number|null) || (seller?.valuation_amount_3 as number|null) || null;

  // 売出価格: property_listings優先 → なければ査定額【最高値】
  const maxAssess = [v1, v2, v3].filter((v): v is number => v != null && v > 0);
  const sortedDesc = [...maxAssess].sort((a, b) => b - a); // 高い順
  const highestAssess = sortedDesc[0] ?? null;
  const listPriceMan = listRaw
    ? Math.round(listRaw / 10000)
    : highestAssess ? Math.round(highestAssess / 10000) : undefined;

  // 最低価格範囲: 最高値〜中間値（2段階あれば範囲、1段階なら単値）
  // 例: 5890万・5390万・4890万 → 「5,890〜5,390」
  const lowestAssess = maxAssess.length > 0 ? Math.min(...maxAssess) : null;
  const minPriceMan = lowestAssess ? Math.round(lowestAssess / 10000) : undefined;

  // 範囲文字列：最高値〜（最高値より低い最初の値）
  let minPriceRange: string | undefined;
  if (sortedDesc.length >= 2) {
    const high = Math.round(sortedDesc[0] / 10000);
    const mid  = Math.round(sortedDesc[1] / 10000);
    minPriceRange = `${high.toLocaleString()}〜${mid.toLocaleString()}`;
  } else if (sortedDesc.length === 1) {
    minPriceRange = Math.round(sortedDesc[0] / 10000).toLocaleString();
  }

  return {
    propertyNo: (seller?.sellerNumber as string) || (seller?.seller_number as string) || '',
    ownerName: (seller?.name as string) || '',
    propertyAddress: (seller?.propertyAddress as string) || (seller?.property_address as string) || '',
    assessPrice: highestAssess ? Math.round(highestAssess / 10000) : undefined,
    listPrice: listPriceMan,
    minimumPrice: minPriceMan,
    minPriceRange,
    startYear:sy, startMonth:sm, marketingYear:my, marketingStartMonth:ms, marketingEndMonth:me,
    contractYear:cy, contractMonth:cm, settlementYear:sety, settlementMonth:setm,
  };
}

const fmtNum = (v?: number) => v != null ? v.toLocaleString() : '';

// 売主名：「様」は背景画像側 → 氏名のみ（末尾の「様」を除去）
function ownerNameOnly(name: string): string {
  return name.trim().replace(/[\s　]*様\s*$/, '');
}

// ─────────────────────────────────────────
// グリッド生成（5mm / 10mm）
// ─────────────────────────────────────────
function buildDebugGrid(): string {
  let html = '';
  for (let x = 0; x <= 210; x += 5) {
    const c = x % 10 === 0 ? 'rgba(0,100,255,0.4)' : 'rgba(0,100,255,0.15)';
    html += `<div style="position:absolute;left:${x}mm;top:0;width:0;height:297mm;border-left:1px solid ${c};pointer-events:none;z-index:20;"></div>`;
    if (x % 10 === 0 && x > 0)
      html += `<div style="position:absolute;left:${x+0.2}mm;top:0.5mm;font-size:4pt;color:blue;opacity:0.8;pointer-events:none;z-index:21;">${x}</div>`;
  }
  for (let y = 0; y <= 297; y += 5) {
    const c = y % 10 === 0 ? 'rgba(0,100,255,0.4)' : 'rgba(0,100,255,0.15)';
    html += `<div style="position:absolute;left:0;top:${y}mm;width:210mm;height:0;border-top:1px solid ${c};pointer-events:none;z-index:20;"></div>`;
    if (y % 10 === 0 && y > 0)
      html += `<div style="position:absolute;left:0.2mm;top:${y+0.3}mm;font-size:4pt;color:blue;opacity:0.8;pointer-events:none;z-index:21;">${y}</div>`;
  }
  return html;
}

// ─────────────────────────────────────────
// BOX生成（透明コンテナ + 文字を中央配置）
// ─────────────────────────────────────────
type BoxCoord = { left:number; top:number; w:number; h:number };

function makeBox(
  coord: BoxCoord,
  content: string,
  fontSize: number,
  fontWeight: number,
  color: string,
  debug: boolean,
  extraStyle = '',
): string {
  const dbgStyle = debug
    ? 'outline:2px solid red;background:rgba(255,0,0,0.10);'
    : '';
  return `<div style="
    position:absolute;
    left:${coord.left}mm; top:${coord.top}mm;
    width:${coord.w}mm; height:${coord.h}mm;
    display:flex; align-items:center; justify-content:center;
    margin:0; padding:0; box-sizing:border-box;
    font-size:${fontSize}pt; font-weight:${fontWeight}; color:${color};
    white-space:nowrap; overflow:hidden;
    ${dbgStyle}${extraStyle}
  ">${content}</div>`;
}

// 物件所在地専用（長い場合のみフォント縮小・flex中央配置・2行まで）
function makeAddressBox(addr: string, debug: boolean, coord = BOXES.address): string {
  const len = addr.length;
  // 1.3〜1.4倍に変更（元8.5pt → 11〜12pt）
  const fs = len > 40 ? 8 : len > 28 ? 9.5 : 12;
  const lh = len > 28 ? 1.3 : 1.1;
  const wrapStyle = len > 28
    ? 'white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all;text-align:left;align-items:flex-start;'
    : 'white-space:nowrap;text-align:left;';
  const dbgStyle = debug ? 'outline:2px solid red;background:rgba(255,0,0,0.10);' : '';
  return `<div style="
    position:absolute;
    left:${coord.left}mm; top:${coord.top}mm;
    width:${coord.w}mm; height:${coord.h}mm;
    display:flex; align-items:center;
    margin:0; padding:0; box-sizing:border-box;
    font-size:${fs}pt; font-weight:600; color:#1a1a1a;
    line-height:${lh}; overflow:hidden;
    ${wrapStyle}${dbgStyle}
  ">${addr||''}</div>`;
}

// ─────────────────────────────────────────
// A4 HTML生成（背景画像 + BOXオーバーレイ）
// ─────────────────────────────────────────
function buildA4Html(d: SaleScheduleData, debug = false, sellerNumber = ''): string {
  const GOLD = '#C99A3D';
  const NAVY = '#ffffff'; // 濃紺BOX内の文字は白

  // 売主番号がFIで始まらない場合は_oitaテンプレートを使用
  const isOita = sellerNumber.trim().length > 0 && !sellerNumber.trim().toUpperCase().startsWith('FI');
  const templateFile = isOita
    ? `/sale-schedule/illustrations/template_oita.png?v=${Date.now()}`
    : `/sale-schedule/illustrations/template.png?v=${Date.now()}`;

  // oita用座標オフセット（FI用BOXESは絶対変更しない）
  const B = isOita ? {
    ownerName:   { ...BOXES.ownerName,   top: BOXES.ownerName.top   + 1 },
    address:     { ...BOXES.address,     top: BOXES.address.top     + 4 },
    listPrice:   { ...BOXES.listPrice,   top: BOXES.listPrice.top   + 3, left: BOXES.listPrice.left - 1 },
    minPrice:    { ...BOXES.minPrice,    top: BOXES.minPrice.top    + 4 },
    step1Year:   { ...BOXES.step1Year },
    step1Month:  { ...BOXES.step1Month },
    step2Year:   { ...BOXES.step2Year,   top: BOXES.step2Year.top   + 2 },
    step2StartM: { ...BOXES.step2StartM, top: BOXES.step2StartM.top + 2 },
    step2EndM:   { ...BOXES.step2EndM,   top: BOXES.step2EndM.top   + 2 },
    step3Year:   { ...BOXES.step3Year,   top: BOXES.step3Year.top   + 4 },
    step3Month:  { ...BOXES.step3Month,  top: BOXES.step3Month.top  + 4 },
    step4Year:   { ...BOXES.step4Year,   top: BOXES.step4Year.top   + 5 },
    step4Month:  { ...BOXES.step4Month,  top: BOXES.step4Month.top  + 5 },
  } : BOXES;

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
  .a4-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
  }
  /* 背景：A4左上(0,0)に完全固定 */
  .template-background {
    position: absolute;
    left: 0; top: 0;
    width: 210mm; height: 297mm;
    object-fit: fill;
    z-index: 0;
  }
  /* オーバーレイ：背景と同じ(0,0)基準 */
  .overlay-layer {
    position: absolute;
    left: 0; top: 0;
    width: 210mm; height: 297mm;
    z-index: 10;
  }
</style>
</head><body>
<div class="a4-page">
  <!-- 背景テンプレート（変更禁止） -->
  <img class="template-background"
    src="${templateFile}" alt="" />

  <!-- 動的テキストBOXオーバーレイ -->
  <div class="overlay-layer">
    ${debug ? buildDebugGrid() : ''}

    <!-- ① 売主名（氏名のみ・「様」は背景画像） fs:9→12.5pt -->
    ${makeBox(B.ownerName, ownerNameOnly(d.ownerName||''), 12.5, 600, '#1a1a1a', debug, 'justify-content:flex-start;padding-left:2mm;')}

    <!-- ② 物件所在地 fs可変→大きめに -->
    ${makeAddressBox(d.propertyAddress||'', debug, B.address)}

    <!-- ③ 売出価格（数値のみ）fs:14→18pt ゴールド太字 -->
    ${makeBox(B.listPrice, fmtNum(d.listPrice), 18, 900, GOLD, debug)}

    <!-- ④ 最低価格（1行・ゴールド太字） -->
    ${makeBox(B.minPrice, d.minPriceRange || fmtNum(d.minimumPrice), 15, 900, GOLD, debug)}

    <!-- 年月（調整保留中・非表示） -->
    <!-- STEP1 年・月：表示開始 -->
    ${makeBox(B.step1Year,  d.startYear  ? `${d.startYear}年`  : '', 13, 700, '#ffffff', debug)}
    ${makeBox(B.step1Month, d.startMonth ? `${d.startMonth}月` : '', 16, 900, '#C99A3D', debug)}

    <!-- STEP2 年・月〜月 -->
    ${makeBox(B.step2Year,   d.marketingYear        ? `${d.marketingYear}年`        : '', 13, 700, '#ffffff', debug)}
    ${makeBox(B.step2StartM, d.marketingStartMonth  ? `${d.marketingStartMonth}月〜`  : '', 16, 900, '#C99A3D', debug)}
    ${makeBox(B.step2EndM,   d.marketingEndMonth    ? `${d.marketingEndMonth}月`    : '', 16, 900, '#C99A3D', debug)}

    <!-- STEP3 年・月 -->
    ${makeBox(B.step3Year,  d.contractYear  ? `${d.contractYear}年`  : '', 13, 700, '#ffffff', debug)}
    ${makeBox(B.step3Month, d.contractMonth ? `${d.contractMonth}月` : '', 16, 900, '#C99A3D', debug)}

    <!-- STEP4 年・月 -->
    ${makeBox(B.step4Year,  d.settlementYear  ? `${d.settlementYear}年`  : '', 13, 700, '#ffffff', debug)}
    ${makeBox(B.step4Month, d.settlementMonth ? `${d.settlementMonth}月` : '', 16, 900, '#C99A3D', debug)}

  </div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const SaleScheduleModal: React.FC<Props> = ({
  open, onClose,
  initialSellerNumber='', initialOwnerName='', initialPropertyAddress='',
  initialAssessPrice, initialMinPrice,
  initialValuation1, initialValuation2, initialValuation3,
}) => {
  const NAVY = '#061D3B';
  const { sy, sm, cy, cm, sety, setm, ms, me, my } = calcDates();

  // 渡された3つの査定額から売出価格（最高値）・最低価格範囲を計算
  const initVals = [initialValuation1, initialValuation2, initialValuation3]
    .filter((v): v is number => v != null && v > 0);
  const initSortedDesc = [...initVals].sort((a, b) => b - a);
  const initHighest = initSortedDesc[0];
  const initSecond  = initSortedDesc[1];

  // 売出価格 = 最高値（万円）
  const initListPrice = initHighest
    ? Math.round(initHighest / 10000)
    : initialAssessPrice ? Math.round(initialAssessPrice / 10000) : undefined;

  // 最低価格範囲 = 「最高値〜中間値」
  let initMinPriceRange: string | undefined;
  if (initHighest && initSecond) {
    initMinPriceRange = `${Math.round(initHighest/10000).toLocaleString()}〜${Math.round(initSecond/10000).toLocaleString()}`;
  } else if (initHighest) {
    initMinPriceRange = Math.round(initHighest/10000).toLocaleString();
  }
  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [data, setData] = useState<SaleScheduleData>({
    propertyNo: initialSellerNumber,
    ownerName: initialOwnerName,
    propertyAddress: initialPropertyAddress,
    assessPrice: initHighest ? Math.round(initHighest/10000) : undefined,
    listPrice: initListPrice,           // 売出価格 = 査定額最高値
    minimumPrice: undefined,
    minPriceRange: initMinPriceRange,   // 最低価格範囲 = 「最高〜中間」
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

  // モーダルが開いたとき、DBに保存済みデータがあれば読み込む
  useEffect(() => {
    if (!open || !initialSellerNumber) return;
    (async () => {
      try {
        const res = await api.get(`/api/document-drafts/${initialSellerNumber}/sale_schedule`);
        if (res.data?.data) {
          setData(prev => ({ ...prev, ...res.data.data }));
        }
      } catch {
        // 保存データなし → 初期値のまま
      }
    })();
  }, [open, initialSellerNumber]);

  // DBに保存
  const handleSave = useCallback(async () => {
    if (!initialSellerNumber) return;
    setSaveStatus('saving');
    try {
      await api.post(`/api/document-drafts/${initialSellerNumber}/sale_schedule`, { data });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [data, initialSellerNumber]);

  const setNum = (f: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData(p => ({ ...p, [f]: e.target.value===''?undefined:Number(e.target.value) }));
  const setStr = (f: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData(p => ({ ...p, [f]: e.target.value }));

  // 印刷（debug=OFF）
  const handlePrint = useCallback(() => {
    const html = buildA4Html(data, false, initialSellerNumber);
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html); win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
  }, [data]);

  // iframeのscale計算（A4実寸px → プレビューコンテナに収める）
  const A4W = 210 * 3.7795;
  const A4H = 297 * 3.7795;
  const PW = 550; // プレビュー幅px
  const PH = 660; // プレビュー高さpx
  const scale = Math.min(PW / A4W, PH / A4H);

  const previewHtml = buildA4Html(data, debugMode, initialSellerNumber);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { maxHeight: '96vh' } }}>
      <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', pb:1 }}>
        <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <FormControlLabel
            control={<Switch size="small" checked={debugMode} onChange={e=>setDebugMode(e.target.checked)} color="error" />}
            label={<Typography variant="caption" color={debugMode?'error':'text.secondary'}>
              {debugMode ? '🔴 デバッグON' : 'デバッグOFF'}
            </Typography>}
            sx={{ mr:0 }}
          />
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p:2 }}>
        {/* 検索 */}
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
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="売主様氏名" value={data.ownerName}
                  onChange={setStr('ownerName')} helperText="「様」は背景画像側に固定" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="物件所在地" value={data.propertyAddress}
                  onChange={setStr('propertyAddress')} multiline rows={2} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="売出価格（万円）" type="number"
                  value={data.listPrice??''} onChange={setNum('listPrice')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="最低価格（範囲表示）"
                  value={data.minPriceRange ?? ''}
                  onChange={e => setData(p => ({ ...p, minPriceRange: e.target.value }))}
                  helperText="例: 5,890〜5,390（自動生成・手動修正可）" />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:2, mb:1, color:NAVY }}>STEP1 売り出し開始</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}><TextField fullWidth size="small" label="年（数字のみ）" type="number" value={data.startYear??''} onChange={setNum('startYear')}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="月（数字のみ）" type="number" value={data.startMonth??''} inputProps={{min:1,max:12}} onChange={setNum('startMonth')}/></Grid>
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
              <Grid item xs={6}><TextField fullWidth size="small" label="月（数字のみ）" type="number" value={data.settlementMonth??''} inputProps={{min:1,max:12}} onChange={setNum('settlementMonth')}/></Grid>
            </Grid>

            {debugMode && (
              <Box sx={{ mt:2, p:1.5, bgcolor:'#fff3f3', border:'1px solid #f44336', borderRadius:1 }}>
                <Typography variant="caption" color="error" fontWeight="bold">
                  🔴 デバッグモード ON
                </Typography>
                <Typography variant="caption" display="block" color="error" sx={{ mt:0.5, fontSize:'0.65rem' }}>
                  赤いBOXが背景画像の空欄に重なるよう確認してください。<br/>
                  ズレている場合はコード内BOXESの座標値を調整します。
                </Typography>
              </Box>
            )}
          </Grid>

          {/* 右：A4プレビュー（iframe + transform:scale）*/}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb:1, color:NAVY }}>
              プレビュー（A4）
            </Typography>
            {/* コンテナ：実寸iframeをscaleで縮小して見せる */}
            <Box sx={{
              width: PW, height: PH,
              overflow: 'hidden',
              border: '2px solid #ccc',
              borderRadius: 1,
              background: '#666',
              position: 'relative',
            }}>
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="preview"
                style={{
                  position: 'absolute',
                  left: 0, top: 0,
                  width: `${A4W}px`,
                  height: `${A4H}px`,
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
        <Button variant="outlined" onClick={handleSave}
          disabled={saveStatus === 'saving'}
          color={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : 'primary'}>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 保存済み' : saveStatus === 'error' ? '保存失敗' : '保存'}
        </Button>
        <Button variant="contained" startIcon={<PrintIcon/>} onClick={handlePrint}
          sx={{ bgcolor:NAVY, '&:hover':{ bgcolor:'#082447' } }}>
          印刷 / PDF保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleScheduleModal;
