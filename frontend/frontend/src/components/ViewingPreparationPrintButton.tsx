import React, { useState, useCallback, useEffect } from 'react';
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

// ============================================================
// 型定義
// ============================================================

interface PropertyListing {
  property_number: string;
  id?: number;
  [key: string]: any;
}

interface BuyerDetails {
  buyer_number?: string;
  name?: string;
  phone_number?: string;
  email?: string;
  company_name?: string;
  broker_inquiry?: string;
  vendor_survey?: string;
  viewing_survey_result?: string;
  viewing_survey_confirmed?: string;
  inquiry_hearing?: string;
  initial_assignee?: string;
  reception_date?: string;
  inquiry_source?: string;
  latest_status?: string;
  project_assignee?: string;
  neighbor_property_email_sent?: string;
  distribution_type?: string;
  pinrich?: string;
  inquiry_email_phone?: string;
  inquiry_email_reply?: string;
  three_calls_confirmed?: string;
  next_call_date?: string;
  owned_home_hearing_inquiry?: string;
  owned_home_hearing_result?: string;
  valuation_required?: string;
  message_to_assignee?: string;
  [key: string]: any;
}

interface ViewingPreparationPrintButtonProps {
  buyer: BuyerDetails;
  linkedProperties: PropertyListing[];
}

// ============================================================
// 印刷用スタイルを動的に挿入するユーティリティ
// ============================================================

function injectPrintStyle(styleId: string, css: string) {
  // 既存のスタイルを削除
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

function removePrintStyle(styleId: string) {
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();
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

  // 物件詳細データをAPIから取得
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
    } catch (err: any) {
      console.error('物件詳細の取得に失敗しました:', err);
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
    removePrintStyle('viewing-preparation-print-style');
  };

  const handlePrint = () => {
    if (propertyDetails.length === 0) return;
    setPrinting(true);

    // 印刷専用スタイルを注入：内覧準備資料エリアのみ表示
    injectPrintStyle(
      'viewing-preparation-print-style',
      `
      @media print {
        @page {
          size: A4;
          margin: 8mm;
        }
        /* 全要素を非表示 */
        body > * {
          display: none !important;
        }
        /* 印刷エリアのみ表示 */
        #viewing-preparation-print-root {
          display: block !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          z-index: 99999 !important;
        }
        .viewing-prep-page {
          page-break-after: always;
        }
        .viewing-prep-page:last-child {
          page-break-after: auto;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      `
    );

    // 印刷用DOMを body に直接追加
    const printRoot = document.createElement('div');
    printRoot.id = 'viewing-preparation-print-root';
    printRoot.style.display = 'none';
    document.body.appendChild(printRoot);

    // React で印刷コンテンツをレンダリング
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(printRoot);
      const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\//g, '/');

      root.render(
        <React.StrictMode>
          <>
            {propertyDetails.map((property, index) => (
              <React.Fragment key={property.property_number || index}>
                {/* 1枚目: 内覧準備資料 */}
                <div className="viewing-prep-page">
                  <ViewingPreparationPrintSheet
                    buyer={buyer}
                    property={property}
                    printDate={today}
                  />
                </div>
                {/* 2枚目: 買付申込書 */}
                <div className={index < propertyDetails.length - 1 ? 'viewing-prep-page' : ''}>
                  <PurchaseApplicationPrintSheet
                    propertyAddress={property.display_address || property.address}
                    propertyPrice={property.price || property.listing_price}
                  />
                </div>
              </React.Fragment>
            ))}
          </>
        </React.StrictMode>
      );

      // レンダリング完了後に印刷
      setTimeout(() => {
        window.print();

        // 印刷後にクリーンアップ
        setTimeout(() => {
          root.unmount();
          printRoot.remove();
          removePrintStyle('viewing-preparation-print-style');
          setPrinting(false);
        }, 500);
      }, 500);
    });
  };

  if (!linkedProperties || linkedProperties.length === 0) return null;

  return (
    <>
      {/* 印刷ボタン */}
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

      {/* プレビューダイアログ */}
      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { maxHeight: '95vh', height: '95vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">内覧準備資料 - 印刷プレビュー</Typography>
          <Typography variant="caption" color="text.secondary">
            ブラウザの印刷設定で「A4・余白なし」を推奨します
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#e8e8e8' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>物件情報を読み込み中...</Typography>
            </Box>
          )}

          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {!loading && !error && propertyDetails.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                p: 3,
                pb: 6,
              }}
            >
              {propertyDetails.map((property, index) => (
                <React.Fragment key={property.property_number || index}>
                  {/* 1枚目: 内覧準備資料 */}
                  <Box
                    sx={{
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      bgcolor: '#fff',
                      transform: 'scale(0.7)',
                      transformOrigin: 'top center',
                      mb: '-90mm',
                    }}
                  >
                    <ViewingPreparationPrintSheet
                      buyer={buyer}
                      property={property}
                    />
                  </Box>
                  {/* 2枚目: 買付申込書 */}
                  <Box
                    sx={{
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      bgcolor: '#fff',
                      transform: 'scale(0.7)',
                      transformOrigin: 'top center',
                      mb: '-90mm',
                    }}
                  >
                    <PurchaseApplicationPrintSheet
                      propertyAddress={property.display_address || property.address}
                      propertyPrice={property.price || property.listing_price}
                    />
                  </Box>
                </React.Fragment>
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
            disabled={printing || loading || !!error || propertyDetails.length === 0}
          >
            {printing ? '印刷中...' : '印刷する'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ViewingPreparationPrintButton;
