"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailIntegrationHelper = exports.EmailIntegrationHelper = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * 査定依頼メールから売主を自動登録するヘルパー関数
 *
 * 既存のメールシステムから呼び出して、統合APIを通じて
 * SupabaseとGoogleスプレッドシートに売主を登録します。
 */
class EmailIntegrationHelper {
    constructor(baseUrl = process.env.API_BASE_URL || 'http://localhost:3000', maxRetries = 3, retryDelay = 1000) {
        this.baseUrl = baseUrl;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
    }
    /**
     * 査定依頼メールから売主を登録
     */
    async registerSellerFromEmail(emailData) {
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await axios_1.default.post(`${this.baseUrl}/api/integration/inquiry-email`, emailData, {
                    timeout: 30000, // 30秒タイムアウト
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                if (response.data.success) {
                    return {
                        success: true,
                        sellerId: response.data.data.sellerId,
                        sellerNumber: response.data.data.sellerNumber,
                    };
                }
                else {
                    return {
                        success: false,
                        error: response.data.error || 'Unknown error',
                    };
                }
            }
            catch (error) {
                lastError = error;
                console.error(`Email integration attempt ${attempt + 1} failed:`, error.message);
                // 最後の試行でない場合は待機してリトライ
                if (attempt < this.maxRetries - 1) {
                    await this.sleep(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
                }
            }
        }
        // すべてのリトライが失敗
        return {
            success: false,
            error: lastError?.message || 'Failed after multiple retries',
        };
    }
    /**
     * 複数の査定依頼メールを一括登録
     */
    async registerSellersFromEmails(emails) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/integration/inquiry-email/batch`, { emails }, {
                timeout: 60000, // 60秒タイムアウト
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data.error || 'Batch registration failed');
            }
        }
        catch (error) {
            console.error('Batch email integration failed:', error.message);
            return {
                successCount: 0,
                failureCount: emails.length,
                results: emails.map(() => ({
                    success: false,
                    error: error.message,
                })),
            };
        }
    }
    /**
     * 重複チェック
     */
    async checkDuplicates(phoneNumber, email) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/integration/check-duplicates`, { phoneNumber, email }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data.error || 'Duplicate check failed');
            }
        }
        catch (error) {
            console.error('Duplicate check failed:', error.message);
            return {
                hasDuplicates: false,
                matches: [],
            };
        }
    }
    /**
     * 待機
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.EmailIntegrationHelper = EmailIntegrationHelper;
// シングルトンインスタンスをエクスポート
exports.emailIntegrationHelper = new EmailIntegrationHelper();
