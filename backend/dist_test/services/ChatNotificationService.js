"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatNotificationService = exports.ChatNotificationService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
const encryption_1 = require("../utils/encryption");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
/**
 * Service for sending Google Chat notifications
 * Handles various notification types for seller management
 */
class ChatNotificationService {
    constructor() {
        // 改行・スペース・制御文字を除去してURLをクリーンにする
        const rawWebhookUrl = (process.env.GOOGLE_CHAT_WEBHOOK_URL || '').replace(/[\r\n\s]/g, '');
        const rawExclusiveUrl = (process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL || '').replace(/[\r\n\s]/g, '');
        // 値が変数名そのものになっている場合（Vercel設定ミス）は空文字として扱う
        this.webhookUrl = rawWebhookUrl.startsWith('http') ? rawWebhookUrl : '';
        this.exclusiveWebhookUrl = rawExclusiveUrl.startsWith('http') ? rawExclusiveUrl : '';
        console.log('[ChatNotificationService] webhookUrl configured:', !!this.webhookUrl);
        console.log('[ChatNotificationService] exclusiveWebhookUrl configured:', !!this.exclusiveWebhookUrl);
    }
    /**
     * Send general contract notification
     *
     * @param sellerId - Seller ID
     * @param data - Notification data
     * @returns Success status
     */
    async sendGeneralContractNotification(sellerId, data) {
        try {
            const seller = await this.getSellerInfo(sellerId);
            const message = this.formatGeneralContractMessage({
                ...data,
                assignee: data.assignee || seller.visit_assignee,
                sellerNumber: seller.seller_number,
                sellerName: seller.name,
                propertyAddress: seller.property_address,
                callPageUrl: seller.call_page_url,
            });
            return await this.sendToGoogleChat(message);
        }
        catch (error) {
            console.error('Send general contract notification error:', error);
            throw error;
        }
    }
    /**
     * Send exclusive contract notification
     *
     * @param sellerId - Seller ID
     * @param data - Notification data
     * @returns Success status
     */
    async sendExclusiveContractNotification(sellerId, data) {
        try {
            if (!this.exclusiveWebhookUrl) {
                throw new Error('GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL is not configured');
            }
            const seller = await this.getSellerInfo(sellerId);
            const message = this.formatExclusiveContractMessage({
                ...data,
                assignee: data.assignee || seller.visit_assignee,
                sellerNumber: seller.seller_number,
                sellerName: seller.name,
                propertyAddress: seller.property_address,
                valuationAmount: seller.valuation_amount_2,
                callPageUrl: seller.call_page_url,
            });
            return await this.sendToGoogleChat(message, this.exclusiveWebhookUrl);
        }
        catch (error) {
            console.error('Send exclusive contract notification error:', error);
            throw error;
        }
    }
    /**
     * Send post-visit other decision notification (sales only)
     *
     * @param sellerId - Seller ID
     * @param data - Notification data
     * @returns Success status
     */
    async sendPostVisitOtherDecisionNotification(sellerId, data) {
        try {
            const seller = await this.getSellerInfo(sellerId);
            const message = this.formatPostVisitOtherDecisionMessage({
                ...data,
                assignee: data.assignee || seller.visit_assignee,
                sellerNumber: seller.seller_number,
                sellerName: seller.name,
                propertyAddress: seller.property_address,
                reason: data.reason || seller.exclusive_other_decision_factor,
                callPageUrl: seller.call_page_url,
            });
            return await this.sendToGoogleChat(message);
        }
        catch (error) {
            console.error('Send post-visit other decision notification error:', error);
            throw error;
        }
    }
    /**
     * Send pre-visit other decision notification
     *
     * @param sellerId - Seller ID
     * @param data - Notification data
     * @returns Success status
     */
    async sendPreVisitOtherDecisionNotification(sellerId, data) {
        try {
            const seller = await this.getSellerInfo(sellerId);
            const message = this.formatPreVisitOtherDecisionMessage({
                ...data,
                assignee: data.assignee || seller.visit_assignee,
                sellerNumber: seller.seller_number,
                sellerName: seller.name,
                propertyAddress: seller.property_address,
                reason: data.reason || seller.exclusive_other_decision_factor,
                callPageUrl: seller.call_page_url,
            });
            return await this.sendToGoogleChat(message);
        }
        catch (error) {
            console.error('Send pre-visit other decision notification error:', error);
            throw error;
        }
    }
    /**
     * Send property introduction notification
     *
     * @param sellerId - Seller ID
     * @param introduction - Property introduction text
     * @returns Success status
     */
    async sendPropertyIntroductionNotification(sellerId, introduction) {
        try {
            const seller = await this.getSellerInfo(sellerId);
            const message = this.formatPropertyIntroductionMessage({
                sellerNumber: seller.seller_number,
                propertyAddress: seller.property_address,
                propertyType: seller.property_type,
                notes: introduction,
            });
            return await this.sendToGoogleChat(message);
        }
        catch (error) {
            console.error('Send property introduction notification error:', error);
            throw error;
        }
    }
    /**
     * Get seller information from database
     *
     * @param sellerId - Seller ID
     * @returns Seller information
     */
    async getSellerInfo(sellerId) {
        const { data, error } = await supabase
            .from('sellers')
            .select(`
        seller_number,
        name,
        property_address,
        property_type,
        valuation_amount_2,
        exclusive_other_decision_factor,
        visit_assignee
      `)
            .eq('id', sellerId)
            .single();
        if (error) {
            throw new Error(`Failed to get seller info: ${error.message}`);
        }
        // 売主名を復号する
        const decryptedName = data.name ? (() => {
            try {
                return (0, encryption_1.decrypt)(data.name);
            }
            catch {
                return data.name;
            }
        })() : '';
        const frontendBaseUrl = 'https://sateituikyaku-admin-frontend.vercel.app';
        return {
            seller_number: data.seller_number,
            name: decryptedName,
            valuation_amount_2: data.valuation_amount_2,
            exclusive_other_decision_factor: data.exclusive_other_decision_factor,
            property_address: data.property_address,
            property_type: data.property_type,
            visit_assignee: data.visit_assignee,
            call_page_url: `${frontendBaseUrl}/sellers/${data.seller_number}/call`,
        };
    }
    /**
     * Format general contract message
     */
    formatGeneralContractMessage(data) {
        return `
📋 *一般媒介契約*

売主番号: ${data.sellerNumber}
売主名: ${data.sellerName}
物件所在地: ${data.propertyAddress}
担当者: ${data.assignee || '未設定'}

一般媒介契約が締結されました。
${data.notes ? `\n備考: ${data.notes}` : ''}
${data.callPageUrl ? `\n🔗 ${data.callPageUrl}` : ''}
    `.trim();
    }
    /**
     * Format exclusive contract message
     */
    formatExclusiveContractMessage(data) {
        return `
🎉 *専任媒介契約取得*

売主番号: ${data.sellerNumber}
売主名: ${data.sellerName}
物件所在地: ${data.propertyAddress}
査定額: ${data.valuationAmount ? `¥${data.valuationAmount.toLocaleString()}` : '未設定'}
担当者: ${data.assignee || '未設定'}

専任媒介契約を取得しました！
${data.notes ? `\n備考: ${data.notes}` : ''}
${data.callPageUrl ? `\n🔗 ${data.callPageUrl}` : ''}
    `.trim();
    }
    /**
     * Format post-visit other decision message
     */
    formatPostVisitOtherDecisionMessage(data) {
        return `
⚠️ *訪問後他決*

売主番号: ${data.sellerNumber}
売主名: ${data.sellerName}
物件所在地: ${data.propertyAddress}
他決要因: ${data.reason || '未記入'}
担当者: ${data.assignee || '未設定'}

訪問査定後に他決となりました。
${data.notes ? `\n対策: ${data.notes}` : ''}
${data.callPageUrl ? `\n🔗 ${data.callPageUrl}` : ''}
    `.trim();
    }
    /**
     * Format pre-visit other decision message
     */
    formatPreVisitOtherDecisionMessage(data) {
        return `
ℹ️ *未訪問他決*

売主番号: ${data.sellerNumber}
売主名: ${data.sellerName}
物件所在地: ${data.propertyAddress}
他決要因: ${data.reason || '未記入'}

訪問前に他決となりました。
${data.notes ? `\n備考: ${data.notes}` : ''}
${data.callPageUrl ? `\n🔗 ${data.callPageUrl}` : ''}
    `.trim();
    }
    /**
     * Format property introduction message
     */
    formatPropertyIntroductionMessage(data) {
        return `
🏠 *物件紹介*

売主番号: ${data.sellerNumber}
物件所在地: ${data.propertyAddress}
物件種別: ${data.propertyType || '未設定'}

${data.notes || '物件紹介文が入力されていません'}
    `.trim();
    }
    /**
     * Send message to Google Chat
     *
     * @param message - Message text
     * @returns Success status
     */
    async sendToGoogleChat(message, webhookUrl) {
        const url = (webhookUrl || this.webhookUrl).replace(/[\r\n\s]/g, '');
        if (!url) {
            throw new Error('Google Chat webhook URL is not configured');
        }
        console.log('[ChatNotificationService] Sending to URL:', url.substring(0, 60) + '...');
        const response = await axios_1.default.post(url, {
            text: message,
        });
        if (response.status !== 200) {
            throw new Error(`Google Chat returned status ${response.status}`);
        }
        return true;
    }
    /**
     * Validate webhook URL configuration
     *
     * @returns true if webhook URL is configured
     */
    isConfigured() {
        return !!this.webhookUrl;
    }
}
exports.ChatNotificationService = ChatNotificationService;
// Export singleton instance
// Note: インスタンスはリクエスト時に環境変数を読み込む
exports.chatNotificationService = new ChatNotificationService();
