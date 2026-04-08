import { GoogleSheetsClient, SheetRow } from './GoogleSheetsClient';
import { SupabaseClient } from '@supabase/supabase-js';

export interface PropertySyncResult {
  success: boolean;
  rowsAffected: number;
  error?: string;
  operation?: 'update';
}

/**
 * 物件リストスプレッドシート同期サービス
 * 
 * データベースの物件リストデータをスプレッドシートに同期します。
 * 既存の売主同期サービス（SpreadsheetSyncService）と同じパターンで実装。
 */
export class PropertyListingSpreadsheetSync {
  private sheetsClient: GoogleSheetsClient;
  private supabase: SupabaseClient;
  private propertyNumberColumn: string = '物件番号';

  constructor(
    sheetsClient: GoogleSheetsClient,
    supabase: SupabaseClient
  ) {
    this.sheetsClient = sheetsClient;
    this.supabase = supabase;
  }

  /**
   * 単一の物件レコードをスプレッドシートに同期（DB → スプレッドシート）
   * 
   * @param propertyNumber 物件番号（例: BB1234）
   * @returns 同期結果
   */
  async syncToSpreadsheet(propertyNumber: string): Promise<PropertySyncResult> {
    try {
      console.log(`📝 [PropertyListingSpreadsheetSync] Starting sync for property: ${propertyNumber}`);
      
      // Supabaseから物件データを取得
      const { data: property, error } = await this.supabase
        .from('property_listings')
        .select('*')
        .eq('property_number', propertyNumber)
        .single();

      if (error || !property) {
        console.error(`❌ [PropertyListingSpreadsheetSync] Property not found: ${propertyNumber}`);
        return {
          success: false,
          rowsAffected: 0,
          error: `Property not found: ${propertyNumber}`,
        };
      }

      console.log(`✅ [PropertyListingSpreadsheetSync] Found property: ${property.property_number}`);

      // スプレッドシート形式に変換
      const sheetRow = this.mapToSheet(property);
      console.log(`📋 [PropertyListingSpreadsheetSync] Converted to sheet row`);

      // 物件番号で既存行を検索
      const existingRowIndex = await this.findRowIndex(propertyNumber);

      if (existingRowIndex) {
        // 既存行を部分更新（CX列「Suumo URL」のみ更新）
        console.log(`📝 [PropertyListingSpreadsheetSync] Updating existing row ${existingRowIndex} (partial update)`);
        await this.updateRow(existingRowIndex, sheetRow);
        console.log(`✅ [PropertyListingSpreadsheetSync] Updated row ${existingRowIndex}`);

        return {
          success: true,
          rowsAffected: 1,
          operation: 'update',
        };
      } else {
        // 物件が見つからない場合はエラー
        console.error(`❌ [PropertyListingSpreadsheetSync] Property not found in spreadsheet: ${propertyNumber}`);
        return {
          success: false,
          rowsAffected: 0,
          error: `Property not found in spreadsheet: ${propertyNumber}`,
        };
      }
    } catch (error: any) {
      console.error(`❌ [PropertyListingSpreadsheetSync] Error:`, error.message);
      return {
        success: false,
        rowsAffected: 0,
        error: error.message,
      };
    }
  }

  /**
   * 物件番号でスプレッドシートの行を検索
   * 
   * @param propertyNumber 物件番号（例: BB1234）
   * @returns 行インデックス（1-indexed）、見つからない場合はnull
   */
  async findRowIndex(propertyNumber: string): Promise<number | null> {
    try {
      console.log(`🔍 [PropertyListingSpreadsheetSync] Searching for property ${propertyNumber}...`);
      const rowIndex = await this.sheetsClient.findRowByColumn(this.propertyNumberColumn, propertyNumber);
      console.log(`🔍 [PropertyListingSpreadsheetSync] Found at row index: ${rowIndex}`);
      return rowIndex;
    } catch (error: any) {
      // カラムが見つからない場合はnullを返す
      console.error(`❌ [PropertyListingSpreadsheetSync] Error finding property ${propertyNumber}:`, error.message);
      return null;
    }
  }

  /**
   * スプレッドシートの行を更新（CX列「Suumo URL」のみ）
   * 
   * @param rowIndex 行インデックス（1-indexed）
   * @param data 更新データ
   */
  async updateRow(rowIndex: number, data: SheetRow): Promise<void> {
    try {
      console.log(`📝 [PropertyListingSpreadsheetSync] Updating row ${rowIndex} with data:`, data);
      
      // 部分更新: CX列「Suumo URL」のみ更新
      await this.sheetsClient.updateRowPartial(rowIndex, data);
      
      console.log(`✅ [PropertyListingSpreadsheetSync] Successfully updated row ${rowIndex}`);
    } catch (error: any) {
      console.error(`❌ [PropertyListingSpreadsheetSync] Error updating row ${rowIndex}:`, error.message);
      throw error;
    }
  }

  /**
   * 物件データをスプレッドシート形式に変換
   * 
   * 現在はSuumo URLのみを同期対象とする。
   * 他のフィールドは既存のGAS同期（10分ごと）で管理される。
   * 
   * @param property 物件データ
   * @returns スプレッドシート行データ
   */
  private mapToSheet(property: any): SheetRow {
    return {
      'Suumo URL': property.suumo_url || '',
    };
  }

  /**
   * 確認フィールドをスプレッドシートに同期（DQ列、列番号120）
   * 
   * @param propertyNumber 物件番号
   * @param confirmation 確認値（「未」または「済」）
   */
  async syncConfirmationToSpreadsheet(propertyNumber: string, confirmation: '未' | '済'): Promise<void> {
    try {
      console.log(`📝 [PropertyListingSpreadsheetSync] Syncing confirmation for ${propertyNumber} to ${confirmation}`);

      // 物件番号から行番号を取得
      const rowIndex = await this.findRowIndex(propertyNumber);
      if (!rowIndex) {
        throw new Error(`物件番号 ${propertyNumber} が見つかりません`);
      }

      // DQ列（列番号120）を更新
      const range = `物件!DQ${rowIndex}`;
      await this.sheetsClient.writeRawCell(range, confirmation);

      console.log(`✅ [PropertyListingSpreadsheetSync] Successfully synced confirmation for ${propertyNumber}`);
    } catch (error: any) {
      console.error(`❌ [PropertyListingSpreadsheetSync] Error syncing confirmation for ${propertyNumber}:`, error);
      throw error;
    }
  }

  /**
   * スプレッドシートから確認フィールドを同期（DQ列 → DB）
   */
  async syncConfirmationFromSpreadsheet(): Promise<{ updatedCount: number; errorCount: number }> {
    try {
      console.log(`🔄 [PropertyListingSpreadsheetSync] Starting confirmation sync from spreadsheet`);

      // DQ列（列番号120）を取得（B列の物件番号も含む）
      const range = '物件!B:DQ';
      const rows = await this.sheetsClient.readRawRange(range);

      if (!rows || rows.length === 0) {
        console.log(`⚠️ [PropertyListingSpreadsheetSync] No data found in spreadsheet`);
        return { updatedCount: 0, errorCount: 0 };
      }

      let updatedCount = 0;
      let errorCount = 0;

      // ヘッダー行をスキップ
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const propertyNumber = row[0]; // B列（0-indexed: 0）
        const confirmation = row[118]; // DQ列（0-indexed: 118、B列から開始のため120-2=118）

        if (!propertyNumber) continue;

        // バリデーション
        if (confirmation && !['未', '済'].includes(confirmation)) {
          console.error(`❌ [PropertyListingSpreadsheetSync] Invalid confirmation value: ${propertyNumber} → ${confirmation}`);
          errorCount++;
          continue;
        }

        // DBを更新
        try {
          const { error } = await this.supabase
            .from('property_listings')
            .update({ 
              confirmation: confirmation || '未', // 空欄の場合は「未」
              updated_at: new Date().toISOString(),
            })
            .eq('property_number', propertyNumber);

          if (error) {
            console.error(`❌ [PropertyListingSpreadsheetSync] DB update error for ${propertyNumber}:`, error);
            errorCount++;
          } else {
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ [PropertyListingSpreadsheetSync] Sync error for ${propertyNumber}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ [PropertyListingSpreadsheetSync] Confirmation sync completed: ${updatedCount} updated, ${errorCount} errors`);
      return { updatedCount, errorCount };
    } catch (error: any) {
      console.error(`❌ [PropertyListingSpreadsheetSync] Error syncing confirmation from spreadsheet:`, error);
      throw error;
    }
  }
}
