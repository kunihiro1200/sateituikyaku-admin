import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { Print as PrintIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../services/api';

const AreaReportPage = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [areaName, setAreaName] = useState('');
  const hasFetched = useRef(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const res = await api.post(`/api/sellers/${sellerId}/area-report`);
      const htmlContent: string = res.data.html || '';
      const name: string = res.data.areaName || '';
      setHtml(htmlContent);
      setAreaName(name);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'レポートの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    generate();
  }, [sellerId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 3, bgcolor: '#f5f5f5',
      }}>
        <CircularProgress size={64} thickness={4} />
        <Typography variant="h6" color="text.secondary">
          AIがエリア情勢レポートを生成中です...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          30〜60秒ほどかかります。このタブはそのままにして他の作業をどうぞ。
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
        <Typography color="error">{error}</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={generate}>再試行</Button>
      </Box>
    );
  }

  return (
    <>
      {/* 印刷時は非表示のツールバー */}
      <Box className="no-print" sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        bgcolor: '#1a237e', color: 'white', px: 3, py: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 3,
      }}>
        <Typography variant="subtitle1" fontWeight="bold">
          エリア情勢レポート {areaName && `— ${areaName}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={generate}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: 'white' } }}
          >
            再生成
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ bgcolor: 'white', color: '#1a237e', '&:hover': { bgcolor: '#e8eaf6' } }}
          >
            A4印刷
          </Button>
        </Box>
      </Box>

      {/* レポート本体 */}
      <Box sx={{ pt: '52px' }}>
        <Box
          dangerouslySetInnerHTML={{ __html: html || '' }}
          sx={{
            fontFamily: "'Hiragino Kaku Gothic ProN','Meiryo',sans-serif",
            fontSize: '12px',
            '& table': { borderCollapse: 'collapse', width: '100%' },
            '& td, & th': { border: '1px solid #ccc', padding: '6px 10px' },
          }}
        />
      </Box>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding-top: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4; margin: 15mm; }
        }
      `}</style>
    </>
  );
};

export default AreaReportPage;
