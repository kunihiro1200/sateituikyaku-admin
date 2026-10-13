/**
 * DriveWatchService
 *
 * Google Drive API の changes.watch を使い、
 * 物件別スプレッドシートの変更をリアルタイムで検知する。
 *
 * 管理するもの：
 *   - 通常フォルダ（my_drive）: folderID = 1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F
 *   - 共有ドライブ            : driveID  = 0AJd1KlohTQaTUk9PVA
 *
 * 有効期限は最大7日のため、vercel.json の cron で6日ごとに更新する。
 */

import { google, drive_v3 } from 'googleapis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// ───── 定数 ─────────────────────────────────────────────────────────────────

/** 業務依頼フォルダID（通常Drive） */
export const GYOMU_FOLDER_ID = '1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F';

/** 共有ドライブID */
export const SHARED_DRIVE_ID = '0AJd1KlohTQaTUk9PVA';

/** 業務依頼集計表のスプレッドシートID（変更通知対象から除外する） */
export const MASTER_SHEET_ID = '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g';

/** drive_watch_state テーブルの drive_id 値 */
export const MY_DRIVE_ID = 'my_drive';

/** 変更通知を受け取る Webhook URL（環境変数から） */
function getWebhookUrl(): string {
  const base = process.env.WEBHOOK_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  return `${base}/api/webhooks/drive`;
}

// ───── 型定義 ────────────────────────────────────────────────────────────────

export interface ChangedFile {
  fileId: string;
  fileName: string;
  driveId: string | null;  // null = 通常Drive
  spreadsheetUrl: string;
}

export interface WatchState {
  drive_id: string;
  page_token: string | null;
  channel_id: string | null;
  resource_id: string | null;
  expiration_at: string | null;
}

// ───── サービス ──────────────────────────────────────────────────────────────

export class DriveWatchService {
  private supabase: SupabaseClient;
  private drive: drive_v3.Drive | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  // ─── Google Drive APIクライアント初期化（WorkTaskSyncService と同じ認証フロー） ───

  private async initDrive(): Promise<drive_v3.Drive> {
    if (this.drive) return this.drive;

    const scopes = ['https://www.googleapis.com/auth/drive'];

    // 1. GOOGLE_SERVICE_ACCOUNT_JSON
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        let jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        let keyFile: any;
        try {
          keyFile = JSON.parse(jsonString);
        } catch {
          keyFile = JSON.parse(Buffer.from(jsonString, 'base64').toString('utf8'));
        }
        if (keyFile.private_key && !keyFile.private_key.includes('\n')) {
          keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
        }
        const auth = new google.auth.JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes,
        });
        await auth.authorize();
        this.drive = google.drive({ version: 'v3', auth });
        console.log('[DriveWatchService] Auth via GOOGLE_SERVICE_ACCOUNT_JSON');
        return this.drive;
      } catch (e: any) {
        console.error('[DriveWatchService] JSON auth failed:', e.message);
      }
    }

    // 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes,
        });
        await auth.authorize();
        this.drive = google.drive({ version: 'v3', auth });
        console.log('[DriveWatchService] Auth via EMAIL + PRIVATE_KEY');
        return this.drive;
      } catch (e: any) {
        console.error('[DriveWatchService] EMAIL+KEY auth failed:', e.message);
      }
    }

    // 3. ローカルファイル
    const fs = require('fs');
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json';
    if (fs.existsSync(keyFilePath)) {
      const auth = new google.auth.GoogleAuth({ keyFile: keyFilePath, scopes });
      this.drive = google.drive({ version: 'v3', auth });
      console.log('[DriveWatchService] Auth via keyFile');
      return this.drive;
    }

    throw new Error('[DriveWatchService] No Google auth credentials found');
  }

  // ─── watchチャンネル登録 ─────────────────────────────────────────────────

  /**
   * 通常Drive（my_drive）と共有ドライブ両方のwatchチャンネルを登録する。
   * 既に有効なチャンネルがある場合はスキップする。
   */
  async registerAllChannels(): Promise<void> {
    await this.registerChannel(MY_DRIVE_ID, null);
    await this.registerChannel(SHARED_DRIVE_ID, SHARED_DRIVE_ID);
  }

  /**
   * 指定ドライブのwatchチャンネルを登録する。
   * @param stateKey  drive_watch_state の drive_id
   * @param driveId   共有DriveIDまたはnull（通常Drive）
   */
  async registerChannel(stateKey: string, driveId: string | null): Promise<void> {
    try {
      const drive = await this.initDrive();

      // 既存状態を確認
      const { data: existing } = await this.supabase
        .from('drive_watch_state')
        .select('*')
        .eq('drive_id', stateKey)
        .single();

      // 有効なチャンネルがまだ残っている場合はスキップ
      if (existing?.channel_id && existing?.expiration_at) {
        const expiresAt = new Date(existing.expiration_at);
        const hoursLeft = (expiresAt.getTime() - Date.now()) / (1000 * 3600);
        if (hoursLeft > 24) {
          console.log(`[DriveWatchService] Channel for ${stateKey} still valid (${hoursLeft.toFixed(1)}h left)`);
          return;
        }
        // 期限切れ間近なら既存チャンネルを停止
        await this.stopChannel(stateKey, existing.channel_id, existing.resource_id);
      }

      // startPageToken を取得
      let startPageTokenRes;
      if (driveId) {
        startPageTokenRes = await drive.changes.getStartPageToken({
          driveId,
          supportsAllDrives: true,
        });
      } else {
        startPageTokenRes = await drive.changes.getStartPageToken({});
      }
      const startPageToken = startPageTokenRes.data.startPageToken!;

      // watchチャンネルを登録
      const channelId = uuidv4();
      const webhookUrl = getWebhookUrl();

      let watchRes;
      if (driveId) {
        watchRes = await drive.changes.watch({
          driveId,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageToken: startPageToken,
          requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            token: process.env.DRIVE_WEBHOOK_TOKEN || 'drive-sync-token',
          },
        } as any);
      } else {
        watchRes = await drive.changes.watch({
          pageToken: startPageToken,
          requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            token: process.env.DRIVE_WEBHOOK_TOKEN || 'drive-sync-token',
          },
        });
      }

      const expiration = watchRes.data.expiration
        ? new Date(parseInt(watchRes.data.expiration)).toISOString()
        : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      // DB に保存
      await this.supabase
        .from('drive_watch_state')
        .upsert({
          drive_id: stateKey,
          page_token: startPageToken,
          channel_id: channelId,
          resource_id: watchRes.data.resourceId || null,
          expiration_at: expiration,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'drive_id' });

      console.log(`[DriveWatchService] ✅ Channel registered for ${stateKey}: ${channelId}, expires: ${expiration}`);
    } catch (e: any) {
      console.error(`[DriveWatchService] ❌ Failed to register channel for ${stateKey}:`, e.message);
      throw e;
    }
  }

  /**
   * 既存チャンネルを停止する（Googleへの通知停止）
   */
  async stopChannel(stateKey: string, channelId: string, resourceId: string | null): Promise<void> {
    try {
      const drive = await this.initDrive();
      await drive.channels.stop({
        requestBody: { id: channelId, resourceId: resourceId || '' },
      });
      console.log(`[DriveWatchService] Stopped channel ${channelId} for ${stateKey}`);
    } catch (e: any) {
      // 既に期限切れのチャンネルでもエラーになるので警告のみ
      console.warn(`[DriveWatchService] Could not stop channel ${channelId}: ${e.message}`);
    }
  }

  // ─── 変更ファイル一覧取得 ────────────────────────────────────────────────

  /**
   * 受信したwebhookのchannelIdに対応するドライブの変更ファイルリストを返す。
   * スプレッドシートかつ業務依頼集計表でないもののみを返す。
   *
   * @param channelId  webhookヘッダーの x-goog-channel-id
   * @returns 変更されたスプレッドシートファイルの一覧
   */
  async getChangedSpreadsheets(channelId: string): Promise<ChangedFile[]> {
    try {
      const drive = await this.initDrive();

      // channelId からどのドライブか特定
      const { data: states } = await this.supabase
        .from('drive_watch_state')
        .select('*');

      const state = (states as WatchState[])?.find(s => s.channel_id === channelId);
      if (!state) {
        console.warn(`[DriveWatchService] Unknown channelId: ${channelId}`);
        return [];
      }

      const isSharedDrive = state.drive_id !== MY_DRIVE_ID;
      const pageToken = state.page_token;
      if (!pageToken) {
        console.warn(`[DriveWatchService] No pageToken for ${state.drive_id}`);
        return [];
      }

      const results: ChangedFile[] = [];
      let nextPageToken: string | undefined = pageToken;

      // changes.list をページ分だけ実行（通常1ページで完了）
      while (nextPageToken) {
        let res;
        if (isSharedDrive) {
          res = await (drive.changes.list as any)({
            pageToken: nextPageToken,
            driveId: state.drive_id,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'nextPageToken,newStartPageToken,changes(fileId,file(id,name,mimeType,webViewLink,parents,driveId,trashed))',
          });
        } else {
          res = await drive.changes.list({
            pageToken: nextPageToken,
            spaces: 'drive',
            fields: 'nextPageToken,newStartPageToken,changes(fileId,file(id,name,mimeType,webViewLink,parents,trashed))',
          });
        }

        const changes = res.data.changes || [];
        for (const change of changes) {
          const file = change.file;
          if (!file) continue;
          if (file.trashed) continue;
          if (file.mimeType !== 'application/vnd.google-apps.spreadsheet') continue;
          if (file.id === MASTER_SHEET_ID) continue;  // 集計表自身を除外

          // 通常Driveの場合: 対象フォルダ内のファイルのみ
          if (!isSharedDrive) {
            const parents = file.parents || [];
            if (!parents.includes(GYOMU_FOLDER_ID)) continue;
          }

          results.push({
            fileId: file.id!,
            fileName: file.name || '',
            driveId: isSharedDrive ? state.drive_id : null,
            spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
          });
        }

        // pageToken を更新
        const newToken = res.data.newStartPageToken || res.data.nextPageToken;
        if (newToken) {
          await this.supabase
            .from('drive_watch_state')
            .update({ page_token: newToken, updated_at: new Date().toISOString() })
            .eq('drive_id', state.drive_id);
        }
        nextPageToken = res.data.nextPageToken || undefined;
      }

      console.log(`[DriveWatchService] Changed spreadsheets: ${results.length}`);
      return results;
    } catch (e: any) {
      console.error('[DriveWatchService] getChangedSpreadsheets error:', e.message);
      throw e;
    }
  }

  /**
   * 期限切れ間近（24時間以内）のチャンネルを更新する。
   * vercel.json の cron（6日ごと）から呼び出す。
   */
  async renewExpiringChannels(): Promise<void> {
    const threshold = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data: states } = await this.supabase
      .from('drive_watch_state')
      .select('*')
      .or(`expiration_at.lt.${threshold},expiration_at.is.null`);

    for (const state of (states as WatchState[]) || []) {
      const isShared = state.drive_id !== MY_DRIVE_ID;
      console.log(`[DriveWatchService] Renewing channel for ${state.drive_id}`);
      try {
        await this.registerChannel(state.drive_id, isShared ? state.drive_id : null);
      } catch (e: any) {
        console.error(`[DriveWatchService] Renewal failed for ${state.drive_id}:`, e.message);
      }
    }
  }

  /**
   * webhookのchannelToken（x-goog-channel-token）を検証する。
   */
  verifyToken(token: string | undefined): boolean {
    const expected = process.env.DRIVE_WEBHOOK_TOKEN || 'drive-sync-token';
    if (!token) return true;  // トークン未設定時はスキップ
    return token === expected;
  }

  /**
   * 指定channelIdが既知のチャンネルかどうかを確認する。
   */
  async isKnownChannel(channelId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('drive_watch_state')
      .select('drive_id')
      .eq('channel_id', channelId)
      .maybeSingle();
    return !!data;
  }
}

// ─── ポーリング方式（Push通知の代替・メイン同期方式） ────────────────────────────

/**
 * ポーリングで最近変更されたスプレッドシートを返す。
 *
 * Push通知ではなくこちらをメインの変更検知として使う。
 * サービスアカウントでは他ユーザー所有のフォルダに対して
 * changes.watch の Push 通知が届かないケースがあるため。
 *
 * @param windowMinutes  この分以内に更新されたファイルを取得（デフォルト2分）
 */
export async function pollRecentChanges(windowMinutes = 2): Promise<ChangedFile[]> {
  const drive = await new DriveWatchService()['initDrive']();

  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const results: ChangedFile[] = [];

  // ─── 通常フォルダ ──────────────────────────────────────────────────────────
  try {
    const res = await drive.files.list({
      q: `'${GYOMU_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and modifiedTime > '${cutoff}' and trashed=false`,
      fields: 'files(id,name,webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 50,
    });
    for (const f of res.data.files || []) {
      if (f.id === MASTER_SHEET_ID) continue;
      results.push({
        fileId: f.id!,
        fileName: f.name || '',
        driveId: null,
        spreadsheetUrl: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`,
      });
    }
    console.log(`[DrivePoll] myDrive: ${res.data.files?.length ?? 0} files since ${cutoff}`);
  } catch (e: any) {
    console.error('[DrivePoll] myDrive list error:', e.message);
  }

  // ─── 共有ドライブ ───────────────────────────────────────────────────────────
  try {
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and modifiedTime > '${cutoff}' and trashed=false`,
      driveId: SHARED_DRIVE_ID,
      corpora: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id,name,webViewLink)',
      pageSize: 50,
    } as any);
    for (const f of (res.data as any).files || []) {
      if (f.id === MASTER_SHEET_ID) continue;
      results.push({
        fileId: f.id!,
        fileName: f.name || '',
        driveId: SHARED_DRIVE_ID,
        spreadsheetUrl: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}`,
      });
    }
    console.log(`[DrivePoll] sharedDrive: ${(res.data as any).files?.length ?? 0} files since ${cutoff}`);
  } catch (e: any) {
    console.error('[DrivePoll] sharedDrive list error:', e.message);
  }

  return results;
}
