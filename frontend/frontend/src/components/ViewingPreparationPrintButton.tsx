import React, { useState, useCallback, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import api from '../services/api';
import ViewingPreparationPrintSheet from './ViewingPreparationPrintSheet';
import PurchaseApplicationPrintSheet from './PurchaseApplicationPrintSheet';
import ExclusiveMediationContractSheet from './ExclusiveMediationContractSheet';
import FundingPlanSheet from './FundingPlanSheet';
import ReformEstimateSheet from './ReformEstimateSheet';

interface PropertyListing {
  property_number: string;
  id?: number;
  [key: string]: any;
}

interface BuyerDetails {
  [key: string]: any;
}

interface ViewingPreparationPrintButtonProps {
  buyer: BuyerDetails;
  linkedProperties: PropertyListing[];
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function ViewingPreparationPrintButton({
  buyer,
  linkedProperties,
}: ViewingPreparationPrintButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<any[]>([]);
  const [printing, setPrinting] = useState(false);
  const today = getTodayStr();

  const fetchPropertyDetails = useCallback(async () => {
    if (!linkedProperties || linkedProperties.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        linkedProperties.map((lp) =>
          api.get(`/api/property-listings/${lp.property_number}`).then((r) => r.data)
        )
      );
      setPropertyDetails(results);
    } catch {
      setError('物件詳細の取得に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [linkedProperties]);

  const handleOpen = () => {
    setDialogOpen(true);
    fetchPropertyDetails();
  };

  const handleClose = () => {
    setDialogOpen(false);
  };

  // ============================================================
  // 印刷：iframeにプレビューHTMLとCSSをコピーして印刷
  // ============================================================
  const handlePrint = () => {
    const printArea = document.getElementById('vp-print-area');
    if (!printArea) return;
    setPrinting(true);

    // 既存のiframeを削除
    const existingIframe = document.getElementById('vp-print-iframe') as HTMLIFrameElement | null;
    if (existingIframe) existingIframe.remove();

    // 非表示iframeを作成
    const iframe = document.createElement('iframe');
    iframe.id = 'vp-print-iframe';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { setPrinting(false); return; }

    // 現在のページの全スタイルシートをiframeにコピー
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .filter((el) => el.id !== 'vp-print-style')
      .map((el) => `<style>${el.textContent}</style>`)
      .join('\n');

    // 各ページのHTMLを取得（.vp-page要素）
    const pages = Array.from(printArea.querySelectorAll('.vp-page'));
    const pagesHtml = pages
      .map((page, i) => {
        const isLast = i === pages.length - 1;
        return `<div style="
          width:210mm;
          page-break-after:${isLast ? 'auto' : 'always'};
          break-after:${isLast ? 'auto' : 'page'};
          background:white;
          overflow:hidden;
        ">${page.innerHTML}</div>`;
      })
      .join('');

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${styleLinks}
${inlineStyles}
<style>
  @page { size: A4 portrait; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body { margin: 0; padding: 0; background: white; font-family: "Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif; }
</style>
</head>
<body>${pagesHtml}</body>
</html>`);
    iframeDoc.close();

    // フォント・画像の読み込みを待ってから印刷
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
          setPrinting(false);
        }, 1000);
      }, 500);
    };

    // フォールバック
    setTimeout(() => {
      if (document.getElementById('vp-print-iframe')) {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { iframe.remove(); setPrinting(false); }, 1000);
      }
    }, 2500);
  };

  if (!linkedProperties || linkedProperties.length === 0) return null;

  const previewPages = propertyDetails.flatMap((property, propIndex) => [
    {
      key: `${propIndex}-1`,
      label: '1枚目：内覧準備資料',
      node: <ViewingPreparationPrintSheet buyer={buyer} property={property} printDate={today} />,
    },
    {
      key: `${propIndex}-2`,
      label: '2枚目：買付申込書',
      node: (
        <PurchaseApplicationPrintSheet
          propertyAddress={property.display_address || property.address}
          propertyPrice={property.price || property.listing_price}
        />
      ),
    },
    {
      key: `${propIndex}-3`,
      label: '3枚目：内覧証明書',
      node: (
        <ExclusiveMediationContractSheet
          propertyAddress={property.display_address || property.address}
        />
      ),
    },
    {
      key: `${propIndex}-4`,
      label: '4枚目：資金計画書',
      node: (
        <FundingPlanSheet
          propertyAddress={property.display_address || property.address}
          propertyPrice={property.price || property.listing_price}
          propertyType={property.property_type}
          printDate={today}
        />
      ),
    },
    {
      key: `${propIndex}-5`,
      label: '5枚目：リフォーム概算表',
      node: <ReformEstimateSheet />,
    },
  ]);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<PrintIcon />}
        onClick={handleOpen}
        sx={{
          borderColor: '#4caf50',
          color: '#2e7d32',
          fontSize: '0.75rem',
          '&:hover': { borderColor: '#2e7d32', bgcolor: '#f1f8e9' },
        }}
      >
        内覧準備資料
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { maxHeight: '95vh', height: '95vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">
            内覧準備資料 - 印刷プレビュー（全{previewPages.length}枚）
          </Typography>
          <Typography variant="caption" color="text.secondary">
            印刷設定：A4・余白なし
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#666' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <CircularProgress sx={{ color: '#fff' }} />
              <Typography sx={{ ml: 2, color: '#fff' }}>物件情報を読み込み中...</Typography>
            </Box>
          )}
          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {!loading && !error && previewPages.length > 0 && (
            /* ===== 印刷対象エリア ===== */
            <Box
              id="vp-print-area"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                py: '20px',
                px: '16px',
              }}
            >
              {previewPages.map((page) => (
                <Box key={page.key} sx={{ width: '100%', maxWidth: '860px' }}>
                  {/* ページラベル（印刷時は非表示） */}
                  <Typography
                    className="vp-no-print"
                    sx={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', mb: '6px', pl: '4px' }}
                  >
                    {page.label}
                  </Typography>

                  {/* A4ページ本体 */}
                  <Box
                    className="vp-page"
                    sx={{
                      width: '210mm',
                      minHeight: '297mm',
                      bgcolor: '#fff',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      mx: 'auto',
                      overflow: 'visible',
                    }}
                  >
                    {page.node}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleClose} color="inherit">
            閉じる
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            onClick={handlePrint}
            disabled={printing || loading || !!error || previewPages.length === 0}
          >
            {printing ? '印刷中...' : `印刷する（${previewPages.length}枚）`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ページラベルを印刷時に非表示にするスタイル */}
      <style>{`
        @media print {
          .vp-no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}

export default ViewingPreparationPrintButton;
