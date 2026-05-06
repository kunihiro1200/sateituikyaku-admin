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
import { createPortal } from 'react-dom';
import api from '../services/api';
import ViewingPreparationPrintSheet from './ViewingPreparationPrintSheet';
import PurchaseApplicationPrintSheet from './PurchaseApplicationPrintSheet';
import ExclusiveMediationContractSheet from './ExclusiveMediationContractSheet';
import FundingPlanSheet from './FundingPlanSheet';
import ReformEstimateSheet from './ReformEstimateSheet';

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
// 今日の日付
// ============================================================

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// 印刷コンテンツ（全ページ）
// ============================================================

function PrintContent({
  buyer,
  propertyDetails,
  today,
}: {
  buyer: BuyerDetails;
  propertyDetails: any[];
  today: string;
}) {
  return (
    <>
      {propertyDetails.map((property, index) => (
        <React.Fragment key={property.property_number || index}>
          {/* 1枚目: 内覧準備資料 */}
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <ViewingPreparationPrintSheet buyer={buyer} property={property} printDate={today} />
          </div>
          {/* 2枚目: 買付申込書 */}
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <PurchaseApplicationPrintSheet
              propertyAddress={property.display_address || property.address}
              propertyPrice={property.price || property.listing_price}
            />
          </div>
          {/* 3枚目: 内覧証明書 */}
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <ExclusiveMediationContractSheet
              propertyAddress={property.display_address || property.address}
            />
          </div>
          {/* 4枚目: 資金計画書 */}
          <div style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
            <FundingPlanSheet
              propertyAddress={property.display_address || property.address}
              propertyPrice={property.price || property.listing_price}
              propertyType={property.property_type}
              printDate={today}
            />
          </div>
          {/* 5枚目: リフォーム概算表 */}
          <div style={{
            pageBreakAfter: index < propertyDetails.length - 1 ? 'always' : 'auto',
            breakAfter: index < propertyDetails.length - 1 ? 'page' : 'auto',
          }}>
            <ReformEstimateSheet />
          </div>
        </React.Fragment>
      ))}
    </>
  );
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
  };

  const handlePrint = () => {
    if (propertyDetails.length === 0) return;
    setPrinting(true);

    // 印刷用スタイルを注入
    const styleId = 'viewing-prep-print-style';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 0;
        }
        /* 通常のページ要素を全て非表示 */
        body > *:not(#vp-print-container) {
          display: none !important;
          visibility: hidden !important;
        }
        /* 印刷コンテナを表示 */
        #vp-print-container {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #vp-print-container * {
          visibility: visible !important;
        }
        /* 背景色を保持 */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);

    // 印刷用コンテナをbodyに直接追加（position: staticで全ページ流れる）
    const container = document.createElement('div');
    container.id = 'vp-print-container';
    container.style.cssText = 'display:none; position:absolute; top:0; left:0; width:210mm;';
    document.body.appendChild(container);

    // React でレンダリング
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <PrintContent
          buyer={buyer}
          propertyDetails={propertyDetails}
          today={today}
        />
      );

      // レンダリング完了を待ってから印刷
      setTimeout(() => {
        container.style.display = 'block';
        window.print();

        // 印刷後クリーンアップ
        setTimeout(() => {
          root.unmount();
          container.remove();
          const s = document.getElementById(styleId);
          if (s) s.remove();
          setPrinting(false);
        }, 1000);
      }, 600);
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
          <Typography variant="h6">内覧準備資料 - 印刷プレビュー（全5枚）</Typography>
          <Typography variant="caption" color="text.secondary">
            印刷設定：A4・余白なし
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#e0e0e0' }}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2 }}>
              {propertyDetails.map((property, propIndex) => {
                const pages = [
                  { label: '1枚目：内覧準備資料', node: <ViewingPreparationPrintSheet buyer={buyer} property={property} printDate={today} /> },
                  { label: '2枚目：買付申込書', node: <PurchaseApplicationPrintSheet propertyAddress={property.display_address || property.address} propertyPrice={property.price || property.listing_price} /> },
                  { label: '3枚目：内覧証明書', node: <ExclusiveMediationContractSheet propertyAddress={property.display_address || property.address} /> },
                  { label: '4枚目：資金計画書', node: <FundingPlanSheet propertyAddress={property.display_address || property.address} propertyPrice={property.price || property.listing_price} propertyType={property.property_type} printDate={today} /> },
                  { label: '5枚目：リフォーム概算表', node: <ReformEstimateSheet /> },
                ];
                return pages.map((page, pageIndex) => (
                  <Box key={`${propIndex}-${pageIndex}`} sx={{ width: '100%', maxWidth: '700px' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#555', fontWeight: 'bold' }}>
                      {page.label}
                    </Typography>
                    <Box
                      sx={{
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        bgcolor: '#fff',
                        transform: 'scale(0.72)',
                        transformOrigin: 'top left',
                        width: '210mm',
                        mb: `calc(297mm * 0.72 - 297mm + 8px)`,
                      }}
                    >
                      {page.node}
                    </Box>
                  </Box>
                ));
              })}
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
            {printing ? '印刷中...' : `印刷する（${propertyDetails.length * 5}枚）`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ViewingPreparationPrintButton;
