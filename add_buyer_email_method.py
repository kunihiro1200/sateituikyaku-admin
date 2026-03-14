#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EmailServiceにsendBuyerEmailメソッドを追加するスクリプト"""

with open('backend/src/services/EmailService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 追加するメソッド（クラスの末尾の } の前に挿入）
new_method = '''
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
      // 改行を<br>タグに変換（HTMLメール用）
      const htmlBody = params.body.replace(/\\n/g, '<br>');

      const encodedSubject = /^[\\x00-\\x7F]*$/.test(params.subject)
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

      const message = messageParts.join('\\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
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
'''

# クラスの末尾の } の直前に挿入
last_brace = text.rfind('\n}')
if last_brace == -1:
    print('ERROR: Could not find closing brace')
    exit(1)

new_text = text[:last_brace] + new_method + text[last_brace:]

with open('backend/src/services/EmailService.ts', 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('Done! sendBuyerEmail method added to EmailService.ts')
