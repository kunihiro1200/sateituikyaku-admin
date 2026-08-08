/**
 * 送付状モーダル
 * - souhu.png を背景に本文をオーバーレイ
 * - 売主番号がFIの場合は「株式会社くじら不動産」、それ以外は「株式会社いふう」
 * - チェックボックスで同封物を選択（チェックなし→本文に含めない）
 * - カスタム同封物3つ（空欄入力・チェックで追加）
 * - メモ欄はユーザー自由入力
 * - 署名は上から65mm・左から120mmに固定（担当名は変更可能）
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Divider, IconButton,
  TextField, FormControlLabel, Checkbox,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';

interface Props {
  open: boolean;
  onClose: () => void;
  sellerNumber?: string;
  employeeName?: string;
  ownerName?: string;
}

const NAVY = '#061D3B';

const COMPANY_FI = {
  name: '株式会社くじら不動産',
  zip: '〒810-0073',
  address: '福岡市中央区舞鶴３－１－１０',
  building: '',
  tel: '092-401-5331',
  mail: 'tenant@ifoo-oita.com',
};
const COMPANY_OITA = {
  name: '株式会社いふう',
  zip: '〒870-0044',
  address: '大分市舞鶴町1-3-30',
  building: 'STビル１F',
  tel: '097-533-2022',
  mail: 'tenant@ifoo-oita.com',
};

export const SouhuModal: React.FC<Props> = ({
  open, onClose,
  sellerNumber = '',
  employeeName = '',
  ownerName = '',
}) => {
  const isFI = sellerNumber.trim().toUpperCase().startsWith('FI') || sellerNumber.trim() === '';
  const company = isFI ? COMPANY_FI : COMPANY_OITA;
  const companyShort = isFI ? 'くじら不動産' : '株式会社いふう';

  const [chkSatei, setChkSatei] = useState(true);
  const [chkPamphlet, setChkPamphlet] = useState(true);
  const [chkSchedule, setChkSchedule] = useState(true);
  const [chkTemodori, setChkTemodori] = useState(true);
  // カスタム同封物3つ（テキスト＋チェック）
  const [custom1, setCustom1] = useState('');
  const [chkCustom1, setChkCustom1] = useState(false);
  const [custom2, setCustom2] = useState('');
  const [chkCustom2, setChkCustom2] = useState(false);
  const [custom3, setCustom3] = useState('');
  const [chkCustom3, setChkCustom3] = useState(false);
  const [memo, setMemo] = useState('');
  const [signature, setSignature] = useState(employeeName);
  const [chkUndecided, setChkUndecided] = useState(false);

  useEffect(() => {
    if (open) {
      setChkSatei(true);
      setChkPamphlet(true);
      setChkSchedule(true);
      setChkTemodori(true);
      setCustom1(''); setChkCustom1(false);
      setCustom2(''); setChkCustom2(false);
      setCustom3(''); setChkCustom3(false);
      setMemo('');
      setSignature(employeeName);
      setChkUndecided(false);
    }
  }, [open, employeeName]);

  const [imgData, setImgData] = useState<string>('');
  useEffect(() => {
    fetch('/sale-schedule/illustrations/souhu.png')
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => setImgData(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');

  // モーダルが開いたとき、DBに保存済みデータがあれば読み込む
  useEffect(() => {
    if (!open || !sellerNumber) return;
    (async () => {
      try {
        const { default: api } = await import('../services/api');
        const res = await api.get(`/api/document-drafts/${sellerNumber}/souhu`);
        if (res.data?.data) {
          const d = res.data.data;
          if (d.chkSatei   !== undefined) setChkSatei(d.chkSatei);
          if (d.chkPamphlet !== undefined) setChkPamphlet(d.chkPamphlet);
          if (d.chkSchedule !== undefined) setChkSchedule(d.chkSchedule);
          if (d.chkTemodori !== undefined) setChkTemodori(d.chkTemodori);
          if (d.custom1    !== undefined) setCustom1(d.custom1);
          if (d.chkCustom1 !== undefined) setChkCustom1(d.chkCustom1);
          if (d.custom2    !== undefined) setCustom2(d.custom2);
          if (d.chkCustom2 !== undefined) setChkCustom2(d.chkCustom2);
          if (d.custom3    !== undefined) setCustom3(d.custom3);
          if (d.chkCustom3 !== undefined) setChkCustom3(d.chkCustom3);
          if (d.memo           !== undefined) setMemo(d.memo);
          if (d.signature      !== undefined) setSignature(d.signature);
          if (d.chkUndecided   !== undefined) setChkUndecided(d.chkUndecided);
        }
      } catch {
        // 保存データなし → 初期値のまま
      }
    })();
  }, [open, sellerNumber]);

  const handleSave = async () => {
    if (!sellerNumber) return;
    setSaveStatus('saving');
    try {
      const { default: api } = await import('../services/api');
      await api.post(`/api/document-drafts/${sellerNumber}/souhu`, {
        data: { chkSatei, chkPamphlet, chkSchedule, chkTemodori, custom1, chkCustom1, custom2, chkCustom2, custom3, chkCustom3, memo, signature, chkUndecided },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const buildHtml = (): string => {
    const items: string[] = [];
    if (chkSatei)                        items.push('□　査定書（査定額、周辺事例、マーケット情報、防災関連）');
    if (chkPamphlet)                     items.push('□　パンフレット（売却の流れ、注意点）');
    if (chkSchedule)                     items.push('□　売却スケジュール（あくまで案ですので、ご参考程度にお願い致します）');
    if (chkTemodori)                     items.push('□　手残り金額リスト');
    if (chkCustom1 && custom1.trim())    items.push(`□　${custom1.trim()}`);
    if (chkCustom2 && custom2.trim())    items.push(`□　${custom2.trim()}`);
    if (chkCustom3 && custom3.trim())    items.push(`□　${custom3.trim()}`);

    const itemsHtml = items.map(item =>
      `<div style="margin-bottom:2.5mm;font-size:11.5pt;">${item}</div>`
    ).join('');

    const memoHtml = memo.trim()
      ? `<div style="margin-top:3mm;font-size:11.5pt;">${memo.trim().replace(/\n/g, '<br/>')}</div>`
      : '';

    const imgSrc = imgData || `/sale-schedule/illustrations/souhu.png`;
    const sigName = signature || employeeName || '◎◎';

    return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>送付状</title>
<style>
  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:210mm;height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;
    font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro','Meiryo',sans-serif;}
  .a4{position:relative;width:210mm;height:297mm;overflow:hidden;}
  .bg{position:absolute;left:0;top:0;width:210mm;height:297mm;object-fit:fill;z-index:0;}
  .layer{position:absolute;left:0;top:0;width:210mm;height:297mm;z-index:10;}
</style>
</head><body>
<div class="a4">
  <img class="bg" src="${imgSrc}" alt="" />
  <div class="layer">

    <!-- 日付：上55mm・右15mm -->
    <div style="position:absolute;right:15mm;top:55mm;font-size:12pt;">
      ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>

    <!-- 売主名：上73mm・左20mm -->
    <div style="position:absolute;left:20mm;top:73mm;font-size:20pt;font-weight:600;font-family:'Hiragino Mincho ProN','Yu Mincho','YuMincho','MS Mincho','serif';">
      ${ownerName.trim().replace(/[\s　]*様\s*$/, '')}
    </div>

    <!-- 署名エリア：上65mm・左120mm -->
    <div style="position:absolute;left:120mm;top:65mm;width:90mm;font-size:12pt;line-height:1.8;">
      <div style="font-weight:700;font-size:13pt;margin-bottom:1mm;">${company.name}</div>
      <div>${company.zip}</div>
      <div>${company.address}</div>
      ${company.building ? `<div>${company.building}</div>` : ''}
      <div>担当：${sigName}</div>
      <div>TEL:${company.tel}</div>
      <div>MAIL:${company.mail}</div>
    </div>

    <!-- 本文エリア -->
    <div style="position:absolute;left:20mm;top:166mm;width:170mm;">
      <div style="font-size:11.5pt;line-height:2.0;">お世話になっております。${companyShort}の${sigName}と申します。<br/>この度は査定のご依頼を頂きまして誠にありがとうございます。<br/>下記を同封させていただきます。</div>
      <div style="margin-top:4mm;">${itemsHtml}</div>
      <div style="font-size:11.5pt;line-height:2.0;margin-top:2mm;">となっております。</div>
      ${memoHtml}
      ${chkUndecided ? `<div style="font-size:11.5pt;line-height:1.5;margin-top:2mm;">まだ売却されるかどうかは迷われているとのことで承知しております。判断材料の一つとして頂ければと思います。</div>` : ''}
      <div style="font-size:11.5pt;line-height:2.0;margin-top:${chkUndecided ? '1mm' : '4mm'};">こちらのエリアは弊社に問合せの多い地域となっておりますので、<br/>ご売却の際は是非ご紹介させて頂ければと思います。<br/>ご不明点がございましたらいつでもご連絡頂ければと思います。<br/>宜しくお願い致します。</div>
    </div>

  </div>
</div>
</body></html>`;
  };

  const handlePrint = () => {
    const html = buildHtml();
    // 非表示iframeで印刷（margin:0が確実に適用される）
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:210mm;height:297mm;border:none;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
    }, 800);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { maxHeight: '96vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight="bold">送付状 資料生成</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* 左：設定フォーム */}
          <Box sx={{ width: 340, flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5, color: NAVY }}>
              会社名：{company.name}
            </Typography>
            <TextField fullWidth size="small" label="担当名（変更可能）" sx={{ mb: 2 }}
              value={signature} onChange={e => setSignature(e.target.value)} />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>
              同封物（チェックなしは本文から除外）
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
              <FormControlLabel control={<Checkbox size="small" checked={chkSatei} onChange={e => setChkSatei(e.target.checked)} />}
                label={<Typography variant="body2">査定書（査定額、周辺事例、マーケット情報、防災関連）</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkPamphlet} onChange={e => setChkPamphlet(e.target.checked)} />}
                label={<Typography variant="body2">パンフレット（売却の流れ、注意点）</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkSchedule} onChange={e => setChkSchedule(e.target.checked)} />}
                label={<Typography variant="body2">売却スケジュール</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkTemodori} onChange={e => setChkTemodori(e.target.checked)} />}
                label={<Typography variant="body2">手残り金額リスト</Typography>} />
              {/* カスタム1 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox size="small" checked={chkCustom1} onChange={e => setChkCustom1(e.target.checked)} />
                <TextField size="small" placeholder="追加同封物を入力" value={custom1}
                  onChange={e => { setCustom1(e.target.value); if (e.target.value) setChkCustom1(true); }}
                  sx={{ flex: 1 }} />
              </Box>
              {/* カスタム2 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox size="small" checked={chkCustom2} onChange={e => setChkCustom2(e.target.checked)} />
                <TextField size="small" placeholder="追加同封物を入力" value={custom2}
                  onChange={e => { setCustom2(e.target.value); if (e.target.value) setChkCustom2(true); }}
                  sx={{ flex: 1 }} />
              </Box>
              {/* カスタム3 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Checkbox size="small" checked={chkCustom3} onChange={e => setChkCustom3(e.target.checked)} />
                <TextField size="small" placeholder="追加同封物を入力" value={custom3}
                  onChange={e => { setCustom3(e.target.value); if (e.target.value) setChkCustom3(true); }}
                  sx={{ flex: 1 }} />
              </Box>
            </Box>
            <TextField fullWidth size="small" label="メモ（任意）" multiline rows={3}
              value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="自由に入力してください" />
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5, color: NAVY }}>
                本文オプション
              </Typography>
              <FormControlLabel
                control={<Checkbox size="small" checked={chkUndecided} onChange={e => setChkUndecided(e.target.checked)} />}
                label={<Typography variant="body2">「まだ売却されるかどうかは迷われているとのことで承知しております。判断材料の一つとして頂ければと思います。」を挿入</Typography>}
              />
            </Box>
          </Box>

          {/* 右：プレビュー */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: NAVY, mb: 1 }}>
              プレビュー（A4）
            </Typography>
            <Box sx={{
              width: 550, height: 660,
              overflow: 'hidden', border: '2px solid #ccc',
              borderRadius: 1, background: '#666',
              position: 'relative',
            }}>
              <iframe
                srcDoc={buildHtml()}
                title="送付状プレビュー"
                style={{
                  position: 'absolute', left: 0, top: 0,
                  width: `${210 * 3.7795}px`,
                  height: `${297 * 3.7795}px`,
                  border: 'none',
                  transformOrigin: 'top left',
                  transform: `scale(${Math.min(550 / (210 * 3.7795), 660 / (297 * 3.7795))})`,
                  background: '#fff',
                }}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit">閉じる</Button>
        <Button variant="outlined" onClick={handleSave} disabled={saveStatus === 'saving'}
          color={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : 'primary'}>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 保存済み' : saveStatus === 'error' ? '保存失敗' : '保存'}
        </Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>印刷</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}
          sx={{ bgcolor: NAVY, '&:hover': { bgcolor: '#082447' } }}>
          PDF保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SouhuModal;
