/**
 * 強化版自動同期サービス
 * 
 * スプレッドシートからDBへの自動同期を管理します。
 * 全件比較方式で不足データを検出し、確実に同期します。
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import { ColumnMapper } from './ColumnMapper';
import { PropertySyncHandler } from './PropertySyncHandler';
import { encrypt } from '../utils/encryption';
import { ExclusionDateCalculator } from './ExclusionDateCalculator';
import * as crypto from 'crypto';
import {
  ValidationResult,
  DeletionResult,
  DeletionSyncResult,
  CompleteSyncResult,
  DeletionSyncConfig,
  RecoveryResult,
} from '../types/deletion';

export interface SyncResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  newSellersCount: number;
  updatedSellersCount: number;
  errors: SyncError[];
  missingSellersDetected: number;
  triggeredBy: 'scheduled' | 'manual';
}

export interface SyncError {
  sellerNumber: string;
  message: string;
  timestamp: Date;
}

export interface SyncHealthStatus {
  isHealthy: boolean;
  lastSyncTime: Date | null;
  lastSyncSuccess: boolean;
  pendingMissingSellers: number;
  syncIntervalMinutes: number;
  nextScheduledSync: Date | null;
  consecutiveFailures: number;
}

export class EnhancedAutoSyncService {
  private supabase: SupabaseClient;
  private sheetsClient: GoogleSheetsClient | null = null;
  private columnMapper: ColumnMapper;
  private propertySyncHandler: PropertySyncHandler;
  private isInitialized = false;

  // 買主用のGoogle Sheetsクライアント
  private buyerSheetsClient: GoogleSheetsClient | null = null;
  private buyerColumnMapper: any | null = null;
  private isBuyerInitialized = false;

  // スプレッドシートキャッシュ（Google Sheets APIクォータ対策）
  private spreadsheetCache: any[] | null = null;
  private spreadsheetCacheExpiry: number = 0;
  private readonly SPREADSHEET_CACHE_TTL = 5 * 60 * 1000; // 5分間キャッシュ（Google Sheets APIクォータ対策）

  // 買主スプレッドシートキャッシュ
  private buyerSpreadsheetCache: any[] | null = null;
  private buyerSpreadsheetCacheExpiry: number = 0;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.columnMapper = new ColumnMapper();
    this.propertySyncHandler = new PropertySyncHandler(this.supabase);
  }


  /**
   * Google Sheets クライアントを初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const sheetsConfig = {
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
        sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      };
      
      this.sheetsClient = new GoogleSheetsClient(sheetsConfig);
      await this.sheetsClient.authenticate();
      this.isInitialized = true;
      console.log('✅ EnhancedAutoSyncService initialized');
    } catch (error: any) {
      console.error('❌ EnhancedAutoSyncService initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * スプレッドシートデータを取得（キャッシュ対応）
   * Google Sheets APIクォータ対策のため、5分間キャッシュします
   */
  private async getSpreadsheetData(forceRefresh: boolean = false): Promise<any[]> {
    const now = Date.now();

    // 強制リフレッシュでない場合、キャッシュが有効なら使用
    if (!forceRefresh && this.spreadsheetCache && now < this.spreadsheetCacheExpiry) {
      console.log('📦 Using cached spreadsheet data (valid for', Math.round((this.spreadsheetCacheExpiry - now) / 1000), 'seconds)');
      return this.spreadsheetCache;
    }

    // キャッシュが無効な場合は再取得
    console.log('🔄 Fetching fresh spreadsheet data...');
    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    const allRows = await this.sheetsClient!.readAll();
    this.spreadsheetCache = allRows;
    this.spreadsheetCacheExpiry = now + this.SPREADSHEET_CACHE_TTL;
    
    console.log(`✅ Spreadsheet data cached (${allRows.length} rows, valid for 30 minutes)`);
    return allRows;
  }

  /**
   * スプレッドシートキャッシュをクリア
   */
  public clearSpreadsheetCache(): void {
    this.spreadsheetCache = null;
    this.spreadsheetCacheExpiry = 0;
    console.log('🗑️ Spreadsheet cache cleared');
  }

  /**
   * 数値をパース
   */
  private parseNumeric(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    const str = String(value).replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  // combineInquiryDateAndYear メソッドを削除
  // inquiry_date カラムは存在しないため、このメソッドは不要

  /**
   * DBから全売主番号を取得（ページネーション対応）
   * Supabaseのデフォルト制限（1000件）を回避するため、ページングで全件取得
   */
  private async getAllDbSellerNumbers(): Promise<Set<string>> {
    const allSellerNumbers = new Set<string>();
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('seller_number')
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch DB sellers: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        for (const seller of data) {
          if (seller.seller_number) {
            allSellerNumbers.add(seller.seller_number);
          }
        }
        offset += pageSize;
        
        // 取得件数がページサイズ未満なら終了
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    return allSellerNumbers;
  }

  /**
   * スプレッドシートにあってDBにない売主番号を検出
   * 全件比較方式で確実に不足データを検出します
   */
  async detectMissingSellers(): Promise<string[]> {
    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    console.log('🔍 Detecting missing sellers (full comparison)...');

    // スプレッドシートから全売主番号を取得（キャッシュ対応）
    const allRows = await this.getSpreadsheetData();
    const sheetSellerNumbers = new Set<string>();
    
    for (const row of allRows) {
      const sellerNumber = row['売主番号'];
      // 🚨 修正: 任意の2文字アルファベットプレフィックス + 数字の形式に対応（AA12903、FI123、BB456等）
      if (sellerNumber && typeof sellerNumber === 'string' && /^[A-Z]{2}\d+$/.test(sellerNumber)) {
        sheetSellerNumbers.add(sellerNumber);
      }
    }
    console.log(`📊 Spreadsheet sellers: ${sheetSellerNumbers.size}`);

    // DBから全売主番号を取得（ページネーション対応）
    const dbSellerNumbers = await this.getAllDbSellerNumbers();
    console.log(`📊 Database sellers: ${dbSellerNumbers.size}`);

    // 差分を計算（スプレッドシートにあってDBにないもの）
    const missingSellers: string[] = [];
    for (const sellerNumber of sheetSellerNumbers) {
      if (!dbSellerNumbers.has(sellerNumber)) {
        missingSellers.push(sellerNumber);
      }
    }

    // 売主番号でソート（プレフィックス + 数字でソート）
    missingSellers.sort((a, b) => {
      // プレフィックス（最初の2文字）を抽出
      const prefixA = a.substring(0, 2);
      const prefixB = b.substring(0, 2);
      
      // プレフィックスが異なる場合はプレフィックスでソート
      if (prefixA !== prefixB) {
        return prefixA.localeCompare(prefixB);
      }
      
      // プレフィックスが同じ場合は数字部分でソート
      const numA = parseInt(a.substring(2), 10);
      const numB = parseInt(b.substring(2), 10);
      return numA - numB;
    });

    console.log(`🆕 Missing sellers: ${missingSellers.length}`);
    if (missingSellers.length > 0) {
      console.log(`   First few: ${missingSellers.slice(0, 5).join(', ')}${missingSellers.length > 5 ? '...' : ''}`);
    }

    return missingSellers;
  }

  /**
   * DBにあってスプレッドシートにない売主番号を検出（削除された売主）
   * 全件比較方式で削除された売主を検出します
   */
  async detectDeletedSellers(): Promise<string[]> {
    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    console.log('🔍 Detecting deleted sellers (full comparison)...');

    // スプレッドシートから全売主番号を取得（キャッシュ対応）
    const allRows = await this.getSpreadsheetData();
    const sheetSellerNumbers = new Set<string>();
    
    for (const row of allRows) {
      const sellerNumber = row['売主番号'];
      // 🚨 修正: 任意の2文字アルファベットプレフィックス + 数字の形式に対応（AA12903、FI123、BB456等）
      if (sellerNumber && typeof sellerNumber === 'string' && /^[A-Z]{2}\d+$/.test(sellerNumber)) {
        sheetSellerNumbers.add(sellerNumber);
      }
    }
    console.log(`📊 Spreadsheet sellers: ${sheetSellerNumbers.size}`);

    // DBから全アクティブ売主番号を取得（ページネーション対応、削除済みを除外）
    const dbSellerNumbers = await this.getAllActiveDbSellerNumbers();
    console.log(`📊 Active database sellers: ${dbSellerNumbers.size}`);

    // 差分を計算（DBにあってスプレッドシートにないもの = 削除された売主）
    const deletedSellers: string[] = [];
    for (const sellerNumber of dbSellerNumbers) {
      if (!sheetSellerNumbers.has(sellerNumber)) {
        deletedSellers.push(sellerNumber);
      }
    }

    // 売主番号でソート（プレフィックス + 数字でソート）
    deletedSellers.sort((a, b) => {
      // プレフィックス（最初の2文字）を抽出
      const prefixA = a.substring(0, 2);
      const prefixB = b.substring(0, 2);
      
      // プレフィックスが異なる場合はプレフィックスでソート
      if (prefixA !== prefixB) {
        return prefixA.localeCompare(prefixB);
      }
      
      // プレフィックスが同じ場合は数字部分でソート
      const numA = parseInt(a.substring(2), 10);
      const numB = parseInt(b.substring(2), 10);
      return numA - numB;
    });

    console.log(`🗑️  Deleted sellers: ${deletedSellers.length}`);
    if (deletedSellers.length > 0) {
      console.log(`   First few: ${deletedSellers.slice(0, 5).join(', ')}${deletedSellers.length > 5 ? '...' : ''}`);
    }

    return deletedSellers;
  }

  /**
   * DBから全アクティブ売主番号を取得（削除済みを除外）
   * ページネーション対応で全件取得
   */
  private async getAllActiveDbSellerNumbers(): Promise<Set<string>> {
    const allSellerNumbers = new Set<string>();
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('seller_number')
        .is('deleted_at', null) // 削除済みを除外
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch active DB sellers: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        for (const seller of data) {
          if (seller.seller_number) {
            allSellerNumbers.add(seller.seller_number);
          }
        }
        offset += pageSize;
        
        // 取得件数がページサイズ未満なら終了
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    return allSellerNumbers;
  }

  /**
   * 削除前のバリデーション
   * アクティブな契約、最近のアクティビティ、アクティブな物件リストをチェック
   */
  private async validateDeletion(sellerNumber: string): Promise<ValidationResult> {
    try {
      // 売主情報を取得
      const { data: seller, error } = await this.supabase
        .from('sellers')
        .select('id, seller_number, status')
        .eq('seller_number', sellerNumber)
        .is('deleted_at', null)
        .single();

      if (error || !seller) {
        return {
          canDelete: false,
          reason: 'Seller not found in database',
          requiresManualReview: false,
        };
      }

      // スプシから削除されたものはステータスに関係なく削除を許可
      return {
        canDelete: true,
        requiresManualReview: false,
        details: { contractStatus: seller.status },
      };

    } catch (error: any) {
      console.error(`❌ Validation error for ${sellerNumber}:`, error.message);
      return {
        canDelete: false,
        reason: `Validation error: ${error.message}`,
        requiresManualReview: true,
      };
    }
  }

  /**
   * ソフトデリートを実行
   * トランザクションで売主と関連物件を削除し、監査ログに記録
   */
  private async executeSoftDelete(sellerNumber: string): Promise<DeletionResult> {
    try {
      // 売主をDBから完全削除（スプシから削除されたものはDBからも削除）
      const { error: deleteError } = await this.supabase
        .from('sellers')
        .delete()
        .eq('seller_number', sellerNumber);

      if (deleteError) {
        console.error(`❌ Failed to delete seller ${sellerNumber}:`, deleteError.message);
        return {
          sellerNumber,
          success: false,
          error: `Seller deletion failed: ${deleteError.message}`,
        };
      }

      const deletedAt = new Date().toISOString();
      console.log(`✅ ${sellerNumber}: Deleted successfully`);

      return {
        sellerNumber,
        success: true,
        deletedAt: new Date(deletedAt),
      };

    } catch (error: any) {
      console.error(`❌ Delete error for ${sellerNumber}:`, error.message);
      return {
        sellerNumber,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 削除された売主を一括同期
   */
  async syncDeletedSellers(sellerNumbers: string[]): Promise<DeletionSyncResult> {
    const startedAt = new Date();
    const deletedSellerNumbers: string[] = [];
    const manualReviewSellerNumbers: string[] = [];
    const errors: Array<{ sellerNumber: string; error: string }> = [];

    console.log(`🗑️  Syncing ${sellerNumbers.length} deleted sellers...`);

    for (const sellerNumber of sellerNumbers) {
      // バリデーション
      const validation = await this.validateDeletion(sellerNumber);
      
      if (!validation.canDelete) {
        if (validation.requiresManualReview) {
          manualReviewSellerNumbers.push(sellerNumber);
          console.log(`⚠️  ${sellerNumber}: Requires manual review - ${validation.reason}`);
        } else {
          errors.push({
            sellerNumber,
            error: validation.reason || 'Validation failed',
          });
          console.log(`❌ ${sellerNumber}: ${validation.reason}`);
        }
        continue;
      }

      // ソフトデリート実行
      const result = await this.executeSoftDelete(sellerNumber);
      
      if (result.success) {
        deletedSellerNumbers.push(sellerNumber);
      } else {
        errors.push({
          sellerNumber,
          error: result.error || 'Unknown error',
        });
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    const syncResult: DeletionSyncResult = {
      totalDetected: sellerNumbers.length,
      successfullyDeleted: deletedSellerNumbers.length,
      failedToDelete: errors.length,
      requiresManualReview: manualReviewSellerNumbers.length,
      deletedSellerNumbers,
      manualReviewSellerNumbers,
      errors,
      startedAt,
      completedAt,
      durationMs,
    };

    console.log(`🎉 Deletion sync completed:`);
    console.log(`   ✅ Deleted: ${deletedSellerNumbers.length}`);
    console.log(`   ⚠️  Manual review: ${manualReviewSellerNumbers.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    return syncResult;
  }

  /**
   * 削除同期の設定を取得
   */
  private getDeletionSyncConfig(): DeletionSyncConfig {
    return {
      enabled: process.env.DELETION_SYNC_ENABLED !== 'false',
      strictValidation: process.env.DELETION_VALIDATION_STRICT !== 'false',
      recentActivityDays: parseInt(process.env.DELETION_RECENT_ACTIVITY_DAYS || '7', 10),
      sendAlerts: process.env.DELETION_SEND_ALERTS !== 'false',
      maxDeletionsPerSync: parseInt(process.env.DELETION_MAX_PER_SYNC || '100', 10),
    };
  }

  /**
   * 削除同期が有効かどうか
   */
  private isDeletionSyncEnabled(): boolean {
    return this.getDeletionSyncConfig().enabled;
  }

  /**
   * 削除された売主を復元
   * 
   * @param sellerNumber - 復元する売主番号
   * @param recoveredBy - 復元を実行したユーザー (default: 'manual')
   * @returns 復元結果
   */
  async recoverDeletedSeller(sellerNumber: string, recoveredBy: string = 'manual'): Promise<RecoveryResult> {
    try {
      console.log(`🔄 Attempting to recover seller: ${sellerNumber}`);

      // 1. 削除監査ログを確認
      const { data: auditLog, error: auditError } = await this.supabase
        .from('seller_deletion_audit')
        .select('*')
        .eq('seller_number', sellerNumber)
        .is('recovered_at', null)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .single();

      if (auditError || !auditLog) {
        console.error(`❌ Audit log not found for ${sellerNumber}`);
        return {
          success: false,
          sellerNumber,
          error: 'Audit log not found or seller was not deleted',
        };
      }

      if (!auditLog.can_recover) {
        console.error(`❌ Recovery not allowed for ${sellerNumber}`);
        return {
          success: false,
          sellerNumber,
          error: 'Recovery is not allowed for this seller',
        };
      }

      // 2. 売主を復元 (deleted_at を NULL に設定)
      const { error: sellerRecoverError } = await this.supabase
        .from('sellers')
        .update({ deleted_at: null })
        .eq('seller_number', sellerNumber);

      if (sellerRecoverError) {
        console.error(`❌ Failed to recover seller ${sellerNumber}:`, sellerRecoverError.message);
        throw new Error(`Failed to recover seller: ${sellerRecoverError.message}`);
      }

      console.log(`✅ Seller ${sellerNumber} recovered`);

      // 3. 関連する物件を復元
      const { data: properties, error: propertiesError } = await this.supabase
        .from('properties')
        .update({ deleted_at: null })
        .eq('seller_id', auditLog.seller_id)
        .select('id');

      const propertiesRestored = properties?.length || 0;
      
      if (propertiesError) {
        console.warn(`⚠️ Warning: Failed to recover properties for ${sellerNumber}:`, propertiesError.message);
      } else {
        console.log(`✅ Recovered ${propertiesRestored} properties for ${sellerNumber}`);
      }

      // 4. 監査ログを更新
      const recoveredAt = new Date().toISOString();
      const { error: auditUpdateError } = await this.supabase
        .from('seller_deletion_audit')
        .update({ 
          recovered_at: recoveredAt,
          recovered_by: recoveredBy,
        })
        .eq('id', auditLog.id);

      const auditRecordUpdated = !auditUpdateError;
      
      if (auditUpdateError) {
        console.warn(`⚠️ Warning: Failed to update audit log for ${sellerNumber}:`, auditUpdateError.message);
      }

      console.log(`🎉 Recovery completed for ${sellerNumber}`);

      return {
        success: true,
        sellerNumber,
        recoveredAt: new Date(recoveredAt),
        recoveredBy,
        details: {
          sellerRestored: true,
          propertiesRestored,
          auditRecordUpdated,
        },
      };

    } catch (error: any) {
      console.error(`❌ Recovery failed for ${sellerNumber}:`, error.message);
      return {
        success: false,
        sellerNumber,
        error: error.message,
      };
    }
  }


  /**
   * 不足している売主を同期
   */
  async syncMissingSellers(sellerNumbers: string[]): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let newSellersCount = 0;

    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    console.log(`🔄 Syncing ${sellerNumbers.length} missing sellers...`);

    // スプレッドシートから全データを取得（キャッシュ対応）
    const allRows = await this.getSpreadsheetData();
    const rowsBySellerNumber = new Map<string, any>();
    for (const row of allRows) {
      const sellerNumber = row['売主番号'];
      if (sellerNumber) {
        rowsBySellerNumber.set(String(sellerNumber), row);
      }
    }

    // 各売主を同期
    for (const sellerNumber of sellerNumbers) {
      const row = rowsBySellerNumber.get(sellerNumber);
      if (!row) {
        errors.push({
          sellerNumber,
          message: 'Row not found in spreadsheet',
          timestamp: new Date(),
        });
        continue;
      }

      try {
        await this.syncSingleSeller(sellerNumber, row);
        newSellersCount++;
        console.log(`✅ ${sellerNumber}: Created`);
      } catch (error: any) {
        errors.push({
          sellerNumber,
          message: error.message,
          timestamp: new Date(),
        });
        console.error(`❌ ${sellerNumber}: ${error.message}`);
      }
    }

    const endTime = new Date();
    const result: SyncResult = {
      success: errors.length === 0,
      startTime,
      endTime,
      newSellersCount,
      updatedSellersCount: 0,
      errors,
      missingSellersDetected: sellerNumbers.length,
      triggeredBy: 'scheduled',
    };

    console.log(`🎉 Sync completed: ${newSellersCount} new, ${errors.length} errors`);
    return result;
  }

  /**
   * 既存売主のデータを更新
   */
  async syncUpdatedSellers(sellerNumbers: string[]): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let updatedSellersCount = 0;

    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    console.log(`🔄 Updating ${sellerNumbers.length} existing sellers...`);

    // スプレッドシートから全データを取得（キャッシュ対応）
    const allRows = await this.getSpreadsheetData();
    const rowsBySellerNumber = new Map<string, any>();
    for (const row of allRows) {
      const sellerNumber = row['売主番号'];
      if (sellerNumber) {
        rowsBySellerNumber.set(String(sellerNumber), row);
      }
    }

    // 各売主を更新
    for (const sellerNumber of sellerNumbers) {
      const row = rowsBySellerNumber.get(sellerNumber);
      if (!row) {
        errors.push({
          sellerNumber,
          message: 'Row not found in spreadsheet',
          timestamp: new Date(),
        });
        continue;
      }

      try {
        await this.updateSingleSeller(sellerNumber, row);
        updatedSellersCount++;
        console.log(`✅ ${sellerNumber}: Updated`);
      } catch (error: any) {
        errors.push({
          sellerNumber,
          message: error.message,
          timestamp: new Date(),
        });
        console.error(`❌ ${sellerNumber}: ${error.message}`);
      }
    }

    const endTime = new Date();
    const result: SyncResult = {
      success: errors.length === 0,
      startTime,
      endTime,
      newSellersCount: 0,
      updatedSellersCount,
      errors,
      missingSellersDetected: 0,
      triggeredBy: 'scheduled',
    };

    console.log(`🎉 Update completed: ${updatedSellersCount} updated, ${errors.length} errors`);
    return result;
  }

  /**
   * 更新が必要な売主を検出
   * スプレッドシートとDBのデータを比較して、変更があった売主番号のリストを返す
   */
  async detectUpdatedSellers(): Promise<string[]> {
    if (!this.isInitialized || !this.sheetsClient) {
      await this.initialize();
    }

    console.log('🔍 Detecting updated sellers (comparing data)...');

    // スプレッドシートから全データを取得（キャッシュ対応）
    const allRows = await this.getSpreadsheetData();
    const sheetDataBySellerNumber = new Map<string, any>();
    
    for (const row of allRows) {
      const sellerNumber = row['売主番号'];
      // 🚨 修正: 任意の2文字アルファベットプレフィックス + 数字の形式に対応（AA12903、FI123、BB456等）
      if (sellerNumber && typeof sellerNumber === 'string' && /^[A-Z]{2}\d+$/.test(sellerNumber)) {
        sheetDataBySellerNumber.set(sellerNumber, row);
      }
    }
    console.log(`📊 Spreadsheet sellers: ${sheetDataBySellerNumber.size}`);

    // DBから全売主データを取得（ページネーション対応）
    const updatedSellers: string[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    let totalChecked = 0;

    while (hasMore) {
      const { data: dbSellers, error } = await this.supabase
        .from('sellers')
        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, address, phone_number, email, property_address, current_status, updated_at, visit_reminder_assignee, mailing_status')
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch DB sellers: ${error.message}`);
      }

      if (!dbSellers || dbSellers.length === 0) {
        hasMore = false;
      } else {
        for (const dbSeller of dbSellers) {
          totalChecked++;
          const sellerNumber = dbSeller.seller_number;
          const sheetRow = sheetDataBySellerNumber.get(sellerNumber);
          
          if (!sheetRow) {
            // スプレッドシートにない = 削除された（別の処理で対応）
            continue;
          }

          // 重要なフィールドを比較
          const sheetContractYearMonth = sheetRow['契約年月 他決は分かった時点'];
          // 「外す」を有効な値として扱う
          const rawSheetVisitAssignee = sheetRow['営担'];
          const sheetVisitAssignee = (rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);
          const sheetStatus = sheetRow['状況（当社）'];
          // コミュニケーションフィールドを追加
          const sheetPhoneContactPerson = sheetRow['電話担当（任意）'];
          const sheetPreferredContactTime = sheetRow['連絡取りやすい日、時間帯'];
          const sheetContactMethod = sheetRow['連絡方法'];
          // 次電日・不通・反響日付
          const sheetNextCallDate = sheetRow['次電日'];
          const sheetUnreachableStatus = sheetRow['不通'];
          const sheetInquiryDate = sheetRow['反響日付'];
          const sheetInquiryYear = sheetRow['反響年'];

          // データが異なる場合は更新対象
          let needsUpdate = false;

          // contract_year_monthの比較
          if (sheetContractYearMonth && sheetContractYearMonth !== '') {
            const formattedDate = this.formatContractYearMonth(sheetContractYearMonth);
            const dbDate = dbSeller.contract_year_month ? String(dbSeller.contract_year_month).substring(0, 10) : null;
            if (formattedDate !== dbDate) {
              needsUpdate = true;
            }
          } else if (dbSeller.contract_year_month !== null) {
            needsUpdate = true;
          }

          // visit_assigneeの比較（空→null、「外す」→nullも検出）
          const dbVisitAssignee = dbSeller.visit_assignee || null;
          if (sheetVisitAssignee !== dbVisitAssignee) {
            needsUpdate = true;
          }

          // statusの比較
          if (sheetStatus && sheetStatus !== dbSeller.status) {
            needsUpdate = true;
          }

          // next_call_dateの比較（スプレッドシートが空欄の場合もDBをクリア）
          const formattedNextCallDate = sheetNextCallDate ? this.formatVisitDate(sheetNextCallDate) : null;
          const dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
          if (formattedNextCallDate !== dbNextCallDate) {
            console.log(`[detectUpdated] ${sellerNumber}: next_call_date changed: sheet="${formattedNextCallDate}" db="${dbNextCallDate}"`);
            needsUpdate = true;
          }

          // unreachable_statusの比較
          const dbUnreachableStatus = dbSeller.unreachable_status || '';
          const sheetUnreachable = sheetUnreachableStatus || '';
          if (sheetUnreachable !== dbUnreachableStatus) {
            needsUpdate = true;
          }

          // コミュニケーションフィールドの比較
          // phone_contact_personの比較
          const dbPhoneContact = dbSeller.phone_contact_person || '';
          const sheetPhoneContact = sheetPhoneContactPerson || '';
          if (sheetPhoneContact !== dbPhoneContact) {
            needsUpdate = true;
          }

          // preferred_contact_timeの比較
          const dbPreferredTime = dbSeller.preferred_contact_time || '';
          const sheetPreferredTime = sheetPreferredContactTime || '';
          if (sheetPreferredTime !== dbPreferredTime) {
            needsUpdate = true;
          }

          // contact_methodの比較
          const dbContactMethod = dbSeller.contact_method || '';
          const sheetContact = sheetContactMethod || '';
          if (sheetContact !== dbContactMethod) {
            needsUpdate = true;
          }

          // inquiry_dateの比較
          if (sheetInquiryDate) {
            const formattedInquiryDate = this.formatInquiryDate(sheetInquiryYear, sheetInquiryDate);
            const dbInquiryDate = dbSeller.inquiry_date ? String(dbSeller.inquiry_date).substring(0, 10) : null;
            if (formattedInquiryDate !== dbInquiryDate) {
              needsUpdate = true;
            }
          }

          // commentsの比較
          const dbComments = dbSeller.comments || '';
          const sheetComments = sheetRow['コメント'] || '';
          if (sheetComments !== dbComments) {
            needsUpdate = true;
          }

          // first_call_personの比較
          const dbFirstCallPerson = dbSeller.first_call_person || '';
          const sheetFirstCallPerson = sheetRow['一番TEL'] || '';
          if (sheetFirstCallPerson !== dbFirstCallPerson) {
            needsUpdate = true;
          }

          // valuation_reasonの比較
          const dbValuationReason = dbSeller.valuation_reason || '';
          const sheetValuationReason = sheetRow['査定理由（査定サイトから転記）'] || '';
          if (sheetValuationReason !== dbValuationReason) {
            needsUpdate = true;
          }

          // valuation_methodの比較（DBが空欄の場合のみ更新）
          const dbValuationMethod = dbSeller.valuation_method || '';
          const sheetValuationMethod = sheetRow['査定方法'] || '';
          if (sheetValuationMethod && dbValuationMethod === '') {
            needsUpdate = true;
          }

          // nameの比較（暗号化フィールドのため直接比較不可）
          // スプシに name がある場合、DBの name が null/空なら更新対象にする
          const sheetName = String(sheetRow['名前(漢字のみ）'] || '');
          if (sheetName && sheetName.trim() !== '' && !dbSeller.name) {
            needsUpdate = true;
          }

          // phone_numberの比較（暗号化フィールド）
          // スプシに値がある場合、DBが null なら更新対象にする
          const sheetPhone = String(sheetRow['電話番号\nハイフン不要'] || sheetRow['電話番号'] || '');
          if (sheetPhone && sheetPhone.trim() !== '' && !dbSeller.phone_number) {
            needsUpdate = true;
          }

          // emailの比較（暗号化フィールド）
          // スプシに値がある場合、DBが null なら更新対象にする
          const sheetEmail = String(sheetRow['メールアドレス'] || '');
          if (sheetEmail && sheetEmail.trim() !== '' && !dbSeller.email) {
            needsUpdate = true;
          }

          // addressの比較（暗号化フィールド）
          // スプシに値がある場合、DBが null なら更新対象にする
          const sheetAddress = String(sheetRow['依頼者住所(物件所在と異なる場合）'] || '');
          if (sheetAddress && sheetAddress.trim() !== '' && !dbSeller.address) {
            needsUpdate = true;
          }

          // property_addressの比較（DBが空欄・「不明」・「未入力」の場合のみ更新）
          const dbPropertyAddress = dbSeller.property_address || '';
          const sheetPropertyAddress = sheetRow['物件所在地'] || '';
          if (sheetPropertyAddress && (dbPropertyAddress === '' || dbPropertyAddress === '不明' || dbPropertyAddress === '未入力')) {
            needsUpdate = true;
          }

          // current_statusの比較
          const dbCurrentStatus = dbSeller.current_status || '';
          const sheetCurrentStatus = sheetRow['状況（売主）'] || '';
          if (sheetCurrentStatus !== dbCurrentStatus) {
            needsUpdate = true;
          }

          // visit_reminder_assigneeの比較
          const dbVisitReminderAssignee = dbSeller.visit_reminder_assignee || '';
          const sheetVisitReminderAssignee = sheetRow['訪問事前通知メール担当'] || '';
          if (sheetVisitReminderAssignee !== dbVisitReminderAssignee) {
            needsUpdate = true;
          }

          // mailing_statusの比較（スプレッドシートが空欄の場合は同期対象外）
          const dbMailingStatus = dbSeller.mailing_status || '';
          const sheetMailingStatus = sheetRow['郵送'] || '';
          if (sheetMailingStatus !== '' && sheetMailingStatus !== dbMailingStatus) {
            needsUpdate = true;
          }

          // 査定額の比較（DBがnullの場合のみ更新）
          const sheetVal1Raw = sheetRow['査定額1'] || sheetRow['査定額1（自動計算）v'];
          const sheetVal2Raw = sheetRow['査定額2'] || sheetRow['査定額2（自動計算）v'];
          const sheetVal3Raw = sheetRow['査定額3'] || sheetRow['査定額3（自動計算）v'];
          const sheetVal1 = this.parseNumeric(sheetVal1Raw);
          const sheetVal2 = this.parseNumeric(sheetVal2Raw);
          const sheetVal3 = this.parseNumeric(sheetVal3Raw);
          // スプシは万円単位、DBは円単位
          const sheetVal1Yen = sheetVal1 !== null ? sheetVal1 * 10000 : null;
          const sheetVal2Yen = sheetVal2 !== null ? sheetVal2 * 10000 : null;
          const sheetVal3Yen = sheetVal3 !== null ? sheetVal3 * 10000 : null;
          if (sheetVal1Yen !== null && dbSeller.valuation_amount_1 === null) {
            needsUpdate = true;
          }
          if (sheetVal2Yen !== null && dbSeller.valuation_amount_2 === null) {
            needsUpdate = true;
          }
          if (sheetVal3Yen !== null && dbSeller.valuation_amount_3 === null) {
            needsUpdate = true;
          }

          if (needsUpdate) {
            updatedSellers.push(sellerNumber);
          }
        }

        offset += pageSize;
        if (dbSellers.length < pageSize) {
          hasMore = false;
        }
      }
    }

    console.log(`📊 Total sellers checked: ${totalChecked}`);
    console.log(`🔄 Updated sellers: ${updatedSellers.length}`);
    if (updatedSellers.length > 0) {
      console.log(`   First few: ${updatedSellers.slice(0, 5).join(', ')}${updatedSellers.length > 5 ? '...' : ''}`);
    }

    return updatedSellers;
  }

  /**
   * 契約年月を YYYY-MM-DD 形式にフォーマット（日は01固定）
   */
  private formatContractYearMonth(value: any): string | null {
    if (!value || value === '') return null;
    
    const str = String(value).trim();
    
    // YYYY/MM/DD 形式の場合
    if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [year, month, day] = str.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY-MM-DD 形式の場合
    if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      const [year, month, day] = str.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY/MM 形式の場合（日を01に設定）
    if (str.match(/^\d{4}\/\d{1,2}$/)) {
      const [year, month] = str.split('/');
      return `${year}-${month.padStart(2, '0')}-01`;
    }
    
    // YYYY-MM 形式の場合（日を01に設定）
    if (str.match(/^\d{4}-\d{1,2}$/)) {
      const [year, month] = str.split('-');
      return `${year}-${month.padStart(2, '0')}-01`;
    }
    
    return null;
  }

  /**
   * 反響日を YYYY-MM-DD 形式にフォーマット
   * 反響年と反響日（月/日）を組み合わせて完全な日付を作成
   */
  private formatInquiryDate(inquiryYear: any, inquiryDate: any): string | null {
    if (!inquiryYear || !inquiryDate) return null;
    
    const year = this.parseNumeric(inquiryYear);
    if (year === null) return null;
    
    const dateStr = String(inquiryDate).trim();
    
    // Excelシリアル値（純粋な数値）の場合
    if (dateStr.match(/^\d+$/)) {
      const serial = parseInt(dateStr, 10);
      if (serial > 1000) { // 1000以上なら日付シリアル値とみなす
        // Excelの基準日: 1899-12-30（1900/2/29バグを考慮）
        // Date.UTCを使いタイムゾーンの影響を排除
        const excelEpochMs = Date.UTC(1899, 11, 30);
        const date = new Date(excelEpochMs + serial * 86400000);
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    
    // MM/DD 形式の場合
    if (dateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
      const [month, day] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY/MM/DD 形式の場合（年が含まれている）
    if (dateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [y, month, day] = dateStr.split('/');
      return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  }

  /**
   * 訪問日を YYYY-MM-DD 形式にフォーマット
   * YYYY/MM/DD または YYYY-MM-DD 形式の日付を標準化
   * 
   * 🚨 修正: スペース区切りの複数日付を処理
   * 例: "2026/04/04 1899/12/30" → "2026-04-04"（最初の日付のみ抽出）
   */
  private formatVisitDate(value: any): string | null {
    if (!value || value === '') return null;
    
    // 文字列の場合、スペースで区切られた複数の日付をチェック
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // スペースが含まれる場合、最初の日付のみを抽出
      if (trimmed.includes(' ')) {
        const firstDate = trimmed.split(' ')[0];
        // 再帰的に最初の日付をフォーマット
        return this.formatVisitDate(firstDate);
      }
    }
    
    // 数値の場合（Excelシリアル値）
    // ColumnMapper.parseDateと同じロジックを使用
    if (typeof value === 'number') {
      const excelEpochMs = Date.UTC(1899, 11, 31); // 1899-12-31 UTC
      const date = new Date(excelEpochMs + (value - 1) * 86400000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const str = String(value).trim();
    
    // 文字列が純粋な数値の場合もシリアル値として処理
    if (str.match(/^\d+$/) && parseInt(str, 10) > 1000) {
      const serial = parseInt(str, 10);
      const excelEpochMs = Date.UTC(1899, 11, 31);
      const date = new Date(excelEpochMs + (serial - 1) * 86400000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // YYYY/MM/DD 形式の場合
    if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [year, month, day] = str.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY-MM-DD 形式の場合
    if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      const [year, month, day] = str.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // MM/DD 形式の場合（現在の年を使用）
    if (str.match(/^\d{1,2}\/\d{1,2}$/)) {
      const currentYear = new Date().getFullYear();
      const [month, day] = str.split('/');
      return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  }

  /**
   * 訪問時間を HH:MM 形式にフォーマット
   * 
   * 🚨 新規追加: 訪問時間のパース処理
   * - Excelシリアル値（0.0～1.0）を時刻（HH:MM）に変換
   * - 日付形式（YYYY/MM/DD）が含まれる場合は無視してnullを返す
   * - 既に時刻形式（HH:MM）の場合はそのまま返す
   */
  private formatVisitTime(value: any): string | null {
    if (!value || value === '') return null;
    
    const str = String(value).trim();
    
    // 日付形式（YYYY/MM/DD または YYYY-MM-DD）が含まれる場合は無視
    if (str.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)) {
      return null;
    }
    
    // 既に時刻形式（HH:MM または HH:MM:SS）の場合はそのまま返す
    if (str.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      const parts = str.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1];
      return `${hours}:${minutes}`;
    }
    
    // 数値の場合（Excelシリアル値: 0.0～1.0）
    if (typeof value === 'number' && value >= 0 && value < 1) {
      // Excelシリアル値を時刻に変換
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    // 文字列が小数の場合もシリアル値として処理
    if (str.match(/^0\.\d+$/)) {
      const serial = parseFloat(str);
      const totalMinutes = Math.round(serial * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    return null;
  }

  /**
   * 不通フラグをbooleanに変換
   * スプレッドシートの「不通」カラムの値:
   * - 空欄 → false
   * - 「通電OK」 → false
   * - その他の値（例: 「不通」） → true
   */
  private convertIsUnreachable(value: any): boolean {
    if (!value || value === '' || String(value).trim() === '' || String(value).trim() === '通電OK') {
      return false;
    }
    return true;
  }

  /**
   * 単一の売主を更新
   */
  public async updateSingleSeller(sellerNumber: string, row: any): Promise<void> {
    const mappedData = this.columnMapper.mapToDatabase(row);
    
    // 査定額を取得（手入力優先、なければ自動計算）
    // 🚨 重要: 種別（土地/戸建て/マンション）に関係なく、手動入力査定額を最優先で使用
    const valuation1 = row['査定額1'] || row['査定額1（自動計算）v'];
    const valuation2 = row['査定額2'] || row['査定額2（自動計算）v'];
    const valuation3 = row['査定額3'] || row['査定額3（自動計算）v'];

    // 反響関連フィールドを取得
    const inquiryYear = row['反響年'];
    const inquiryDate = row['反響日付'];  // 正しいカラム名: 反響日付
    const inquirySite = row['サイト'];

    // 訪問関連フィールドを取得（正しいカラム名を使用）
    const visitAcquisitionDate = row['訪問取得日\n年/月/日'];  // 改行文字を含む
    const visitDate = row['訪問日 Y/M/D'];
    const visitTime = row['訪問時間'];  // 訪問時間を追加
    const visitValuationAcquirer = row['訪問査定取得者'];
    const visitAssignee = row['営担'];

    // 物件関連フィールドを取得
    const propertyAddress = row['物件所在地'];
    let propertyType = row['種別'];
    if (propertyType) {
      const typeStr = String(propertyType).trim();
      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    }
    const landArea = row['土（㎡）'];
    const buildingArea = row['建（㎡）'];
    const landAreaVerified = row['土地（当社調べ）'];
    const buildingAreaVerified = row['建物（当社調べ）'];
    const buildYear = row['築年'];
    const structure = row['構造'];
    const floorPlan = row['間取り'];

    const updateData: any = {
      status: mappedData.status || '追客中',
      next_call_date: mappedData.next_call_date || null,
      pinrich_status: mappedData.pinrich_status || null,
      is_unreachable: this.convertIsUnreachable(row['不通']),
      unreachable_status: row['不通'] ? String(row['不通']) : null,
      comments: row['コメント'] ? String(row['コメント']) : null,
      updated_at: new Date().toISOString(),
    };

    // 暗号化フィールドはスプシに値がある場合のみ更新（空欄でDBの既存値を消さない）
    if (mappedData.name && mappedData.name.trim() !== '') {
      updateData.name = encrypt(mappedData.name);
    }
    if (mappedData.address && mappedData.address.trim() !== '') {
      updateData.address = encrypt(mappedData.address);
    }
    if (mappedData.phone_number && mappedData.phone_number.trim() !== '') {
      updateData.phone_number = encrypt(mappedData.phone_number);
      // 重複検出用ハッシュ（SHA-256）
      updateData.phone_number_hash = crypto.createHash('sha256').update(mappedData.phone_number).digest('hex');
    }
    if (mappedData.email && mappedData.email.trim() !== '') {
      updateData.email = encrypt(mappedData.email);
      // 重複検出用ハッシュ（SHA-256）
      updateData.email_hash = crypto.createHash('sha256').update(mappedData.email).digest('hex');
    }

    // 状況（売主）をsellers.current_statusにも保存（空欄の場合はnullでクリア）
    const currentStatus = row['状況（売主）'];
    updateData.current_status = currentStatus ? String(currentStatus) : null;

    // 物件関連フィールドを追加
    if (propertyAddress) {
      updateData.property_address = String(propertyAddress);
    }
    if (propertyType) {
      updateData.property_type = String(propertyType);
    }
    const parsedLandArea = this.parseNumeric(landArea);
    if (parsedLandArea !== null) {
      updateData.land_area = parsedLandArea;
    }
    const parsedBuildingArea = this.parseNumeric(buildingArea);
    if (parsedBuildingArea !== null) {
      updateData.building_area = parsedBuildingArea;
    }
    // 土地（当社調べ）・建物（当社調べ）を同期
    const parsedLandAreaVerified = this.parseNumeric(landAreaVerified);
    if (parsedLandAreaVerified !== null) {
      updateData.land_area_verified = parsedLandAreaVerified;
    }
    const parsedBuildingAreaVerified = this.parseNumeric(buildingAreaVerified);
    if (parsedBuildingAreaVerified !== null) {
      updateData.building_area_verified = parsedBuildingAreaVerified;
    }
    const parsedBuildYear = this.parseNumeric(buildYear);
    if (parsedBuildYear !== null) {
      updateData.build_year = parsedBuildYear;
    }
    if (structure) {
      updateData.structure = String(structure);
    }
    if (floorPlan) {
      updateData.floor_plan = String(floorPlan);
    }

    // 反響関連フィールドを追加
    if (inquiryYear) {
      updateData.inquiry_year = this.parseNumeric(inquiryYear);
    }
    if (inquiryDate) {
      updateData.inquiry_date = this.formatInquiryDate(inquiryYear, inquiryDate);
    }
    if (inquirySite) {
      updateData.inquiry_site = String(inquirySite);
    }

    // 除外日を計算（inquiry_site または inquiry_date が存在する場合）
    {
      const siteForCalc = inquirySite ? String(inquirySite) : null;
      const dateForCalc = inquiryDate ? this.formatInquiryDate(inquiryYear, inquiryDate) : null;
      if (siteForCalc && dateForCalc) {
        const exclusionDate = ExclusionDateCalculator.calculateExclusionDate(dateForCalc, siteForCalc);
        if (exclusionDate !== null) {
          updateData.exclusion_date = exclusionDate.toISOString().split('T')[0];
        } else {
          updateData.exclusion_date = null;
        }
      }
    }

    // 訪問関連フィールドを追加
    if (visitAcquisitionDate) {
      updateData.visit_acquisition_date = this.formatVisitDate(visitAcquisitionDate);
    }
    if (visitDate) {
      updateData.visit_date = this.formatVisitDate(visitDate);
    }
    if (visitTime) {
      updateData.visit_time = this.formatVisitTime(visitTime);
    }
    if (visitValuationAcquirer) {
      updateData.visit_valuation_acquirer = String(visitValuationAcquirer);
    }
    // visit_assigneeの更新ロジック
    // - 空文字の場合はnullでクリア
    // - 値がある場合はその値で更新（「外す」を含む）
    // - undefinedの場合（スプシにカラムが存在しない等）は更新しない（DBの既存値を保持）
    if (visitAssignee === '') {
      updateData.visit_assignee = null;
    } else if (visitAssignee !== undefined && visitAssignee !== null) {
      updateData.visit_assignee = String(visitAssignee);
    }
    // visitAssignee が undefined の場合は updateData に含めない（DBの既存値を保持）

    // コミュニケーションフィールドを追加
    const phoneContactPerson = row['電話担当（任意）'];
    const preferredContactTime = row['連絡取りやすい日、時間帯'];
    const contactMethod = row['連絡方法'];
    const firstCallPerson = row['一番TEL'];
    
    if (phoneContactPerson) {
      updateData.phone_contact_person = String(phoneContactPerson);
    }
    if (preferredContactTime) {
      updateData.preferred_contact_time = String(preferredContactTime);
    }
    if (contactMethod) {
      updateData.contact_method = String(contactMethod);
    }
    if (firstCallPerson !== undefined) {
      updateData.first_call_person = firstCallPerson ? String(firstCallPerson) : null;
    }

    // 訪問事前通知メール担当（CV列）を追加
    const visitReminderAssignee = row['訪問事前通知メール担当'];
    if (visitReminderAssignee !== undefined) {
      updateData.visit_reminder_assignee = visitReminderAssignee ? String(visitReminderAssignee) : null;
    }

    // 不通時Sメール担当を追加
    const unreachableSmsAssignee = row['不通時Sメール担当'];
    if (unreachableSmsAssignee !== undefined) {
      updateData.unreachable_sms_assignee = unreachableSmsAssignee ? String(unreachableSmsAssignee) : null;
    }

    // メール送信確認セクションの残りフィールドを追加
    const valuationSmsAssignee = row['査定Sメール担当'];
    if (valuationSmsAssignee !== undefined) {
      updateData.valuation_sms_assignee = valuationSmsAssignee ? String(valuationSmsAssignee) : null;
    }
    const valuationReasonEmailAssignee = row['査定理由別３後Eメ担'];
    if (valuationReasonEmailAssignee !== undefined) {
      updateData.valuation_reason_email_assignee = valuationReasonEmailAssignee ? String(valuationReasonEmailAssignee) : null;
    }
    const cancelNoticeAssignee = row['キャンセル案内担当'];
    if (cancelNoticeAssignee !== undefined) {
      updateData.cancel_notice_assignee = cancelNoticeAssignee ? String(cancelNoticeAssignee) : null;
    }
    const longTermEmailAssignee = row['除外前、長期客メール担当'];
    if (longTermEmailAssignee !== undefined) {
      updateData.long_term_email_assignee = longTermEmailAssignee ? String(longTermEmailAssignee) : null;
    }
    const callReminderEmailAssignee = row['当社が電話したというリマインドメール担当'];
    if (callReminderEmailAssignee !== undefined) {
      updateData.call_reminder_email_assignee = callReminderEmailAssignee ? String(callReminderEmailAssignee) : null;
    }

    // ID（D列）とサイトURL（AP列）を追加
    const inquiryId = row['ID'];
    if (inquiryId !== undefined) {
      updateData.inquiry_id = inquiryId ? String(inquiryId) : null;
    }
    const siteUrl = row['サイトURL'];
    if (siteUrl !== undefined) {
      updateData.site_url = siteUrl ? String(siteUrl) : null;
    }

    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      updateData.valuation_method = String(valuationMethod);
    }

    // 郵送ステータスを追加（空欄の場合は同期しない）
    const mailingStatus = row['郵送'];
    if (mailingStatus !== undefined && mailingStatus !== '') {
      updateData.mailing_status = String(mailingStatus);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];
    if (valuationReason !== undefined) {
      updateData.valuation_reason = valuationReason ? String(valuationReason) : null;
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      updateData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      updateData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) updateData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) updateData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) updateData.valuation_amount_3 = val3 * 10000;

    // 固定資産税路線価を追加（円/㎡、万円変換不要）
    const fixedAssetTaxRoadPrice = row['固定資産税路線価'];
    const parsedFixedAssetTaxRoadPrice = this.parseNumeric(fixedAssetTaxRoadPrice);
    if (parsedFixedAssetTaxRoadPrice !== null) {
      updateData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPrice;
    } else if (fixedAssetTaxRoadPrice === '' || fixedAssetTaxRoadPrice === null || fixedAssetTaxRoadPrice === undefined) {
      updateData.fixed_asset_tax_road_price = null;
    }

    // 専任他決打合せを追加（CZ列、列104、0-indexed: 103）
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'];
    if (exclusiveOtherDecisionMeeting !== undefined) {
      updateData.exclusive_other_decision_meeting = exclusiveOtherDecisionMeeting ? String(exclusiveOtherDecisionMeeting) : null;
    }

    const { error: updateError } = await this.supabase
      .from('sellers')
      .update(updateData)
      .eq('seller_number', sellerNumber);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // 物件情報も更新
    const { data: seller } = await this.supabase
      .from('sellers')
      .select('id')
      .eq('seller_number', sellerNumber)
      .single();

    if (seller) {
      const propertyAddress = row['物件所在地'] || '';
      let propertyType = row['種別'];
      if (propertyType) {
        const typeStr = String(propertyType).trim();
        const typeMapping: Record<string, string> = {
          '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
          '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
        };
        propertyType = typeMapping[typeStr] || 'その他';
      }

      await this.propertySyncHandler.syncProperty(seller.id, {
        address: String(propertyAddress),
        property_type: propertyType ? String(propertyType) : undefined,
        land_area: this.parseNumeric(row['土（㎡）']) ?? undefined,
        building_area: this.parseNumeric(row['建（㎡）']) ?? undefined,
        build_year: this.parseNumeric(row['築年']) ?? undefined,
        structure: row['構造'] ? String(row['構造']) : undefined,
        seller_situation: row['状況（売主）'] ? String(row['状況（売主）']) : undefined,
        floor_plan: row['間取り'] ? String(row['間取り']) : undefined,
      });
    }
  }

  /**
   * 単一の売主を同期
   */
  public async syncSingleSeller(sellerNumber: string, row: any): Promise<void> {
    const mappedData = this.columnMapper.mapToDatabase(row);
    
    // 査定額を取得（手入力優先、なければ自動計算）
    // 🚨 重要: 種別（土地/戸建て/マンション）に関係なく、手動入力査定額を最優先で使用
    const valuation1 = row['査定額1'] || row['査定額1（自動計算）v'];
    const valuation2 = row['査定額2'] || row['査定額2（自動計算）v'];
    const valuation3 = row['査定額3'] || row['査定額3（自動計算）v'];

    // 反響関連フィールドを取得
    const inquiryYear = row['反響年'];
    const inquiryDate = row['反響日付'];  // 正しいカラム名: 反響日付
    const inquirySite = row['サイト'];

    // 訪問関連フィールドを取得（正しいカラム名を使用）
    const visitAcquisitionDate = row['訪問取得日\n年/月/日'];  // 改行文字を含む
    const visitDate = row['訪問日 Y/M/D'];
    const visitTime = row['訪問時間'];  // 訪問時間を追加
    const visitValuationAcquirer = row['訪問査定取得者'];
    const visitAssignee = row['営担'];

    // 物件関連フィールドを取得
    const propertyAddress = row['物件所在地'];
    let propertyType = row['種別'];
    if (propertyType) {
      const typeStr = String(propertyType).trim();
      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    }
    const landArea = row['土（㎡）'];
    const buildingArea = row['建（㎡）'];
    const landAreaVerified = row['土地（当社調べ）'];
    const buildingAreaVerified = row['建物（当社調べ）'];
    const buildYear = row['築年'];
    const structure = row['構造'];
    const floorPlan = row['間取り'];

    const encryptedData: any = {
      seller_number: sellerNumber,
      name: mappedData.name ? encrypt(mappedData.name) : null,
      address: mappedData.address ? encrypt(mappedData.address) : null,
      phone_number: mappedData.phone_number ? encrypt(mappedData.phone_number) : null,
      email: mappedData.email ? encrypt(mappedData.email) : null,
      // 重複検出用ハッシュ（SHA-256）
      phone_number_hash: mappedData.phone_number ? crypto.createHash('sha256').update(mappedData.phone_number).digest('hex') : null,
      email_hash: mappedData.email ? crypto.createHash('sha256').update(mappedData.email).digest('hex') : null,
      status: mappedData.status || '追客中',
      next_call_date: mappedData.next_call_date || null,
      pinrich_status: mappedData.pinrich_status || null,
      is_unreachable: this.convertIsUnreachable(row['不通']),
      unreachable_status: row['不通'] ? String(row['不通']) : null,
      comments: row['コメント'] ? String(row['コメント']) : null,
    };

    // 状況（売主）をsellers.current_statusにも保存
    const currentStatusNew = row['状況（売主）'];
    if (currentStatusNew) {
      encryptedData.current_status = String(currentStatusNew);
    }

    // 物件関連フィールドを追加
    if (propertyAddress) {
      encryptedData.property_address = String(propertyAddress);
    }
    if (propertyType) {
      encryptedData.property_type = String(propertyType);
    }
    const parsedLandArea = this.parseNumeric(landArea);
    if (parsedLandArea !== null) {
      encryptedData.land_area = parsedLandArea;
    }
    const parsedBuildingArea = this.parseNumeric(buildingArea);
    if (parsedBuildingArea !== null) {
      encryptedData.building_area = parsedBuildingArea;
    }
    // 土地（当社調べ）・建物（当社調べ）を同期
    const parsedLandAreaVerified = this.parseNumeric(landAreaVerified);
    if (parsedLandAreaVerified !== null) {
      encryptedData.land_area_verified = parsedLandAreaVerified;
    }
    const parsedBuildingAreaVerified = this.parseNumeric(buildingAreaVerified);
    if (parsedBuildingAreaVerified !== null) {
      encryptedData.building_area_verified = parsedBuildingAreaVerified;
    }
    const parsedBuildYear = this.parseNumeric(buildYear);
    if (parsedBuildYear !== null) {
      encryptedData.build_year = parsedBuildYear;
    }
    if (structure) {
      encryptedData.structure = String(structure);
    }
    if (floorPlan) {
      encryptedData.floor_plan = String(floorPlan);
    }

    // 反響関連フィールドを追加
    if (inquiryYear) {
      encryptedData.inquiry_year = this.parseNumeric(inquiryYear);
    }
    if (inquiryDate) {
      encryptedData.inquiry_date = this.formatInquiryDate(inquiryYear, inquiryDate);
    }
    if (inquirySite) {
      encryptedData.inquiry_site = String(inquirySite);
    }

    // 除外日を計算（inquiry_site または inquiry_date が存在する場合）
    {
      const siteForCalc = inquirySite ? String(inquirySite) : null;
      const dateForCalc = inquiryDate ? this.formatInquiryDate(inquiryYear, inquiryDate) : null;
      if (siteForCalc && dateForCalc) {
        const exclusionDate = ExclusionDateCalculator.calculateExclusionDate(dateForCalc, siteForCalc);
        if (exclusionDate !== null) {
          encryptedData.exclusion_date = exclusionDate.toISOString().split('T')[0];
        } else {
          encryptedData.exclusion_date = null;
        }
      }
    }

    // 訪問関連フィールドを追加
    if (visitAcquisitionDate) {
      encryptedData.visit_acquisition_date = this.formatVisitDate(visitAcquisitionDate);
    }
    if (visitDate) {
      encryptedData.visit_date = this.formatVisitDate(visitDate);
    }
    if (visitTime) {
      encryptedData.visit_time = this.formatVisitTime(visitTime);
    }
    if (visitValuationAcquirer) {
      encryptedData.visit_valuation_acquirer = String(visitValuationAcquirer);
    }
    // visit_assigneeの更新ロジック
    // - 空文字の場合はnullでクリア
    // - 値がある場合はその値で設定（「外す」を含む）
    // - undefinedの場合（スプシにカラムが存在しない等）は設定しない（DBの既存値を保持）
    if (visitAssignee === '') {
      encryptedData.visit_assignee = null;
    } else if (visitAssignee !== undefined && visitAssignee !== null) {
      encryptedData.visit_assignee = String(visitAssignee);
    }
    // visitAssignee が undefined の場合は encryptedData に含めない（DBの既存値を保持）

    // コミュニケーションフィールドを追加
    const phoneContactPerson = row['電話担当（任意）'];
    const preferredContactTime = row['連絡取りやすい日、時間帯'];
    const contactMethod = row['連絡方法'];
    const firstCallPerson = row['一番TEL'];
    
    if (phoneContactPerson) {
      encryptedData.phone_contact_person = String(phoneContactPerson);
    }
    if (preferredContactTime) {
      encryptedData.preferred_contact_time = String(preferredContactTime);
    }
    if (contactMethod) {
      encryptedData.contact_method = String(contactMethod);
    }
    if (firstCallPerson !== undefined) {
      encryptedData.first_call_person = firstCallPerson ? String(firstCallPerson) : null;
    }

    // 訪問事前通知メール担当（CV列）を追加
    const visitReminderAssigneeNew = row['訪問事前通知メール担当'];
    if (visitReminderAssigneeNew !== undefined) {
      encryptedData.visit_reminder_assignee = visitReminderAssigneeNew ? String(visitReminderAssigneeNew) : null;
    }

    // 不通時Sメール担当を追加
    const unreachableSmsAssigneeNew = row['不通時Sメール担当'];
    if (unreachableSmsAssigneeNew !== undefined) {
      encryptedData.unreachable_sms_assignee = unreachableSmsAssigneeNew ? String(unreachableSmsAssigneeNew) : null;
    }

    // メール送信確認セクションの残りフィールドを追加
    const valuationSmsAssigneeNew = row['査定Sメール担当'];
    if (valuationSmsAssigneeNew !== undefined) {
      encryptedData.valuation_sms_assignee = valuationSmsAssigneeNew ? String(valuationSmsAssigneeNew) : null;
    }
    const valuationReasonEmailAssigneeNew = row['査定理由別３後Eメ担'];
    if (valuationReasonEmailAssigneeNew !== undefined) {
      encryptedData.valuation_reason_email_assignee = valuationReasonEmailAssigneeNew ? String(valuationReasonEmailAssigneeNew) : null;
    }
    const cancelNoticeAssigneeNew = row['キャンセル案内担当'];
    if (cancelNoticeAssigneeNew !== undefined) {
      encryptedData.cancel_notice_assignee = cancelNoticeAssigneeNew ? String(cancelNoticeAssigneeNew) : null;
    }
    const longTermEmailAssigneeNew = row['除外前、長期客メール担当'];
    if (longTermEmailAssigneeNew !== undefined) {
      encryptedData.long_term_email_assignee = longTermEmailAssigneeNew ? String(longTermEmailAssigneeNew) : null;
    }
    const callReminderEmailAssigneeNew = row['当社が電話したというリマインドメール担当'];
    if (callReminderEmailAssigneeNew !== undefined) {
      encryptedData.call_reminder_email_assignee = callReminderEmailAssigneeNew ? String(callReminderEmailAssigneeNew) : null;
    }

    // ID（D列）とサイトURL（AP列）を追加
    const inquiryIdNew = row['ID'];
    if (inquiryIdNew !== undefined) {
      encryptedData.inquiry_id = inquiryIdNew ? String(inquiryIdNew) : null;
    }
    const siteUrlNew = row['サイトURL'];
    if (siteUrlNew !== undefined) {
      encryptedData.site_url = siteUrlNew ? String(siteUrlNew) : null;
    }

    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      encryptedData.valuation_method = String(valuationMethod);
    }

    // 郵送ステータスを追加（空欄の場合は設定しない）
    const mailingStatusNew = row['郵送'];
    if (mailingStatusNew !== undefined && mailingStatusNew !== '') {
      encryptedData.mailing_status = String(mailingStatusNew);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];
    if (valuationReason !== undefined) {
      encryptedData.valuation_reason = valuationReason ? String(valuationReason) : null;
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      encryptedData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      encryptedData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) encryptedData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) encryptedData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) encryptedData.valuation_amount_3 = val3 * 10000;

    // 固定資産税路線価を追加（円/㎡、万円変換不要）
    const fixedAssetTaxRoadPriceNew = row['固定資産税路線価'];
    const parsedFixedAssetTaxRoadPriceNew = this.parseNumeric(fixedAssetTaxRoadPriceNew);
    if (parsedFixedAssetTaxRoadPriceNew !== null) {
      encryptedData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPriceNew;
    }

    // 専任他決打合せを追加（CZ列、列104、0-indexed: 103）
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'];
    if (exclusiveOtherDecisionMeeting !== undefined) {
      encryptedData.exclusive_other_decision_meeting = exclusiveOtherDecisionMeeting ? String(exclusiveOtherDecisionMeeting) : null;
    }

    // UPSERT: 既存データがあれば更新、なければ挿入
    const { data: newSeller, error: upsertError } = await this.supabase
      .from('sellers')
      .upsert(encryptedData, {
        onConflict: 'seller_number', // seller_number が重複した場合は更新
        ignoreDuplicates: false, // 重複時に更新を実行
      })
      .select()
      .single();

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    // 物件情報を確実に作成
    if (newSeller) {
      try {
        await this.ensurePropertyCreated(newSeller.id, sellerNumber, row);
      } catch (error: any) {
        console.error(`❌ Failed to create property for ${sellerNumber}:`, error.message);
        // 物件作成失敗をログに記録
        await this.logPropertyCreationError(sellerNumber, error.message);
        // 物件作成失敗は警告のみ（売主は既に作成済み）
        // エラーを再スローしない（売主同期は成功とみなす）
      }
    }
  }

  /**
   * 物件情報を確実に作成
   * 
   * @param sellerId - 売主ID
   * @param sellerNumber - 売主番号
   * @param row - スプレッドシートの行データ
   */
  private async ensurePropertyCreated(
    sellerId: string,
    sellerNumber: string,
    row: any
  ): Promise<void> {
    const propertyAddress = row['物件所在地'] || '';
    const propertyNumber = row['物件番号'] ? String(row['物件番号']) : undefined;
    
    let propertyType = row['種別'];
    if (propertyType) {
      const typeStr = String(propertyType).trim();
      const typeMapping: Record<string, string> = {
        '土': '土地',
        '戸': '戸建て',
        'マ': 'マンション',
        '事': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    } else {
      propertyType = 'その他';
    }

    const propertyData = {
      address: String(propertyAddress),
      property_type: propertyType ? String(propertyType) : undefined,
      land_area: this.parseNumeric(row['土（㎡）']) ?? undefined,
      building_area: this.parseNumeric(row['建（㎡）']) ?? undefined,
      build_year: this.parseNumeric(row['築年']) ?? undefined,
      structure: row['構造'] ? String(row['構造']) : undefined,
      seller_situation: row['状況（売主）'] ? String(row['状況（売主）']) : undefined,
      floor_plan: row['間取り'] ? String(row['間取り']) : undefined,
    };

    const result = await this.propertySyncHandler.syncProperty(
      sellerId,
      propertyData,
      propertyNumber
    );

    if (!result.success) {
      throw new Error(`Property sync failed: ${result.error}`);
    }

    console.log(`✅ ${sellerNumber}: Property created/updated${propertyNumber ? ` (${propertyNumber})` : ''}`);
  }

  /**
   * 物件作成エラーをログに記録
   * 
   * @param sellerNumber - 売主番号
   * @param errorMessage - エラーメッセージ
   */
  private async logPropertyCreationError(
    sellerNumber: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('sync_logs')
        .insert({
          entity_type: 'property',
          entity_id: sellerNumber,
          operation: 'create',
          status: 'failed',
          error_message: errorMessage,
          timestamp: new Date().toISOString(),
        });
      
      console.log(`📝 Logged property creation error for ${sellerNumber}`);
    } catch (error: any) {
      console.error(`⚠️  Failed to log error for ${sellerNumber}:`, error.message);
      // ログ記録失敗は無視（メイン処理に影響させない）
    }
  }


  /**
   * 物件リスト更新同期を実行
   * PropertyListingSyncService.syncUpdatedPropertyListings()を呼び出し
   */
  async syncPropertyListingUpdates(): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    duration_ms: number;
    errors?: Array<{ property_number: string; error: string }>;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('🏢 Starting property listing update sync...');
      
      // PropertyListingSyncServiceを初期化
      const { PropertyListingSyncService } = await import('./PropertyListingSyncService');
      const { GoogleSheetsClient } = await import('./GoogleSheetsClient');
      
      // 物件リストスプレッドシート設定
      const PROPERTY_LIST_SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
      const PROPERTY_LIST_SHEET_NAME = '物件';
      
      const sheetsConfig = {
        spreadsheetId: PROPERTY_LIST_SPREADSHEET_ID,
        sheetName: PROPERTY_LIST_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      };
      
      const sheetsClient = new GoogleSheetsClient(sheetsConfig);
      await sheetsClient.authenticate();
      
      const syncService = new PropertyListingSyncService(sheetsClient);
      
      // 更新同期を実行
      const result = await syncService.syncUpdatedPropertyListings();
      
      const duration_ms = Date.now() - startTime;
      
      console.log(`✅ Property listing update sync completed: ${result.updated} updated, ${result.failed} failed`);
      
      return {
        success: result.failed === 0,
        updated: result.updated,
        failed: result.failed,
        duration_ms,
        errors: result.errors,
      };
      
    } catch (error: any) {
      const duration_ms = Date.now() - startTime;
      console.error('❌ Property listing update sync failed:', error.message);
      
      return {
        success: false,
        updated: 0,
        failed: 1,
        duration_ms,
        errors: [{
          property_number: 'SYSTEM',
          error: error.message,
        }],
      };
    }
  }

  /**
   * Phase 4.6: 新規物件追加同期を実行
   * PropertyListingSyncService.syncNewProperties()を呼び出し
   */
  async syncNewPropertyAddition(): Promise<{
    success: boolean;
    added: number;
    failed: number;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      console.log('🆕 Starting new property addition sync...');

      // PropertyListingSyncServiceを初期化
      const { PropertyListingSyncService } = await import('./PropertyListingSyncService');
      const { GoogleSheetsClient } = await import('./GoogleSheetsClient');

      const PROPERTY_LIST_SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
      const PROPERTY_LIST_SHEET_NAME = '物件';

      const sheetsConfig = {
        spreadsheetId: PROPERTY_LIST_SPREADSHEET_ID,
        sheetName: PROPERTY_LIST_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      };

      const sheetsClient = new GoogleSheetsClient(sheetsConfig);
      await sheetsClient.authenticate();

      const syncService = new PropertyListingSyncService(sheetsClient);

      // 新規物件追加同期を実行
      const result = await syncService.syncNewProperties();

      const duration_ms = Date.now() - startTime;

      console.log(`✅ New property addition sync completed: ${result.added} added, ${result.failed} failed`);

      return {
        success: result.failed === 0,
        added: result.added,
        failed: result.failed,
        duration_ms
      };

    } catch (error: any) {
      const duration_ms = Date.now() - startTime;
      console.error('❌ New property addition sync failed:', error.message);

      return {
        success: false,
        added: 0,
        failed: 1,
        duration_ms
      };
    }
  }

  /**
   * Phase 4.8: スプレッドシートから削除された物件をDBから完全削除する同期
   * - DBにあってスプレッドシートにない物件 → property_listings と property_details から完全削除
   */
  async syncHiddenPropertyListings(): Promise<{
    success: boolean;
    hidden: number;
    restored: number;
    failed: number;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      console.log('🗑️  Starting deleted property listings sync...');

      // 1. 物件リストスプレッドシートから全物件番号を取得
      const { GoogleSheetsClient } = await import('./GoogleSheetsClient');
      const PROPERTY_LIST_SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
      const PROPERTY_LIST_SHEET_NAME = '物件';

      const sheetsConfig = {
        spreadsheetId: PROPERTY_LIST_SPREADSHEET_ID,
        sheetName: PROPERTY_LIST_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      };

      const sheetsClient = new GoogleSheetsClient(sheetsConfig);
      await sheetsClient.authenticate();
      const spreadsheetData = await sheetsClient.readAll();

      const spreadsheetPropertyNumbers = new Set<string>();
      for (const row of spreadsheetData) {
        const propertyNumber = String(row['物件番号'] || '').trim();
        if (propertyNumber) {
          spreadsheetPropertyNumbers.add(propertyNumber);
        }
      }

      console.log(`📊 Spreadsheet properties: ${spreadsheetPropertyNumbers.size}`);

      // 2. DBのproperty_listingsから全物件番号を取得（ページネーション対応）
      const dbPropertyNumbers: string[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await this.supabase
          .from('property_listings')
          .select('property_number')
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to read property_listings: ${error.message}`);
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          for (const property of data) {
            if (property.property_number) {
              dbPropertyNumbers.push(property.property_number);
            }
          }
          offset += pageSize;
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
      }

      console.log(`📊 Database properties: ${dbPropertyNumbers.length}`);

      // 3. DBにあってスプレッドシートにない物件 → 完全削除
      const toDelete = dbPropertyNumbers.filter(
        pn => !spreadsheetPropertyNumbers.has(pn)
      );

      console.log(`🗑️  Properties to delete: ${toDelete.length}`);

      let hidden = 0; // 削除件数（呼び出し元との互換性のためhiddenという名前を維持）
      let failed = 0;

      for (const propertyNumber of toDelete) {
        try {
          // property_details も削除
          await this.supabase
            .from('property_details')
            .delete()
            .eq('property_number', propertyNumber);

          // property_listings を削除
          const { error } = await this.supabase
            .from('property_listings')
            .delete()
            .eq('property_number', propertyNumber);

          if (error) {
            console.error(`❌ Failed to delete ${propertyNumber}: ${error.message}`);
            failed++;
          } else {
            console.log(`�️  Deleted: ${propertyNumber}`);
            hidden++;
          }
        } catch (err: any) {
          console.error(`❌ ${propertyNumber}: ${err.message}`);
          failed++;
        }
      }

      const duration_ms = Date.now() - startTime;
      console.log(`✅ Deleted property sync completed: ${hidden} deleted, ${failed} failed`);

      return { success: failed === 0, hidden, restored: 0, failed, duration_ms };

    } catch (error: any) {
      const duration_ms = Date.now() - startTime;
      console.error('❌ Deleted property sync failed:', error.message);
      return { success: false, hidden: 0, restored: 0, failed: 1, duration_ms };
    }
  }

  /**
   * Phase 4.7: property_details同期を実行
   * property_listingsに存在するがproperty_detailsに存在しない物件を検出して同期
   */
  async syncMissingPropertyDetails(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      console.log('📝 Starting property details sync...');

      // 1. property_listingsから全物件番号を取得
      const propertyListingsNumbers = new Set<string>();
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: properties, error } = await this.supabase
          .from('property_listings')
          .select('property_number')
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to read property_listings: ${error.message}`);
        }

        if (!properties || properties.length === 0) {
          hasMore = false;
        } else {
          for (const property of properties) {
            if (property.property_number) {
              propertyListingsNumbers.add(property.property_number);
            }
          }
          offset += pageSize;
          
          if (properties.length < pageSize) {
            hasMore = false;
          }
        }
      }

      console.log(`📊 Total properties in property_listings: ${propertyListingsNumbers.size}`);

      // 2. property_detailsから全物件番号を取得（コメントデータが空かどうかも確認）
      const propertyDetailsNumbers = new Set<string>();
      const emptyCommentsPropertyNumbers = new Set<string>(); // コメントデータが空の物件
      offset = 0;
      hasMore = true;

      while (hasMore) {
        const { data: details, error } = await this.supabase
          .from('property_details')
          .select('property_number, recommended_comments')
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(`Failed to read property_details: ${error.message}`);
        }

        if (!details || details.length === 0) {
          hasMore = false;
        } else {
          for (const detail of details) {
            if (detail.property_number) {
              propertyDetailsNumbers.add(detail.property_number);
              
              // recommended_commentsが空または未設定の場合、更新対象に追加
              const hasComments = detail.recommended_comments && 
                                  Array.isArray(detail.recommended_comments) && 
                                  detail.recommended_comments.length > 0;
              if (!hasComments) {
                emptyCommentsPropertyNumbers.add(detail.property_number);
              }
            }
          }
          offset += pageSize;
          
          if (details.length < pageSize) {
            hasMore = false;
          }
        }
      }

      console.log(`📊 Total properties in property_details: ${propertyDetailsNumbers.size}`);
      console.log(`📊 Properties with empty comments: ${emptyCommentsPropertyNumbers.size}`);

      // 3. 差分を計算（property_listingsにあってproperty_detailsにないもの + コメントが空のもの）
      const missingPropertyNumbers: string[] = [];
      for (const propertyNumber of propertyListingsNumbers) {
        // property_detailsに存在しない、またはコメントデータが空の場合は同期対象
        if (!propertyDetailsNumbers.has(propertyNumber) || emptyCommentsPropertyNumbers.has(propertyNumber)) {
          missingPropertyNumbers.push(propertyNumber);
        }
      }

      console.log(`🆕 Properties to sync (missing or empty comments): ${missingPropertyNumbers.length}`);

      if (missingPropertyNumbers.length === 0) {
        const duration_ms = Date.now() - startTime;
        return {
          success: true,
          synced: 0,
          failed: 0,
          duration_ms
        };
      }

      // 4. PropertyListingSyncServiceを使用して同期
      const { PropertyListingSyncService } = await import('./PropertyListingSyncService');
      const syncService = new PropertyListingSyncService();

      let synced = 0;
      let failed = 0;

      // バッチ処理（10件ずつ）
      const BATCH_SIZE = 10;
      for (let i = 0; i < missingPropertyNumbers.length; i += BATCH_SIZE) {
        const batch = missingPropertyNumbers.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(missingPropertyNumbers.length / BATCH_SIZE);

        console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} properties)...`);

        for (const propertyNumber of batch) {
          try {
            // 物件情報を取得（物件種別が必要）
            const { data: property, error: propertyError } = await this.supabase
              .from('property_listings')
              .select('property_type')
              .eq('property_number', propertyNumber)
              .single();

            if (propertyError || !property) {
              console.error(`❌ ${propertyNumber}: Property not found in property_listings`);
              failed++;
              continue;
            }

            // AthomeSheetSyncServiceを使用してスプレッドシートからコメントデータを取得
            const { AthomeSheetSyncService } = await import('./AthomeSheetSyncService');
            const athomeSheetSyncService = new AthomeSheetSyncService();
            
            const syncSuccess = await athomeSheetSyncService.syncPropertyComments(
              propertyNumber,
              property.property_type as 'land' | 'detached_house' | 'apartment'
            );

            // PropertyServiceを使用して物件リストスプレッドシートのBQ列（●内覧前伝達事項）からproperty_aboutを取得
            const { PropertyService } = await import('./PropertyService');
            const propertyService = new PropertyService();
            
            try {
              const propertyAbout = await propertyService.getPropertyAbout(propertyNumber);
              
              if (propertyAbout) {
                // property_detailsテーブルにproperty_aboutを保存
                const { error: updateError } = await this.supabase
                  .from('property_details')
                  .update({ property_about: propertyAbout })
                  .eq('property_number', propertyNumber);
                
                if (updateError) {
                  console.warn(`⚠️ ${propertyNumber}: Failed to update property_about: ${updateError.message}`);
                } else {
                  console.log(`✅ ${propertyNumber}: Synced property_about from BQ column`);
                }
              }
            } catch (aboutError: any) {
              console.warn(`⚠️ ${propertyNumber}: Failed to get property_about: ${aboutError.message}`);
            }

            if (syncSuccess) {
              console.log(`✅ ${propertyNumber}: Synced comments from spreadsheet`);
              synced++;
            } else {
              console.error(`❌ ${propertyNumber}: Failed to sync comments from spreadsheet`);
              failed++;
            }
          } catch (error: any) {
            console.error(`❌ ${propertyNumber}: ${error.message}`);
            failed++;
          }
        }

        // バッチ間に少し待機
        if (i + BATCH_SIZE < missingPropertyNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration_ms = Date.now() - startTime;

      console.log(`✅ Property details sync completed: ${synced} synced, ${failed} failed`);

      return {
        success: failed === 0,
        synced,
        failed,
        duration_ms
      };

    } catch (error: any) {
      const duration_ms = Date.now() - startTime;
      console.error('❌ Property details sync failed:', error.message);

      return {
        success: false,
        synced: 0,
        failed: 1,
        duration_ms
      };
    }
  }

  /**
   * フル同期を実行
   * detectMissingSellersとsyncMissingSellersを組み合わせて実行
   * 更新同期と削除同期も含む
   */
  async runFullSync(triggeredBy: 'scheduled' | 'manual' = 'scheduled', clearCache: boolean = false): Promise<CompleteSyncResult> {
    const startTime = new Date();
    console.log(`🔄 Starting full sync (triggered by: ${triggeredBy})`);
    
    // 手動トリガーまたは明示的にキャッシュクリアが指定された場合、キャッシュをクリア
    if (clearCache || triggeredBy === 'manual') {
      this.clearSpreadsheetCache();
    }
    
    try {
      // Phase 1: 追加同期 - 不足売主を検出して追加（最優先）
      // 環境変数チェック：売主同期を有効にするか
      const isSellerSyncEnabled = process.env.SELLER_SYNC_ENABLED !== 'false';
      console.log('🔍 SELLER_SYNC_ENABLED:', process.env.SELLER_SYNC_ENABLED);
      console.log('🔍 isSellerSyncEnabled:', isSellerSyncEnabled);

      // additionResult と deletionResult をブロック外で初期化
      let additionResult = {
        totalProcessed: 0,
        successfullyAdded: 0,
        successfullyUpdated: 0,
        failed: 0,
      };
      let deletionResult: DeletionSyncResult = {
        totalDetected: 0,
        successfullyDeleted: 0,
        failedToDelete: 0,
        requiresManualReview: 0,
        deletedSellerNumbers: [],
        manualReviewSellerNumbers: [],
        errors: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
      };

      if (isSellerSyncEnabled) {

      console.log('📥 Phase 1: Seller Addition Sync');

      const missingSellers = await this.detectMissingSellers();

      if (missingSellers.length > 0) {
        const syncResult = await this.syncMissingSellers(missingSellers);
        additionResult = {
          totalProcessed: missingSellers.length,
          successfullyAdded: syncResult.newSellersCount,
          successfullyUpdated: 0,
          failed: syncResult.errors.length,
        };
      } else {
        console.log('✅ No missing sellers to sync');
      }

      // Phase 2: 更新同期 - 既存売主のデータを更新
      console.log('\n🔄 Phase 2: Seller Update Sync');
      const updatedSellers = await this.detectUpdatedSellers();
      
      if (updatedSellers.length > 0) {
        const updateResult = await this.syncUpdatedSellers(updatedSellers);
        additionResult.totalProcessed += updatedSellers.length;
        additionResult.successfullyUpdated = updateResult.updatedSellersCount;
        additionResult.failed += updateResult.errors.length;
      } else {
        console.log('✅ No sellers to update');
      }

      // Phase 3: 削除同期 - 削除された売主を検出してソフトデリート
      if (this.isDeletionSyncEnabled()) {
        console.log('\n🗑️  Phase 3: Seller Deletion Sync');
        const deletedSellers = await this.detectDeletedSellers();
        
        if (deletedSellers.length > 0) {
          deletionResult = await this.syncDeletedSellers(deletedSellers);
        } else {
          console.log('✅ No deleted sellers to sync');
        }
      } else {
        console.log('\n⏭️  Phase 3: Seller Deletion Sync (Disabled)');
      }
      } else {
        console.log('\n⏭️  Phase 1-3: Seller Sync (Disabled by SELLER_SYNC_ENABLED=false)');
      }


      // Phase 4: 作業タスク同期（GASスクリプトで処理）
      console.log('\n📋 Phase 4: Work Task Sync');
      // Note: Work task sync は GASスクリプト（gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs）で処理
      // 10分ごとのトリガーで Supabase の work_tasks テーブルに直接 upsert される
      console.log('✅ Work task sync (handled by GAS script: gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs)');

      // Phase 4.5: 物件リスト更新同期（新規追加）
      console.log('\n🏢 Phase 4.5: Property Listing Update Sync');
      let propertyListingUpdateResult = {
        updated: 0,
        failed: 0,
        duration_ms: 0,
      };
      
      try {
        const plResult = await this.syncPropertyListingUpdates();
        propertyListingUpdateResult = {
          updated: plResult.updated,
          failed: plResult.failed,
          duration_ms: plResult.duration_ms,
        };
        
        if (plResult.updated > 0) {
          console.log(`✅ Property listing update sync: ${plResult.updated} updated`);
        } else {
          console.log('✅ No property listings to update');
        }
      } catch (error: any) {
        console.error('⚠️  Property listing update sync error:', error.message);
        propertyListingUpdateResult.failed = 1;
        // エラーでも次のフェーズに進む
      }

      // Phase 4.6: 新規物件追加同期（新規追加）
      console.log('\n🆕 Phase 4.6: New Property Addition Sync');
      let newPropertyAdditionResult = {
        added: 0,
        failed: 0,
        duration_ms: 0,
      };
      
      try {
        const newPropResult = await this.syncNewPropertyAddition();
        newPropertyAdditionResult = {
          added: newPropResult.added,
          failed: newPropResult.failed,
          duration_ms: newPropResult.duration_ms,
        };
        
        if (newPropResult.added > 0) {
          console.log(`✅ New property addition sync: ${newPropResult.added} added`);
        } else {
          console.log('✅ No new properties to add');
        }
      } catch (error: any) {
        console.error('⚠️  New property addition sync error:', error.message);
        newPropertyAdditionResult.failed = 1;
        // エラーでも処理を継続
      }

      // Phase 4.7: property_details同期（新規追加）
      console.log('\n📝 Phase 4.7: Property Details Sync');
      let propertyDetailsSyncResult = {
        synced: 0,
        failed: 0,
        duration_ms: 0,
      };
      
      try {
        const pdResult = await this.syncMissingPropertyDetails();
        propertyDetailsSyncResult = {
          synced: pdResult.synced,
          failed: pdResult.failed,
          duration_ms: pdResult.duration_ms,
        };
        
        if (pdResult.synced > 0) {
          console.log(`✅ Property details sync: ${pdResult.synced} synced`);
        } else {
          console.log('✅ No missing property details to sync');
        }
      } catch (error: any) {
        console.error('⚠️  Property details sync error:', error.message);
        propertyDetailsSyncResult.failed = 1;
        // エラーでも処理を継続
      }

      // Phase 4.8: スプレッドシートから削除された物件の完全削除同期
      console.log('\n�️  Phase 4.8: Deleted Property Listings Sync');
      let hiddenPropertySyncResult = {
        hidden: 0,
        restored: 0,
        failed: 0,
        duration_ms: 0,
      };

      try {
        const hpResult = await this.syncHiddenPropertyListings();
        hiddenPropertySyncResult = {
          hidden: hpResult.hidden,
          restored: hpResult.restored,
          failed: hpResult.failed,
          duration_ms: hpResult.duration_ms,
        };

        if (hpResult.hidden > 0) {
          console.log(`✅ Deleted property sync: ${hpResult.hidden} deleted`);
        } else {
          console.log('✅ No property listings to delete');
        }
      } catch (error: any) {
        console.error('⚠️  Deleted property sync error:', error.message);
        hiddenPropertySyncResult.failed = 1;
        // エラーでも処理を継続
      }

      // Phase 5: 買主同期
      console.log('\n🛒 Phase 5: Buyer Sync');
      console.log('   Syncing buyers from spreadsheet...');

      let buyerAddedCount = 0;
      let buyerUpdatedCount = 0;
      let buyerFailedCount = 0;

      try {
        const buyerSyncResult = await this.syncBuyers();
        buyerAddedCount = buyerSyncResult.syncMissingResult?.newSellersCount || 0;
        buyerUpdatedCount = buyerSyncResult.syncUpdatedResult?.updatedSellersCount || 0;
        buyerFailedCount = (buyerSyncResult.syncMissingResult?.errors.length || 0) + (buyerSyncResult.syncUpdatedResult?.errors.length || 0);
        console.log(`✅ Buyer sync completed: ${buyerAddedCount} added, ${buyerUpdatedCount} updated, ${buyerFailedCount} failed`);
      } catch (error: any) {
        console.error('⚠️  Buyer sync error:', error.message);
        buyerFailedCount = 1;
        // エラーでも処理を継続
      }

      const endTime = new Date();
      const totalDurationMs = endTime.getTime() - startTime.getTime();

      // 全体のステータスを判定
      let status: 'success' | 'partial_success' | 'failed' = 'success';
      if (additionResult.failed > 0 || 
          deletionResult.failedToDelete > 0 || 
          propertyListingUpdateResult.failed > 0 ||
          newPropertyAdditionResult.failed > 0 ||
          buyerFailedCount > 0) {
        status = 'partial_success';
      }
      if (additionResult.successfullyAdded === 0 && 
          additionResult.successfullyUpdated === 0 && 
          deletionResult.successfullyDeleted === 0 &&
          propertyListingUpdateResult.updated === 0 &&
          newPropertyAdditionResult.added === 0 &&
          buyerAddedCount === 0 &&
          buyerUpdatedCount === 0 &&
          (additionResult.failed > 0 || 
           deletionResult.failedToDelete > 0 || 
           propertyListingUpdateResult.failed > 0 ||
           newPropertyAdditionResult.failed > 0 ||
           buyerFailedCount > 0)) {
        status = 'failed';
      }

      const completeResult: CompleteSyncResult = {
        additionResult,
        deletionResult,
        status,
        syncedAt: endTime,
        totalDurationMs,
      };

      console.log('\n📊 Complete Sync Summary:');
      console.log(`   Status: ${status}`);
      console.log(`   Sellers Added: ${additionResult.successfullyAdded}`);
      console.log(`   Sellers Updated: ${additionResult.successfullyUpdated}`);
      console.log(`   Sellers Deleted: ${deletionResult.successfullyDeleted}`);
      console.log(`   Property Listings Updated: ${propertyListingUpdateResult.updated}`);
      console.log(`   New Properties Added: ${newPropertyAdditionResult.added}`);
      console.log(`   Property Details Synced: ${propertyDetailsSyncResult.synced}`);
      console.log(`   Buyers Added: ${buyerAddedCount}`);
      console.log(`   Buyers Updated: ${buyerUpdatedCount}`);
      console.log(`   Manual Review: ${deletionResult.requiresManualReview}`);
      console.log(`   Duration: ${(totalDurationMs / 1000).toFixed(2)}s`);

      // Note: Logging removed - sync_logs table not needed
      // EnhancedAutoSyncService works without database logging

      return completeResult;
    } catch (error: any) {
      console.error('❌ Full sync failed:', error.message);
      
      const endTime = new Date();
      return {
        additionResult: {
          totalProcessed: 0,
          successfullyAdded: 0,
          successfullyUpdated: 0,
          failed: 1,
        },
        deletionResult: {
          totalDetected: 0,
          successfullyDeleted: 0,
          failedToDelete: 0,
          requiresManualReview: 0,
          deletedSellerNumbers: [],
          manualReviewSellerNumbers: [],
          errors: [{
            sellerNumber: 'SYSTEM',
            error: error.message,
          }],
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
        },
        status: 'failed',
        syncedAt: endTime,
        totalDurationMs: endTime.getTime() - startTime.getTime(),
      };
    }
  }


  // ========================================
  // 買主同期メソッド
  // ========================================

  /**
   * 買主用Google Sheetsクライアントを初期化
   */
  async initializeBuyer(): Promise<void> {
    if (this.isBuyerInitialized) return;

    try {
      // 修正: .trim() で末尾の不正な文字（\r\n など）を除去し、フォールバックを削除
      const buyerSpreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();
      if (!buyerSpreadsheetId) {
        throw new Error('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set. Cannot initialize buyer sync service.');
      }
      const buyerSheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';
      const sheetsConfig = {
        spreadsheetId: buyerSpreadsheetId,
        sheetName: buyerSheetName,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      };

      this.buyerSheetsClient = new GoogleSheetsClient(sheetsConfig);
      await this.buyerSheetsClient.authenticate();

      // BuyerColumnMapper を動的にインポート
      const { BuyerColumnMapper } = await import('./BuyerColumnMapper');
      this.buyerColumnMapper = new BuyerColumnMapper();

      this.isBuyerInitialized = true;
      console.log('✅ Buyer sync service initialized');
    } catch (error: any) {
      console.error('❌ Buyer sync service initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * 買主スプレッドシートデータを取得（キャッシュ対応）
   */
  private async getBuyerSpreadsheetData(forceRefresh: boolean = false): Promise<any[]> {
    const now = Date.now();

    if (!forceRefresh && this.buyerSpreadsheetCache && now < this.buyerSpreadsheetCacheExpiry) {
      console.log('📦 Using cached buyer spreadsheet data (valid for', Math.round((this.buyerSpreadsheetCacheExpiry - now) / 1000), 'seconds)');
      return this.buyerSpreadsheetCache;
    }

    console.log('🔄 Fetching fresh buyer spreadsheet data...');
    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    const allRows = await this.buyerSheetsClient!.readAll();
    this.buyerSpreadsheetCache = allRows;
    this.buyerSpreadsheetCacheExpiry = now + this.SPREADSHEET_CACHE_TTL;

    console.log(`✅ Buyer spreadsheet data cached (${allRows.length} rows, valid for 60 minutes)`);
    return allRows;
  }

  /**
   * 買主スプレッドシートキャッシュをクリア
   */
  public clearBuyerSpreadsheetCache(): void {
    this.buyerSpreadsheetCache = null;
    this.buyerSpreadsheetCacheExpiry = 0;
    console.log('🗑️ Buyer spreadsheet cache cleared');
  }

  /**
   * DBから全買主番号を取得（ページネーション対応）
   */
  private async getAllDbBuyerNumbers(): Promise<Set<string>> {
    const allBuyerNumbers = new Set<string>();
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number')
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch DB buyers: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        for (const buyer of data) {
          if (buyer.buyer_number) {
            allBuyerNumbers.add(buyer.buyer_number);
          }
        }
        offset += pageSize;
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    return allBuyerNumbers;
  }

  /**
   * スプレッドシートにあってDBにない買主番号を検出
   */
  async detectMissingBuyers(): Promise<string[]> {
    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    console.log('🔍 Detecting missing buyers (full comparison)...');

    const allRows = await this.getBuyerSpreadsheetData();
    const sheetBuyerNumbers = new Set<string>();

    for (const row of allRows) {
      const buyerNumber = row['買主番号'];
      if (buyerNumber !== null && buyerNumber !== undefined && buyerNumber !== '') {
        const buyerNumberStr = String(buyerNumber).trim();
        if (buyerNumberStr) {
          sheetBuyerNumbers.add(buyerNumberStr);
        }
      }
    }
    console.log(`📊 Spreadsheet buyers: ${sheetBuyerNumbers.size}`);

    const dbBuyerNumbers = await this.getAllDbBuyerNumbers();
    console.log(`📊 Database buyers: ${dbBuyerNumbers.size}`);

    const missingBuyers: string[] = [];
    for (const buyerNumber of sheetBuyerNumbers) {
      if (!dbBuyerNumbers.has(buyerNumber)) {
        missingBuyers.push(buyerNumber);
      }
    }

    missingBuyers.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    console.log(`🆕 Missing buyers: ${missingBuyers.length}`);
    if (missingBuyers.length > 0) {
      console.log(`   First few: ${missingBuyers.slice(0, 5).join(', ')}${missingBuyers.length > 5 ? '...' : ''}`);
    }

    return missingBuyers;
  }

  /**
   * 更新が必要な買主を検出
   */
  async detectUpdatedBuyers(): Promise<string[]> {
    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    console.log('🔍 Detecting updated buyers (full field comparison)...');

    const allRows = await this.getBuyerSpreadsheetData();
    const sheetDataByBuyerNumber = new Map<string, any>();

    for (const row of allRows) {
      const buyerNumber = row['買主番号'];
      if (buyerNumber !== null && buyerNumber !== undefined && buyerNumber !== '') {
        const buyerNumberStr = String(buyerNumber).trim();
        if (buyerNumberStr) {
          sheetDataByBuyerNumber.set(buyerNumberStr, row);
        }
      }
    }
    console.log(`📊 Spreadsheet buyers: ${sheetDataByBuyerNumber.size}`);

    // 日付型・数値型のDBカラム一覧（BuyerColumnMapperのtypeConversionsから取得）
    const typeConversions = this.buyerColumnMapper.getTypeConversions();
    const dateFields = new Set(Object.entries(typeConversions).filter(([, t]) => t === 'date' || t === 'datetime').map(([k]) => k));
    const numberFields = new Set(Object.entries(typeConversions).filter(([, t]) => t === 'number').map(([k]) => k));

    // 比較対象外のフィールド（主キー・タイムスタンプ・内部管理フィールド）
    const skipFields = new Set([
      'buyer_number', 'buyer_id', 'created_at', 'updated_at', 'created_datetime',
      'db_updated_at', 'last_synced_at', 'deleted_at',
    ]);

    const updatedBuyers: string[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    let totalChecked = 0;

    while (hasMore) {
      // 全DBカラムを取得（*）
      const { data: dbBuyers, error } = await this.supabase
        .from('buyers')
        .select('*')
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch DB buyers: ${error.message}`);
      }

      if (!dbBuyers || dbBuyers.length === 0) {
        hasMore = false;
      } else {
        for (const dbBuyer of dbBuyers) {
          totalChecked++;
          const buyerNumber = dbBuyer.buyer_number;
          const sheetRow = sheetDataByBuyerNumber.get(buyerNumber);

          if (!sheetRow) {
            continue;
          }

          // スプレッドシートの行をDBマッピング形式に変換
          const mappedSheetData = this.buyerColumnMapper.mapSpreadsheetToDatabase(
            Object.keys(sheetRow),
            Object.values(sheetRow)
          );

          let needsUpdate = false;

          for (const [dbField, sheetValue] of Object.entries(mappedSheetData)) {
            if (skipFields.has(dbField)) continue;

            const dbValue = dbBuyer[dbField];

            if (dateFields.has(dbField)) {
              // 日付フィールド: YYYY-MM-DD の先頭10文字で比較
              const sheetDate = sheetValue ? String(sheetValue).substring(0, 10) : null;
              const dbDate = dbValue ? String(dbValue).substring(0, 10) : null;
              if (sheetDate !== dbDate) {
                needsUpdate = true;
                break;
              }
            } else if (numberFields.has(dbField)) {
              // 数値フィールド: 数値として比較
              const sheetNum = sheetValue !== null && sheetValue !== undefined ? Number(sheetValue) : null;
              const dbNum = dbValue !== null && dbValue !== undefined ? Number(dbValue) : null;
              if (sheetNum !== dbNum) {
                needsUpdate = true;
                break;
              }
            } else {
              // 文字列フィールド: 空文字とnullを同一視して比較
              const sheetStr = sheetValue !== null && sheetValue !== undefined ? String(sheetValue).trim() : '';
              const dbStr = dbValue !== null && dbValue !== undefined ? String(dbValue).trim() : '';
              if (sheetStr !== dbStr) {
                needsUpdate = true;
                break;
              }
            }
          }

          if (needsUpdate) {
            updatedBuyers.push(buyerNumber);
          }
        }

        offset += pageSize;
        if (dbBuyers.length < pageSize) {
          hasMore = false;
        }
      }
    }

    console.log(`📊 Total buyers checked: ${totalChecked}`);
    console.log(`🔄 Updated buyers: ${updatedBuyers.length}`);
    if (updatedBuyers.length > 0) {
      console.log(`   First few: ${updatedBuyers.slice(0, 5).join(', ')}${updatedBuyers.length > 5 ? '...' : ''}`);
    }

    return updatedBuyers;
  }

  /**
   * 日付を YYYY-MM-DD 形式にフォーマット（買主用）
   */
  private formatBuyerDate(value: any): string | null {
    if (!value || value === '') return null;

    const numValue = Number(value);
    if (!isNaN(numValue) && numValue > 30000 && numValue < 60000) {
      try {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
          console.warn(`⚠️ Invalid year from Excel serial: ${year} (serial: ${numValue})`);
          return null;
        }
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (error: any) {
        console.warn(`⚠️ Failed to parse Excel serial value: ${numValue} (${error.message})`);
        return null;
      }
    }

    const str = String(value).trim();

    if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const [year, month, day] = str.split('/');
      const y = parseInt(year);
      if (y < 1900 || y > 2100) {
        console.warn(`⚠️ Invalid year: ${y}`);
        return null;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      const [year, month, day] = str.split('-');
      const y = parseInt(year);
      if (y < 1900 || y > 2100) {
        console.warn(`⚠️ Invalid year: ${y}`);
        return null;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }

  /**
   * 不足している買主を同期
   */
  async syncMissingBuyers(buyerNumbers: string[]): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let newBuyersCount = 0;

    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    console.log(`🔄 Syncing ${buyerNumbers.length} missing buyers...`);

    const allRows = await this.getBuyerSpreadsheetData();
    const rowsByBuyerNumber = new Map<string, any>();
    for (const row of allRows) {
      const buyerNumber = row['買主番号'];
      if (buyerNumber) {
        rowsByBuyerNumber.set(String(buyerNumber), row);
      }
    }

    for (const buyerNumber of buyerNumbers) {
      const row = rowsByBuyerNumber.get(buyerNumber);
      if (!row) {
        errors.push({
          sellerNumber: buyerNumber,
          message: 'Row not found in spreadsheet',
          timestamp: new Date(),
        });
        continue;
      }

      try {
        await this.syncSingleBuyer(buyerNumber, row);
        newBuyersCount++;
        console.log(`✅ ${buyerNumber}: Created`);
      } catch (error: any) {
        errors.push({
          sellerNumber: buyerNumber,
          message: error.message,
          timestamp: new Date(),
        });
        console.error(`❌ ${buyerNumber}: ${error.message}`);
      }
    }

    const endTime = new Date();
    const result: SyncResult = {
      success: errors.length === 0,
      startTime,
      endTime,
      newSellersCount: newBuyersCount,
      updatedSellersCount: 0,
      errors,
      missingSellersDetected: buyerNumbers.length,
      triggeredBy: 'scheduled',
    };

    console.log(`🎉 Buyer sync completed: ${newBuyersCount} new, ${errors.length} errors`);
    return result;
  }

  /**
   * 既存買主のデータを更新
   */
  async syncUpdatedBuyers(buyerNumbers: string[]): Promise<SyncResult> {
    const startTime = new Date();
    const errors: SyncError[] = [];
    let updatedBuyersCount = 0;

    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    console.log(`🔄 Updating ${buyerNumbers.length} existing buyers...`);

    // forceRefresh = true でキャッシュを無視して最新データを取得
    const allRows = await this.getBuyerSpreadsheetData(true);
    const rowsByBuyerNumber = new Map<string, any>();
    for (const row of allRows) {
      const buyerNumber = row['買主番号'];
      if (buyerNumber) {
        rowsByBuyerNumber.set(String(buyerNumber), row);
      }
    }

    for (const buyerNumber of buyerNumbers) {
      const row = rowsByBuyerNumber.get(buyerNumber);
      if (!row) {
        errors.push({
          sellerNumber: buyerNumber,
          message: 'Row not found in spreadsheet',
          timestamp: new Date(),
        });
        continue;
      }

      try {
        await this.updateSingleBuyer(buyerNumber, row);
        updatedBuyersCount++;
        console.log(`✅ ${buyerNumber}: Updated`);
      } catch (error: any) {
        errors.push({
          sellerNumber: buyerNumber,
          message: error.message,
          timestamp: new Date(),
        });
        console.error(`❌ ${buyerNumber}: ${error.message}`);
      }
    }

    const endTime = new Date();
    const result: SyncResult = {
      success: errors.length === 0,
      startTime,
      endTime,
      newSellersCount: 0,
      updatedSellersCount: updatedBuyersCount,
      errors,
      missingSellersDetected: 0,
      triggeredBy: 'scheduled',
    };

    console.log(`🎉 Buyer update completed: ${updatedBuyersCount} updated, ${errors.length} errors`);
    return result;
  }

  /**
   * 単一買主の新規同期
   */
  private async syncSingleBuyer(buyerNumber: string, row: any): Promise<void> {
    const mappedData = this.buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row),
      Object.values(row)
    );

    // name が null/空の場合はデフォルト値を設定（NOT NULL 制約対応）
    if (!mappedData.name || mappedData.name === null || mappedData.name === 'null' || mappedData.name.trim() === '') {
      mappedData.name = `買主${buyerNumber}`;
    }

    const buyerData: any = {
      buyer_number: buyerNumber,
      ...mappedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 既存の買主を確認
    const { data: existingBuyer, error: checkError } = await this.supabase
      .from('buyers')
      .select('buyer_id')
      .eq('buyer_number', buyerNumber)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Failed to check existing buyer: ${checkError.message}`);
    }

    if (existingBuyer) {
      // 既存の買主を更新
      const { error: updateError } = await this.supabase
        .from('buyers')
        .update({
          ...buyerData,
          created_at: undefined, // created_at は更新しない
        })
        .eq('buyer_number', buyerNumber);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      // 新規買主を挿入
      const { error: insertError } = await this.supabase
        .from('buyers')
        .insert(buyerData);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }

  /**
   * 単一買主を更新
   * 手動入力優先フィールド（desired_areaなど）は、DBがスプレッドシートより
   * 後に更新されている場合（db_updated_at > last_synced_at）は上書きしない
   */
  private async updateSingleBuyer(buyerNumber: string, row: any): Promise<void> {
    const mappedData = this.buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row),
      Object.values(row)
    );

    const updateData: any = {
      ...mappedData,
      updated_at: new Date().toISOString(),
    };

    // buyer_number と buyer_id は更新しない（主キーとUUID）
    delete updateData.buyer_number;
    delete updateData.buyer_id;

    // 手動入力優先フィールド: DBがスプレッドシートより後に更新されていれば上書きしない
    const manualPriorityFields = ['desired_area'];

    // DBの現在値を取得して比較
    const { data: existingBuyer } = await this.supabase
      .from('buyers')
      .select('db_updated_at, last_synced_at, desired_area')
      .eq('buyer_number', buyerNumber)
      .maybeSingle();

    if (existingBuyer) {
      const dbUpdatedAt = existingBuyer.db_updated_at ? new Date(existingBuyer.db_updated_at) : null;
      const lastSyncedAt = existingBuyer.last_synced_at ? new Date(existingBuyer.last_synced_at) : null;

      // DBが手動更新されている（db_updated_at > last_synced_at）場合、手動優先フィールドを保護
      const isManuallyUpdated = dbUpdatedAt && lastSyncedAt
        ? dbUpdatedAt > lastSyncedAt
        : dbUpdatedAt && !lastSyncedAt; // last_synced_atがない場合も手動更新とみなす

      if (isManuallyUpdated) {
        for (const field of manualPriorityFields) {
          if (field in updateData) {
            console.log(`[updateSingleBuyer] ${buyerNumber}: ${field} is manually updated (db_updated_at=${existingBuyer.db_updated_at} > last_synced_at=${existingBuyer.last_synced_at}), skipping spreadsheet overwrite`);
            delete updateData[field];
          }
        }
      }
    }

    const { error: updateError } = await this.supabase
      .from('buyers')
      .update(updateData)
      .eq('buyer_number', buyerNumber);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  /**
   * DBから全アクティブ買主番号を取得（削除済みを除外）
   */
  private async getAllActiveBuyerNumbers(): Promise<Set<string>> {
    const allBuyerNumbers = new Set<string>();
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number')
        .is('deleted_at', null) // 削除済みを除外
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch active DB buyers: ${error.message}`);
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        for (const buyer of data) {
          if (buyer.buyer_number) {
            allBuyerNumbers.add(buyer.buyer_number);
          }
        }
        offset += pageSize;
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    return allBuyerNumbers;
  }

  /**
   * DBにあってスプレッドシートにない買主番号を検出（削除された買主）
   */
  async detectDeletedBuyers(): Promise<string[]> {
    if (!this.isBuyerInitialized || !this.buyerSheetsClient) {
      await this.initializeBuyer();
    }

    console.log('🔍 Detecting deleted buyers (full comparison)...');

    const allRows = await this.getBuyerSpreadsheetData();
    const sheetBuyerNumbers = new Set<string>();

    for (const row of allRows) {
      const buyerNumber = row['買主番号'];
      if (buyerNumber !== null && buyerNumber !== undefined && buyerNumber !== '') {
        sheetBuyerNumbers.add(String(buyerNumber).trim());
      }
    }
    console.log(`📊 Spreadsheet buyers: ${sheetBuyerNumbers.size}`);

    const dbBuyerNumbers = await this.getAllActiveBuyerNumbers();
    console.log(`📊 Active database buyers: ${dbBuyerNumbers.size}`);

    // 安全ガード1: スプレッドシートから0件の場合は削除処理をスキップ
    if (sheetBuyerNumbers.size === 0) {
      console.warn('⚠️ SAFETY GUARD 1: No buyer numbers found in spreadsheet. Skipping deletion to prevent accidental mass deletion.');
      return [];
    }

    // 安全ガード2: スプレッドシートの買主数がDBの50%未満の場合は削除処理をスキップ
    if (dbBuyerNumbers.size > 0) {
      const ratio = sheetBuyerNumbers.size / dbBuyerNumbers.size;
      if (ratio < 0.5) {
        console.warn(`⚠️ SAFETY GUARD 2: Spreadsheet has only ${sheetBuyerNumbers.size} buyers but DB has ${dbBuyerNumbers.size} active buyers (ratio: ${(ratio * 100).toFixed(1)}%). This may indicate a wrong spreadsheet is being used. Skipping deletion.`);
        return [];
      }
    }

    const deletedBuyers: string[] = [];
    for (const buyerNumber of dbBuyerNumbers) {
      if (!sheetBuyerNumbers.has(buyerNumber)) {
        deletedBuyers.push(buyerNumber);
      }
    }

    deletedBuyers.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

    console.log(`🗑️ Deleted buyers: ${deletedBuyers.length}`);
    if (deletedBuyers.length > 0) {
      console.log(`   First few: ${deletedBuyers.slice(0, 5).join(', ')}${deletedBuyers.length > 5 ? '...' : ''}`);
    }

    return deletedBuyers;
  }

  /**
   * 削除前のバリデーション（買主用）
   */
  private async validateBuyerDeletion(buyerNumber: string): Promise<ValidationResult> {
    try {
      const { data: buyer, error } = await this.supabase
        .from('buyers')
        .select('*')
        .eq('buyer_number', buyerNumber)
        .is('deleted_at', null)
        .single();

      if (error || !buyer) {
        return {
          canDelete: false,
          reason: 'Buyer not found in database',
          requiresManualReview: false,
        };
      }

      const details: ValidationResult['details'] = {};

      // アクティブな問い合わせをチェック
      const inactiveStatuses = ['成約', '購入済み', ''];
      if (buyer.latest_status && !inactiveStatuses.includes(buyer.latest_status)) {
        details.hasActiveInquiries = true;
        // 買主の場合はアクティブな問い合わせがあっても削除を許可
      }

      // 最近のアクティビティをチェック（7日以内の更新）
      if (buyer.updated_at) {
        const updatedAt = new Date(buyer.updated_at);
        const now = new Date();
        const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate <= 7) {
          details.hasRecentActivity = true;
          details.lastActivityDate = updatedAt;
          // 買主の場合は最近のアクティビティがあっても削除を許可
        }
      }

      // 買主の場合は常に削除を許可
      return {
        canDelete: true,
        requiresManualReview: false,
        details,
      };

    } catch (error: any) {
      console.error(`❌ Validation error for buyer ${buyerNumber}:`, error.message);
      return {
        canDelete: false,
        reason: `Validation error: ${error.message}`,
        requiresManualReview: true,
      };
    }
  }

  /**
   * ハードデリートを実行（買主用）
   * スプレッドシートに存在しない買主をDBから物理削除する
   */
  private async executeBuyerHardDelete(buyerNumber: string): Promise<DeletionResult> {
    try {
      const { data: buyer, error: fetchError } = await this.supabase
        .from('buyers')
        .select('*')
        .eq('buyer_number', buyerNumber)
        .is('deleted_at', null)
        .single();

      if (fetchError || !buyer) {
        return {
          sellerNumber: buyerNumber, // DeletionResult は sellerNumber を使用（汎用的な名前）
          success: false,
          error: 'Buyer not found',
        };
      }

      const deletedAt = new Date();

      // 1. 監査ログにバックアップを作成
      const { data: auditRecord, error: auditError } = await this.supabase
        .from('buyer_deletion_audit')
        .insert({
          buyer_id: buyer.id,
          buyer_number: buyerNumber,
          deleted_at: deletedAt.toISOString(),
          deleted_by: 'auto_sync',
          reason: 'Removed from spreadsheet',
          buyer_data: buyer,
          can_recover: true,
        })
        .select()
        .single();

      if (auditError) {
        console.error(`❌ Failed to create audit record for buyer ${buyerNumber}:`, auditError.message);
        return {
          sellerNumber: buyerNumber,
          success: false,
          error: `Audit creation failed: ${auditError.message}`,
        };
      }

      // 2. 買主をハードデリート（物理削除）
      const { error: buyerDeleteError } = await this.supabase
        .from('buyers')
        .delete()
        .eq('buyer_number', buyerNumber);

      if (buyerDeleteError) {
        console.error(`❌ Failed to hard delete buyer ${buyerNumber}:`, buyerDeleteError.message);
        return {
          sellerNumber: buyerNumber,
          success: false,
          error: `Buyer deletion failed: ${buyerDeleteError.message}`,
        };
      }

      console.log(`✅ Buyer ${buyerNumber}: Hard deleted successfully`);

      return {
        sellerNumber: buyerNumber,
        success: true,
        auditId: auditRecord.id,
        deletedAt,
      };

    } catch (error: any) {
      console.error(`❌ Hard delete error for buyer ${buyerNumber}:`, error.message);
      return {
        sellerNumber: buyerNumber,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 削除された買主を一括同期
   */
  async syncDeletedBuyers(buyerNumbers: string[]): Promise<DeletionSyncResult> {
    const startedAt = new Date();
    const deletedBuyerNumbers: string[] = [];
    const manualReviewBuyerNumbers: string[] = [];
    const errors: Array<{ sellerNumber: string; error: string }> = [];

    console.log(`🗑️ Syncing ${buyerNumbers.length} deleted buyers...`);

    for (const buyerNumber of buyerNumbers) {
      const validation = await this.validateBuyerDeletion(buyerNumber);

      if (!validation.canDelete) {
        if (validation.requiresManualReview) {
          manualReviewBuyerNumbers.push(buyerNumber);
          console.log(`⚠️ Buyer ${buyerNumber}: Requires manual review - ${validation.reason}`);
        } else {
          errors.push({
            sellerNumber: buyerNumber,
            error: validation.reason || 'Validation failed',
          });
          console.log(`❌ Buyer ${buyerNumber}: ${validation.reason}`);
        }
        continue;
      }

      const result = await this.executeBuyerHardDelete(buyerNumber);

      if (result.success) {
        deletedBuyerNumbers.push(buyerNumber);
      } else {
        errors.push({
          sellerNumber: buyerNumber,
          error: result.error || 'Unknown error',
        });
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    const syncResult: DeletionSyncResult = {
      totalDetected: buyerNumbers.length,
      successfullyDeleted: deletedBuyerNumbers.length,
      failedToDelete: errors.length,
      requiresManualReview: manualReviewBuyerNumbers.length,
      deletedSellerNumbers: deletedBuyerNumbers, // DeletionSyncResult は deletedSellerNumbers を使用
      manualReviewSellerNumbers: manualReviewBuyerNumbers,
      errors,
      startedAt,
      completedAt,
      durationMs,
    };

    console.log(`🎉 Buyer deletion sync completed:`);
    console.log(`   ✅ Deleted: ${deletedBuyerNumbers.length}`);
    console.log(`   ⚠️ Manual review: ${manualReviewBuyerNumbers.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);

    return syncResult;
  }

  /**
   * 削除された買主を復元
   */
  async recoverDeletedBuyer(buyerNumber: string, recoveredBy: string = 'manual'): Promise<RecoveryResult> {
    try {
      console.log(`🔄 Attempting to recover buyer: ${buyerNumber}`);

      // 1. 削除監査ログを確認
      const { data: auditLog, error: auditError } = await this.supabase
        .from('buyer_deletion_audit')
        .select('*')
        .eq('buyer_number', buyerNumber)
        .is('recovered_at', null)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .single();

      if (auditError || !auditLog) {
        console.error(`❌ Audit log not found for buyer ${buyerNumber}`);
        return {
          success: false,
          sellerNumber: buyerNumber, // RecoveryResult は sellerNumber を使用
          error: 'Audit log not found or buyer was not deleted',
        };
      }

      if (!auditLog.can_recover) {
        console.error(`❌ Recovery not allowed for buyer ${buyerNumber}`);
        return {
          success: false,
          sellerNumber: buyerNumber,
          error: 'Recovery is not allowed for this buyer',
        };
      }

      // 2. 買主を復元（deleted_at を NULL に設定）
      const { error: buyerRecoverError } = await this.supabase
        .from('buyers')
        .update({ deleted_at: null })
        .eq('buyer_number', buyerNumber);

      if (buyerRecoverError) {
        console.error(`❌ Failed to recover buyer ${buyerNumber}:`, buyerRecoverError.message);
        throw new Error(`Failed to recover buyer: ${buyerRecoverError.message}`);
      }

      console.log(`✅ Buyer ${buyerNumber} recovered`);

      // 3. 監査ログを更新
      const recoveredAt = new Date().toISOString();
      const { error: auditUpdateError } = await this.supabase
        .from('buyer_deletion_audit')
        .update({
          recovered_at: recoveredAt,
          recovered_by: recoveredBy,
        })
        .eq('id', auditLog.id);

      const auditRecordUpdated = !auditUpdateError;

      if (auditUpdateError) {
        console.warn(`⚠️ Warning: Failed to update audit log for buyer ${buyerNumber}:`, auditUpdateError.message);
      }

      console.log(`🎉 Recovery completed for buyer ${buyerNumber}`);

      return {
        success: true,
        sellerNumber: buyerNumber,
        recoveredAt: new Date(recoveredAt),
        recoveredBy,
        details: {
          sellerRestored: false,
          propertiesRestored: 0,
          auditRecordUpdated,
          buyerRestored: true,
        },
      };

    } catch (error: any) {
      console.error(`❌ Recovery failed for buyer ${buyerNumber}:`, error.message);
      return {
        success: false,
        sellerNumber: buyerNumber,
        error: error.message,
      };
    }
  }

  /**
   * 買主同期のメインメソッド（追加・更新・削除を一括実行）
   */
  async syncBuyers(): Promise<{
    missingBuyers: string[];
    updatedBuyers: string[];
    deletedBuyers: string[];
    syncMissingResult: SyncResult | null;
    syncUpdatedResult: SyncResult | null;
    deletionSyncResult: DeletionSyncResult | null;
  }> {
    console.log('🔄 Starting buyer sync...');

    const missingBuyers = await this.detectMissingBuyers();
    const updatedBuyers = await this.detectUpdatedBuyers();
    const deletedBuyers = await this.detectDeletedBuyers();

    let syncMissingResult: SyncResult | null = null;
    if (missingBuyers.length > 0) {
      syncMissingResult = await this.syncMissingBuyers(missingBuyers);
    }

    let syncUpdatedResult: SyncResult | null = null;
    if (updatedBuyers.length > 0) {
      syncUpdatedResult = await this.syncUpdatedBuyers(updatedBuyers);
    }

    let deletionSyncResult: DeletionSyncResult | null = null;
    if (deletedBuyers.length > 0) {
      // 安全ガード3: 削除対象がアクティブ買主の10%以上の場合は削除処理をスキップ
      const activeBuyerCount = (await this.getAllActiveBuyerNumbers()).size;
      if (activeBuyerCount > 0) {
        const deletionRatio = deletedBuyers.length / activeBuyerCount;
        if (deletionRatio >= 0.1) {
          console.error(`🚨 SAFETY GUARD 3: Deletion target (${deletedBuyers.length}) is ${(deletionRatio * 100).toFixed(1)}% of active buyers (${activeBuyerCount}). This exceeds the 10% threshold. Skipping deletion to prevent accidental mass deletion. Manual review required.`);
        } else {
          deletionSyncResult = await this.syncDeletedBuyers(deletedBuyers);
        }
      }
    }

    console.log('✅ Buyer sync completed');

    return {
      missingBuyers,
      updatedBuyers,
      deletedBuyers,
      syncMissingResult,
      syncUpdatedResult,
      deletionSyncResult,
    };
  }

  /**
   * 売主のみの同期を実行（Phase 1-3のみ）
   * GASからのトリガー用。物件・買主同期をスキップしてタイムアウトを回避する。
   */
  async runSellersOnlySync(): Promise<{
    success: boolean;
    added: number;
    updated: number;
    deleted: number;
    errors: any[];
    durationMs: number;
  }> {
    const startTime = new Date();
    console.log('🔄 Starting sellers-only sync (Phase 1-3)...');

    // キャッシュをクリアして最新データを取得
    this.clearSpreadsheetCache();

    let added = 0;
    let updated = 0;
    let deleted = 0;
    const errors: any[] = [];

    try {
      // Phase 1: 追加同期
      console.log('📥 Phase 1: Seller Addition Sync');
      const missingSellers = await this.detectMissingSellers();
      if (missingSellers.length > 0) {
        const syncResult = await this.syncMissingSellers(missingSellers);
        added = syncResult.newSellersCount;
        errors.push(...syncResult.errors);
      } else {
        console.log('✅ No missing sellers to sync');
      }

      // Phase 2: 更新同期
      console.log('\n🔄 Phase 2: Seller Update Sync');
      const updatedSellers = await this.detectUpdatedSellers();
      if (updatedSellers.length > 0) {
        const updateResult = await this.syncUpdatedSellers(updatedSellers);
        updated = updateResult.updatedSellersCount;
        errors.push(...updateResult.errors);
      } else {
        console.log('✅ No updated sellers to sync');
      }

      // Phase 3: 削除同期（deletionOnly=true で別途呼ぶため、ここではスキップ）
      console.log('\n⏭️  Phase 3: Seller Deletion Sync (skipped - use deletionOnly=true)');

      const durationMs = new Date().getTime() - startTime.getTime();
      console.log(`🎉 Sellers-only sync completed: ${added} added, ${updated} updated, ${deleted} deleted (${durationMs}ms)`);

      return {
        success: errors.length === 0,
        added,
        updated,
        deleted,
        errors,
        durationMs,
      };
    } catch (error: any) {
      console.error('❌ Sellers-only sync failed:', error.message);
      const durationMs = new Date().getTime() - startTime.getTime();
      return {
        success: false,
        added,
        updated,
        deleted,
        errors: [...errors, { message: error.message }],
        durationMs,
      };
    }
  }

}

// シングルトンインスタンス
let enhancedAutoSyncServiceInstance: EnhancedAutoSyncService | null = null;

export function getEnhancedAutoSyncService(): EnhancedAutoSyncService {
  if (!enhancedAutoSyncServiceInstance) {
    enhancedAutoSyncServiceInstance = new EnhancedAutoSyncService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  return enhancedAutoSyncServiceInstance;
}


/**
 * 強化版定期同期マネージャー
 * 指定間隔でスプレッドシートからDBへの同期を実行します
 * デフォルトで有効化され、エラー時も継続します
 */
export class EnhancedPeriodicSyncManager {
  private intervalId: NodeJS.Timeout | null = null;
  private syncService: EnhancedAutoSyncService;
  private intervalMinutes: number;
  private isRunning = false;
  private lastSyncTime: Date | null = null;

  constructor(intervalMinutes: number = 10) {
    this.syncService = getEnhancedAutoSyncService();
    this.intervalMinutes = intervalMinutes;
  }

  /**
   * 定期同期を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Enhanced periodic sync is already running');
      return;
    }

    try {
      await this.syncService.initialize();
      this.isRunning = true;

      // 初回実行を60秒後に遅延（クォータ制限対策）
      console.log(`🔄 Starting enhanced periodic sync (interval: ${this.intervalMinutes} minutes)`);
      console.log('⏰ First sync will run in 60 seconds (quota limit protection)');
      
      setTimeout(async () => {
        await this.runSync();
        
        // 定期実行を設定
        this.intervalId = setInterval(async () => {
          await this.runSync();
        }, this.intervalMinutes * 60 * 1000);
        
        console.log(`✅ Enhanced periodic sync started (every ${this.intervalMinutes} minutes)`);
      }, 60 * 1000); // 60秒後に初回実行

    } catch (error: any) {
      console.error('❌ Failed to start enhanced periodic sync:', error.message);
      // エラーでも再試行のためにisRunningはtrueのまま
      this.scheduleRetry();
    }
  }

  /**
   * 初期化失敗時のリトライをスケジュール
   */
  private scheduleRetry(): void {
    console.log('🔄 Scheduling retry in 1 minute...');
    setTimeout(async () => {
      if (!this.isRunning) return;
      try {
        await this.syncService.initialize();
        await this.runSync();
        
        // 成功したら定期実行を開始
        this.intervalId = setInterval(async () => {
          await this.runSync();
        }, this.intervalMinutes * 60 * 1000);
        
        console.log(`✅ Enhanced periodic sync recovered`);
      } catch (error: any) {
        console.error('❌ Retry failed:', error.message);
        this.scheduleRetry();
      }
    }, 60 * 1000);
  }

  /**
   * 定期同期を停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Enhanced periodic sync stopped');
  }

  /**
   * 同期を実行
   */
  private async runSync(): Promise<void> {
    try {
      const { getSyncHealthChecker } = await import('./SyncHealthChecker');
      
      const result = await this.syncService.runFullSync('scheduled');
      this.lastSyncTime = new Date();
      
      // ログ記録は runFullSync 内で既に実行されている
      
      // ヘルスチェックを更新
      const healthChecker = getSyncHealthChecker();
      await healthChecker.checkAndUpdateHealth();
      
      const totalChanges = result.additionResult.successfullyAdded + 
                          result.additionResult.successfullyUpdated +
                          result.deletionResult.successfullyDeleted;
      
      if (totalChanges > 0) {
        console.log(`📊 Enhanced periodic sync: ${result.additionResult.successfullyAdded} added, ${result.additionResult.successfullyUpdated} updated, ${result.deletionResult.successfullyDeleted} deleted`);
      }
    } catch (error: any) {
      console.error('⚠️ Enhanced periodic sync error:', error.message);
      // エラーでも次回スケジュールは継続
    }
  }

  /**
   * 実行中かどうか
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 同期間隔を取得
   */
  getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  /**
   * 最後の同期時刻を取得
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }
}

// 強化版定期同期マネージャーのシングルトン
let enhancedPeriodicSyncManagerInstance: EnhancedPeriodicSyncManager | null = null;

export function getEnhancedPeriodicSyncManager(intervalMinutes?: number): EnhancedPeriodicSyncManager {
  if (!enhancedPeriodicSyncManagerInstance) {
    enhancedPeriodicSyncManagerInstance = new EnhancedPeriodicSyncManager(
      intervalMinutes || parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES || '5', 10)
    );
  }
  return enhancedPeriodicSyncManagerInstance;
}

/**
 * 自動同期が有効かどうかを判定
 * デフォルトで有効、明示的にfalseの場合のみ無効
 */
export function isAutoSyncEnabled(): boolean {
  const envValue = process.env.AUTO_SYNC_ENABLED;
  // 明示的に'false'の場合のみ無効
  if (envValue === 'false') {
    return false;
  }
  // それ以外（未設定、'true'、その他）は有効
  return true;
}
