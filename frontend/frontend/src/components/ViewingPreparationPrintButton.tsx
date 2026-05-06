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

// ============================================================
// 印刷用グローバルスタイルを注入・削除
// ============================================================

const PRINT_STYLE_ID = 'vp-print-global-style';

function injectPrintStyle() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 0mm;
      }

      /* プレビューダイアログ以外を全て非表示 */
      body > *:not(#vp-print-overlay) {
        display: none !important;
      }

      /* 印刷オーバーレイを表示 */
      #vp-print-overlay {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        overflow: visible !important;
        z-index: 999999 !important;
      }

      /* 各ページ */
      .vp-print-page {
        width: 210mm !important;
        height: 297mm !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
        position: relative !important;
        display: block !important;
      }

      .vp-print-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      /* 背景色・画像を保持 */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function removePrintStyle() {
  const el = document.getElementById(PRINT_STYLE_ID);
  if (el) el.remove();
}

// ============================================================
// コンポーネント
// ============================================================

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
    removePrintStyle();
  };

  // ============================================================
  // 印刷：body直下に印刷専用オーバーレイを作り window.print()
  // ============================================================
  const handlePrint = () => {
    if (propertyDetails.length === 0) return;
    setPrinting(true);

    // 既存のオーバーレイを削除
    const existing = document.getElementById('vp-print-overlay');
    if (existing) existing.remove();

    // 印刷専用オーバーレイをbody直下に作成
    const overlay = document.createElement('div');
    overlay.id = 'vp-print-overlay';
    overlay.style.cssText = 'display:none;';
    document.body.appendChild(overlay);

    // React でレンダリング
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(overlay);

      const pages = propertyDetails.flatMap((property, propIndex) => [
        <div key={`${propIndex}-1`} className="vp-print-page">
          <ViewingPreparationPrintSheet buyer={buyer} property={property} printDate={today} />
        </div>,
        <div key={`${propIndex}-2`} className="vp-print-page">
          <PurchaseApplicationPrintSheet
            propertyAddress={property.display_address || property.address}
            propertyPrice={property.price || property.listing_price}
          />
        </div>,
        <div key={`${propIndex}-3`} className="vp-print-page">
          <ExclusiveMediationContractSheet
            propertyAddress={property.display_address || property.address}
          />
        </div>,
        <div key={`${propIndex}-4`} className="vp-print-page">
          <FundingPlanSheet
            propertyAddress={property.display_address || property.address}
            propertyPrice={property.price || property.listing_price}
            propertyType={property.property_type}
            printDate={today}
          />
        </div>,
        <div key={`${propIndex}-5`} className="vp-print-page">
          <ReformEstimateSheet />
        </div>,
      ]);

      root.render(<>{pages}</>);

      // レンダリング完了を待ってから印刷
      setTimeout(() => {
        injectPrintStyle();

        // afterprint イベントでクリーンアップ
        const cleanup = () => {
          root.unmount();
          overlay.remove();
          removePrintStyle();
          setPrinting(false);
          window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);

        window.print();

        // afterprint が発火しない場合のフォールバック
        setTimeout(() => {
          if (document.getElementById('vp-print-overlay')) {
            cleanup();
          }
        }, 3000);
      }, 800);
    });
  };

  if (!linkedProperties || linkedProperties.length === 0) return null;

  // プレビュー用ページリスト
  const previewPages = propertyDetails.flatMap((property, propIndex) => [
    {
      key: `${propIndex}-1`,
      label: `1枚目：内覧準備資料`,
      node: <ViewingPreparationPrintSheet buyer={buyer} property={property} printDate={today} />,
    },
    {
      key: `${propIndex}-2`,
      label: `2枚目：買付申込書`,
      node: (
        <PurchaseApplicationPrintSheet
          propertyAddress={property.display_address || property.address}
          propertyPrice={property.price || property.listing_price}
        />
      ),
    },
    {
      key: `${propIndex}-3`,
      label: `3枚目：内覧証明書`,
      node: (
        <ExclusiveMediationContractSheet
          propertyAddress={property.display_address || property.address}
        />
      ),
    },
    {
      key: `${propIndex}-4`,
      label: `4枚目：資金計画書`,
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
      label: `5枚目：リフォーム概算表`,
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

        <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#777' }}>
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
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                py: '24px',
                px: '16px',
              }}
            >
              {previewPages.map((page) => (
                <Box key={page.key} sx={{ width: '100%', maxWidth: '820px' }}>
                  {/* ページラベル */}
                  <Typography
                    sx={{
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      mb: '6px',
                      pl: '4px',
                    }}
                  >
                    {page.label}
                  </Typography>
                  {/* A4実寸ページ（スクロールで全体確認可能） */}
                  <Box
                    sx={{
                      width: '210mm',
                      minHeight: '297mm',
                      bgcolor: '#fff',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      overflow: 'hidden',
                      mx: 'auto',
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
    </>
  );
}

export default ViewingPreparationPrintButton;
