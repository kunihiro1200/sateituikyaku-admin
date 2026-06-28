import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import PrintIcon from '@mui/icons-material/Print';
import HouseMakerModal from './HouseMakerModal';
import NearbyMapModal from './NearbyMapModal';
import { EvaluationPointsDisplay } from './EvaluationPointsEditor';

export interface ViewingPreparationPopupProps {
  open: boolean;
  onClose: () => void;
  buyerNumber: string | null | undefined;
  propertyNumber: string | null | undefined;
  houseMaker?: string | null | undefined;
  googleMapUrl?: string | null | undefined;
  address?: string | null | undefined;
  buyer?: Record<string, any> | null;
  linkedProperties?: Array<Record<string, any>>;
}

// 固定リンク定数（ATBBのみ）
const FIXED_LINKS = [
  {
    label: 'ATBB',
    url: 'https://atbb.athome.jp/',
    description: '①詳細ページと②地図③インフォシートを印刷',
  },
] as const;

interface CopyButtonProps {
  text: string;
  label: string;
}

/** ワンクリックコピーボタン */
const CopyButton: React.FC<CopyButtonProps> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard が使用不可の場合のフォールバック
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Tooltip title={copied ? 'コピーしました！' : 'コピー'} placement="top">
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        onClick={handleCopy}
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 'bold',
            color: copied ? 'success.main' : 'text.primary',
          }}
        >
          {label}：{text}
        </Typography>
        {copied ? (
          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 16, color: 'action.active' }} />
        )}
      </Box>
    </Tooltip>
  );
};

/**
 * 内覧準備ポップアップコンポーネント
 * 内覧前に必要な買主番号・物件番号のコピー機能と固定リンク2件を提供する
 */
export const ViewingPreparationPopup: React.FC<ViewingPreparationPopupProps> = ({
  open,
  onClose,
  buyerNumber,
  propertyNumber,
  houseMaker,
  googleMapUrl,
  address,
  buyer,
  linkedProperties,
}) => {
  const hasBuyerNumber = buyerNumber != null && buyerNumber !== '';
  // 物件番号があるかどうか：propertyNumber プロップ、かつ linkedProperties に有効な物件番号を持つものがある
  const hasPropertyNumber = (propertyNumber != null && propertyNumber !== '')
    && (linkedProperties != null && linkedProperties.length > 0
        && linkedProperties.some((lp) => lp.property_number != null && lp.property_number !== ''));
  const [houseMakerModalOpen, setHouseMakerModalOpen] = useState(false);
  const [nearbyMapModalOpen, setNearbyMapModalOpen] = useState(false);
  const [printing1, setPrinting1] = useState(false);
  const [printing2, setPrinting2] = useState(false);
  const [printingCash, setPrintingCash] = useState(false);
  const [printingRepeater, setPrintingRepeater] = useState(false);
  const [printingCashRepeater, setPrintingCashRepeater] = useState(false);

  function getTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  // 内覧準備資料１（白黒）印刷
  const handlePrint1 = () => {
    if (!buyer || !linkedProperties || linkedProperties.length === 0) return;
    setPrinting1(true);
    import('../services/api').then(({ default: api }) => {
      Promise.all(
        linkedProperties.map((lp: Record<string, any>) =>
          api.get(`/api/property-listings/${lp.property_number}`).then((r: any) => r.data)
        )
      ).then((propertyDetails) => {
        import('../utils/printHtmlGenerators').then(({ generateAllPagesHtml }) => {
          const html = generateAllPagesHtml(buyer, propertyDetails, getTodayStr());
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) { setPrinting1(false); document.body.removeChild(iframe); return; }
          doc.open(); doc.write(html); doc.close();
          const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrinting1(false); }, 1000); };
          const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
          if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 800); }
          else { iframe.onload = () => setTimeout(doPrint, 800); setTimeout(doPrint, 2000); }
        });
      }).catch(() => { setPrinting1(false); });
    }).catch(() => { setPrinting1(false); });
  };

  // 内覧準備資料（自己資金）印刷
  const handlePrintCash = () => {
    if (!buyer || !linkedProperties || linkedProperties.length === 0) return;
    setPrintingCash(true);
    import('../services/api').then(({ default: api }) => {
      Promise.all(
        linkedProperties.map((lp: Record<string, any>) =>
          api.get(`/api/property-listings/${lp.property_number}`).then((r: any) => r.data)
        )
      ).then((propertyDetails) => {
        import('../utils/printHtmlGenerators').then(({ generateAllPagesCashHtml }) => {
          const html = generateAllPagesCashHtml(buyer, propertyDetails, getTodayStr());
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) { setPrintingCash(false); document.body.removeChild(iframe); return; }
          doc.open(); doc.write(html); doc.close();
          const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrintingCash(false); }, 1000); };
          const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
          if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 800); }
          else { iframe.onload = () => setTimeout(doPrint, 800); setTimeout(doPrint, 2000); }
        });
      }).catch(() => { setPrintingCash(false); });
    }).catch(() => { setPrintingCash(false); });
  };

  // 内覧準備資料（リピーター）印刷
  const handlePrintRepeater = () => {
    if (!buyer || !linkedProperties || linkedProperties.length === 0) return;
    setPrintingRepeater(true);
    import('../services/api').then(({ default: api }) => {
      Promise.all(
        linkedProperties.map((lp: Record<string, any>) =>
          api.get(`/api/property-listings/${lp.property_number}`).then((r: any) => r.data)
        )
      ).then((propertyDetails) => {
        import('../utils/printHtmlGenerators').then(({ generateAllPagesRepeaterHtml }) => {
          const html = generateAllPagesRepeaterHtml(buyer, propertyDetails, getTodayStr());
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) { setPrintingRepeater(false); document.body.removeChild(iframe); return; }
          doc.open(); doc.write(html); doc.close();
          const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrintingRepeater(false); }, 1000); };
          const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
          if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 800); }
          else { iframe.onload = () => setTimeout(doPrint, 800); setTimeout(doPrint, 2000); }
        });
      }).catch(() => { setPrintingRepeater(false); });
    }).catch(() => { setPrintingRepeater(false); });
  };

  // 内覧準備資料（自己資金・リピーター）印刷
  const handlePrintCashRepeater = () => {
    if (!buyer || !linkedProperties || linkedProperties.length === 0) return;
    setPrintingCashRepeater(true);
    import('../services/api').then(({ default: api }) => {
      Promise.all(
        linkedProperties.map((lp: Record<string, any>) =>
          api.get(`/api/property-listings/${lp.property_number}`).then((r: any) => r.data)
        )
      ).then((propertyDetails) => {
        import('../utils/printHtmlGenerators').then(({ generateAllPagesCashRepeaterHtml }) => {
          const html = generateAllPagesCashRepeaterHtml(buyer, propertyDetails, getTodayStr());
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
          document.body.appendChild(iframe);
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) { setPrintingCashRepeater(false); document.body.removeChild(iframe); return; }
          doc.open(); doc.write(html); doc.close();
          const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrintingCashRepeater(false); }, 1000); };
          const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
          if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 800); }
          else { iframe.onload = () => setTimeout(doPrint, 800); setTimeout(doPrint, 2000); }
        });
      }).catch(() => { setPrintingCashRepeater(false); });
    }).catch(() => { setPrintingCashRepeater(false); });
  };

  // 内覧準備資料２（カラー）印刷
  const handlePrint2 = () => {
    if (!buyer) return;
    setPrinting2(true);
    const propertyNumber = (linkedProperties && linkedProperties.length > 0)
      ? (linkedProperties[0].property_number || '')
      : '';
    import('../utils/printHtmlGenerators').then(({ generateViewingPrep2Html }) => {
      const html = generateViewingPrep2Html(buyer, getTodayStr(), propertyNumber);
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { setPrinting2(false); document.body.removeChild(iframe); return; }
      doc.open(); doc.write(html); doc.close();
      const cleanup = () => { setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} setPrinting2(false); }, 1000); };
      const doPrint = () => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch (_) {} cleanup(); };
      if (iframe.contentDocument?.readyState === 'complete') { setTimeout(doPrint, 1200); }
      else { iframe.onload = () => setTimeout(doPrint, 1200); setTimeout(doPrint, 5000); }
      setTimeout(() => { setPrinting2(false); }, 8000);
    }).catch(() => { setPrinting2(false); });
  };

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>内覧準備資料</DialogTitle>
      <DialogContent>
        {/* 注意書き（赤色・太字） */}
        <Typography
          sx={{
            color: 'error.main',
            fontWeight: 'bold',
            mb: 2,
          }}
        >
          ※準備前にカレンダーに●をつけてください
        </Typography>

        {/* 買主番号・物件番号コピーエリア */}
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 買主番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasBuyerNumber ? (
              <CopyButton text={buyerNumber as string} label="買主番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                買主番号：（未設定）
              </Typography>
            )}
          </Box>

          {/* 物件番号 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasPropertyNumber ? (
              <CopyButton text={propertyNumber as string} label="物件番号" />
            ) : (
              <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                物件番号：（未設定）
              </Typography>
            )}
          </Box>
        </Box>

        {/* リンク一覧（番号付きリスト） */}
        <List component="ol" sx={{ listStyleType: 'decimal', pl: 2 }}>
          {/* 内覧準備資料（白黒） */}
          <ListItem component="li" sx={{ display: 'list-item', py: 0.5 }}>
            <ListItemText
              primary={
                hasPropertyNumber && linkedProperties && linkedProperties.length > 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography component="span">内覧準備資料（白黒）：</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printing1 ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrint1}
                      disabled={printing1 || !buyer || !linkedProperties || linkedProperties.length === 0}
                      sx={{
                        borderColor: '#4caf50',
                        color: '#2e7d32',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#2e7d32', bgcolor: '#f1f8e9' },
                      }}
                    >
                      {printing1 ? '印刷中...' : '印刷'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingCash ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintCash}
                      disabled={printingCash || !buyer || !linkedProperties || linkedProperties.length === 0}
                      sx={{
                        borderColor: '#1976d2',
                        color: '#1565c0',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#1565c0', bgcolor: '#e3f2fd' },
                      }}
                    >
                      {printingCash ? '印刷中...' : '自己資金'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingRepeater ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintRepeater}
                      disabled={printingRepeater || !buyer || !linkedProperties || linkedProperties.length === 0}
                      sx={{
                        borderColor: '#ff9800',
                        color: '#e65100',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#e65100', bgcolor: '#fff3e0' },
                      }}
                    >
                      {printingRepeater ? '印刷中...' : 'リピーター'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printingCashRepeater ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrintCashRepeater}
                      disabled={printingCashRepeater || !buyer || !linkedProperties || linkedProperties.length === 0}
                      sx={{
                        borderColor: '#9c27b0',
                        color: '#6a1b9a',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#6a1b9a', bgcolor: '#f3e5f5' },
                      }}
                    >
                      {printingCashRepeater ? '印刷中...' : '自己資金(リピーター)'}
                    </Button>
                  </Box>
                ) : (
                  <Typography component="span">
                    内覧準備資料　<a href="https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=1575477339#gid=1575477339" target="_blank" rel="noopener noreferrer">こちらから</a>
                  </Typography>
                )
              }
            />
          </ListItem>
          {/* 内覧準備資料（カラー） */}
          {(hasPropertyNumber && linkedProperties && linkedProperties.length > 0) && (
            <ListItem component="li" sx={{ display: 'list-item', py: 0.5 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span">内覧準備資料（カラー）：</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={printing2 ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
                      onClick={handlePrint2}
                      disabled={printing2 || !buyer}
                      sx={{
                        borderColor: '#f5c518',
                        color: '#b8860b',
                        fontSize: '0.75rem',
                        '&:hover': { borderColor: '#b8860b', bgcolor: '#fffde7' },
                      }}
                    >
                      {printing2 ? '印刷中...' : '印刷'}
                    </Button>
                  </Box>
                }
              />
            </ListItem>
          )}
          {FIXED_LINKS.map((link, index) => (
            <ListItem
              key={index}
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    {link.label}：
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.description ?? link.label}
                    </a>
                  </Typography>
                }
              />
            </ListItem>
          ))}
          {/* 近隣MAP（google_map_urlがある場合のみ表示） */}
          {googleMapUrl && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span">
                      近隣MAP：
                      <Box
                        component="span"
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.7 },
                        }}
                        onClick={() => setNearbyMapModalOpen(true)}
                      >
                        🗺️ クリックして表示
                      </Box>
                    </Typography>
                    <Typography
                      component="div"
                      sx={{ color: 'error.main', fontSize: '0.8rem', mt: 0.3 }}
                    >
                      ※＋を２回押して拡大表示して印刷してください。カラーの両面印刷です。
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          )}
          {/* ハウスメーカー（house_makerフィールドに値がある場合のみ表示） */}
          {houseMaker && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography component="span">
                    ハウスメーカー：{houseMaker}（
                    <Box
                      component="span"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.7 },
                      }}
                      onClick={() => setHouseMakerModalOpen(true)}
                    >
                      詳細を見る
                    </Box>
                    ）
                  </Typography>
                }
              />
            </ListItem>
          )}
          {/* 評価ポイント！（システムから取得して物件ごとに表示） */}
          {linkedProperties && linkedProperties.length > 0 && linkedProperties
            .filter(lp => lp.property_number && (lp.property_number.startsWith('FI') || lp.property_number.startsWith('AA')))
            .map((lp, idx) => (
            <ListItem
              key={`eval-${lp.property_number}-${idx}`}
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span" sx={{ fontWeight: 'bold' }}>
                      評価ポイント！{linkedProperties.filter(p => p.property_number?.startsWith('FI') || p.property_number?.startsWith('AA')).length > 1 ? `（${lp.property_number}）` : ''}：
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <EvaluationPointsDisplay
                        sellerNumber={lp.property_number}
                        propertyAddress={lp.display_address || lp.address}
                      />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
          {/* propertyNumber単体のフォールバック（linkedPropertiesがない場合） */}
          {(!linkedProperties || linkedProperties.length === 0) && propertyNumber && (propertyNumber.startsWith('FI') || propertyNumber.startsWith('AA')) && (
            <ListItem
              component="li"
              sx={{ display: 'list-item', py: 0.5 }}
            >
              <ListItemText
                primary={
                  <Box>
                    <Typography component="span" sx={{ fontWeight: 'bold' }}>
                      評価ポイント！：
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <EvaluationPointsDisplay
                        sellerNumber={propertyNumber}
                      />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>

    {/* ハウスメーカーモーダル */}
    {houseMaker && (
      <HouseMakerModal
        open={houseMakerModalOpen}
        onClose={() => setHouseMakerModalOpen(false)}
        commentHtml={houseMaker}
        mode="buyer"
      />
    )}

    {/* 近隣MAPモーダル */}
    {googleMapUrl && (
      <NearbyMapModal
        open={nearbyMapModalOpen}
        onClose={() => setNearbyMapModalOpen(false)}
        googleMapUrl={googleMapUrl}
        address={address || ''}
      />
    )}
    </>
  );
};

export default ViewingPreparationPopup;
