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
import IfuuCampaignSheet from './IfuuCampaignSheet';

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

// ============================================================
// 内覧準備資料２ボタン（挨拶状スタイル）
// ============================================================
export function ViewingPreparation2PrintButton({
  buyer,
}: {
  buyer: BuyerDetails;
}) {
  const [printing, setPrinting] = useState(false);
  const today = getTodayStr();

  const handlePrint = () => {
    setPrinting(true);
    import('../utils/printHtmlGenerators').then(({ generateViewingPrep2Html }) => {
      const html = generateViewingPrep2Html(buyer, today);
      // iframe方式: @page margin:0 が確実に効く（window.openでは無視されることがある）
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) { setPrinting(false); document.body.removeChild(iframe); return; }
      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => {
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
          setPrinting(false);
        }, 1000);
      };

      const doPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (_) { /* ignore */ }
        cleanup();
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        setTimeout(doPrint, 1200);
      } else {
        iframe.onload = () => setTimeout(doPrint, 1200);
        setTimeout(doPrint, 5000); // フォールバック（画像読み込み待ち）
      }
    }).catch(() => {
      setPrinting(false);
    });
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={printing ? <CircularProgress size={14} color="inherit" /> : <PrintIcon />}
      onClick={handlePrint}
      disabled={printing}
      sx={{
        borderColor: '#f5c518',
        color: '#b8860b',
        fontSize: '0.75rem',
        '&:hover': { borderColor: '#b8860b', bgcolor: '#fffde7' },
      }}
    >
      {printing ? '印刷中...' : '内覧準備資料２'}
    </Button>
  );
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
  // 印刷：iframe方式（@page margin:0 が確実に効く）
  // ============================================================
  const handlePrint = () => {
    if (propertyDetails.length === 0) return;
    setPrinting(true);

    import('../utils/printHtmlGenerators').then(({ generateAllPagesHtml }) => {
      const html = generateAllPagesHtml(buyer, propertyDetails, today);

      // iframe方式: window.open と違い @page { margin:0 } が確実に適用される
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        setPrinting(false);
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => {
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
          setPrinting(false);
        }, 1000);
      };

      const doPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (_) { /* ignore */ }
        cleanup();
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        setTimeout(doPrint, 800);
      } else {
        iframe.onload = () => setTimeout(doPrint, 800);
        setTimeout(doPrint, 2000); // フォールバック
      }
    });
  };

  if (!linkedProperties || linkedProperties.length === 0) return null;

  const previewPages = propertyDetails.flatMap((property, propIndex) => {
    const price = property.price || property.listing_price;
    const pages = [
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
    ];
    // 物件価格1500万円以上の場合のみキャンペーンシートを追加
    if (price != null && price >= 15000000) {
      pages.push({
        key: `${propIndex}-6`,
        label: '6枚目：いふうキャンペーン',
        node: <IfuuCampaignSheet buyerNumber={buyer?.buyer_number || ''} viewingDate={buyer?.viewing_date || today} />,
      });
    }
    return pages;
  });

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
