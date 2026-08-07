/**
 * 送付状モーダル
 * - souhu.png を背景に本文をオーバーレイ
 * - 売主番号がFIの場合は「くじら不動産」、それ以外は「株式会社いふう」
 * - チェックボックスで同封物を選択（チェックなし→本文に含めない）
 * - メモ欄はユーザー自由入力
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
  sellerNumber?: string;   // FI判定用
  employeeName?: string;   // ◎◎ = ログインユーザー名
  ownerName?: string;      // 売主名（宛先用）
}

const NAVY = '#061D3B';

export const SouhuModal: React.FC<Props> = ({
  open, onClose,
  sellerNumber = '',
  employeeName = '',
  ownerName = '',
}) => {
  const isFI = sellerNumber.trim().toUpperCase().startsWith('FI') || sellerNumber.trim() === '';
  const companyName = isFI ? 'くじら不動産' : '株式会社いふう';

  // チェックボックス（デフォルト全チェック）
  const [chkSatei, setChkSatei] = useState(true);
  const [chkPamphlet, setChkPamphlet] = useState(true);
  const [chkSchedule, setChkSchedule] = useState(true);
  const [chkTemodori, setChkTemodori] = useState(true);
  const [memo, setMemo] = useState('');

  // モーダルが開くたびに初期化
  useEffect(() => {
    if (open) {
      setChkSatei(true);
      setChkPamphlet(true);
      setChkSchedule(true);
      setChkTemodori(true);
      setMemo('');
    }
  }, [open]);

  // 画像Base64キャッシュ
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

  const buildHtml = (debug = false): string => {
    const items: string[] = [];
    if (chkSatei)     items.push('□　査定書（査定額、周辺事例、マーケット情報、防災関連）');
    if (chkPamphlet)  items.push('□　パンフレット（売却の流れ、注意点）');
    if (chkSchedule)  items.push('□　売却スケジュール（あくまで案ですので、ご参考程度にお願い致します）');
    if (chkTemodori)  items.push('□　手残り金額リスト');

    const itemsHtml = items.map(item =>
      `<div style="margin-bottom:2.5mm;font-size:11.5pt;">${item}</div>`
    ).join('');

    const memoHtml = memo.trim()
      ? `<div style="margin-top:3mm;font-size:11.5pt;">${memo.trim().replace(/\n/g, '<br/>')}</div>`
      : '';

    const imgSrc = imgData || `/sale-schedule/illustrations/souhu.png`;

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
    <!-- 本文エリア -->
    <div style="position:absolute;left:20mm;top:168mm;width:170mm;">
      <div style="font-size:11.5pt;line-height:2.0;">
        お世話になっております。${companyName}の${employeeName || '◎◎'}と申します。<br/>
        この度は査定のご依頼を頂きまして誠にありがとうございます。<br/>
        下記を同封させていただきます。
      </div>
      <div style="margin-top:4mm;">
        ${itemsHtml}
      </div>
      <div style="font-size:11.5pt;line-height:2.0;margin-top:2mm;">
        となっております。
      </div>
      ${memoHtml}
      <div style="font-size:11.5pt;line-height:2.0;margin-top:4mm;">
        こちらのエリアでは弊社に問合せの多い地域となっておりますので、<br/>
        ご売却の際は是非ご紹介させて頂ければと思います。<br/>
        ご不明点がございましたらいつでもご連絡頂ければと思います。<br/>
        宜しくお願い致します。
      </div>
    </div>
  </div>
</div>
</body></html>`;
  };

  const handlePrint = () => {
    const html = buildHtml(false);
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('ポップアップブロックを解除してください。'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 600);
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
          <Box sx={{ width: 320, flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: NAVY }}>
              会社名：{companyName}
            </Typography>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5, color: NAVY }}>
              同封物（チェックなしは本文から除外）
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
              <FormControlLabel control={<Checkbox size="small" checked={chkSatei} onChange={e => setChkSatei(e.target.checked)} />}
                label={<Typography variant="body2">査定書（査定額、周辺事例、マーケット情報、防災関連）</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkPamphlet} onChange={e => setChkPamphlet(e.target.checked)} />}
                label={<Typography variant="body2">パンフレット（売却の流れ、注意点）</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkSchedule} onChange={e => setChkSchedule(e.target.checked)} />}
                label={<Typography variant="body2">売却スケジュール</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={chkTemodori} onChange={e => setChkTemodori(e.target.checked)} />}
                label={<Typography variant="body2">手残り金額リスト</Typography>} />
            </Box>
            <TextField fullWidth size="small" label="メモ（任意）" multiline rows={4}
              value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="自由に入力してください" />
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
                srcDoc={buildHtml(false)}
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
