"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const AuthService_1 = require("../services/AuthService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const authService = new AuthService_1.AuthService();
// Google OAuth設定
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
    // プロフィール情報を返す
    return done(null, profile);
}));
/**
 * Google OAuth認証開始
 */
router.get('/google', passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
}));
/**
 * Google OAuth コールバック
 */
router.get('/google/callback', passport_1.default.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }), async (req, res) => {
    try {
        const profile = req.user;
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
        res.redirect(`${frontendUrl}/auth/callback?token=${authResult.sessionToken}&refresh=${authResult.refreshToken}`);
    }
    catch (error) {
        console.error('❌ Google callback error:', {
            message: error.message,
            stack: error.stack,
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
});
/**
 * ログアウト
 */
router.post('/logout', auth_1.authenticate, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            await authService.logout(token);
        }
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
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
router.post('/refresh', async (req, res) => {
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
    }
    catch (error) {
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
router.get('/me', auth_1.authenticate, (req, res) => {
    res.json(req.employee);
});
/**
 * ログインユーザーのイニシャルを取得（スプシのスタッフシートから）
 */
router.get('/my-initials', auth_1.authenticate, async (req, res) => {
    try {
        const email = req.employee?.email;
        if (!email) {
            return res.json({ initials: null });
        }
        // まずDBのinitialsカラムを確認
        const dbInitials = req.employee?.initials;
        if (dbInitials) {
            return res.json({ initials: dbInitials });
        }
        // DBにない場合はスプシのスタッフシートから取得
        const { StaffManagementService } = await Promise.resolve().then(() => __importStar(require('../services/StaffManagementService')));
        const staffService = new StaffManagementService();
        const initials = await staffService.getInitialsByEmail(email);
        res.json({ initials: initials || null });
    }
    catch (error) {
        console.error('Get my initials error:', error);
        res.json({ initials: null });
    }
});
exports.default = router;
