"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleChatService = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Google Chat Webhook APIへのメッセージ送信を担当するサービス
 */
class GoogleChatService {
    constructor() {
        this.timeout = 10000; // 10秒
    }
    /**
     * Google ChatにメッセージをPOST
     */
    async sendMessage(webhookUrl, message) {
        try {
            if (!webhookUrl || !this.isValidWebhookUrl(webhookUrl)) {
                return { success: false, error: '無効なWebhook URLです' };
            }
            if (!message || message.trim().length === 0) {
                return { success: false, error: 'メッセージが空です' };
            }
            const payload = { text: message };
            const response = await axios_1.default.post(webhookUrl, payload, {
                timeout: this.timeout,
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.status >= 200 && response.status < 300) {
                console.log('[GoogleChatService] Message sent successfully:', {
                    status: response.status,
                    timestamp: new Date().toISOString(),
                });
                return { success: true };
            }
            return { success: false, error: `予期しないレスポンス: ${response.status}` };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    isValidWebhookUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return (parsedUrl.protocol === 'https:' &&
                parsedUrl.hostname === 'chat.googleapis.com' &&
                parsedUrl.pathname.startsWith('/v1/spaces/'));
        }
        catch {
            return false;
        }
    }
    handleError(error) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
                console.error('[GoogleChatService] Timeout error:', { error: axiosError.message });
                return { success: false, error: 'メッセージの送信がタイムアウトしました' };
            }
            if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
                console.error('[GoogleChatService] Network error:', { code: axiosError.code });
                return { success: false, error: 'ネットワークエラーが発生しました' };
            }
            if (axiosError.response) {
                const status = axiosError.response.status;
                const statusText = axiosError.response.statusText;
                console.error('[GoogleChatService] HTTP error:', { status, statusText });
                if (status >= 400 && status < 500) {
                    return { success: false, error: `メッセージの送信に失敗しました: ${statusText} (${status})` };
                }
                if (status >= 500) {
                    return { success: false, error: `Google Chatサーバーエラー: ${statusText} (${status})` };
                }
            }
            return { success: false, error: `メッセージの送信に失敗しました: ${axiosError.message}` };
        }
        console.error('[GoogleChatService] Unexpected error:', { error: error.message || error });
        return { success: false, error: `予期しないエラーが発生しました: ${error.message || error}` };
    }
}
exports.GoogleChatService = GoogleChatService;
