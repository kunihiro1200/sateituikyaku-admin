import axios from 'axios';

/**
 * Twilio SMS送信サービス（axios経由でREST APIを直接呼び出し）
 *
 * 環境変数:
 * - TWILIO_ACCOUNT_SID: TwilioアカウントID
 * - TWILIO_AUTH_TOKEN: Twilio認証トークン
 * - TWILIO_PHONE_NUMBER: Twilio電話番号（送信元）
 */
export class TwilioSmsService {
  private accountSid: string;
  private authToken: string;
  private fromPhoneNumber: string;
  private configured: boolean;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.accountSid || !this.authToken || !this.fromPhoneNumber) {
      console.warn('Twilio credentials not configured. SMS sending will be disabled.');
      this.configured = false;
    } else {
      console.log('Twilio SMS Service initialized successfully');
      this.configured = true;
    }
  }

  /**
   * 単一のSMSを送信
   */
  async sendSms(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.configured) {
      return {
        success: false,
        error: 'Twilio client not initialized. Please check your credentials.',
      };
    }

    try {
      const formattedTo = this.formatPhoneNumber(to);

      // Twilio REST API を axios で直接呼び出し
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        new URLSearchParams({
          Body: message,
          From: this.fromPhoneNumber,
          To: formattedTo,
        }),
        {
          auth: {
            username: this.accountSid,
            password: this.authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        success: true,
        messageId: response.data.sid,
      };
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to send SMS',
      };
    }
  }

  /**
   * 複数のSMSを一括送信
   */
  async sendBulkSms(
    recipients: Array<{ phoneNumber: string; message: string }>
  ): Promise<{
    successCount: number;
    failedCount: number;
    results: Array<{ phoneNumber: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    if (!this.configured) {
      return {
        successCount: 0,
        failedCount: recipients.length,
        results: recipients.map(r => ({
          phoneNumber: r.phoneNumber,
          success: false,
          error: 'Twilio client not initialized',
        })),
      };
    }

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const result = await this.sendSms(recipient.phoneNumber, recipient.message);
        return {
          phoneNumber: recipient.phoneNumber,
          ...result,
        };
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - successCount;

    return {
      successCount,
      failedCount,
      results: results.map(r => r.status === 'fulfilled' ? r.value : {
        phoneNumber: '',
        success: false,
        error: 'Promise rejected',
      }),
    };
  }

  /**
   * 電話番号を国際フォーマットに変換
   * 日本の電話番号の場合は+81形式に変換
   */
  private formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/[-\s]/g, '');

    if (cleaned.startsWith('+81')) {
      return cleaned;
    }

    if (cleaned.startsWith('0')) {
      return '+81' + cleaned.substring(1);
    }

    return '+81' + cleaned;
  }

  /**
   * Twilioクライアントが初期化されているか確認
   */
  isConfigured(): boolean {
    return this.configured;
  }
}

// シングルトンインスタンス
export const twilioSmsService = new TwilioSmsService();
