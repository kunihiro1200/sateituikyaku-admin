import axios, { AxiosError } from 'axios';

/**
 * Google Chatメッセージの構造
 */
interface GoogleChatMessage {
  text: string;
}

/**
 * メッセージ送信結果
 */
export interface SendMessageResult {
  success: boolean;
  error?: string;
}

/**
 * Google Chat Webhook APIへのメッセージ送信を担当するサービス
 */
export class GoogleChatService {
  private readonly timeout: number = 10000; // 10秒

  /**
   * Google ChatにメッセージをPOST
   */
  async sendMessage(webhookUrl: string, message: string): Promise<SendMessageResult> {
    try {
      if (!webhookUrl || !this.isValidWebhookUrl(webhookUrl)) {
        return { success: false, error: '無効なWebhook URLです' };
      }

      if (!message || message.trim().length === 0) {
        return { success: false, error: 'メッセージが空です' };
      }

      const payload: GoogleChatMessage = { text: message };

      const response = await axios.post(webhookUrl, payload, {
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
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.protocol === 'https:' &&
        parsedUrl.hostname === 'chat.googleapis.com' &&
        parsedUrl.pathname.startsWith('/v1/spaces/')
      );
    } catch {
      return false;
    }
  }

  private handleError(error: any): SendMessageResult {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

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
