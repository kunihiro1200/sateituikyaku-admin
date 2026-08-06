/**
 * 売却スケジュール資料生成モーダル
 * 印刷: 別ウィンドウ方式（モーダルのscale/z-index問題を完全回避）
 * プレビュー: iframe srcDoc方式（リアルタイム更新）
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Box, Typography,
  CircularProgress, Alert, Divider, IconButton,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';

export interface SaleScheduleData {
  propertyNo: string;
  ownerName: string;
  propertyAddress: string;
  assessPrice?: number;
  listPrice?: number;
  minimumPrice?: number;
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
  initialAssessPrice?: number;
}

function calcDates(now = new Date()) {
  const sy = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  const sm = now.getMonth() >= 11 ? 1 : now.getMonth() + 2;
  const cy = sm + 3 > 12 ? sy + 1 : sy;
  const cm = sm + 3 > 12 ? (sm + 3) - 12 : sm + 3;
  const sety = cm + 1 > 12 ? cy + 1 : cy;
  const setm = cm + 1 > 12 ? (cm + 1) - 12 : cm + 1;
  const me = sm + 1 > 12 ? 1 : sm + 1;
  const ye = sm + 1 > 12 ? sy + 1 : sy;
  return { sy, sm, cy, cm, sety, setm, me, ye };
}

function convertDb(seller: Record<string, unknown>, pl: Record<string, unknown> | null): Partial<SaleScheduleData> {
  const { sy, sm, cy, cm, sety, setm, me, ye } = calcDates();
  const listRaw = (pl?.listing_price as number | null) || (pl?.sales_price as number | null) || null;
  const assessRaw = (seller?.valuation_amount_1 as number | null) || (seller?.valuation_amount_2 as number | null) || null;
  return {
    propertyNo: (seller?.seller_number as string) || '',
    ownerName: (seller?.name as string) || '',
    propertyAddress: (seller?.property_address as string) || '',
    assessPrice: assessRaw ? Math.round(assessRaw / 10000) : undefined,
    listPrice: listRaw ? Math.round(listRaw / 10000) : undefined,
    startYear: sy, startMonth: sm,
    marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月`,
    contractYear: cy, contractMonth: cm,
    settlementYear: sety, settlementMonth: setm,
  };
}

// ─── A4 HTML生成（完全インラインCSS・参考画像レイアウト準拠） ───
function buildA4Html(d: SaleScheduleData): string {
  const N = '#061D3B', G = '#C99A3D', L = '#F6F7F9';
  const f = (v?: number) => v != null ? v.toLocaleString() : '―';
  const ymStr = (y?: number, m?: number, suf = '') => y && m ? `${y}年${m}月${suf}` : '―';

  const chk = (t: string) => `<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
    <div style="width:11px;height:11px;border:1.5px solid ${G};border-radius:2px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
      <div style="width:6px;height:6px;background:${G};border-radius:1px;"></div></div>
    <span style="font-size:7.5pt;">${t}</span></div>`;

  const pt = (t: string, bg = '#fff') => `<div style="background:${bg};border:1px solid ${N};border-radius:3px;padding:3px 5px;margin-top:4px;">
    <div style="font-size:5.5pt;font-weight:900;color:${G};text-align:center;letter-spacing:0.1em;margin-bottom:2px;">POINT</div>
    <div style="font-size:6pt;line-height:1.55;">${t}</div></div>`;

  const stepBadge = (n: string) =>
    `<div style="width:28px;height:28px;border-radius:50%;background:${G};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14pt;box-shadow:0 2px 5px rgba(0,0,0,0.3);flex-shrink:0;z-index:2;">${n}</div>`;

  // 左カラム: STEP番号 + ラベル + 年月
  const stepLeft = (n: string, label: string, ym: string) => `
    <div style="width:22mm;flex-shrink:0;display:flex;flex-direction:column;align-items:center;position:relative;">
      <div style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:${N};transform:translateX(-50%);z-index:0;"></div>
      ${stepBadge(n)}
      <div style="background:${N};color:#fff;border-radius:3px;padding:1.5px 4px;font-size:5.5pt;font-weight:700;text-align:center;line-height:1.35;margin-top:2px;white-space:pre-wrap;z-index:1;">${label}</div>
      <div style="font-size:7.5pt;color:${N};font-weight:700;margin-top:3px;text-align:center;line-height:1.45;z-index:1;">${ym}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>売却スケジュール</title>
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:210mm;height:297mm;font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;font-size:9pt;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;height:297mm;display:flex;flex-direction:column;background:#fff;overflow:hidden;}
</style>
</head><body><div class="page">

<!-- HEADER -->
<div style="background:${N};padding:0 9mm;height:26mm;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
  <div>
    <div style="font-size:7pt;color:rgba(255,255,255,0.6);letter-spacing:0.12em;margin-bottom:1px;">不動産</div>
    <div style="font-size:23pt;font-weight:900;color:${G};letter-spacing:0.04em;line-height:1.05;">売却スケジュール</div>
    <div style="font-size:6.5pt;color:rgba(255,255,255,0.65);margin-top:3px;">全力で販売活動を行い、最善の条件でのご売却をサポートします</div>
  </div>
  <div style="text-align:right;">
    <img src="/kujira-fudosan-logo.png" alt="" style="height:8mm;max-width:26mm;object-fit:contain;display:block;margin-left:auto;" onerror="this.style.display='none'"/>
    <div style="font-size:7pt;font-weight:700;color:${G};letter-spacing:0.1em;margin-top:2px;">KUJIRA REAL ESTATE</div>
  </div>
</div>

<!-- MAIN -->
<div style="flex:1;display:flex;flex-direction:column;padding:3mm 0 0 9mm;overflow:hidden;">

  <!-- 物件情報 -->
  <div style="border:1.5px solid ${N};border-radius:4px;background:${L};overflow:hidden;margin-right:9mm;margin-bottom:2.5mm;flex-shrink:0;">
    <div style="display:flex;align-items:center;border-bottom:1px solid ${N}22;padding:2mm 3mm;">
      <div style="width:7mm;font-size:9pt;color:${G};text-align:center;">＃</div>
      <div style="width:18mm;font-size:7.5pt;font-weight:700;color:${N};">物件番号</div>
      <div style="flex:1;font-size:8pt;">${d.propertyNo||'―'}</div>
    </div>
    <div style="display:flex;align-items:center;border-bottom:1px solid ${N}22;padding:2mm 3mm;">
      <div style="width:7mm;font-size:9pt;color:${G};text-align:center;">👤</div>
      <div style="width:18mm;font-size:7.5pt;font-weight:700;color:${N};">売　主　様</div>
      <div style="flex:1;font-size:8pt;">${d.ownerName?d.ownerName+'　様':'―'}</div>
    </div>
    <div style="display:flex;align-items:flex-start;padding:2mm 3mm;">
      <div style="width:7mm;font-size:9pt;color:${G};text-align:center;padding-top:1px;">📍</div>
      <div style="width:18mm;font-size:7.5pt;font-weight:700;color:${N};padding-top:1px;">物件所在地</div>
      <div style="flex:1;font-size:7.5pt;word-break:break-all;line-height:1.45;">${d.propertyAddress||'―'}</div>
    </div>
  </div>

  <!-- STEP1 -->
  <div style="display:flex;margin-bottom:2mm;flex-shrink:0;">
    ${stepLeft('1','売り出し\n開始', ymStr(d.startYear,d.startMonth))}
    <div style="flex:1;background:${L};border:1px solid ${N}22;border-radius:0 4px 4px 0;padding:3mm;margin-right:9mm;">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2.5mm;padding-bottom:2mm;border-bottom:1px solid ${N}15;">
        <span style="font-size:8pt;font-weight:700;color:${N};">売出価格</span>
        <span style="font-size:20pt;font-weight:900;color:${G};line-height:1;">${f(d.listPrice)}</span>
        <span style="font-size:8pt;color:${N};">万円</span>
      </div>
      <div style="display:flex;gap:3mm;">
        <div style="flex:1;">
          ${chk('室内写真・掲載内容の見直し')}
          ${chk('不動産ポータルサイト掲載')}
          ${chk('周辺相場・競合物件の確認')}
          ${chk('販売活動開始')}
        </div>
        <div style="width:40mm;flex-shrink:0;">${pt('最適なタイミングで売り出すことで、多くの購入希望者へアプローチします。')}</div>
      </div>
    </div>
  </div>

  <!-- STEP2 -->
  <div style="display:flex;margin-bottom:2mm;flex-shrink:0;">
    ${stepLeft('2','販売活動\nを強化', d.marketingPeriod||'―')}
    <div style="flex:1;background:#fff;border:1px solid ${N}22;border-radius:0 4px 4px 0;padding:3mm;margin-right:9mm;">
      <div style="font-size:7.5pt;font-weight:700;color:${N};margin-bottom:2mm;padding-bottom:1.5mm;border-bottom:1px solid ${N}15;">売却チャンスを逃さないよう全力で販売活動を強化します！</div>
      <div style="display:flex;gap:2mm;margin-bottom:2mm;">
        ${[
          ['広告の見直し・拡大','掲載媒体や広告内容を見直し、より多くの購入希望者へ物件情報を届けます。'],
          ['反響状況の分析','問い合わせ・アクセス状況を分析し、販売方法を随時改善します。'],
          ['ご案内の強化','お問い合わせから内覧まで迅速・丁寧に対応し、購入意欲を高めます。'],
          ['価格戦略の検討','市場動向と反響状況を確認し、最適な販売価格をご提案します。'],
        ].map(([t,desc])=>`
          <div style="flex:1;background:${L};border-top:2px solid ${N};border-radius:2px;padding:2.5mm 2mm;text-align:center;">
            <div style="height:10mm;display:flex;align-items:center;justify-content:center;margin-bottom:2px;">
              <div style="width:18px;height:18px;border-radius:50%;background:${N}33;"></div>
            </div>
            <div style="font-size:6.5pt;font-weight:700;color:${N};margin-bottom:2px;">${t}</div>
            <div style="font-size:5.5pt;color:#555;line-height:1.5;">${desc}</div>
          </div>`).join('')}
      </div>
      <div style="background:${N};border-radius:3px;padding:2.5mm;text-align:center;">
        <span style="font-size:7pt;font-weight:700;color:${G};">積極的な取り組みで「早期・高値売却」を目指します！</span>
      </div>
    </div>
  </div>

  <!-- STEP3 -->
  <div style="display:flex;margin-bottom:1.5mm;flex-shrink:0;">
    ${stepLeft('3','売買契約\n(最低価格)', ymStr(d.contractYear,d.contractMonth))}
    <div style="flex:1;background:${L};border:1px solid ${N}22;border-radius:0 4px 4px 0;padding:3mm;margin-right:9mm;">
      <div style="display:flex;gap:3mm;">
        <div style="flex:1;">
          <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:2.5mm;">
            <span style="font-size:7pt;font-weight:700;color:${N};white-space:nowrap;">最低価格</span>
            <span style="font-size:17pt;font-weight:900;color:${G};line-height:1;">${f(d.minimumPrice)}</span>
            <span style="font-size:7pt;color:${N};">万円で売買契約を目標</span>
          </div>
          ${chk('最善条件でのご成約を目指します')}
          ${chk('条件調整・契約手続き')}
          ${chk('売買契約書作成・重要事項説明')}
        </div>
        <div style="width:42mm;flex-shrink:0;">${pt('条件が整い次第、スムーズに契約手続きを進めます。')}</div>
      </div>
    </div>
  </div>

  <!-- STEP4（STEP3直下・縦続き） -->
  <div style="display:flex;margin-bottom:2.5mm;flex-shrink:0;">
    ${stepLeft('4','決済・\nお引渡し', ymStr(d.settlementYear,d.settlementMonth,'中旬'))}
    <div style="flex:1;background:#fff;border:1px solid ${N}22;border-radius:0 4px 4px 0;padding:3mm;margin-right:9mm;">
      <div style="display:flex;gap:3mm;">
        <div style="flex:1;">
          <div style="font-size:8pt;font-weight:700;color:${N};margin-bottom:2.5mm;">決済・お引渡し</div>
          ${chk('各種手続き・日程調整')}
          ${chk('引き渡し準備')}
          ${chk('鍵のお引き渡し')}
          ${chk('残代金受領')}
        </div>
        <div style="width:42mm;flex-shrink:0;">${pt('決済・お引渡しまでしっかりとサポートいたします。',L)}</div>
      </div>
    </div>
  </div>

  <!-- サポート体制 -->
  <div style="margin-right:9mm;flex-shrink:0;margin-bottom:2.5mm;">
    <div style="background:${N};color:#fff;padding:2.5mm 4mm;border-radius:4px 4px 0 0;font-size:8pt;font-weight:700;text-align:center;letter-spacing:0.05em;">くじら不動産のサポート体制</div>
    <div style="display:flex;background:${L};border:1.5px solid ${N};border-top:none;border-radius:0 0 4px 4px;padding:3mm 2mm;">
      ${[
        ['📈','市場分析・戦略立案','最新の市場データを基に、最適な販売戦略をご提案します。'],
        ['📢','販売力・集客力','多様な広告媒体とネットワークで、より多くの購入希望者にアプローチします。'],
        ['🤝','安心のサポート','売主様に寄り添い、安心・安全な売却を実現します。'],
        ['📋','手続きサポート','売買契約から決済まで、各種手続きを丁寧にサポートします。'],
      ].map(([icon,title,desc])=>`
        <div style="flex:1;text-align:center;padding:1.5mm 2mm;">
          <div style="height:10mm;display:flex;align-items:center;justify-content:center;margin-bottom:2px;">
            <div style="font-size:16pt;">${icon}</div>
          </div>
          <div style="font-size:7pt;font-weight:700;color:${N};margin-bottom:2px;">${title}</div>
          <div style="font-size:5.5pt;color:#555;line-height:1.5;">${desc}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- メッセージ -->
  <div style="border-top:2px solid ${G};padding:3mm 0 2mm;margin-right:9mm;flex-shrink:0;">
    <p style="font-size:8pt;font-weight:700;color:${N};line-height:1.6;margin-bottom:2px;">市場動向を見極め、計画的に進めることで最善の売却を実現します。</p>
    <p style="font-size:7pt;color:#555;line-height:1.6;">定期的にご報告し、最善の売却を目指しますのでご安心ください。</p>
  </div>

</div><!-- /MAIN -->

<!-- FOOTER -->
<div style="background:${N};height:17mm;padding:0 9mm;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
  <div style="display:flex;align-items:center;gap:3mm;">
    <img src="/kujira-fudosan-logo.png" alt="" style="height:7mm;max-width:10mm;object-fit:contain;" onerror="this.style.display='none'"/>
    <div>
      <div style="font-size:9pt;font-weight:800;color:${G};">くじら不動産</div>
      <div style="font-size:5.5pt;color:rgba(255,255,255,0.6);">誠実なサポートで、安心の売却を。</div>
    </div>
  </div>
  <div style="width:1px;height:10mm;background:${G};opacity:0.5;"></div>
  <div style="text-align:center;">
    <div style="font-size:11pt;font-weight:900;color:${G};">092-401-5331</div>
    <div style="font-size:5.5pt;color:rgba(255,255,255,0.65);">営業時間 10:00〜18:00</div>
  </div>
  <div style="width:1px;height:10mm;background:${G};opacity:0.5;"></div>
  <div style="text-align:right;">
    <div style="font-size:6.5pt;color:rgba(255,255,255,0.85);">福岡市中央区舞鶴3-1-10</div>
    <div style="font-size:5.5pt;color:rgba(255,255,255,0.55);margin-top:2px;">tenant@ifoo-oita.com</div>
  </div>
</div>

</div></body></html>`;
}

// ─── メインコンポーネント ───
export const SaleScheduleModal: React.FC<Props> = ({
  open, onClose,
  initialSellerNumber='', initialOwnerName='', initialPropertyAddress='', initialAssessPrice,
}) => {
  const NAVY = '#061D3B';
  const { sy, sm, cy, cm, sety, setm, me, ye } = calcDates();

  const [searchNo, setSearchNo] = useState(initialSellerNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [data, setData] = useState<SaleScheduleData>({
    propertyNo: initialSellerNumber, ownerName: initialOwnerName,
    propertyAddress: initialPropertyAddress,
    assessPrice: initialAssessPrice ? Math.round(initialAssessPrice/10000) : undefined,
    listPrice: undefined, minimumPrice: undefined,
    startYear: sy, startMonth: sm,
    marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月`,
    contractYear: cy, contractMonth: cm,
    settlementYear: sety, settlementMonth: setm,
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

  const setField = (field: keyof SaleScheduleData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const nums = ['assessPrice','listPrice','minimumPrice','startYear','startMonth','contractYear','contractMonth','settlementYear','settlementMonth'];
    setData(p => ({ ...p, [field]: nums.includes(field) ? (v===''?undefined:Number(v)) : v }));
  };
  const updPeriod = (sy: number, sm: number) => {
    const me = sm+1>12?1:sm+1; const ye = sm+1>12?sy+1:sy;
    setData(p => ({ ...p, marketingPeriod: `${sy}年${sm}月〜${ye}年${me}月` }));
  };

  const handlePrint = useCallback(() => {
    const html = buildA4Html(data);
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html);
    win.document.close();
    // onloadが発火しない場合があるためsetTimeoutで確実に実行
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
  }, [data]);

  const previewHtml = buildA4Html(data);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { maxHeight: '95vh' } }}>
      <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', pb:1 }}>
        <Typography variant="h6" fontWeight="bold">売却スケジュール資料生成</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p:2 }}>
        <Box sx={{ display:'flex', gap:1, mb:2, alignItems:'center' }}>
          <TextField label="売主番号" size="small" value={searchNo}
            onChange={e => setSearchNo(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleSearch()}
            placeholder="例: AA12345" sx={{ width:180 }} />
          <Button variant="contained" size="small"
            startIcon={loading ? <CircularProgress size={16} color="inherit"/> : <SearchIcon/>}
            onClick={handleSearch} disabled={loading}>物件情報取得</Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          {/* 左：フォーム */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb:1, color:NAVY }}>物件情報</Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}><TextField fullWidth size="small" label="物件番号" value={data.propertyNo} onChange={setField('propertyNo')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="売主様氏名" value={data.ownerName} onChange={setField('ownerName')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="物件所在地" value={data.propertyAddress} onChange={setField('propertyAddress')} multiline rows={2}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="査定価格（万円）" type="number" value={data.assessPrice??''} onChange={setField('assessPrice')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="売出価格（万円）" type="number" value={data.listPrice??''} onChange={setField('listPrice')}/></Grid>
              <Grid item xs={12}><TextField fullWidth size="small" label="最低売却価格（万円）" type="number" value={data.minimumPrice??''} onChange={setField('minimumPrice')}/></Grid>
            </Grid>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt:2, mb:1, color:NAVY }}>スケジュール</Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}><TextField fullWidth size="small" label="売出年" type="number" value={data.startYear??''}
                onChange={e=>{const v=Number(e.target.value);setData(p=>({...p,startYear:v||undefined}));if(v&&data.startMonth)updPeriod(v,data.startMonth);}}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="売出月" type="number" value={data.startMonth??''} inputProps={{min:1,max:12}}
                onChange={e=>{const v=Number(e.target.value);setData(p=>({...p,startMonth:v||undefined}));if(data.startYear&&v)updPeriod(data.startYear,v);}}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="契約年" type="number" value={data.contractYear??''} onChange={e=>setData(p=>({...p,contractYear:Number(e.target.value)||undefined}))}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="契約月" type="number" value={data.contractMonth??''} inputProps={{min:1,max:12}} onChange={e=>setData(p=>({...p,contractMonth:Number(e.target.value)||undefined}))}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="決済年" type="number" value={data.settlementYear??''} onChange={e=>setData(p=>({...p,settlementYear:Number(e.target.value)||undefined}))}/></Grid>
              <Grid item xs={6}><TextField fullWidth size="small" label="決済月" type="number" value={data.settlementMonth??''} inputProps={{min:1,max:12}} onChange={e=>setData(p=>({...p,settlementMonth:Number(e.target.value)||undefined}))}/></Grid>
            </Grid>
          </Grid>
          {/* 右：iframeプレビュー */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb:1, color:NAVY }}>プレビュー（A4）</Typography>
            <Box sx={{ border:'1px solid #ccc', borderRadius:1, overflow:'hidden', height:620 }}>
              <iframe srcDoc={previewHtml} title="売却スケジュールプレビュー"
                style={{ width:'100%', height:'100%', border:'none' }} />
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
