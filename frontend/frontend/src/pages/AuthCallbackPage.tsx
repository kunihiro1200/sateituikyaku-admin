import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { useAuthStore } from '../store/authStore';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const handleAuthCallback = useAuthStore((state) => state.handleAuthCallback);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const hasProcessed = useRef(false);

  useEffect(() => {
    // 既に処理済みの場合はスキップ（二重実行防止）
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        console.log('🔵 AuthCallbackPage: Processing authentication callback...');
        console.log('🔍 Full URL:', window.location.href);
        console.log('🔍 Hash:', window.location.hash);
        console.log('🔍 Search:', window.location.search);
        
        setIsProcessing(true);
        setError(null);
        setDebugInfo('認証情報を確認中...');

        // タイムアウト設定（30秒）
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('認証処理がタイムアウトしました。もう一度お試しください。')), 30000);
        });

        await Promise.race([
          handleAuthCallback(),
          timeoutPromise
        ]);

        console.log('✅ AuthCallbackPage: Authentication successful, redirecting to home...');
        setDebugInfo('認証成功！リダイレクト中...');
        
        // 少し待ってからリダイレクト（状態更新を確実にするため）
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      } catch (err) {
        console.error('❌ AuthCallbackPage: Authentication failed:', err);
        
        // タイムアウトエラーでも認証が成功している場合はリダイレクト
        const currentIsAuthenticated = useAuthStore.getState().isAuthenticated;
        if (currentIsAuthenticated) {
          console.log('✅ AuthCallbackPage: Auth state is authenticated despite error, redirecting...');
          navigate('/', { replace: true });
          return;
        }
        
        let errorMessage = '認証処理中にエラーが発生しました。';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          console.error('❌ Error details:', {
            message: err.message,
            stack: err.stack,
          });
        }
        
        setError(errorMessage);
        setIsProcessing(false);
        setDebugInfo('');
      }
    };

    // 少し遅延させてから実行（URLハッシュが確実に読み込まれるように）
    const timer = setTimeout(() => {
      processCallback();
    }, 100);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                認証エラー
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {error}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                問題が解決しない場合は、ブラウザのキャッシュをクリアしてから再度お試しください。
              </Typography>
            </Alert>
            <Button
              variant="contained"
              onClick={() => {
                // ローカルストレージをクリア
                localStorage.removeItem('session_token');
                localStorage.removeItem('refresh_token');
                navigate('/login', { replace: true });
              }}
              sx={{ mr: 2 }}
            >
              ログインページに戻る
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                // デバッグ情報を表示
                console.log('🔍 Debug Info:');
                console.log('URL:', window.location.href);
                console.log('Hash:', window.location.hash);
                console.log('LocalStorage:', {
                  session_token: localStorage.getItem('session_token'),
                  refresh_token: localStorage.getItem('refresh_token'),
                });
                alert('デバッグ情報をコンソールに出力しました。F12キーを押して確認してください。');
              }}
            >
              デバッグ情報を表示
            </Button>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          {isProcessing ? debugInfo || '認証処理中...' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          この画面が10秒以上表示される場合は、ページを再読み込みしてください
        </Typography>
      </Box>
    </Container>
  );
}
