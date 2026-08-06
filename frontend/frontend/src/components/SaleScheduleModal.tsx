/**
 * 売却スケジュール資料生成モーダル
 * 印刷方式: 別ウィンドウ(printWindow)にA4HTMLを書き出してprint()
 * → モーダルのscale・opacity・z-index問題を完全回避
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  CircularProgress, Alert, Divider, IconButton,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────
export interface SaleScheduleData {
  propertyNo: string;
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;   // 査定価格（万円）
  listPrice?: number;     // 売出価格（万円）
  minimumPrice?: number;  // 最低売却価格（万円）
  startYear?: number;
  startMonth?: number;
  marketingPeriod?: string;
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
  initialAssessPrice?: number; // 円
}

// ─────────────────────────────────────────
// DB → SaleScheduleData 変換
// ─────────────────────────────────────────
function convertDbToScheduleData(
  seller: Record<string, unknown>,
  propertyListing: Record<string, unknown> | null
): Partial<SaleScheduleData> {
  const now = new Date();
  const sy = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  const sm = now.getMonth() >= 11 ? 1 : now.getMonth() + 2;
  const cy = sm + 3 > 12 ? sy + 1 : sy;
  const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
  const sety = cm + 1 > 12 ? cy + 1 : cy;
  const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
  const me = sm + 1 > 12 ? 1 : sm + 1;
  const ye = sm + 1 > 12 ? sy + 1 : sy;

  const listPriceRaw = (propertyListing?.listing_price as number | null)
    || (propertyListing?.sales_price as number | null) || null;
  const assessRaw = (seller?.valuation_amount_1 as number | null)
    || (seller?.valuation_amount_2 as number | null) || null;

  return {
    propertyNo: (seller?.seller_number as string) || '',
    ownerName: (seller?.name as string) || '',
    propertyAddress: (seller?.property_address as string) || '',
    assessPrice: assessRaw ? Math.round(assessRaw / 10000) : undefined,
    listPrice: listPriceRaw ? Math.round(listPriceRaw / 10000) : undefined,
    startYear: sy, startMonth: sm,
    marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月`,
    contractYear: cy, contractMonth: cm,
    settlementYear: sety, settlementMonth: setm,
  };
}

// ─────────────────────────────────────────
// A4 HTML 生成（印刷専用・完全インラインCSS）
// ─────────────────────────────────────────
function buildA4Html(d: SaleScheduleData): string {
  const NAVY = '#061D3B';
  const GOLD = '#C99A3D';
  const BG_LIGHT = '#F6F7F9';
  const fmt = (v?: number) => v != null ? v.toLocaleString() : '―';

  const startYM = d.startYear && d.startMonth ? `${d.startYear}年${d.startMonth}月` : '―';
  const contractYM = d.contractYear && d.contractMonth ? `${d.contractYear}年${d.contractMonth}月` : '―';
  const settlementYM = d.settlementYear && d.settlementMonth ? `${d.settlementYear}年${d.settlementMonth}月中旬` : '―';
  const period = d.marketingPeriod || '―';

  const chk = (text: string) => `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">
      <div style="width:10px;height:10px;border:1.5px solid ${GOLD};border-radius:2px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;background:${GOLD};border-radius:1px;"></div>
      </div>
      <span style="font-size:7.5pt;">${text}</span>
    </div>`;

  const point = (text: string, bg = '#fff') => `
    <div style="background:${bg};border:1px solid ${NAVY};border-radius:3px;padding:3mm 3mm;margin-top:2mm;">
      <div style="font-size:6pt;font-weight:900;color:${GOLD};margin-bottom:2px;text-align:center;letter-spacing:0.08em;">POINT</div>
      <div style="font-size:6pt;line-height:1.6;">${text}</div>
    </div>`;

  const stepCircle = (n: string) => `
    <div style="width:28px;height:28px;border-radius:50%;background:${GOLD};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-weight:900;font-size:14pt;box-shadow:0 2px 4px rgba(0,0,0,0.3);flex-shrink:0;">${n}</div>`;

  const stepLabel = (txt: string) => `
    <div style="background:${NAVY};color:#fff;border-radius:3px;padding:2px 5px;
      font-size:6pt;font-weight:700;text-align:center;line-height:1.4;margin-top:2px;">${txt}</div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>売却スケジュール</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm; height: 297mm;
    font-family: 'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;
    font-size: 9pt; color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .a4 {
    width: 210mm; height: 297mm;
    display: flex; flex-direction: column;
    background: #fff; overflow: hidden;
  }
</style>
</head>
<body>
<div class="a4">

  <!-- HEADER -->
  <div style="background:${NAVY};height:28mm;padding:0 10mm;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div>
      <div style="font-size:7pt;color:rgba(255,255,255,0.65);letter-spacing:0.12em;margin-bottom:2px;">不動産</div>
      <div style="font-size:22pt;font-weight:900;color:${GOLD};letter-spacing:0.04em;line-height:1;">売却スケジュール</div>
      <div style="font-size:6.5pt;color:rgba(255,255,255,0.7);margin-top:4px;letter-spacing:0.04em;">
        全力で販売活動を行い、最善の条件でのご売却をサポートします
      </div>
    </div>
    <div style="text-align:right;">
      <img src="/kujira-fudosan-logo.png" alt="くじら不動産"
        style="height:9mm;max-width:28mm;object-fit:contain;display:block;margin-left:auto;"
        onerror="this.style.display='none'" />
      <div style="font-size:7pt;font-weight:700;color:${GOLD};letter-spacing:0.1em;margin-top:3px;">KUJIRA REAL ESTATE</div>
    </div>
  </div>

  <!-- MAIN -->
  <div style="padding:4mm 10mm 3mm 10mm;flex:1;display:flex;flex-direction:column;gap:2mm;overflow:hidden;">

    <!-- 物件情報 -->
    <div style="border:1.5px solid ${NAVY};border-radius:4px;background:${BG_LIGHT};
      overflow:hidden;height:22mm;flex-shrink:0;">
      <div style="display:flex;align-items:center;border-bottom:1px solid ${NAVY}25;padding:2.5mm 3mm;height:7mm;">
        <div style="width:5mm;font-size:9pt;flex-shrink:0;">＃</div>
        <div style="width:20mm;font-size:7.5pt;font-weight:700;color:${NAVY};">物件番号</div>
        <div style="flex:1;font-size:8pt;">${d.propertyNo || '―'}</div>
      </div>
      <div style="display:flex;align-items:center;border-bottom:1px solid ${NAVY}25;padding:2.5mm 3mm;height:7mm;">
        <div style="width:5mm;font-size:9pt;flex-shrink:0;">👤</div>
        <div style="width:20mm;font-size:7.5pt;font-weight:700;color:${NAVY};">売　主　様</div>
        <div style="flex:1;font-size:8pt;">${d.ownerName ? d.ownerName + '　様' : '―'}</div>
      </div>
      <div style="display:flex;align-items:flex-start;padding:2.5mm 3mm;min-height:8mm;">
        <div style="width:5mm;font-size:9pt;flex-shrink:0;padding-top:1px;">📍</div>
        <div style="width:20mm;font-size:7.5pt;font-weight:700;color:${NAVY};padding-top:1px;">物件所在地</div>
        <div style="flex:1;font-size:7.5pt;word-break:break-all;line-height:1.4;">${d.propertyAddress || '―'}</div>
      </div>
    </div>

    <!-- STEP 1 -->
    <div style="display:flex;gap:3mm;background:${BG_LIGHT};border:1.5px solid ${NAVY}22;
      border-radius:4px;padding:3mm;height:43mm;flex-shrink:0;overflow:hidden;">
      <!-- 左 -->
      <div style="width:20mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
        ${stepCircle('1')}
        ${stepLabel('売り出し開始')}
        <div style="font-size:8pt;color:${NAVY};font-weight:700;margin-top:3px;text-align:center;line-height:1.4;">
          ${startYM.replace('年', '年\n')}
        </div>
      </div>
      <!-- 右 -->
      <div style="flex:1;overflow:hidden;">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3mm;">
          <span style="font-size:8pt;font-weight:700;color:${NAVY};">売出価格</span>
          <span style="font-size:18pt;font-weight:900;color:${GOLD};line-height:1;">${fmt(d.listPrice)}</span>
          <span style="font-size:8pt;color:${NAVY};">万円</span>
        </div>
        <div style="display:flex;gap:3mm;">
          <div style="flex:1;">
            ${chk('室内写真・掲載内容の見直し')}
            ${chk('不動産ポータルサイト掲載')}
            ${chk('周辺相場・競合物件の確認')}
            ${chk('販売活動開始')}
          </div>
          <div style="width:42mm;background:#fff;border:1px solid ${NAVY};border-radius:4px;padding:3mm;flex-shrink:0;">
            <div style="font-size:6pt;font-weight:900;color:${GOLD};text-align:center;margin-bottom:3px;letter-spacing:0.08em;">POINT</div>
            <div style="font-size:6pt;line-height:1.6;color:#333;">市場動向を確認し、最も反響を得やすい価格帯・タイミングで販売を開始します。</div>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 2 -->
    <div style="background:#fff;border:1.5px solid ${NAVY}22;border-radius:4px;padding:3mm;
      height:57mm;flex-shrink:0;overflow:hidden;">
      <div style="display:flex;gap:3mm;height:100%;">
        <div style="width:20mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
          ${stepCircle('2')}
          ${stepLabel('販売活動を強化')}
          <div style="font-size:7pt;color:${NAVY};font-weight:700;margin-top:3px;text-align:center;line-height:1.5;">
            ${period}
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div style="font-size:7.5pt;font-weight:700;color:${NAVY};margin-bottom:2mm;flex-shrink:0;">
            売却チャンスを逃さないよう全力で販売活動を強化します！
          </div>
          <div style="display:flex;gap:2mm;flex:1;overflow:hidden;">
            ${[
              ['広告の見直し・拡大', '掲載媒体や広告内容を見直し、より多くの購入希望者へ物件情報を届けます。'],
              ['反響状況の分析', '問い合わせ・アクセス状況を分析し、販売方法を随時改善します。'],
              ['ご案内の強化', 'お問い合わせから内覧まで迅速・丁寧に対応し、購入意欲を高めます。'],
              ['価格戦略の検討', '市場動向と反響状況を確認し、最適な販売価格をご提案します。'],
            ].map(([title, desc]) => `
              <div style="flex:1;background:${BG_LIGHT};border-top:2px solid ${NAVY};border-radius:3px;
                padding:3mm 2mm;display:flex;flex-direction:column;align-items:center;overflow:hidden;">
                <div style="font-size:6.5pt;font-weight:700;color:${NAVY};margin-bottom:3px;text-align:center;">${title}</div>
                <div style="font-size:5.5pt;color:#555;line-height:1.5;text-align:center;">${desc}</div>
              </div>`).join('')}
          </div>
          <div style="margin-top:2mm;border-top:2px solid ${GOLD};padding-top:2mm;
            text-align:center;font-size:7pt;font-weight:700;color:${GOLD};flex-shrink:0;">
            積極的な取り組みで「早期・高値売却」を目指します！
          </div>
        </div>
      </div>
    </div>

    <!-- STEP 3 + 4 -->
    <div style="display:flex;gap:3mm;height:55mm;flex-shrink:0;">
      <!-- STEP3 -->
      <div style="flex:1;background:${BG_LIGHT};border:1.5px solid ${NAVY}22;border-radius:4px;padding:3mm;overflow:hidden;">
        <div style="display:flex;gap:3mm;height:100%;">
          <div style="width:20mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
            ${stepCircle('3')}
            ${stepLabel('売買契約\n（最低価格）')}
            <div style="font-size:7pt;color:${NAVY};font-weight:700;margin-top:3px;text-align:center;line-height:1.4;">
              ${contractYM.replace('年', '年\n')}
            </div>
          </div>
          <div style="flex:1;overflow:hidden;">
            <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:2mm;flex-wrap:nowrap;">
              <span style="font-size:6.5pt;font-weight:700;color:${NAVY};white-space:nowrap;">最低価格</span>
              <span style="font-size:13pt;font-weight:900;color:${GOLD};line-height:1;">${fmt(d.minimumPrice)}</span>
              <span style="font-size:6.5pt;color:${NAVY};">万円で売買契約を目標</span>
            </div>
            ${chk('最善条件でのご成約を目指します')}
            ${chk('条件調整・契約手続き')}
            ${chk('売買契約書作成・重要事項説明')}
            ${point('条件が整い次第、スムーズに契約手続きを進めます。')}
          </div>
        </div>
      </div>
      <!-- STEP4 -->
      <div style="flex:1;background:#fff;border:1.5px solid ${NAVY}22;border-radius:4px;padding:3mm;overflow:hidden;">
        <div style="display:flex;gap:3mm;height:100%;">
          <div style="width:20mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
            ${stepCircle('4')}
            ${stepLabel('決済・\nお引渡し')}
            <div style="font-size:7pt;color:${NAVY};font-weight:700;margin-top:3px;text-align:center;line-height:1.4;">
              ${settlementYM.replace('年', '年\n')}
            </div>
          </div>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:8pt;font-weight:700;color:${NAVY};margin-bottom:2mm;">決済・お引渡し</div>
            ${chk('各種手続き・日程調整')}
            ${chk('引き渡し準備')}
            ${chk('鍵のお引き渡し')}
            ${chk('残代金受領')}
            ${point('決済・お引渡しまでしっかりとサポートいたします。', BG_LIGHT)}
          </div>
        </div>
      </div>
    </div>

    <!-- サポート体制 -->
    <div style="height:28mm;flex-shrink:0;">
      <div style="background:${NAVY};color:#fff;padding:2mm 4mm;border-radius:4px 4px 0 0;
        font-size:8pt;font-weight:700;text-align:center;letter-spacing:0.05em;">
        くじら不動産のサポート体制
      </div>
      <div style="display:flex;gap:2mm;background:${BG_LIGHT};border:1.5px solid ${NAVY};
        border-top:none;border-radius:0 0 4px 4px;padding:2.5mm;height:calc(100% - 7mm);">
        ${[
          ['市場分析・戦略立案', '最新の市場データを基に、最適な販売戦略をご提案します。'],
          ['販売力・集客力', '多様な広告媒体とネットワークで、より多くの購入希望者にアプローチします。'],
          ['安心のサポート', '売主様に寄り添い、安心・安全な売却を実現します。'],
          ['手続きサポート', '売買契約から決済まで、各種手続きを丁寧にサポートします。'],
        ].map(([title, desc]) => `
          <div style="flex:1;text-align:center;padding:1.5mm;">
            <div style="font-size:7pt;font-weight:700;color:${NAVY};margin-bottom:2px;">${title}</div>
            <div style="font-size:5.5pt;color:#555;line-height:1.5;">${desc}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- メッセージ -->
    <div style="border-top:2px solid ${GOLD};padding:2mm 0;height:16mm;flex-shrink:0;
      display:flex;align-items:center;overflow:hidden;">
      <div style="flex:1;">
        <p style="font-size:7.5pt;color:${NAVY};font-weight:700;margin-bottom:2px;line-height:1.6;">
          市場動向を見極め、計画的に進めることで最善の売却を実現します。
        </p>
        <p style="font-size:6.5pt;color:#555;line-height:1.6;">
          定期的にご報告し、最善の売却を目指しますのでご安心ください。
        </p>
      </div>
    </div>

  </div><!-- /MAIN -->

  <!-- FOOTER -->
  <div style="background:${NAVY};height:18mm;padding:0 10mm;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:3mm;">
      <img src="/kujira-fudosan-logo.png" alt=""
        style="height:7mm;max-width:10mm;object-fit:contain;"
        onerror="this.style.display='none'" />
      <div>
        <div style="font-size:9pt;font-weight:800;color:${GOLD};">くじら不動産</div>
        <div style="font-size:5.5pt;color:rgba(255,255,255,0.65);">誠実なサポートで、安心の売却を。</div>
      </div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:11pt;font-weight:900;color:${GOLD};">092-401-5331</div>
      <div style="font-size:5.5pt;color:rgba(255,255,255,0.65);">営業時間 10:00〜18:00</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:6.5pt;color:rgba(255,255,255,0.85);">福岡市中央区舞鶴3-1-10</div>
      <div style="font-size:5.5pt;color:rgba(255,255,255,0.55);margin-top:1px;">tenant@ifoo-oita.com</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────
export const SaleScheduleModal: React.FC<Props> = ({
  open, onClose,
  initialSellerNumber = '',
  initialOwnerName = '',
  initialPropertyAddress = '',
  initialAssessPrice,
}) => {
  const NAVY = '#061D3B';

  const makeDefault = (): SaleScheduleData => {
    const now = new Date();
    const sy = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
    const sm = now.getMonth() >= 11 ? 1 : now.getMonth() + 2;
    const cy = sm + 3 > 12 ? sy + 1 : sy;
    const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
    const sety = cm + 1 > 12 ? cy + 1 : cy;
    const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
    const me = sm + 1 > 12 ? 1 : sm + 1;
    const ye = sm + 1 > 12 ? sy + 1 : sy;
    return {
      propertyNo: initialSellerNumber,
      ownerName: initialOwnerName,
      propertyAddress: initialPropertyAddress,
      assessPrice: initialAssessPrice ? Math.round(initialAssessPrice / 10000) : undefined,
      listPrice: undefined, minimumPrice: undefined,
      startYear: sy, startMonth: sm,
      marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月`,
      contractYear: cy, contractMonth: cm,
      settlementYear: sety, settlementMonth: setm,
    };
  };

  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SaleScheduleData>(makeDefault);

  const handleSearch = useCallback(async () => {
    if (!searchNo.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await api.get(`/api/sellers/by-number/${searchNo.trim().toUpperCase()}`);
      let pl: Record<string, unknown> | null = null;
      try {
        const pr = await api.get(`/api/property-listings/${searchNo.trim().toUpperCase()}`);
        pl = pr.data?.property || pr.data || null;
      } catch { /* no property listing */ }
      const converted = convertDbToScheduleData(res.data, pl);
      setData(prev => ({ ...prev, ...converted }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '売主番号が見つかりませんでした');
    } finally { setLoading(false); }
  }, [searchNo]);

  const handleField = (field: keyof SaleScheduleData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const numFields = ['assessPrice','listPrice','minimumPrice','startYear','startMonth',
        'contractYear','contractMonth','settlementYear','settlementMonth'];
      setData(prev => ({
        ...prev,
        [field]: numFields.includes(field) ? (val === '' ? undefined : Number(val)) : val,
      }));
    };

  const updatePeriod = (sy: number, sm: number) => {
    const me = sm + 1 > 12 ? 1 : sm + 1;
    const ye = sm + 1 > 12 ? sy + 1 : sy;
    setData(prev => ({ ...prev, marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月` }));
  };

  // 別ウィンドウで印刷（モーダルの縮小・z-index問題を完全回避）
  const handlePrint = useCallback(() => {
    const html = buildA4Html(data);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('ポップアップをブロックしていません。許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      setTimeout(() => { win.print(); }, 300);
    };
  }, [data]);

  // プレビュー用iframe src
  const previewHtml = buildA4Html(data);
  const previewSrc = `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { maxHeight: '95vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 2 }}>
        {/* 検索 */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <TextField label="売主番号" size="small" value={searchNo}
            onChange={e => setSearchNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="例: AA12345" sx={{ width: 180 }} />
          <Button variant="contained" size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch} disabled={loading}>
            物件情報取得
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* 左：フォーム */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>物件情報</Typography>
            <Grid container spacing={1}>
              {[
                { label: '物件番号', field: 'propertyNo' as const },
                { label: '売主様氏名', field: 'ownerName' as const },
              ].map(({ label, field }) => (
                <Grid item xs={12} key={field}>
                  <TextField fullWidth size="small" label={label}
                    value={data[field] as string} onChange={handleField(field)} />
                </Grid>
              ))}
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="物件所在地"
                  value={data.propertyAddress} onChange={handleField('propertyAddress')}
                  multiline rows={2} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="査定価格（万円）" type="number"
                  value={data.assessPrice ?? ''} onChange={handleField('assessPrice')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="売出価格（万円）" type="number"
                  value={data.listPrice ?? ''} onChange={handleField('listPrice')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="最低売却価格（万円）" type="number"
                  value={data.minimumPrice ?? ''} onChange={handleField('minimumPrice')} />
              </Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2, mb: 1, color: NAVY }}>スケジュール</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="売出年" type="number" value={data.startYear ?? ''}
                  onChange={e => { const v = Number(e.target.value); setData(p => ({...p, startYear: v||undefined})); if(v && data.startMonth) updatePeriod(v, data.startMonth); }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="売出月" type="number" value={data.startMonth ?? ''}
                  inputProps={{ min:1, max:12 }}
                  onChange={e => { const v = Number(e.target.value); setData(p => ({...p, startMonth: v||undefined})); if(data.startYear && v) updatePeriod(data.startYear, v); }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="契約年" type="number" value={data.contractYear ?? ''}
                  onChange={e => setData(p => ({...p, contractYear: Number(e.target.value)||undefined}))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="契約月" type="number" value={data.contractMonth ?? ''}
                  inputProps={{ min:1, max:12 }}
                  onChange={e => setData(p => ({...p, contractMonth: Number(e.target.value)||undefined}))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="決済年" type="number" value={data.settlementYear ?? ''}
                  onChange={e => setData(p => ({...p, settlementYear: Number(e.target.value)||undefined}))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="決済月" type="number" value={data.settlementMonth ?? ''}
                  inputProps={{ min:1, max:12 }}
                  onChange={e => setData(p => ({...p, settlementMonth: Number(e.target.value)||undefined}))} />
              </Grid>
            </Grid>
          </Grid>

          {/* 右：iframeプレビュー */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>
              プレビュー（A4）
            </Typography>
            <Box sx={{ border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden', height: 620 }}>
              <iframe
                srcDoc={previewHtml}
                title="売却スケジュールプレビュー"
                style={{
                  width: '100%', height: '100%',
                  border: 'none', background: '#fff',
                  transform: 'scale(1)',
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit">閉じる</Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>印刷 / PDF保存</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
          sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#082447' } }}>
          印刷・PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaleScheduleModal;
