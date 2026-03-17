with open('backend/src/services/EmailService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# クラスの閉じ括弧の直前にメソッドを挿入
new_method = '''
  /**
   * 配信メールを複数受信者に送信（公開前・値下げメール配信用）
   */
  async sendDistributionEmail(params: {
    senderAddress: string;
    recipients: string[];
    subject: string;
    body: string;
    propertyNumber: string;
  }): Promise<{
    success: boolean;
    successCount: number;
    failedCount: number;
    totalCount: number;
    message: string;
  }> {
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

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const encodedSubject = this.encodeSubject(params.subject);

    let successCount = 0;
    let failedCount = 0;

    console.log(`📧 Sending distribution email to ${params.recipients.length} recipients`);
    console.log(`  From: ${params.senderAddress}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Property: ${params.propertyNumber}`);

    for (const recipient of params.recipients) {
      try {
        const messageParts = [
          `From: ${params.senderAddress}`,
          `To: ${recipient}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          params.body,
        ];

        const message = messageParts.join('\\r\\n');
        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\\+/g, '-')
          .replace(/\\//g, '_')
          .replace(/=+$/, '');

        await retryGmailApi(async () => {
          return await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage },
          });
        });

        successCount++;
        console.log(`  ✅ Sent to: ${recipient}`);
      } catch (error) {
        failedCount++;
        console.error(`  ❌ Failed to send to ${recipient}:`, error);
      }
    }

    const totalCount = params.recipients.length;
    const success = failedCount === 0;

    console.log(`📊 Distribution email result: ${successCount}/${totalCount} sent`);

    return {
      success,
      successCount,
      failedCount,
      totalCount,
      message: success
        ? `${successCount}件のメールを送信しました`
        : `${successCount}件送信成功、${failedCount}件失敗`,
    };
  }

'''

# クラスの最後の閉じ括弧の直前に挿入
old_ending = '\n}\n'
new_ending = new_method + '}\n'

if text.endswith(old_ending):
    text = text[:-len(old_ending)] + new_ending
    print('Inserted sendDistributionEmail method')
else:
    print('ERROR: Could not find class ending')
    print('Last 50 chars:', repr(text[-50:]))

with open('backend/src/services/EmailService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
