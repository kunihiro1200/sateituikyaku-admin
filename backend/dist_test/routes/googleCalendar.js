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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GoogleAuthService_1 = require("../services/GoogleAuthService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const googleAuthService = new GoogleAuthService_1.GoogleAuthService();
/**
 * Google Calendar OAuth認証を開始（会社アカウント用）
 * GET /api/auth/google/calendar
 * 認証不要 - 直接Googleカレンダー認証画面にリダイレクト
 */
router.get('/', async (_req, res) => {
    try {
        const authUrl = await googleAuthService.getAuthUrl();
        // JSONではなく、直接リダイレクト
        res.redirect(authUrl);
    }
    catch (error) {
        console.error('Get auth URL error:', error);
        res.status(500).json({
            error: {
                code: 'AUTH_URL_ERROR',
                message: error.message || 'Failed to generate authentication URL',
                retryable: false,
            },
        });
    }
});
/**
 * Google Calendar OAuth コールバック（認証不要）- 会社アカウント用
 * GET /api/auth/google/calendar/callback
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, error: oauthError } = req.query;
        // OAuth エラーチェック
        if (oauthError) {
            console.error('OAuth error:', oauthError);
            return res.send(`
        <html>
          <head><title>カレンダー接続エラー</title></head>
          <body>
            <h1>❌ カレンダー接続に失敗しました</h1>
            <p>エラー: ${oauthError}</p>
            <p><a href="/">トップページに戻る</a></p>
          </body>
        </html>
      `);
        }
        if (!code || typeof code !== 'string') {
            return res.send(`
        <html>
          <head><title>カレンダー接続エラー</title></head>
          <body>
            <h1>❌ カレンダー接続に失敗しました</h1>
            <p>認証コードが見つかりません</p>
            <p><a href="/">トップページに戻る</a></p>
          </body>
        </html>
      `);
        }
        // 認証コードをトークンに交換（会社アカウント用）
        await googleAuthService.exchangeCodeForTokens(code);
        // 成功時はフロントエンドの設定ページにリダイレクト
        const frontendUrl = process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app';
        res.redirect(`${frontendUrl}/settings?calendar_connected=true`);
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app';
        const errorMsg = encodeURIComponent(error.message || 'exchange_failed');
        res.redirect(`${frontendUrl}/settings?calendar_error=${errorMsg}`);
    }
});
/**
 * Google Calendar連携を解除（会社アカウント用）
 * POST /api/auth/google/calendar/revoke
 */
router.post('/revoke', auth_1.authenticate, async (_req, res) => {
    try {
        await googleAuthService.revokeAccess();
        res.json({ message: 'Google Calendar disconnected successfully' });
    }
    catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({
            error: {
                code: 'REVOKE_ERROR',
                message: 'Failed to disconnect Google Calendar',
                retryable: true,
            },
        });
    }
});
/**
 * Google Calendar接続状態を確認（会社アカウント用）
 * GET /api/auth/google/calendar/status
 */
router.get('/status', auth_1.authenticate, async (_req, res) => {
    try {
        const isConnected = await googleAuthService.isConnected();
        res.json({ connected: isConnected });
    }
    catch (error) {
        console.error('Check connection status error:', error);
        res.status(500).json({
            error: {
                code: 'STATUS_CHECK_ERROR',
                message: 'Failed to check connection status',
                retryable: true,
            },
        });
    }
});
/**
 * Webhookを登録
 * POST /api/auth/google/calendar/webhook/register
 */
router.post('/webhook/register', auth_1.authenticate, async (_req, res) => {
    try {
        const { CalendarWebhookService } = await Promise.resolve().then(() => __importStar(require('../services/CalendarWebhookService')));
        const webhookService = new CalendarWebhookService();
        const supabase = webhookService['supabase'];
        // OAuth2クライアントを取得
        const oauth2Client = await googleAuthService.getAuthenticatedClient();
        // 会社アカウントIDを取得
        const { data: admin } = await supabase
            .from('employees')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();
        if (!admin) {
            return res.status(400).json({ error: 'Company account not configured' });
        }
        // Webhookを登録
        const channel = await webhookService.registerWebhook(admin.id, oauth2Client);
        return res.json({
            message: 'Webhook registered successfully',
            channel: {
                id: channel.channel_id,
                expiration: channel.expiration,
            },
        });
    }
    catch (error) {
        console.error('Webhook registration error:', error);
        return res.status(500).json({
            error: {
                code: 'WEBHOOK_REGISTER_ERROR',
                message: error.message || 'Failed to register webhook',
                retryable: true,
            },
        });
    }
});
/**
 * Webhookを解除
 * POST /api/auth/google/calendar/webhook/unregister
 */
router.post('/webhook/unregister', auth_1.authenticate, async (_req, res) => {
    try {
        const { CalendarWebhookService } = await Promise.resolve().then(() => __importStar(require('../services/CalendarWebhookService')));
        const webhookService = new CalendarWebhookService();
        const supabase = webhookService['supabase'];
        // OAuth2クライアントを取得
        const oauth2Client = await googleAuthService.getAuthenticatedClient();
        // 会社アカウントIDを取得
        const { data: admin } = await supabase
            .from('employees')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();
        if (!admin) {
            return res.status(400).json({ error: 'Company account not configured' });
        }
        // 既存のWebhookを取得
        const channel = await webhookService.getWebhookByEmployeeId(admin.id);
        if (!channel) {
            return res.status(404).json({ error: 'No webhook found' });
        }
        // Webhookを解除
        await webhookService.unregisterWebhook(channel.channel_id, oauth2Client);
        return res.json({ message: 'Webhook unregistered successfully' });
    }
    catch (error) {
        console.error('Webhook unregistration error:', error);
        return res.status(500).json({
            error: {
                code: 'WEBHOOK_UNREGISTER_ERROR',
                message: error.message || 'Failed to unregister webhook',
                retryable: true,
            },
        });
    }
});
/**
 * Webhook状態を確認
 * GET /api/auth/google/calendar/webhook/status
 */
router.get('/webhook/status', auth_1.authenticate, async (_req, res) => {
    try {
        const { CalendarWebhookService } = await Promise.resolve().then(() => __importStar(require('../services/CalendarWebhookService')));
        const webhookService = new CalendarWebhookService();
        const supabase = webhookService['supabase'];
        // 会社アカウントIDを取得
        const { data: admin } = await supabase
            .from('employees')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();
        if (!admin) {
            return res.json({ registered: false });
        }
        // Webhookを取得
        const channel = await webhookService.getWebhookByEmployeeId(admin.id);
        if (!channel) {
            return res.json({ registered: false });
        }
        // 有効期限を確認
        const now = new Date();
        const expiration = new Date(channel.expiration);
        const isExpired = now > expiration;
        return res.json({
            registered: true,
            expired: isExpired,
            expiration: channel.expiration,
            channelId: channel.channel_id,
        });
    }
    catch (error) {
        console.error('Webhook status check error:', error);
        return res.status(500).json({
            error: {
                code: 'WEBHOOK_STATUS_ERROR',
                message: 'Failed to check webhook status',
                retryable: true,
            },
        });
    }
});
exports.default = router;
