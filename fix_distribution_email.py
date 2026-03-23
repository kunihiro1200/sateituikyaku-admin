#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GmailDistributionButtonに画像添付機能を追加するスクリプト
1. backend/src/services/EmailService.supabase.ts - sendDistributionEmailに添付対応
2. backend/src/routes/emails.ts - /send-distributionエンドポイントに添付対応
3. frontend/frontend/src/components/DistributionConfirmationModal.tsx - 画像添付UI追加
4. frontend/frontend/src/components/GmailDistributionButton.tsx - 状態管理追加
"""

import os

# ============================================================
# 1. EmailService.supabase.ts - sendDistributionEmailに添付対応
# ============================================================
email_service_path = 'backend/src/services/EmailService.supabase.ts'
with open(email_service_path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

old_method = '''  async sendDistributionEmail(params: {
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
  }'''

new_method = '''  async sendDistributionEmail(params: {
    senderAddress: string;
    recipients: string[];
    subject: string;
    body: string;
    propertyNumber: string;
    attachments?: Array<{
      filename: string;
      mimeType: string;
      data: Buffer;
    }>;
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
    const hasAttachments = params.attachments && params.attachments.length > 0;

    let successCount = 0;
    let failedCount = 0;

    console.log(`📧 Sending distribution email to ${params.recipients.length} recipients`);
    console.log(`  From: ${params.senderAddress}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Property: ${params.propertyNumber}`);
    if (hasAttachments) {
      console.log(`  Attachments: ${params.attachments!.length} files`);
    }

    for (const recipient of params.recipients) {
      try {
        let encodedMessage: string;

        if (hasAttachments) {
          // MIMEマルチパートメッセージを構築
          const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const messageParts = [
            `From: ${params.senderAddress}`,
            `To: ${recipient}`,
            `Subject: ${encodedSubject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            params.body,
          ];

          for (const attachment of params.attachments!) {
            const base64Data = attachment.data.toString('base64');
            messageParts.push(
              `--${boundary}`,
              `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
              'Content-Transfer-Encoding: base64',
              `Content-Disposition: attachment; filename="${attachment.filename}"`,
              '',
              base64Data,
            );
          }
          messageParts.push(`--${boundary}--`);

          const message = messageParts.join('\\r\\n');
          encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\\+/g, '-')
            .replace(/\\//g, '_')
            .replace(/=+$/, '');
        } else {
          // 添付なし（既存ロジック）
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
          encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\\+/g, '-')
            .replace(/\\//g, '_')
            .replace(/=+$/, '');
        }

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
  }'''

if old_method in content:
    content = content.replace(old_method, new_method)
    with open(email_service_path, 'wb') as f:
        f.write(content.encode('utf-8'))
    print(f'✅ {email_service_path} updated')
else:
    print(f'❌ Could not find target in {email_service_path}')

# ============================================================
# 2. emails.ts - /send-distributionエンドポイントに添付対応
# ============================================================
emails_route_path = 'backend/src/routes/emails.ts'
with open(emails_route_path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\n', '\n')

old_route = '''      const { senderAddress, recipients, subject, body, propertyNumber } = req.body;

      // 送信元アドレスのホワイトリスト検証
      const validSenders = [
        'tenant@ifoo-oita.com',
        'gyosha@ifoo-oita.com',
        'info@ifoo-oita.com',
      ];

      if (!validSenders.includes(senderAddress)) {
        return res.status(400).json({
          success: false,
          message: '無効な送信元アドレスです',
        });
      }

      // EmailServiceを使用してメールを送信
      const result = await emailService.sendDistributionEmail({
        senderAddress,
        recipients,
        subject,
        body,
        propertyNumber: propertyNumber || 'unknown',
      });'''

new_route = '''      const { senderAddress, recipients, subject, body, propertyNumber, attachments } = req.body;

      // 送信元アドレスのホワイトリスト検証
      const validSenders = [
        'tenant@ifoo-oita.com',
        'gyosha@ifoo-oita.com',
        'info@ifoo-oita.com',
      ];

      if (!validSenders.includes(senderAddress)) {
        return res.status(400).json({
          success: false,
          message: '無効な送信元アドレスです',
        });
      }

      // 添付ファイルの処理（画像データをBufferに変換）
      let processedAttachments: Array<{ filename: string; mimeType: string; data: Buffer }> | undefined;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const { GoogleDriveService } = await import('../services/GoogleDriveService');
        const driveService = new GoogleDriveService();

        const attachmentsRaw = await Promise.all(
          attachments.map(async (img: any) => {
            // ローカルファイル（Base64データ）
            if (img.base64Data) {
              return {
                filename: img.name || 'attachment.jpg',
                mimeType: img.mimeType || 'image/jpeg',
                data: Buffer.from(img.base64Data, 'base64'),
              };
            }
            // URL指定
            if (img.url) {
              try {
                const https = await import('https');
                const http = await import('http');
                const data = await new Promise<Buffer>((resolve, reject) => {
                  const client = img.url.startsWith('https') ? https : http;
                  (client as any).get(img.url, (res: any) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                  }).on('error', reject);
                });
                return {
                  filename: img.name || 'attachment.jpg',
                  mimeType: 'image/jpeg',
                  data,
                };
              } catch (urlErr) {
                console.warn(`⚠️ Could not fetch image from URL: ${img.url}`, urlErr);
                return null;
              }
            }
            // Google Drive ファイル
            const fileData = await driveService.getFile(img.id);
            if (!fileData) {
              console.warn(`⚠️ Could not fetch file from Google Drive: ${img.id}`);
              return null;
            }
            return {
              filename: img.name || `image-${img.id}.jpg`,
              mimeType: fileData.mimeType || 'image/jpeg',
              data: fileData.data,
            };
          })
        );
        processedAttachments = attachmentsRaw.filter((a): a is NonNullable<typeof a> => a !== null);
      }

      // EmailServiceを使用してメールを送信
      const result = await emailService.sendDistributionEmail({
        senderAddress,
        recipients,
        subject,
        body,
        propertyNumber: propertyNumber || 'unknown',
        attachments: processedAttachments,
      });'''

if old_route in content:
    content = content.replace(old_route, new_route)
    with open(emails_route_path, 'wb') as f:
        f.write(content.encode('utf-8'))
    print(f'✅ {emails_route_path} updated')
else:
    print(f'❌ Could not find target in {emails_route_path}')

print('Backend files done.')
