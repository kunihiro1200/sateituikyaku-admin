import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService.supabase';
import { supabaseClient } from '../config/supabase';

const router = Router();
const authService = new AuthService();

/**
 * Supabase Authのコールバック処理
 * フロントエンドから呼ばれる
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { access_token, refresh_token } = req.body;

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('🔵 /auth/callback called');
      console.log('🔵 Has access_token:', !!access_token);
      console.log('🔵 Has refresh_token:', !!refresh_token);
    }

    if (!access_token) {
      console.error('❌ No access token provided');
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'アクセストークンが必要です',
          retryable: false,
        },
      });
      return;
    }

    // トークンからユーザー情報を取得
    if (isDev) {
      console.log('🔵 Verifying token with Supabase...');
    }
    
    // Supabase Authでセッションを設定してユーザー情報を取得
    const { data: { user }, error } = await supabaseClient.auth.setSession({
      access_token,
      refresh_token: refresh_token || '',
    });

    if (isDev) {
      console.log('🔵 Session result:', { 
        hasUser: !!user, 
        userId: user?.id,
        userEmail: user?.email,
        error: error?.message 
      });
    }

    if (error) {
      console.error('❌ Supabase session error:', error.message);
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: `認証エラー: ${error.message}`,
          retryable: false,
        },
      });
      return;
    }

    if (!user) {
      console.error('❌ No user found in session');
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: '無効なアクセストークンです',
          retryable: false,
        },
      });
      return;
    }

    if (!user.email) {
      console.error('❌ User has no email');
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ユーザーのメールアドレスが取得できません',
          retryable: false,
        },
      });
      return;
    }

    // 社員レコードを取得または作成
    if (isDev) {
      console.log('🔵 Creating/getting employee record...');
    }
    
    const employee = await authService.getOrCreateEmployee(
      user.id,
      user.email,
      user.user_metadata
    );

    if (isDev) {
      console.log('✅ Employee record created/retrieved:', {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      });
    }

    res.json({
      employee,
      access_token,
      refresh_token,
    });
  } catch (error) {
    console.error('❌ Auth callback error:', error);
    
    const errorMessage = error instanceof Error ? error.message : '認証に失敗しました';
    
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: errorMessage,
        retryable: true,
      },
    });
  }
});

/**
 * ログアウト
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await authService.logout(token);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Failed to logout',
        retryable: true,
      },
    });
  }
});

/**
 * 現在のユーザー情報取得
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'No authentication token provided',
          retryable: false,
        },
      });
      return;
    }

    const token = authHeader.substring(7);
    const employee = await authService.validateSession(token);
    
    res.json(employee);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid or expired authentication token',
        retryable: false,
      },
    });
  }
});

/**
 * トークンリフレッシュ
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
          retryable: false,
        },
      });
      return;
    }

    // Supabase Authでトークンをリフレッシュ（ANON_KEYクライアントを使用）
    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      res.status(401).json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid refresh token',
          retryable: false,
        },
      });
      return;
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Failed to refresh token',
        retryable: false,
      },
    });
  }
});

/**
 * ログインユーザーのイニシャルを取得（スプシのスタッフシートから）
 */
router.get('/my-initials', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ initials: null });
    }
    const token = authHeader.substring(7);
    const employee = await authService.validateSession(token);
    const email = employee?.email;
    if (!email) return res.json({ initials: null });

    // DBのinitialsカラムを確認
    const dbInitials = (employee as any)?.initials;
    if (dbInitials) return res.json({ initials: dbInitials });

    // スプシのスタッフシートからメールでイニシャルを取得
    const { StaffManagementService } = await import('../services/StaffManagementService');
    const staffService = new StaffManagementService();
    const initials = await staffService.getInitialsByEmail(email);
    res.json({ initials: initials || null });
  } catch (error) {
    console.error('Get my initials error:', error);
    res.json({ initials: null });
  }
});

export default router;
