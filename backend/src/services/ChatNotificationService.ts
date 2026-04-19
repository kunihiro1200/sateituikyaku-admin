import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ChatNotificationData {
  sellerNumber?: string;
  sellerName?: string;
  propertyAddress?: string;
  propertyType?: string;
  valuationAmount?: number;
  reason?: string;
  notes?: string;
  assignee?: string;
  callPageUrl?: string;
}

/**
 * Service for sending Google Chat notifications
 * Handles various notification types for seller management
 */
export class ChatNotificationService {
  private webhookUrl: string;
  private exclusiveWebhookUrl: string;

  constructor() {
    this.webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';
    this.exclusiveWebhookUrl = process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL || '';
  }

  /**
   * Send general contract notification
   * 
   * @param sellerId - Seller ID
   * @param data - Notification data
   * @returns Success status
   */
  async sendGeneralContractNotification(
    sellerId: string,
    data: ChatNotificationData
  ): Promise<boolean> {
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
    } catch (error) {
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
  async sendExclusiveContractNotification(
    sellerId: string,
    data: ChatNotificationData
  ): Promise<boolean> {
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
    } catch (error) {
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
  async sendPostVisitOtherDecisionNotification(
    sellerId: string,
    data: ChatNotificationData
  ): Promise<boolean> {
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
    } catch (error) {
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
  async sendPreVisitOtherDecisionNotification(
    sellerId: string,
    data: ChatNotificationData
  ): Promise<boolean> {
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
    } catch (error) {
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
  async sendPropertyIntroductionNotification(
    sellerId: string,
    introduction: string
  ): Promise<boolean> {
    try {
      const seller = await this.getSellerInfo(sellerId);
      
      const message = this.formatPropertyIntroductionMessage({
        sellerNumber: seller.seller_number,
        propertyAddress: seller.property_address,
        propertyType: seller.property_type,
        notes: introduction,
      });

      return await this.sendToGoogleChat(message);
    } catch (error) {
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
  private async getSellerInfo(sellerId: string): Promise<any> {
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
      try { return decrypt(data.name); } catch { return data.name; }
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
  private formatGeneralContractMessage(data: ChatNotificationData): string {
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
  private formatExclusiveContractMessage(data: ChatNotificationData): string {
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
  private formatPostVisitOtherDecisionMessage(data: ChatNotificationData): string {
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
  private formatPreVisitOtherDecisionMessage(data: ChatNotificationData): string {
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
  private formatPropertyIntroductionMessage(data: ChatNotificationData): string {
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
  private async sendToGoogleChat(message: string, webhookUrl?: string): Promise<boolean> {
    const url = webhookUrl || this.webhookUrl;
    if (!url) {
      throw new Error('Google Chat webhook URL is not configured');
    }

    console.log('[ChatNotificationService] Sending to URL:', url.substring(0, 60) + '...');

    const response = await axios.post(url, {
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
  isConfigured(): boolean {
    return !!this.webhookUrl;
  }
}

// Export singleton instance
// Note: インスタンスはリクエスト時に環境変数を読み込む
export const chatNotificationService = new ChatNotificationService();
