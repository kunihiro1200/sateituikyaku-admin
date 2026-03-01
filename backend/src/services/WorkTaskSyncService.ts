import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, sheets_v4 } from 'googleapis';
import { WorkTaskColumnMapper, WorkTaskData } from './WorkTaskColumnMapper';

const SPREADSHEET_ID = process.env.WORK_TASK_SPREADSHEET_ID || '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g';
const SHEET_NAME = process.env.WORK_TASK_SHEET_NAME || '業務依頼';

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

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.columnMapper = new WorkTaskColumnMapper();
  }

  /**
   * Google Sheets APIクライアントを初期化
   * Vercel環境: GOOGLE_SERVICE_ACCOUNT_JSON（JSON文字列）を使用
   * ローカル環境: GOOGLE_SERVICE_ACCOUNT_KEY_PATH（ファイルパス）を使用
   */
  private async initSheetsClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;

    let auth: any;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Vercel環境: 環境変数からJSON認証情報を取得
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      // ローカル環境: ファイルパスから認証情報を取得
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }

    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  /**
   * 全データを同期
   */
  async syncAll(): Promise<SyncResult> {
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

      // データ行を全件取得（2行目以降）
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!2:3000`,
      });
      const rows = dataResponse.data.values || [];

      console.log(`[WorkTaskSync] 取得行数: ${rows.length}`);

      // バッチ処理用バッファ
      const batchData: WorkTaskData[] = [];
      const BATCH_SIZE = 50;

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
          batchData.push(workTaskData);

          // バッチサイズに達したらupsert
          if (batchData.length >= BATCH_SIZE) {
            const { error: upsertError } = await this.supabase
              .from('work_tasks')
              .upsert(batchData, { onConflict: 'property_number' });

            if (upsertError) {
              errors.push({ rowNumber, error: upsertError.message });
            } else {
              successCount += batchData.length;
            }
            batchData.length = 0;
          }
        } catch (rowError: any) {
          errors.push({ rowNumber, error: rowError.message });
        }
      }

      // 残りのバッチをupsert
      if (batchData.length > 0) {
        const { error: upsertError } = await this.supabase
          .from('work_tasks')
          .upsert(batchData, { onConflict: 'property_number' });

        if (upsertError) {
          errors.push({ rowNumber: -1, error: upsertError.message });
        } else {
          successCount += batchData.length;
        }
      }

      const endTime = new Date();
      console.log(`[WorkTaskSync] 完了: 成功=${successCount}, エラー=${errors.length}`);

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
      console.error('[WorkTaskSync] 同期エラー:', error.message);
      return {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ rowNumber: 0, error: error.message }],
        startTime,
        endTime,
      };
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
        range: `${SHEET_NAME}!2:3000`,
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
