import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { consultApi } from '../services/consultApi';

/**
 * 不動産相談チャットアプリ：本人確認ページ（認証不要・顧客向け公開ページ）。
 * 売主番号 or 電話番号のいずれかで本人確認し、成功したらセッショントークンを端末に保存して
 * チャット画面（/consult/:sellerNumber）へ遷移する。
 *
 * 一度確認済みの端末は次回以降このページをスキップする（ConsultChatPage側でトークン検証）。
 */
export default function ConsultVerifyPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sellerNumber' | 'phoneNumber'>('sellerNumber');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // 既に本人確認済みの端末であれば、そのままチャット画面へ遷移する
  useEffect(() => {
    (async () => {
      const stored = consultApi.getStoredSession();
      if (!stored) {
        setCheckingSession(false);
        return;
      }
      const resolved = await consultApi.resolveSession(stored.token);
      if (resolved) {
        navigate(`/consult/${resolved.sellerNumber}`, { replace: true });
      } else {
        consultApi.clearSession();
        setCheckingSession(false);
      }
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError(mode === 'sellerNumber' ? '売主番号を入力してください' : '電話番号を入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = mode === 'sellerNumber' ? { sellerNumber: value.trim() } : { phoneNumber: value.trim() };
      const result = await consultApi.verify(params);
      if (result.sessionToken) {
        consultApi.saveSession(result.sellerId, result.sellerNumber, result.sessionToken);
      }
      navigate(`/consult/${result.sellerNumber}`);
    } catch (err: any) {
      setError(err.message || '確認できませんでした。入力内容をご確認ください。');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f5f5f5',
        p: 2,
      }}
    >
      <Paper sx={{ p: 3, maxWidth: 420, width: '100%', borderRadius: 3 }} elevation={2}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          不動産相談チャット
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          売主番号または電話番号を入力してください。
        </Typography>

        <ToggleButtonGroup
          value={mode}
          exclusive
          fullWidth
          size="small"
          onChange={(_, v) => {
            if (v) {
              setMode(v);
              setValue('');
              setError('');
            }
          }}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="sellerNumber">売主番号で確認</ToggleButton>
          <ToggleButton value="phoneNumber">電話番号で確認</ToggleButton>
        </ToggleButtonGroup>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            autoFocus
            placeholder={mode === 'sellerNumber' ? '例: AA12345' : '例: 09012345678'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={mode === 'phoneNumber' ? 'numeric' : 'text'}
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : '確認して始める'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
