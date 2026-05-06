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

// ============================================================
// 型定義
// ============================================================

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
  const printAreaRef = useRef<HTMLDivElement>(null);
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
    } catch (err: any) {
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
  // 印刷：新しいウィンドウを開いてそこに印刷
  // ============================================================
  const handlePrint = () => {
    if (!printAreaRef.current || propertyDetails.length === 0) return;
    setPrinting(true);

    // 印刷用の新しいウィンドウを開く
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('ポップアップがブロックされています。ポップアップを許可してください。');
      setPrinting(false);
      return;
    }

    // プレビューエリアのHTMLを取得
    const printContent = printAreaRef.current.innerHTML;

    // 新しいウィンドウにHTMLを書き込む
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>内覧準備資料</title>
  <style>
    /* リセット */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    body {
      font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
      background: white;
    }

    /* 各ページ */
    .print-page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      position: relative;
      background: white;
    }

    .print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
      }

      .print-page {
        width: 210mm;
        min-height: 297mm;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
      }

      .print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }

    /* MUIのスタイルを最低限インライン化 */
    .MuiBox-root, .MuiTypography-root, .MuiGrid-root, .MuiGrid-item,
    .MuiDivider-root, .MuiPaper-root {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  ${printContent}
</body>
</html>
    `);

    printWindow.document.close();

    // ロード完了後に印刷
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        setPrinting(false);
      }, 500);
    };

    // onloadが発火しない場合のフォールバック
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
      setPrinting(false);
    }, 2000);
  };

  if (!linkedProperties || linkedProperties.length === 0) return null;

  // 全ページのリスト
  const allPages = propertyDetails.flatMap((property, propIndex) => [
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
          <Typography variant="h6">内覧準備資料 - 印刷プレビュー（全{allPages.length}枚）</Typography>
          <Typography variant="caption" color="text.secondary">
            印刷設定：A4・余白なし
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: 'auto', bgcolor: '#888' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2, color: '#fff' }}>物件情報を読み込み中...</Typography>
            </Box>
          )}

          {error && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {!loading && !error && propertyDetails.length > 0 && (
            <>
              {/* 印刷用の実寸DOM（スクロールで確認できるプレビュー兼印刷ソース） */}
              <Box
                ref={printAreaRef}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  p: '16px',
                }}
              >
                {allPages.map((page) => (
                  <Box
                    key={page.key}
                    className="print-page"
                    sx={{
                      width: '210mm',
                      minHeight: '297mm',
                      bgcolor: '#fff',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {page.node}
                  </Box>
                ))}
              </Box>
            </>
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
            {printing ? '印刷中...' : `印刷する（${allPages.length}枚）`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ViewingPreparationPrintButton;
