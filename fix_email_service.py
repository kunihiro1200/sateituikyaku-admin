#!/usr/bin/env python3
# EmailService.supabase.ts に sendEmailWithCcAndAttachments メソッドを追加

with open('backend/src/services/EmailService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# クラスの末尾（最後の }）の直前に新メソッドを追加
# createMultipartMessage メソッドの後に追加する

new_method = '''
  /**
   * CC・添付ファイル付きメールを送信（レインズ登録ページ用）
   */
  async sendEmailWithCcAndAttachments(params: {
    to: string;
    cc?: string;
    subject: string;
    body: string;
    from: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailResult> {
    try {
      // GMAIL_REFRESH_TOKEN が未設定の場合、google_calendar_tokens からトークンを取得
      if (!process.env.GMAIL_REFRESH_TOKEN) {
        try {
          const { GoogleAuthService } = await import('./GoogleAuthService');
          const googleAuthService = new GoogleAuthService();
          const authenticatedClient = await googleAuthService.getAuthenticatedClient();
          this.oauth2Client = authenticatedClient;
        } catch (authError: any) {
          console.error('Failed to get authenticated client from GoogleAuthService:', authError);
          throw new Error('Gmail認証が設定されていません。Google連携を行ってください。');
        }
      }

      console.log('📧 Sending email with CC and attachments:');
      console.log(`  To: ${params.to}`);
      console.log(`  CC: ${params.cc || '(none)'}`);
      console.log(`  Subject: ${params.subject}`);
      console.log(`  From: ${params.from}`);
      console.log(`  Attachments: ${params.attachments?.length || 0}`);

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const boundary = '----=_Part_' + Date.now();
      const encodedSubject = this.encodeSubject(params.subject);

      const messageParts: string[] = [
        `From: ${params.from}`,
        `To: ${params.to}`,
      ];
      if (params.cc) {
        messageParts.push(`Cc: ${params.cc}`);
      }
      messageParts.push(
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
      );

      const attachments = params.attachments || [];

      if (attachments.length > 0) {
        // 添付ファイルあり: multipart/mixed
        messageParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        messageParts.push('');
        messageParts.push(`--${boundary}`);
        messageParts.push('Content-Type: text/plain; charset=utf-8');
        messageParts.push('Content-Transfer-Encoding: 8bit');
        messageParts.push('');
        messageParts.push(params.body);
        messageParts.push('');

        for (const attachment of attachments) {
          messageParts.push(`--${boundary}`);
          messageParts.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
          messageParts.push('Content-Transfer-Encoding: base64');
          messageParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
          messageParts.push('');
          const base64Data = attachment.data.toString('base64');
          const lines = base64Data.match(/.{1,76}/g) || [];
          messageParts.push(lines.join('\\r\\n'));
          messageParts.push('');
        }
        messageParts.push(`--${boundary}--`);
      } else {
        // 添付ファイルなし: text/plain
        messageParts.push('Content-Type: text/plain; charset=utf-8');
        messageParts.push('Content-Transfer-Encoding: 8bit');
        messageParts.push('');
        messageParts.push(params.body);
      }

      const message = messageParts.join('\\r\\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=+$/, '');

      const result = await retryGmailApi(async () => {
        return await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedMessage },
        });
      });

      const messageId = result.data.id || `sent-${Date.now()}`;
      console.log(`✅ Email with CC/attachments sent successfully: ${messageId}`);

      return { messageId, sentAt: new Date(), success: true };
    } catch (error) {
      console.error('sendEmailWithCcAndAttachments error:', error);
      return {
        messageId: '',
        sentAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
'''

# createMultipartMessage メソッドの後（クラスの閉じ括弧の直前）に追加
# クラスの最後の } を探して、その直前に挿入
# "export default router;" ではなく、クラスの末尾 "}" を探す

# EmailService クラスの末尾を探す
# ファイルの末尾付近の "}" を探す
last_brace_idx = text.rfind('\n}')
if last_brace_idx >= 0:
    # sendEmailWithCcAndAttachments がまだ存在しない場合のみ追加
    if 'sendEmailWithCcAndAttachments' not in text:
        text = text[:last_brace_idx] + new_method + text[last_brace_idx:]
        print('✅ sendEmailWithCcAndAttachments メソッドを追加しました')
    else:
        print('⚠️ sendEmailWithCcAndAttachments はすでに存在します')
else:
    print('❌ クラスの末尾が見つかりませんでした')

with open('backend/src/services/EmailService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
