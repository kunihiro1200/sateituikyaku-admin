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
}
