import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '../store/authStore';
import { EmployeeRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// viewerロールがアクセスできるパスのプレフィックス
const VIEWER_ALLOWED_PATHS = ['/property-listings'];

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth, employee } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // 認証チェック開始
    useAuthStore.setState({ isLoading: true });
    
    // 認証チェックを実行（タイムアウト付き）
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Auth check timeout - forcing to login');
      useAuthStore.setState({ isLoading: false, isAuthenticated: false });
    }, 5000); // 5秒でタイムアウト

    checkAuth().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時に1回だけ実行

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // viewerロールは物件リスト系ページのみアクセス許可
  if (employee?.role === EmployeeRole.VIEWER) {
    const isAllowed = VIEWER_ALLOWED_PATHS.some(prefix =>
      location.pathname.startsWith(prefix)
    );
    if (!isAllowed) {
      return <Navigate to="/property-listings" replace />;
    }
  }

  return <>{children}</>;
}
