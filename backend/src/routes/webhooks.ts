import express, { Request, Response } from 'express';
import { CalendarWebhookService, WebhookHeaders } from '../services/CalendarWebhookService';
import { CalendarSyncService } from '../services/CalendarSyncService';
import { GoogleAuthService } from '../services/GoogleAuthService';
import { supabase } from '../config/supabase';
import { DriveWatchService } from '../services/DriveWatchService';
import { PropertySheetSyncService } from '../services/PropertySheetSyncService';

const router = express.Router();
const webhookService = new CalendarWebhookService();
const syncService = new CalendarSyncService();
const authService = new GoogleAuthService();

/**
 * POST /api/webhooks/calendar
 * Google Calendarからのwebhook通知を受信
 */
router.post('/calendar', async (req: Request, res: Response) => {
  try {
    // ヘッダーを取得
    const headers: WebhookHeaders = {
      'x-goog-channel-id': req.headers['x-goog-channel-id'] as string,
      'x-goog-channel-token': req.headers['x-goog-channel-token'] as string,
      'x-goog-resource-id': req.headers['x-goog-resource-id'] as string,
      'x-goog-resource-state': req.headers['x-goog-resource-state'] as string,
      'x-goog-message-number': req.headers['x-goog-message-number'] as string,
    };

    console.log('📨 Webhook notification received:', {
      channelId: headers['x-goog-channel-id'],
      state: headers['x-goog-resource-state'],
      messageNumber: headers['x-goog-message-number'],
    });

    // 署名を検証
    const isValid = await webhookService.verifyWebhookSignature(headers);
    if (!isValid) {
      console.warn('⚠️ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // 非同期で処理（迅速に応答するため）
    setImmediate(async () => {
      try {
        await webhookService.handleWebhookNotification(headers, req.body);

        // exists状態の場合、同期を実行
        if (headers['x-goog-resource-state'] === 'exists') {
          // チャンネルIDから従業員IDを取得
          const { data: channel } = await supabase
            .from('calendar_webhook_channels')
            .select('employee_id')
            .eq('channel_id', headers['x-goog-channel-id'])
            .single();

          if (channel) {
            // OAuth2クライアントを取得して同期
            const oauth2Client = await authService.getAuthenticatedClient();
            await syncService.syncCalendarChanges(channel.employee_id, oauth2Client);
          }
        }
      } catch (error: any) {
        console.error('Error processing webhook notification:', error);
      }
    });

    // 迅速に200を返す
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook endpoint error:', error);

    if (error.message?.includes('Unknown webhook channel')) {
      return res.status(404).json({ error: 'Webhook channel not found' });
    }

    if (error.message?.includes('expired')) {
      return res.status(410).json({ error: 'Webhook channel expired' });
    }

    res.status(400).json({ error: 'Bad request' });
  }
});

// ─── Drive Webhook ──────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/drive
 *
 * Google Drive changes.watch からの push notification を受信する。
 *
 * ⑤ Vercel 実行時間対応：
 *   - 受信後に即座に 200 OK を返す
 *   - setImmediate で非同期処理（Calendar webhook と同じパターン）
 *   - 1ファイルの処理は約3〜5秒で完了するため 300秒制限に余裕
 *
 * ③ テスト環境限定モード：
 *   - 環境変数 DRIVE_SYNC_ENABLED=false の場合は処理しない
 *   - 環境変数 DRIVE_SYNC_TEST_ONLY=AA12345 のように設定すると指定物件のみ処理
 */
router.post('/drive', async (req: Request, res: Response) => {
  // Google は 200 を受け取れないと再送するため、即座に返す
  res.status(200).send('OK');

  // テスト環境フラグ確認
  if (process.env.DRIVE_SYNC_ENABLED === 'false') {
    console.log('[DriveWebhook] DRIVE_SYNC_ENABLED=false, skipping');
    return;
  }

  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceState = req.headers['x-goog-resource-state'] as string;
  const channelToken = req.headers['x-goog-channel-token'] as string | undefined;
  const messageNumber = req.headers['x-goog-message-number'] as string;

  console.log('[DriveWebhook] Received:', { channelId, resourceState, messageNumber });

  // "sync" は初回登録時の確認通知。処理不要。
  if (resourceState === 'sync') {
    console.log('[DriveWebhook] sync notification, skipping');
    return;
  }

  if (resourceState !== 'change' && resourceState !== 'exists') {
    console.log('[DriveWebhook] Unhandled resourceState:', resourceState);
    return;
  }

  setImmediate(async () => {
    try {
      const watchService = new DriveWatchService();
      const syncService = new PropertySheetSyncService();

      // トークン検証
      if (!watchService.verifyToken(channelToken)) {
        console.warn('[DriveWebhook] Invalid token, ignoring');
        return;
      }

      // 既知のチャンネルか確認
      const known = await watchService.isKnownChannel(channelId);
      if (!known) {
        console.warn('[DriveWebhook] Unknown channelId:', channelId);
        return;
      }

      // 変更されたスプレッドシートの一覧を取得
      const changedFiles = await watchService.getChangedSpreadsheets(channelId);
      if (changedFiles.length === 0) {
        console.log('[DriveWebhook] No qualifying spreadsheets changed');
        return;
      }

      // デバウンス: 30秒以内に同じファイルが pending ログにある場合はスキップ
      const debounceWindow = new Date(Date.now() - 30 * 1000).toISOString();

      for (const file of changedFiles) {
        // テスト物件番号フィルター
        const testOnly = process.env.DRIVE_SYNC_TEST_ONLY;
        if (testOnly) {
          // registry で物件番号を確認（まだ未登録なら処理する）
          const { data: reg } = await supabase
            .from('property_spreadsheet_registry')
            .select('property_number')
            .eq('file_id', file.fileId)
            .maybeSingle();
          if (reg?.property_number && reg.property_number !== testOnly) {
            console.log(`[DriveWebhook] DRIVE_SYNC_TEST_ONLY: skipping ${reg.property_number}`);
            continue;
          }
        }

        // デバウンス確認
        const { data: recentLogs } = await supabase
          .from('drive_sync_log')
          .select('id')
          .eq('file_id', file.fileId)
          .eq('status', 'pending')
          .gte('created_at', debounceWindow)
          .limit(1);

        if (recentLogs && recentLogs.length > 0) {
          console.log(`[DriveWebhook] Debounce: ${file.fileId} already pending`);
          continue;
        }

        // ログ作成して同期実行
        const logId = await syncService.createLog(file.fileId);
        await syncService.syncFile(file.fileId, file.spreadsheetUrl, logId);
      }

    } catch (err: any) {
      console.error('[DriveWebhook] Background processing error:', err.message);
    }
  });
});

export default router;
