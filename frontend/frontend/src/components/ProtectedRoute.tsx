import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '../store/authStore';
import { EmployeeRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// viewerロールがアクセスできるパスのプレフィックス
const VIEWER_ALLOWED_PATHS = ['/property-listings'];

// checkAuthが実行中かどうかのグローバルフラグ（二重呼び出し防止）
let authCheckInProgress = false;

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, checkAuth, employee } = useAuthStore();
  const location = useLocation();
  const hasChecked = useRef(false);

  useEffect(() => {
    // 既に認証済みの場合はスキップ
    if (isAuthenticated && employee) {
      useAuthStore.setState({ isLoading: false });
      return;
    }

    // 既にチェック済み or 実行中の場合はスキップ
    if (hasChecked.current || authCheckInProgress) return;
    hasChecked.current = true;
    authCheckInProgress = true;

    // 認証チェックを実行（タイムアウト付き）
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Auth check timeout - forcing to login');
      useAuthStore.setState({ isLoading: false, isAuthenticated: false });
      authCheckInProgress = false;
    }, 5000); // 5秒でタイムアウト

    checkAuth().finally(() => {
      clearTimeout(timeoutId);
      authCheckInProgress = false;
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
