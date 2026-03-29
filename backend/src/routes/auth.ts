import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../services/AuthService';
import { authenticate } from '../middleware/auth';

const router = Router();
const authService = new AuthService();

// Google OAuth設定
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      // プロフィール情報を返す
      return done(null, profile);
    }
  )
);

/**
 * Google OAuth認証開始
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * Google OAuth コールバック
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
  async (req: Request, res: Response) => {
    try {
      const profile = req.user as any;
      
      console.log('📝 Google profile received:', {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
      });

      // Google認証後の処理
      const authResult = await authService.loginWithGoogle({
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
      });

      console.log('✅ Login successful for:', profile.emails[0].value);

      // フロントエンドにリダイレクト（トークンをクエリパラメータで渡す）
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/auth/callback?token=${authResult.sessionToken}&refresh=${authResult.refreshToken}`
      );
    } catch (error: any) {
      console.error('❌ Google callback error:', {
        message: error.message,
        stack: error.stack,
      });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

/**
 * ログアウト
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
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
 * トークンリフレッシュ
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
          retryable: false,
        },
      });
    }

    const authResult = await authService.refreshToken(refreshToken);

    res.json({
      sessionToken: authResult.sessionToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid refresh token',
        retryable: false,
      },
    });
  }
});

/**
 * 現在のユーザー情報取得
 */
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.employee);
});

/**
 * ログインユーザーのイニシャルを取得（スプシのスタッフシートから）
 */
router.get('/my-initials', authenticate, async (req: Request, res: Response) => {
  try {
    const email = req.employee?.email;
    if (!email) {
      return res.json({ initials: null });
    }
    // まずDBのinitialsカラムを確認
    const dbInitials = (req.employee as any)?.initials;
    if (dbInitials) {
      return res.json({ initials: dbInitials });
    }
    // DBにない場合はスプシのスタッフシートから取得
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
