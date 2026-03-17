import { google } from 'googleapis';
import { GoogleAuthService } from './GoogleAuthService';
import { BaseRepository } from '../repositories/BaseRepository';

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
}

/**
 * Gmail APIを使用してメールを送信するサービス
 * 会社アカウント（tenant@ifoo-oita.com）のOAuth2トークンを使用
 */
export class EmailService extends BaseRepository {
  private googleAuthService: GoogleAuthService;

  constructor() {
    super();
    this.googleAuthService = new GoogleAuthService();
  }

  /**
   * メールを送信する
   * @param options 送信オプション（宛先、件名、本文）
   */
  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, body } = options;

    if (!to || to.length === 0) {
      console.warn('[EmailService] No recipients specified, skipping email send');
      return;
    }

    // 有効なメールアドレスのみフィルタリング
    const validRecipients = to.filter(email => email && email.includes('@'));
    if (validRecipients.length === 0) {
      console.warn('[EmailService] No valid email addresses found, skipping email send');
      return;
    }

    try {
      const authClient = await this.googleAuthService.getAuthenticatedClient();
      const gmail = google.gmail({ version: 'v1', auth: authClient });

      // RFC 2822形式のメールを作成
      const toHeader = validRecipients.join(', ');
      const rawMessage = [
        `To: ${toHeader}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body).toString('base64'),
      ].join('\r\n');

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`[EmailService] Email sent successfully to: ${toHeader}`);
    } catch (error: any) {
      // メール送信失敗はカレンダー登録の成功に影響させない（ログのみ）
      console.error('[EmailService] Failed to send email:', {
        to: validRecipients,
        subject,
        error: error.message,
      });
      throw error;
    }
  }
  /**
   * 買主へのメール送信（HTML対応、改行を<br>に変換）
   */
  async sendBuyerEmail(params: {
    to: string;
    subject: string;
    body: string;
    from?: string;
  }): Promise<{ messageId: string; success: boolean; error?: string }> {
    try {
      const authClient = await this.googleAuthService.getAuthenticatedClient();
      const gmail = google.gmail({ version: 'v1', auth: authClient });

      const from = params.from || 'tenant@ifoo-oita.com';
      // URLを<a>タグに変換してからHTMLエスケープ・改行変換
      const urlToLink = (text: string): string =>
        text.replace(/(https?:\/\/[^\s\u3000\u3001\u3002\uff01\uff09\u300d\u300f\u3011\u3015\u3017\u3019\u301b\u301f\uff3d\uff5d\u300b\u300f]+)/g,
          (url) => `<a href="${url}">${url}</a>`);
      const htmlBody = urlToLink(params.body).replace(/\n/g, '<br>');

      const encodedSubject = /^[\x00-\x7F]*$/.test(params.subject)
        ? params.subject
        : `=?UTF-8?B?${Buffer.from(params.subject, 'utf-8').toString('base64')}?=`;

      const messageParts = [
        `From: ${from}`,
        `To: ${params.to}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        htmlBody,
      ];

      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      console.log(`[EmailService] Buyer email sent successfully to: ${params.to}`);
      return { messageId: response.data.id || '', success: true };
    } catch (error: any) {
      console.error('[EmailService] Failed to send buyer email:', {
        to: params.to,
        subject: params.subject,
        error: error.message,
      });
      return { messageId: '', success: false, error: error.message };
    }
  }

}
