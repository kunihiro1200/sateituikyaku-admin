import { useState } from 'react';
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
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface PortalMeritsModalProps {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  propertyAddress?: string;
}

// テキストをカテゴリ別にパースしてJSXで整形する
function parseAndRender(text: string) {
  if (!text) return null;

  const lines = text.split('\n');
  const sections: { heading: string; items: string[] }[] = [];
  let current: { heading: string; items: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 「・」「•」「-」で始まる行は箇条書き項目
    if (/^[・•\-]/.test(line)) {
      if (!current) {
        // 見出しなしで項目が来た場合
        current = { heading: '', items: [] };
        sections.push(current);
      }
      current.items.push(line.replace(/^[・•\-]\s*/, ''));
    } else {
      // 見出し行
      current = { heading: line, items: [] };
      sections.push(current);
    }
  }

  return sections.map((sec, idx) => (
    <Box key={idx} sx={{ mb: 2 }}>
      {sec.heading && (
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 'bold',
            color: '#1a237e',
            borderLeft: '4px solid #1a237e',
            pl: 1,
            mb: 0.5,
            fontSize: '0.9rem',
          }}
        >
          {sec.heading}
        </Typography>
      )}
      {sec.items.map((item, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0.5,
            mb: 0.25,
          }}
        >
          <Typography
            component="span"
            sx={{ color: '#1976d2', fontWeight: 'bold', mt: '2px', flexShrink: 0 }}
          >
            ・
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.7, fontSize: '0.85rem' }}>
            {item}
          </Typography>
        </Box>
      ))}
      {idx < sections.length - 1 && <Divider sx={{ mt: 1.5 }} />}
    </Box>
  ));
}

export const PortalMeritsModal = ({
  open,
  onClose,
  sellerId,
  propertyAddress,
}: PortalMeritsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/sellers/${sellerId}/portal-merits`);
      setText(res.data.text || '');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'メリットの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    setText(null);
    setError(null);
    onClose();
  };

  // ダイアログが開いたとき自動生成
  if (open && !text && !loading && !error) {
    generate();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: '85vh' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          background: 'linear-gradient(135deg, #e8eaf6 0%, #fff 100%)',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography component="span" sx={{ fontSize: '1.3rem' }}>🏡</Typography>
            <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
              ポータルサイト掲載メリット
            </Typography>
          </Box>
          {propertyAddress && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
              {propertyAddress}
            </Typography>
          )}
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto' }}>
        {loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300,
              gap: 2,
            }}
          >
            <CircularProgress size={48} />
            <Typography color="text.secondary">
              ChatGPTがアピールポイントを生成中です...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              （20〜40秒ほどかかる場合があります）
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={generate}>
              再試行
            </Button>
          </Box>
        )}

        {text && !loading && (
          <Box sx={{ p: 1 }}>
            {parseAndRender(text)}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        {text && !loading && (
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={generate}
              size="small"
            >
              再生成
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              size="small"
              color={copied ? 'success' : 'primary'}
            >
              {copied ? 'コピーしました' : '全文コピー'}
            </Button>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose} variant="outlined" size="small">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortalMeritsModal;
