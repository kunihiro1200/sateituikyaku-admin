import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../services/api';

interface AreaReportModalProps {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  sellerNumber?: string;
  propertyAddress?: string;
}

export const AreaReportModal = ({
  open,
  onClose,
  sellerId,
  sellerNumber,
  propertyAddress,
}: AreaReportModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [areaName, setAreaName] = useState<string>('');
  const [isDemo, setIsDemo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/sellers/${sellerId}/area-report`);
      setReportHtml(res.data.html);
      setAreaName(res.data.areaName || '');
      setIsDemo(res.data.isDemo || false);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'レポートの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>エリア情勢レポート - ${areaName}</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { size: A4; margin: 15mm; }
    }
    body {
      font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
      font-size: 12px;
      color: #333;
      background: white;
    }
  </style>
</head>
<body>
${reportHtml}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleOpen = () => {
    if (!reportHtml) {
      generateReport();
    }
  };

  // ダイアログが開いたときに自動生成
  if (open && !reportHtml && !loading && !error) {
    generateReport();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
            エリア情勢レポート
          </Typography>
          {areaName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
              {areaName}
              {propertyAddress && ` (${propertyAddress})`}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, p: 4 }}>
            <CircularProgress size={48} />
            <Typography color="text.secondary">
              AIがエリア情勢レポートを生成中です...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              （30〜60秒ほどかかる場合があります）
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={generateReport}>
              再試行
            </Button>
          </Box>
        )}

        {reportHtml && !loading && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Box
              sx={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                p: 2,
                minHeight: '100%',
                fontFamily: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif",
                fontSize: '12px',
                '& table': {
                  borderCollapse: 'collapse',
                  width: '100%',
                  mb: 2,
                },
                '& td, & th': {
                  border: '1px solid #ccc',
                  padding: '6px 10px',
                },
              }}
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        {reportHtml && !loading && (
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={generateReport}
            size="small"
          >
            再生成
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="outlined" size="small">
          閉じる
        </Button>
        {reportHtml && !loading && (
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            size="small"
            sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#283593' } }}
          >
            A4印刷
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AreaReportModal;
