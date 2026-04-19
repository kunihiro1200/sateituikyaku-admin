import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, sheets_v4 } from 'googleapis';
import { WorkTaskColumnMapper, WorkTaskData } from './WorkTaskColumnMapper';

const SPREADSHEET_ID = '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g';
const SHEET_NAME = '業務依頼';

export interface SyncError {
  rowNumber: number;
  propertyNumber?: string;
  error: string;
}

export interface SyncResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: SyncError[];
  startTime: Date;
  endTime: Date;
}

/**
 * 業務依頼スプレッドシート同期サービス
 */
export class WorkTaskSyncService {
  private supabase: SupabaseClient;
  private columnMapper: WorkTaskColumnMapper;
  private sheets: sheets_v4.Sheets | null = null;
  private isSyncing: boolean = false;

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.columnMapper = new WorkTaskColumnMapper();
  }

  /**
   * Google Sheets APIクライアントを初期化
   * 認証優先順位:
   * 1. GOOGLE_SERVICE_ACCOUNT_JSON（JSON文字列 or Base64）- Vercel環境用
   * 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY - Vercel環境用フォールバック
   * 3. GOOGLE_SERVICE_ACCOUNT_PATH またはローカルファイル - ローカル開発用
   * 4. いずれも存在しない場合はエラーをスロー
   */
  private async initSheetsClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    console.log('[WorkTaskSyncService] Initializing Google Sheets client...');

    // 1. GOOGLE_SERVICE_ACCOUNT_JSON 環境変数（JSON文字列 or Base64）
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.log('[WorkTaskSyncService] Using GOOGLE_SERVICE_ACCOUNT_JSON');
      try {
        let jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

        // Base64エンコードされている場合はデコード
        let keyFile: any;
        try {
          keyFile = JSON.parse(jsonString);
        } catch (e) {
          // JSONパース失敗 → Base64としてデコード
          console.log('[WorkTaskSyncService] Decoding Base64 encoded JSON...');
          jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
          keyFile = JSON.parse(jsonString);
        }

        // private_keyの改行を復元
        if (keyFile.private_key && !keyFile.private_key.includes('\n')) {
          keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
        }

        const auth = new google.auth.JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        await auth.authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        console.log('[WorkTaskSyncService] Authentication successful (GOOGLE_SERVICE_ACCOUNT_JSON)');
        return this.sheets;
      } catch (error: any) {
        console.error('[WorkTaskSyncService] Authentication failed (GOOGLE_SERVICE_ACCOUNT_JSON):', error.message);
        throw new Error(`Google Sheets 認証失敗 (GOOGLE_SERVICE_ACCOUNT_JSON): ${error.message}`);
      }
    }

    // 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY（Vercel環境用フォールバック）
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      console.log('[WorkTaskSyncService] Using GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY');
      try {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        const auth = new google.auth.JWT({
          email,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        await auth.authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        console.log('[WorkTaskSyncService] Authentication successful (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)');
        return this.sheets;
      } catch (error: any) {
        console.error('[WorkTaskSyncService] Authentication failed (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY):', error.message);
        throw new Error(`Google Sheets 認証失敗 (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY): ${error.message}`);
      }
    }

    // 3. ファイル認証（ローカル開発用フォールバック）
    const fs = require('fs');
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json';
    if (fs.existsSync(keyFilePath)) {
      console.log(`[WorkTaskSyncService] Using service account file: ${keyFilePath}`);
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: keyFilePath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
        console.log('[WorkTaskSyncService] Authentication successful (keyFile)');
        return this.sheets;
      } catch (error: any) {
        console.error(`[WorkTaskSyncService] Authentication failed (keyFile: ${keyFilePath}):`, error.message);
        throw new Error(`Google Sheets 認証失敗 (keyFile: ${keyFilePath}): ${error.message}`);
      }
    }

    // 4. いずれの認証情報も存在しない場合
    const errorMessage =
      'Google Sheets 認証情報が設定されていません。' +
      '以下のいずれかの環境変数を設定してください: ' +
      'GOOGLE_SERVICE_ACCOUNT_JSON, ' +
      'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, ' +
      'または GOOGLE_SERVICE_ACCOUNT_PATH';
    console.error('[WorkTaskSyncService] No authentication credentials found.');
    throw new Error(errorMessage);
  }

  /**
   * 全データを同期
   */
  async syncAll(): Promise<SyncResult> {
    this.isSyncing = true;
    const startTime = new Date();
    const errors: SyncError[] = [];
    let successCount = 0;

    try {
      const sheets = await this.initSheetsClient();

      // ヘッダー行を取得
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];

      // データ行を取得（2行目以降）
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!2:1000`,
      });
      const rows = dataResponse.data.values || [];

      console.log(`取得行数: ${rows.length}`);

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // 1-indexed, ヘッダー行を除く
        const row = rows[i];

        try {
          // 行データをオブジェクトに変換
          const sheetRow: Record<string, any> = {};
          headers.forEach((header: string, index: number) => {
            sheetRow[header] = row[index] || '';
          });

          // 物件番号が空の行はスキップ
          const propertyNumber = sheetRow['物件番号'];
          if (!propertyNumber || propertyNumber.trim() === '') {
            continue;
          }

          // バリデーション
          const validation = this.columnMapper.validate(sheetRow);
          if (!validation.isValid) {
            errors.push({
              rowNumber,
              propertyNumber,
              error: validation.errors.join(', '),
            });
            continue;
          }

          // データ変換
          const workTaskData = this.columnMapper.mapToDatabase(sheetRow);
          workTaskData.synced_at = new Date().toISOString();

          // Upsert処理
          const { error: upsertError } = await this.supabase
            .from('work_tasks')
            .upsert(workTaskData, {
              onConflict: 'property_number',
            });

          if (upsertError) {
            errors.push({
              rowNumber,
              propertyNumber,
              error: upsertError.message,
            });
          } else {
            successCount++;
          }
        } catch (rowError: any) {
          errors.push({
            rowNumber,
            error: rowError.message,
          });
        }
      }

      const endTime = new Date();

      return {
        totalRows: rows.length,
        successCount,
        errorCount: errors.length,
        errors,
        startTime,
        endTime,
      };
    } catch (error: any) {
      const endTime = new Date();
      return {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ rowNumber: 0, error: error.message }],
        startTime,
        endTime,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 単一の物件番号でデータを同期
   */
  async syncByPropertyNumber(propertyNumber: string): Promise<WorkTaskData | null> {
    try {
      const sheets = await this.initSheetsClient();

      // ヘッダー行を取得
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];

      // 全データを取得して物件番号で検索
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!2:1000`,
      });
      const rows = dataResponse.data.values || [];

      // 物件番号のカラムインデックスを取得
      const propertyNumberIndex = headers.indexOf('物件番号');
      if (propertyNumberIndex === -1) {
        throw new Error('物件番号カラムが見つかりません');
      }

      // 該当行を検索
      const targetRow = rows.find(row => row[propertyNumberIndex] === propertyNumber);
      if (!targetRow) {
        return null;
      }

      // 行データをオブジェクトに変換
      const sheetRow: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        sheetRow[header] = targetRow[index] || '';
      });

      // データ変換
      const workTaskData = this.columnMapper.mapToDatabase(sheetRow);
      workTaskData.synced_at = new Date().toISOString();

      // Upsert処理
      const { error: upsertError } = await this.supabase
        .from('work_tasks')
        .upsert(workTaskData, {
          onConflict: 'property_number',
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      return workTaskData;
    } catch (error: any) {
      console.error(`物件番号 ${propertyNumber} の同期エラー:`, error.message);
      return null;
    }
  }

  /**
   * DBの変更をスプレッドシートに書き戻す
   */
  async writeBackToSpreadsheet(propertyNumber: string, updates: Partial<WorkTaskData>): Promise<void> {
    try {
      const sheets = await this.initSheetsClient();

      // ヘッダー行を取得
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];

      // 物件番号列のインデックスを取得
      const propertyNumberIndex = headers.indexOf('物件番号');
      if (propertyNumberIndex === -1) throw new Error('物件番号カラムが見つかりません');

      // 全データから対象行番号を検索
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:A`,
      });
      const colA = dataResponse.data.values || [];
      const rowIndex = colA.findIndex((r, i) => i > 0 && r[0] === propertyNumber);
      if (rowIndex === -1) {
        console.warn(`スプシに物件番号 ${propertyNumber} が見つかりません`);
        return;
      }
      const sheetRowNumber = rowIndex + 1; // 1-indexed

      // DBカラム名→スプシカラム名の逆マッピングを構築
      const mappingConfig = this.columnMapper.getMappingConfig();
      const dbToSheet: Record<string, string> = {};
      for (const [sheetCol, dbCol] of Object.entries(mappingConfig.spreadsheetToDb)) {
        dbToSheet[dbCol] = sheetCol;
      }

      // 更新するセルを特定して書き込む
      const requests: sheets_v4.Schema$ValueRange[] = [];
      for (const [dbCol, value] of Object.entries(updates)) {
        const sheetCol = dbToSheet[dbCol];
        if (!sheetCol) continue;
        const colIndex = headers.indexOf(sheetCol);
        if (colIndex === -1) continue;

        // 列番号をA1記法に変換
        const colLetter = this.columnIndexToLetter(colIndex);
        const cellRange = `${SHEET_NAME}!${colLetter}${sheetRowNumber}`;
        requests.push({
          range: cellRange,
          values: [[value ?? '']],
        });
      }

      if (requests.length === 0) return;

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: requests,
        },
      });

      console.log(`スプシ書き戻し完了: ${propertyNumber} (${requests.length}セル)`);
    } catch (error: any) {
      console.error(`スプシ書き戻しエラー (${propertyNumber}):`, error.message);
      // 書き戻し失敗はDBの保存には影響させない（ログのみ）
    }
  }

  /**
   * 列インデックス（0始まり）をA1記法の列文字に変換
   */
  private columnIndexToLetter(index: number): string {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  /**
   * 物件番号でデータを取得
   */
  async getByPropertyNumber(propertyNumber: string): Promise<WorkTaskData | null> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !data) {
      return null;
    }

    return data as WorkTaskData;
  }
}
