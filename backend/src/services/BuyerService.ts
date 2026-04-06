// 買主リストのCRUDサービス
import { createClient } from '@supabase/supabase-js';
import { AuditLogService } from './AuditLogService';
import { BuyerWriteService } from './BuyerWriteService';
import { ConflictResolver, ConflictInfo } from './ConflictResolver';
import { RetryHandler } from './RetryHandler';
import { BuyerColumnMapper } from './BuyerColumnMapper';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import { BuyerNumberSpreadsheetClient } from './BuyerNumberSpreadsheetClient';
import { calculateBuyerStatus } from './BuyerStatusCalculator';
import { STATUS_DEFINITIONS } from '../config/buyer-status-definitions';

// モジュールレベルのキャッシュ（Vercelサーバーレス環境でもインスタンス間で共有される）
// インスタンス変数だとリクエストごとにリセットされるため、モジュールレベルに移動
let _moduleLevelStatusCache: {
  buyers: any[];
  computedAt: number;
} | null = null;
const _MODULE_STATUS_CACHE_TTL = 30 * 60 * 1000; // 30分

/**
 * 買主ステータスキャッシュを無効化（外部から呼び出し可能）
 * 買主データ更新時に呼び出してキャッシュをクリアする
 */
export function invalidateBuyerStatusCache(): void {
  _moduleLevelStatusCache = null;
  console.log('[BuyerService] Buyer status cache invalidated');
}

export interface BuyerQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assignee?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  statusCategory?: 'all' | 'todayCall' | 'threeCallUnchecked' | 'viewingDayBefore' | 'assigned' | 'todayCallAssigned';
}

export interface SyncResult {
  success: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  error?: string;
  conflict?: ConflictInfo[];
}

export interface UpdateWithSyncResult {
  buyer: any;
  syncResult: SyncResult;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BuyerService {
  private supabase;
  private writeService: BuyerWriteService | null = null;
  private conflictResolver: ConflictResolver | null = null;
  private retryHandler: RetryHandler | null = null;
  private columnMapper: BuyerColumnMapper | null = null;

  // ステータス計算結果のキャッシュはモジュールレベル変数 _moduleLevelStatusCache を使用
  // （Vercelサーバーレス環境ではインスタンス変数はリクエストごとにリセットされるため）

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * 双方向同期用のサービスを初期化（遅延初期化）
   */
  private async initSyncServices(): Promise<void> {
    if (this.writeService) return;

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    });
    
    // 認証を実行
    await sheetsClient.authenticate();
    
    this.columnMapper = new BuyerColumnMapper();
    this.writeService = new BuyerWriteService(sheetsClient, this.columnMapper);
    this.conflictResolver = new ConflictResolver(this.writeService, this.columnMapper);
    this.retryHandler = new RetryHandler(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * 買主リストを取得（ページネーション、検索、フィルタ対応）
   */
  async getAll(options: BuyerQueryOptions = {}): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      assignee,
      dateFrom,
      dateTo,
      sortBy = 'reception_date',
      sortOrder = 'desc',
      statusCategory,
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('buyers')
      .select('*', { count: 'exact' });

    // 検索（4〜5桁の数字は買主番号の完全一致を優先）
    if (search) {
      const isBuyerNumber = /^\d{4,5}$/.test(search);
      if (isBuyerNumber) {
        query = query.eq('buyer_number', search);
      } else {
        query = query.or(
          `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,property_number.ilike.%${search}%`
        );
      }
    }

    // フィルタリング
    if (status) {
      query = query.ilike('latest_status', `%${status}%`);
    }
    if (assignee) {
      query = query.or(`initial_assignee.ilike.%${assignee}%,follow_up_assignee.ilike.%${assignee}%`);
    }
    if (dateFrom) {
      query = query.gte('reception_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('reception_date', dateTo);
    }

    // サイドバーカテゴリフィルター
    if (statusCategory && statusCategory !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      
      switch (statusCategory) {
        case 'todayCall': {
          // 当日TEL: 後続担当が空 AND 次電日が空でない AND 次電日 <= 今日
          query = query
            .is('follow_up_assignee', null)
            .not('next_call_date', 'is', null)
            .lte('next_call_date', todayStr);
          break;
        }
        
        case 'threeCallUnchecked': {
          // ３回架電未: ３回架電確認済み = "3回架電未" AND (【問合メール】電話対応 = "不通" OR "未")
          query = query
            .eq('three_calls_confirmed', '3回架電未')
            .or('inquiry_email_phone.eq.不通,inquiry_email_phone.eq.未');
          break;
        }
        
        case 'viewingDayBefore': {
          // 内覧日前日: viewing_date が空でない AND broker_inquiry ≠ "業者問合せ" AND notification_sender が空
          // 今日が内覧日の前営業日（木曜内覧のみ2日前、それ以外は1日前）
          // ※ 日付計算はJavaScript側で行う必要があるため、全件取得してフィルタ
          query = query
            .not('viewing_date', 'is', null)
            .neq('broker_inquiry', '業者問合せ')
            .is('notification_sender', null);
          break;
        }
        
        default: {
          // 動的カテゴリ（assigned:xxx, todayCallAssigned:xxx）
          const dynamicCategory = statusCategory as string;
          
          if (dynamicCategory.startsWith('assigned:')) {
            // 担当(イニシャル): follow_up_assignee または initial_assignee = イニシャル
            const assigneeInitial = dynamicCategory.replace('assigned:', '');
            query = query.or(
              `follow_up_assignee.eq.${assigneeInitial},initial_assignee.eq.${assigneeInitial}`
            );
          } else if (dynamicCategory.startsWith('todayCallAssigned:')) {
            // 当日TEL(イニシャル): follow_up_assignee = イニシャル AND 次電日が空でない AND 次電日 <= 今日
            const assigneeInitial = dynamicCategory.replace('todayCallAssigned:', '');
            query = query
              .eq('follow_up_assignee', assigneeInitial)
              .not('next_call_date', 'is', null)
              .lte('next_call_date', todayStr);
          }
          break;
        }
      }
    }

    // ソート（受付日が空欄のものは一番後ろに配置）
    // nullsFirst: false で NULL値を最後に配置
    query = query.order(sortBy, { 
      ascending: sortOrder === 'asc',
      nullsFirst: false 
    });

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // property_listingsからaddress（物件所在地）とsales_assignee（物件担当者）を取得して結合
    const buyers = data || [];
    const propertyNumbers = [...new Set(
      buyers.map((b: any) => b.property_number).filter(Boolean)
    )] as string[];

    let propertyMap: Record<string, { address: string | null; sales_assignee: string | null; property_type: string | null; atbb_status: string | null }> = {};
    if (propertyNumbers.length > 0) {
      const { data: properties } = await this.supabase
        .from('property_listings')
        .select('property_number, address, sales_assignee, property_type, atbb_status')
        .in('property_number', propertyNumbers);
      if (properties) {
        properties.forEach((p: any) => {
          propertyMap[p.property_number] = {
            address: p.address,
            sales_assignee: p.sales_assignee,
            property_type: p.property_type ?? null,
            atbb_status: p.atbb_status ?? null,
          };
        });
      }
    }

    const enrichedData = buyers.map((b: any) => {
      // calculated_statusを計算
      const statusResult = calculateBuyerStatus(b);
      
      return {
        ...b,
        calculated_status: statusResult.status,
        status_priority: statusResult.priority,
        property_address: propertyMap[b.property_number]?.address ?? null,
        property_sales_assignee: propertyMap[b.property_number]?.sales_assignee ?? null,
        property_type: propertyMap[b.property_number]?.property_type ?? null,
        atbb_status: propertyMap[b.property_number]?.atbb_status ?? null,
      };
    });

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * IDで買主を取得
   */
  async getById(id: string): Promise<any | null> {
    // UUIDか買主番号かを判定して適切なカラムで検索
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const { data, error } = await this.supabase
      .from('buyers')
      .select('*')
      .eq(isUuid ? 'buyer_id' : 'buyer_number', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch buyer: ${error.message}`);
    }

    return data;
  }

  /**
   * 買主番号で買主を取得
   */
  async getByBuyerNumber(buyerNumber: string, includeDeleted: boolean = false): Promise<any | null> {
    console.log(`[BuyerService.getByBuyerNumber] buyerNumber=${buyerNumber} (type: ${typeof buyerNumber})`);
    
    // buyer_numberは数値型なので、文字列を数値に変換
    const buyerNumberInt = parseInt(buyerNumber, 10);
    console.log(`[BuyerService.getByBuyerNumber] converted to int: ${buyerNumberInt}`);
    
    let query = this.supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', buyerNumberInt);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.single();

    if (error) {
      console.log(`[BuyerService.getByBuyerNumber] error:`, error);
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch buyer: ${error.message}`);
    }

    console.log(`[BuyerService.getByBuyerNumber] found buyer buyer_id=${data?.buyer_id}`);
    return data;
  }


  /**
   * 検索
   */
  async search(query: string, limit: number = 20): Promise<any[]> {
    // 数字のみのクエリの場合、buyer_number.eq.{数値} は TEXT型カラムとの型不一致で500エラーになる
    // getAll() と同様に .eq('buyer_number', query) を使って文字列として渡す
    // ※ buyers テーブルに id カラムは存在しない（主キーは buyer_number）
    const isNumericOnly = /^\d+$/.test(query);
    const selectFields = 'buyer_number, name, phone_number, email, property_number, latest_status, initial_assignee';

    if (isNumericOnly) {
      // 数字のみ: buyer_number の完全一致（.eq() で TEXT型として文字列比較）
      // + 他フィールドの部分一致を別クエリで実行して結合
      const [exactMatch, partialMatch] = await Promise.all([
        this.supabase
          .from('buyers')
          .select(selectFields)
          .eq('buyer_number', query)
          .limit(limit),
        this.supabase
          .from('buyers')
          .select(selectFields)
          .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`)
          .limit(limit),
      ]);

      if (exactMatch.error) {
        throw new Error(`Failed to search buyers: ${exactMatch.error.message}`);
      }
      if (partialMatch.error) {
        throw new Error(`Failed to search buyers: ${partialMatch.error.message}`);
      }

      // 重複を除いて結合（buyer_number で dedup）
      const exactData = exactMatch.data || [];
      const partialData = partialMatch.data || [];
      const seen = new Set(exactData.map((b: any) => b.buyer_number));
      const combined = [
        ...exactData,
        ...partialData.filter((b: any) => !seen.has(b.buyer_number)),
      ];

      return combined.slice(0, limit);
    } else {
      // 文字列を含む: 全フィールドで ilike 検索
      const { data, error } = await this.supabase
        .from('buyers')
        .select(selectFields)
        .or(
          `buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`
        )
        .limit(limit);

      if (error) {
        throw new Error(`Failed to search buyers: ${error.message}`);
      }

      return data || [];
    }
  }

  /**
   * 買主に紐づく物件リストを取得
   */
  async getLinkedProperties(buyerId: string): Promise<any[]> {
    // UUIDか買主番号かを判定して買主を取得
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerId);
    const buyer = isUuid
      ? await this.getById(buyerId)
      : await this.getByBuyerNumber(buyerId);
    if (!buyer || !buyer.property_number) {
      return [];
    }

    // 物件番号で物件リストを検索
    const propertyNumbers = buyer.property_number.split(',').map((n: string) => n.trim()).filter((n: string) => n);
    
    if (propertyNumbers.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('property_listings')
      .select('*')
      .in('property_number', propertyNumbers);

    if (error) {
      throw new Error(`Failed to fetch linked properties: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 物件番号から買主を取得
   */
  async getByPropertyNumber(propertyNumber: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('buyers')
      .select('*')
      .ilike('property_number', `%${propertyNumber}%`);

    if (error) {
      throw new Error(`Failed to fetch buyers by property: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 統計情報を取得
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byAssignee: Record<string, number>;
    byConfidence: Record<string, number>;
  }> {
    // 総数
    const { count: total } = await this.supabase
      .from('buyers')
      .select('*', { count: 'exact', head: true });

    // ステータス別
    const { data: statusData } = await this.supabase
      .from('buyers')
      .select('latest_status')
      .not('latest_status', 'is', null);

    const byStatus: Record<string, number> = {};
    statusData?.forEach(row => {
      const key = row.latest_status || '未設定';
      byStatus[key] = (byStatus[key] || 0) + 1;
    });

    // 担当者別
    const { data: assigneeData } = await this.supabase
      .from('buyers')
      .select('initial_assignee, follow_up_assignee');

    const byAssignee: Record<string, number> = {};
    assigneeData?.forEach(row => {
      const assignee = row.follow_up_assignee || row.initial_assignee || '未設定';
      byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
    });

    // 確度別
    const { data: confidenceData } = await this.supabase
      .from('buyers')
      .select('inquiry_confidence')
      .not('inquiry_confidence', 'is', null);

    const byConfidence: Record<string, number> = {};
    confidenceData?.forEach(row => {
      const key = row.inquiry_confidence || '未設定';
      byConfidence[key] = (byConfidence[key] || 0) + 1;
    });

    return {
      total: total || 0,
      byStatus,
      byAssignee,
      byConfidence
    };
  }

  /**
   * 新規買主を作成
   */
  async create(buyerData: Partial<any>): Promise<any> {
    // 買主番号を自動生成
    const buyerNumber = await this.generateBuyerNumber();

    const newBuyer = {
      ...buyerData,
      buyer_number: buyerNumber,
    };

    const { data, error } = await this.supabase
      .from('buyers')
      .insert(newBuyer)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create buyer: ${error.message}`);
    }

    // DB保存成功後、採番スプレッドシートのB2セルを更新
    // 失敗しても登録自体は成功とする（警告ログのみ）
    try {
      const client = await this.initBuyerNumberClient();
      await client.updateBuyerNumber(buyerNumber);
    } catch (updateError: any) {
      console.warn(`[BuyerService] Failed to update buyer number cell after registration (buyer_number=${buyerNumber}): ${updateError.message}`);
    }

    // DB保存成功後、買主リストスプレッドシートに新規行を追加
    // 失敗しても登録自体は成功とする（警告ログのみ）
    try {
      await this.initSyncServices();
      if (this.writeService) {
        const appendResult = await this.writeService.appendNewBuyer(data);
        if (!appendResult.success) {
          console.warn(`[BuyerService] Failed to append new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendResult.error}`);
        } else {
          console.log(`[BuyerService] Successfully appended buyer ${buyerNumber} to spreadsheet`);
        }
      }
    } catch (appendError: any) {
      console.warn(`[BuyerService] Error appending new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendError.message}`);
    }

    return data;
  }

  /**
   * 買主番号採番用スプレッドシートクライアントを初期化
   */
  private async initBuyerNumberClient(): Promise<BuyerNumberSpreadsheetClient> {
    const spreadsheetId = process.env.BUYER_NUMBER_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('BUYER_NUMBER_SPREADSHEET_ID is not set');
    }

    const sheetName = process.env.BUYER_NUMBER_SHEET_NAME || '連番';
    const cell = process.env.BUYER_NUMBER_CELL || 'B2';

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    });

    await sheetsClient.authenticate();

    return new BuyerNumberSpreadsheetClient(sheetsClient, cell);
  }

  /**
   * 買主番号を自動生成（スプレッドシートの連番シートB2セル+1）
   */
  private async generateBuyerNumber(): Promise<string> {
    const client = await this.initBuyerNumberClient();
    return client.getNextBuyerNumber();
  }

  /**
   * サイドバーカウント更新が必要かどうかを判定
   * @param updateData 更新データ
   * @returns サイドバーカウント更新が必要な場合はtrue
   */
  private shouldUpdateBuyerSidebarCounts(updateData: Partial<any>): boolean {
    // サイドバーカテゴリーに影響するフィールド
    const sidebarFields = ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender'];
    return sidebarFields.some(field => field in updateData);
  }

  /**
   * 買主情報を更新
   */
  async update(id: string, updateData: Partial<any>, userId?: string, userEmail?: string): Promise<any> {
    console.log('[BuyerService.update] ===== START =====');
    console.log('[BuyerService.update] id:', id);
    console.log('[BuyerService.update] updateData:', JSON.stringify(updateData, null, 2));
    
    // UUIDか買主番号かを判定して存在確認
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    console.log('[BuyerService.update] isUuid:', isUuid);
    
    const existing = isUuid
      ? await this.getById(id)
      : await this.getByBuyerNumber(id);
    if (!existing) {
      console.error('[BuyerService.update] Buyer not found');
      throw new Error('Buyer not found');
    }

    const buyerNumber = existing.buyer_number;
    console.log('[BuyerService.update] buyerNumber:', buyerNumber);

    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    console.log('[BuyerService.update] allowedData:', JSON.stringify(allowedData, null, 2));

    // 手動更新時刻を記録（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    // buyer_numberは数値型なので、数値に変換
    const buyerNumberInt = parseInt(buyerNumber, 10);
    console.log('[BuyerService.update] buyerNumberInt:', buyerNumberInt);

    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('buyer_number', buyerNumberInt)
      .select()
      .single();

    if (error) {
      console.error('[BuyerService.update] Database update failed:', error);
      throw new Error(`Failed to update buyer: ${error.message}`);
    }

    console.log('[BuyerService.update] Database update successful');

    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    invalidateBuyerStatusCache();
    console.log('[BuyerService.update] Buyer status cache invalidated');

    // Log audit trail for each changed field
    if (userId && userEmail) {
      for (const key in allowedData) {
        if (key !== 'db_updated_at' && existing[key] !== allowedData[key]) {
          try {
            await AuditLogService.logFieldUpdate(
              'buyer',
              buyerNumber,
              key,
              existing[key],
              allowedData[key],
              userId,
              userEmail
            );
          } catch (auditError) {
            // Log error but don't fail the update
            console.error('Failed to create audit log:', auditError);
          }
        }
      }
    }

    // サイドバーカウント更新（非同期、ノンブロッキング）
    console.log('[BuyerService] Checking if sidebar counts update is needed:', {
      shouldUpdate: this.shouldUpdateBuyerSidebarCounts(allowedData),
      allowedData: Object.keys(allowedData),
      buyerNumber
    });
    
    if (this.shouldUpdateBuyerSidebarCounts(allowedData)) {
      console.log('[BuyerService] Triggering sidebar counts update for buyer:', buyerNumber);
      console.log('[BuyerService] Old buyer data (before update):', JSON.stringify({
        buyer_number: existing.buyer_number,
        next_call_date: existing.next_call_date,
        follow_up_assignee: existing.follow_up_assignee,
        viewing_date: existing.viewing_date
      }, null, 2));
      const { SidebarCountsUpdateService } = await import('./SidebarCountsUpdateService');
      const sidebarService = new SidebarCountsUpdateService(this.supabase);
      // 更新前のデータを渡す
      sidebarService.updateBuyerSidebarCounts(buyerNumber, existing).catch(err => {
        console.error('⚠️ Failed to update buyer sidebar counts:', err);
      });
    } else {
      console.log('[BuyerService] Sidebar counts update not needed');
    }

    console.log('[BuyerService.update] ===== END =====');
    return data;
  }

  /**
   * 買主情報を更新し、スプレッドシートに同期
   * @param id 買主ID
   * @param updateData 更新データ
   * @param userId ユーザーID
   * @param userEmail ユーザーメール
   * @param options オプション（force: 競合を無視して強制上書き）
   * @returns 更新結果と同期ステータス
   */
  async updateWithSync(
    id: string,
    updateData: Partial<any>,
    userId?: string,
    userEmail?: string,
    options?: { force?: boolean }
  ): Promise<UpdateWithSyncResult> {
    // 同期サービスを初期化（認証含む）
    await this.initSyncServices();

    // 存在確認（UUIDか買主番号かを判定）
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const existing = isUuid
      ? await this.getById(id)
      : await this.getByBuyerNumber(id);
    if (!existing) {
      throw new Error('Buyer not found');
    }

    const buyerNumber = existing.buyer_number;

    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'buyer_number'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 手動更新時刻を記録（スプレッドシート同期による上書きを防ぐため）
    allowedData.db_updated_at = new Date().toISOString();

    // 競合チェック（forceオプションがない場合、かつ前回同期済みの場合のみ）
    // last_synced_at がない場合は、まだ一度も同期されていないため競合チェックをスキップ
    // 注意: 競合チェックは、スプレッドシートが他のユーザーによって変更された場合のみ検出する
    // DBの値が変更されただけでは競合とはみなさない
    if (!options?.force && this.conflictResolver && existing.last_synced_at) {
      // スプレッドシートの現在値を取得して、DBの前回同期時の値と比較
      // 期待値は「前回同期時のスプレッドシートの値」= DBの現在値（同期後に変更されていない場合）
      // ただし、ユーザーがDBを編集した場合は、その編集前の値が期待値となる
      // 
      // 簡略化: 競合チェックは、スプレッドシートの値がDBの値と異なる場合のみ行う
      // これにより、ユーザーがDBを編集してスプレッドシートに同期する際に、
      // スプレッドシートが他のユーザーによって変更されていた場合のみ競合を検出する
      const expectedValues: Record<string, any> = {};
      for (const key of Object.keys(allowedData)) {
        // 期待値は、DBの現在値（編集前の値）
        expectedValues[key] = existing[key];
      }

      const conflictResult = await this.conflictResolver.checkConflict(
        buyerNumber,
        allowedData,
        expectedValues,
        new Date(existing.last_synced_at)
      );

      if (conflictResult.hasConflict) {
        // 競合がある場合、DBは更新せずに競合情報を返す
        return {
          buyer: existing,
          syncResult: {
            success: false,
            syncStatus: 'failed',
            error: 'Conflict detected',
            conflict: conflictResult.conflicts
          }
        };
      }
    }

    // DB更新（buyer_numberカラムを使用）
    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('buyer_number', buyerNumber)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update buyer: ${error.message}`);
    }

    // スプレッドシート同期を試行
    let syncResult: SyncResult;

    try {
      if (this.writeService && this.retryHandler) {
        // リトライ付きで同期を実行
        const retryResult = await this.retryHandler.executeWithRetry(
          async () => {
            const writeResult = await this.writeService!.updateFields(buyerNumber, allowedData);
            if (!writeResult.success) {
              throw new Error(writeResult.error || 'Spreadsheet write failed');
            }
            return writeResult;
          }
        );

        if (retryResult.success) {
          // 同期成功 - last_synced_atを更新
          await this.supabase
            .from('buyers')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('buyer_number', buyerNumber);

          syncResult = {
            success: true,
            syncStatus: 'synced'
          };
        } else {
          // 同期失敗 - キューに追加
          for (const key of Object.keys(allowedData)) {
            if (key !== 'db_updated_at') {
              await this.retryHandler.queueFailedChange({
                buyer_number: buyerNumber,
                field_name: key,
                old_value: existing[key] ? String(existing[key]) : null,
                new_value: allowedData[key] ? String(allowedData[key]) : null,
                retry_count: retryResult.attempts,
                last_error: retryResult.error || null
              });
            }
          }

          syncResult = {
            success: false,
            syncStatus: 'pending',
            error: retryResult.error
          };
        }
      } else {
        // 同期サービスが利用できない場合
        syncResult = {
          success: false,
          syncStatus: 'pending',
          error: 'Sync services not available'
        };
      }
    } catch (syncError: any) {
      // 同期エラー - キューに追加
      if (this.retryHandler) {
        for (const key of Object.keys(allowedData)) {
          if (key !== 'db_updated_at') {
            await this.retryHandler.queueFailedChange({
              buyer_number: buyerNumber,
              field_name: key,
              old_value: existing[key] ? String(existing[key]) : null,
              new_value: allowedData[key] ? String(allowedData[key]) : null,
              retry_count: 0,
              last_error: syncError.message
            });
          }
        }
      }

      syncResult = {
        success: false,
        syncStatus: 'pending',
        error: syncError.message
      };
    }

    // 監査ログを記録（sync_status付き）
    if (userId && userEmail) {
      for (const key in allowedData) {
        if (key !== 'db_updated_at' && existing[key] !== allowedData[key]) {
          try {
            await AuditLogService.logFieldUpdate(
              'buyer',
              id,
              key,
              existing[key],
              allowedData[key],
              userId,
              userEmail,
              syncResult.syncStatus
            );
          } catch (auditError) {
            console.error('Failed to create audit log:', auditError);
          }
        }
      }
    }

    return {
      buyer: data,
      syncResult
    };
  }

  /**
   * 複数の買主情報をバッチ更新（GAS用）
   * @param buyers 買主データの配列 [{ buyer_number, updateData }, ...]
   * @param userId ユーザーID
   * @param userEmail ユーザーメール
   * @returns バッチ更新結果
   */
  async updateBatch(
    buyers: Array<{ buyer_number: string; updateData: Partial<any> }>,
    userId?: string,
    userEmail?: string
  ): Promise<{ success: number; failed: number; results: Array<{ buyer_number: string; success: boolean; error?: string }> }> {
    console.log('[BuyerService.updateBatch] ===== START =====');
    console.log('[BuyerService.updateBatch] buyers count:', buyers.length);

    const results: Array<{ buyer_number: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    // 各買主を順次更新
    for (const buyer of buyers) {
      try {
        const { buyer_number, updateData } = buyer;
        
        // updateメソッドを呼び出し（サイドバーカウント更新も含む）
        await this.update(buyer_number, updateData, userId, userEmail);
        
        results.push({
          buyer_number,
          success: true
        });
        successCount++;
      } catch (error: any) {
        console.error(`[BuyerService.updateBatch] Failed to update buyer ${buyer.buyer_number}:`, error);
        results.push({
          buyer_number: buyer.buyer_number,
          success: false,
          error: error.message
        });
        failedCount++;
      }
    }

    console.log('[BuyerService.updateBatch] ===== END =====');
    console.log('[BuyerService.updateBatch] Success:', successCount);
    console.log('[BuyerService.updateBatch] Failed:', failedCount);

    return {
      success: successCount,
      failed: failedCount,
      results
    };
  }

  async getExportData(options: BuyerQueryOptions = {}): Promise<any[]> {
    const { search, status, assignee, dateFrom, dateTo } = options;

    let query = this.supabase
      .from('buyers')
      .select('*');

    if (search) {
      query = query.or(
        `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%`
      );
    }
    if (status) {
      query = query.ilike('latest_status', `%${status}%`);
    }
    if (assignee) {
      query = query.or(`initial_assignee.ilike.%${assignee}%,follow_up_assignee.ilike.%${assignee}%`);
    }
    if (dateFrom) {
      query = query.gte('reception_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('reception_date', dateTo);
    }

    query = query.order('buyer_number', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to export buyers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Parse past_buyer_list column into array of buyer numbers
   * @param pastBuyerList - Comma-separated string of past buyer numbers
   * @returns Array of trimmed buyer numbers
   */
  parsePastBuyerList(pastBuyerList: string | null | undefined): string[] {
    if (!pastBuyerList || pastBuyerList.trim() === '') {
      return [];
    }

    return pastBuyerList
      .split(',')
      .map(num => num.trim())
      .filter(num => num.length > 0);
  }

  /**
   * Get all past buyer numbers for a buyer
   * @param buyerId - The buyer ID
   * @returns Array of past buyer numbers with metadata
   */
  async getPastBuyerNumbers(buyerId: string): Promise<Array<{
    buyerNumber: string;
    propertyNumber: string | null;
    inquiryDate: string | null;
    inquirySource: string | null;
  }>> {
    // Get the buyer record
    const buyer = await this.getById(buyerId);
    if (!buyer) {
      throw new Error(`Buyer not found: ${buyerId}`);
    }

    // Parse past buyer list
    const pastBuyerNumbers = this.parsePastBuyerList(buyer.past_buyer_list);
    
    if (pastBuyerNumbers.length === 0) {
      return [];
    }

    // For each past buyer number, try to find inquiry details
    // Since past buyer numbers are historical, we need to search for them
    // in the buyers table (they might still exist as separate records)
    const { data: pastBuyerRecords, error } = await this.supabase
      .from('buyers')
      .select('buyer_number, property_number, reception_date, inquiry_source')
      .in('buyer_number', pastBuyerNumbers);

    if (error) {
      console.error('Error fetching past buyer records:', error);
      // Return basic info even if we can't fetch details
      return pastBuyerNumbers.map(num => ({
        buyerNumber: num,
        propertyNumber: null,
        inquiryDate: null,
        inquirySource: null
      }));
    }

    // Create a map of buyer number to details
    const detailsMap = new Map<string, { propertyNumber: string | null; inquiryDate: string | null; inquirySource: string | null }>(
      (pastBuyerRecords || []).map(record => [
        record.buyer_number,
        {
          propertyNumber: record.property_number,
          inquiryDate: record.reception_date,
          inquirySource: record.inquiry_source
        }
      ])
    );

    // Return array with details where available
    return pastBuyerNumbers.map(num => ({
      buyerNumber: num,
      propertyNumber: detailsMap.get(num)?.propertyNumber || null,
      inquiryDate: detailsMap.get(num)?.inquiryDate || null,
      inquirySource: detailsMap.get(num)?.inquirySource || null
    }));
  }

  /**
   * Get inquiry history for a specific buyer number
   * @param buyerNumber - The buyer number to look up
   * @returns Inquiry details including property, date, source, status
   */
  async getInquiryHistoryByBuyerNumber(buyerNumber: string): Promise<{
    buyerNumber: string;
    propertyNumber: string | null;
    inquiryDate: string | null;
    inquirySource: string | null;
    status: string | null;
    buyerId: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('buyers')
      .select('buyer_id, buyer_number, property_number, reception_date, inquiry_source, latest_status')
      .eq('buyer_number', buyerNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch inquiry history: ${error.message}`);
    }

    return {
      buyerNumber: data.buyer_number,
      propertyNumber: data.property_number,
      inquiryDate: data.reception_date,
      inquirySource: data.inquiry_source,
      status: data.latest_status,
      buyerId: data.buyer_id
    };
  }

  /**
   * Get complete inquiry history across all buyer numbers for a buyer
   * @param buyerId - The buyer ID
   * @returns Array of all inquiries including current and past buyer numbers
   */
  async getCompleteInquiryHistory(buyerId: string): Promise<Array<{
    buyerNumber: string;
    propertyNumber: string | null;
    inquiryDate: string | null;
    inquirySource: string | null;
    status: string | null;
    isCurrent: boolean;
  }>> {
    const buyer = await this.getById(buyerId);
    if (!buyer) {
      throw new Error(`Buyer not found: ${buyerId}`);
    }

    const history: Array<{
      buyerNumber: string;
      propertyNumber: string | null;
      inquiryDate: string | null;
      inquirySource: string | null;
      status: string | null;
      isCurrent: boolean;
    }> = [];

    // Add current buyer number inquiry
    history.push({
      buyerNumber: buyer.buyer_number,
      propertyNumber: buyer.property_number,
      inquiryDate: buyer.reception_date,
      inquirySource: buyer.inquiry_source,
      status: buyer.latest_status,
      isCurrent: true
    });

    // Add past buyer numbers
    const pastBuyerNumbers = await this.getPastBuyerNumbers(buyerId);
    for (const past of pastBuyerNumbers) {
      history.push({
        buyerNumber: past.buyerNumber,
        propertyNumber: past.propertyNumber,
        inquiryDate: past.inquiryDate,
        inquirySource: past.inquirySource,
        status: null, // Past records may not have current status
        isCurrent: false
      });
    }

    // Sort by inquiry date (most recent first)
    history.sort((a, b) => {
      if (!a.inquiryDate) return 1;
      if (!b.inquiryDate) return -1;
      return new Date(b.inquiryDate).getTime() - new Date(a.inquiryDate).getTime();
    });

    return history;
  }

  /**
   * Get inquiry history for buyer detail page
   * Returns all property inquiries associated with current and past buyer numbers
   * @param buyerId - The buyer ID
   * @returns Array of inquiry history items with property details
   */
  async getInquiryHistory(buyerId: string): Promise<Array<{
    buyerNumber: string;
    propertyNumber: string;
    propertyAddress: string;
    inquiryDate: string;
    status: 'current' | 'past';
    propertyId: string;
    propertyListingId: string;
  }>> {
    // buyerIdがUUIDか買主番号かを判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerId);
    
    // 買主番号の場合は直接DBから取得（getById経由を避けて余分なクエリを削減）
    let buyer: any;
    if (isUuid) {
      buyer = await this.getById(buyerId);
    } else {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number, property_number, reception_date, past_buyer_list')
        .eq('buyer_number', buyerId)
        .is('deleted_at', null)
        .single();
      if (error && error.code !== 'PGRST116') throw new Error(`Failed to fetch buyer: ${error.message}`);
      buyer = data;
    }
    
    if (!buyer) {
      throw new Error(`Buyer not found: ${buyerId}`);
    }

    // Collect all property numbers from current buyer
    const allPropertyNumbers: string[] = [];
    const propertyToBuyerMap = new Map<string, { 
      buyerNumber: string; 
      status: 'current' | 'past';
      inquiryDate: string;
    }>();

    // Parse current buyer's property numbers
    if (buyer.property_number) {
      const currentPropertyNumbers = buyer.property_number
        .split(',')
        .map((n: string) => n.trim())
        .filter((n: string) => n);
      
      currentPropertyNumbers.forEach((propNum: string) => {
        allPropertyNumbers.push(propNum);
        propertyToBuyerMap.set(propNum, {
          buyerNumber: buyer.buyer_number,
          status: 'current',
          inquiryDate: buyer.reception_date || ''
        });
      });
    }

    // Get past buyer numbers and their property numbers（並列取得）
    const pastBuyerNumbers = this.parsePastBuyerList(buyer.past_buyer_list);
    
    if (pastBuyerNumbers.length > 0) {
      const pastBuyerResults = await Promise.all(
        pastBuyerNumbers.map(pastBuyerNumber =>
          this.supabase
            .from('buyers')
            .select('buyer_number, property_number, reception_date')
            .eq('buyer_number', pastBuyerNumber)
            .single()
        )
      );

      for (const { data: pastBuyer, error: pastBuyerError } of pastBuyerResults) {
        if (!pastBuyerError && pastBuyer && pastBuyer.property_number) {
          const pastPropertyNumbers = pastBuyer.property_number
            .split(',')
            .map((n: string) => n.trim())
            .filter((n: string) => n);
          
          pastPropertyNumbers.forEach((propNum: string) => {
            allPropertyNumbers.push(propNum);
            propertyToBuyerMap.set(propNum, {
              buyerNumber: pastBuyer.buyer_number,
              status: 'past',
              inquiryDate: pastBuyer.reception_date || ''
            });
          });
        }
      }
    }

    // Remove duplicates
    const uniquePropertyNumbers = Array.from(new Set(allPropertyNumbers));

    if (uniquePropertyNumbers.length === 0) {
      return [];
    }

    // Fetch property listings for all property numbers
    const { data: properties, error } = await this.supabase
      .from('property_listings')
      .select(`
        id,
        property_number,
        address
      `)
      .in('property_number', uniquePropertyNumbers);

    if (error) {
      throw new Error(`Failed to fetch inquiry history: ${error.message}`);
    }

    if (!properties || properties.length === 0) {
      return [];
    }

    // Map to inquiry history format
    const history = properties.map(property => {
      const buyerInfo = propertyToBuyerMap.get(property.property_number);
      return {
        buyerNumber: buyerInfo?.buyerNumber || buyer.buyer_number,
        propertyNumber: property.property_number,
        propertyAddress: property.address || '',
        inquiryDate: buyerInfo?.inquiryDate || '',
        status: buyerInfo?.status || 'current',
        propertyId: property.id,
        propertyListingId: property.id,
      };
    });

    // Sort by inquiry date (most recent first)
    history.sort((a, b) => {
      if (!a.inquiryDate) return 1;
      if (!b.inquiryDate) return -1;
      return new Date(b.inquiryDate).getTime() - new Date(a.inquiryDate).getTime();
    });

    return history;
  }

  /**
   * 配信エリア番号に該当する買主を取得（買主候補と同じ条件でフィルタリング）
   */
  async getBuyersByAreas(
    areaNumbers: string[],
    propertyType?: string | null,
    salesPrice?: number | null
  ): Promise<any[]> {
    if (!areaNumbers || areaNumbers.length === 0) {
      return [];
    }

    // DBレベルで distribution_type = '要' に絞り込み（最大のボトルネック解消）
    // latest_status が成約・Dを含むものも除外
    const { data: allBuyers, error } = await this.supabase
      .from('buyers')
      .select(`
        buyer_id,
        buyer_number,
        name,
        latest_status,
        latest_viewing_date,
        inquiry_confidence,
        inquiry_source,
        distribution_type,
        distribution_areas,
        broker_inquiry,
        desired_area,
        desired_property_type,
        price_range_house,
        price_range_apartment,
        price_range_land,
        reception_date,
        email,
        phone_number,
        property_type,
        property_number,
        price,
        inquiry_hearing,
        viewing_result_follow_up
      `)
      .eq('distribution_type', '要')
      .is('deleted_at', null)
      .not('latest_status', 'ilike', '%成約%')
      .not('latest_status', 'ilike', '%D%');

    if (error) {
      throw new Error(`Failed to fetch buyers by areas: ${error.message}`);
    }

    const filteredBuyers = this.filterBuyerCandidates(allBuyers || [], areaNumbers, propertyType, salesPrice);
    const sortedBuyers = this.sortBuyersByDateAndConfidence(filteredBuyers);

    // property_listingsからproperty_addressを取得して付与
    const propertyNumbers = [...new Set(
      sortedBuyers.map((b: any) => b.property_number).filter(Boolean)
    )] as string[];

    let propertyAddressMap: Record<string, string | null> = {};
    if (propertyNumbers.length > 0) {
      const { data: properties } = await this.supabase
        .from('property_listings')
        .select('property_number, address')
        .in('property_number', propertyNumbers);
      if (properties) {
        properties.forEach((p: any) => {
          propertyAddressMap[p.property_number] = p.address ?? null;
        });
      }
    }

    return sortedBuyers.map(buyer => ({
      ...buyer,
      distribution_areas: this.parseDistributionAreas(buyer.distribution_areas || buyer.desired_area),
      inquiry_property_type: buyer.desired_property_type ?? null,
      inquiry_price: buyer.price ?? null,
      property_address: propertyAddressMap[buyer.property_number] ?? null,
    }));
  }

  private parseDistributionAreas(distributionAreas: any): string[] {
    if (!distributionAreas) return [];
    if (Array.isArray(distributionAreas)) return distributionAreas;
    if (typeof distributionAreas === 'string') {
      return distributionAreas.split(/[,\s]+/).map(area => area.trim()).filter(area => area.length > 0);
    }
    return [];
  }

  private filterBuyerCandidates(
    buyers: any[],
    propertyAreaNumbers: string[],
    propertyType?: string | null,
    salesPrice?: number | null
  ): any[] {
    return buyers.filter(buyer => {
      if (this.shouldExcludeBuyer(buyer)) return false;
      if (!this.matchesStatus(buyer)) return false;
      if (!this.matchesAreaCriteria(buyer, propertyAreaNumbers)) return false;
      if (propertyType && !this.matchesPropertyTypeCriteria(buyer, propertyType)) return false;
      if (salesPrice && !this.matchesPriceCriteria(buyer, salesPrice, propertyType)) return false;
      return true;
    });
  }

  private sortBuyersByDateAndConfidence(buyers: any[]): any[] {
    return buyers.sort((a, b) => {
      const dateA = a.reception_date ? new Date(a.reception_date).getTime() : 0;
      const dateB = b.reception_date ? new Date(b.reception_date).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      const confidenceOrder: { [key: string]: number } = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6 };
      const orderA = confidenceOrder[(a.inquiry_confidence || '').trim().toUpperCase()] || 999;
      const orderB = confidenceOrder[(b.inquiry_confidence || '').trim().toUpperCase()] || 999;
      return orderA - orderB;
    });
  }

  private shouldExcludeBuyer(buyer: any): boolean {
    if (this.isBusinessInquiry(buyer)) return true;
    if (!this.hasMinimumCriteria(buyer)) return true;
    if (!this.hasDistributionRequired(buyer)) return true;
    return false;
  }

  private isBusinessInquiry(buyer: any): boolean {
    const inquirySource = (buyer.inquiry_source || '').trim();
    const distributionType = (buyer.distribution_type || '').trim();
    const brokerInquiry = (buyer.broker_inquiry || '').trim();
    if (inquirySource === '業者問い合わせ' || inquirySource.includes('業者')) return true;
    if (distributionType === '業者問い合わせ' || distributionType.includes('業者')) return true;
    if (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false') return true;
    return false;
  }

  private hasMinimumCriteria(buyer: any): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    const desiredPropertyType = (buyer.desired_property_type || '').trim();
    return desiredArea !== '' || desiredPropertyType !== '';
  }

  private hasDistributionRequired(buyer: any): boolean {
    return (buyer.distribution_type || '').trim() === '要';
  }

  private matchesStatus(buyer: any): boolean {
    const latestStatus = (buyer.latest_status || '').trim();
    if (latestStatus.includes('成約') || latestStatus.includes('D')) return false;
    return true;
  }

  // 別府市エリア番号一覧（㊶別府市全域・㊸別府市広域の判定に使用）
  private readonly BEPPU_AREA_NUMBERS = ['\u2468', '\u2469', '\u246A', '\u246B', '\u246C', '\u246D', '\u246E', '\u32B7', '\u32B8'];
  // ⑨=U+2468, ⑩=U+2469, ⑪=U+246A, ⑫=U+246B, ⑬=U+246C, ⑭=U+246D, ⑮=U+246E, ㊷=U+32B7, ㊸=U+32B8

  private matchesAreaCriteria(buyer: any, propertyAreaNumbers: string[]): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    if (!desiredArea) return true;
    if (propertyAreaNumbers.length === 0) return false;
    const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);

    // ㊶（U+32B6）= 別府市全域: 物件が別府市エリア（⑨〜⑮㊷㊸）のいずれかであれば該当
    const BEPPU_ALL = '\u32B6'; // ㊶
    if (buyerAreaNumbers.includes(BEPPU_ALL)) {
      const isBeppuProperty = propertyAreaNumbers.some(a => this.BEPPU_AREA_NUMBERS.includes(a));
      if (isBeppuProperty) return true;
    }

    // 通常のエリアマッチング
    return propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
  }

  private matchesPropertyTypeCriteria(buyer: any, propertyType: string | null): boolean {
    const desiredType = (buyer.desired_property_type || '').trim();
    if (desiredType === '指定なし') return true;
    if (!desiredType) return false;
    if (!propertyType) return false;

    const propertyTypeMap: Record<string, string> = {
      'land': '土地',
      'detached_house': '戸建',
      'apartment': 'マンション',
    };
    const japanesePropertyType = propertyTypeMap[propertyType] || propertyType;
    const normalizedPropertyType = this.normalizePropertyType(japanesePropertyType);
    const normalizedDesiredTypes = desiredType.split(/[,、\s]+/).map((t: string) => this.normalizePropertyType(t));

    return normalizedDesiredTypes.some((dt: string) =>
      dt === normalizedPropertyType ||
      normalizedPropertyType.includes(dt) ||
      dt.includes(normalizedPropertyType)
    );
  }

  private matchesPriceCriteria(buyer: any, salesPrice: number | null, propertyType: string | null): boolean {
    if (!salesPrice) return true;

    const propertyTypeMap: Record<string, string> = {
      'land': '土地',
      'detached_house': '戸建',
      'apartment': 'マンション',
    };
    const japanesePropertyType = propertyTypeMap[propertyType || ''] || propertyType;
    const normalizedType = this.normalizePropertyType(japanesePropertyType || '');

    let priceRange: string | null = null;
    if (normalizedType === '戸建' || normalizedType.includes('戸建')) {
      priceRange = buyer.price_range_house;
    } else if (normalizedType === 'マンション' || normalizedType.includes('マンション')) {
      priceRange = buyer.price_range_apartment;
    } else if (normalizedType === '土地' || normalizedType.includes('土地')) {
      priceRange = buyer.price_range_land;
    }

    if (!priceRange || !priceRange.trim()) return true;

    const { min, max } = this.parsePriceRange(priceRange);
    return salesPrice >= min && salesPrice <= max;
  }

  private extractAreaNumbers(areaString: string): string[] {
    // ①〜⑳（U+2460〜U+2473）および㉑〜㊿（U+3251〜U+32BF）の囲み数字を全て抽出
    return areaString.match(/[\u2460-\u2473\u3251-\u32BF]/g) || [];
  }

  /**
   * ステータスごとの買主数をカウント
   */
  /**
   * 全買主を1000件制限を回避して全件取得する
   */
  private async fetchAllBuyers(): Promise<any[]> {
    const PAGE_SIZE = 1000;

    // ステータス計算と物件情報表示に必要なカラムのみ取得（select('*')より大幅に高速化）
    const BUYER_COLUMNS = [
      'buyer_number', 'buyer_id', 'name', 'phone_number', 'email',
      'reception_date', 'latest_viewing_date', 'viewing_date', 'next_call_date',
      'follow_up_assignee', 'initial_assignee', 'latest_status',
      'inquiry_confidence', 'inquiry_email_phone', 'inquiry_email_reply',
      'three_calls_confirmed', 'broker_inquiry', 'inquiry_source',
      'viewing_result_follow_up', 'viewing_unconfirmed', 'viewing_type_general',
      'post_viewing_seller_contact', 'notification_sender',
      'valuation_survey', 'valuation_survey_confirmed', 'broker_survey', 'vendor_survey',
      'day_of_week', 'pinrich', 'email_confirmed', 'email_confirmation_assignee',
      'viewing_promotion_not_needed', 'viewing_promotion_sender',
      'past_buyer_list', 'price', 'property_number',
      'desired_area', 'desired_property_type', 'budget',
    ].join(', ');

    console.log('🔍 [DEBUG] fetchAllBuyers - BUYER_COLUMNS:', BUYER_COLUMNS);

    // count クエリ・最初のバッチ・property_listings を全て並列実行
    const [countResult, firstBatchResult, allListingsResult] = await Promise.all([
      this.supabase
        .from('buyers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      this.supabase
        .from('buyers')
        .select(BUYER_COLUMNS)
        .is('deleted_at', null)
        .range(0, PAGE_SIZE - 1),
      // property_listings を buyers 取得と並列で全件取得
      this.supabase
        .from('property_listings')
        .select('property_number, atbb_status, address, sales_assignee, property_type'),
    ]);

    const { count, error: countError } = countResult;
    if (countError) throw new Error(`Failed to count buyers: ${countError.message}`);
    if (firstBatchResult.error) throw new Error(`Failed to fetch buyers: ${firstBatchResult.error.message}`);

    const totalCount = count || 0;
    if (totalCount === 0) return [];

    const allBuyers: any[] = [...(firstBatchResult.data || [])];

    // 2バッチ目以降を並列取得（既に1バッチ目は取得済み）
    const batchCount = Math.ceil(totalCount / PAGE_SIZE);
    if (batchCount > 1) {
      const remainingRanges: Array<[number, number]> = [];
      for (let i = 1; i < batchCount; i++) {
        remainingRanges.push([i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1]);
      }

      const batchResults = await Promise.all(
        remainingRanges.map(([from, to]) =>
          this.supabase
            .from('buyers')
            .select(BUYER_COLUMNS)
            .is('deleted_at', null)
            .range(from, to)
        )
      );

      for (const { data, error } of batchResults) {
        if (error) throw new Error(`Failed to fetch buyers: ${error.message}`);
        if (data) allBuyers.push(...data);
      }
    }

    // property_listings のマップを構築（並列取得済み）
    const propertyMap: Record<string, { atbb_status: string; property_address: string | null; sales_assignee: string | null; property_type: string | null }> = {};
    if (allListingsResult.data) {
      for (const listing of allListingsResult.data) {
        if (listing.property_number) {
          propertyMap[listing.property_number] = {
            atbb_status: listing.atbb_status || '',
            property_address: listing.address ?? null,
            sales_assignee: listing.sales_assignee ?? null,
            property_type: listing.property_type ?? null,
          };
        }
      }
    }

    // 各買主に紐づく物件の情報を付与（複数物件の場合は最初の物件を使用）
    return allBuyers.map(buyer => {
      if (!buyer.property_number) return buyer;
      const firstPropertyNumber = buyer.property_number.split(',')[0].trim();
      const prop = propertyMap[firstPropertyNumber];
      return {
        ...buyer,
        atbb_status: prop?.atbb_status || '',
        property_address: prop?.property_address ?? null,
        property_sales_assignee: prop?.sales_assignee ?? null,
        property_type: prop?.property_type ?? null,
      };
    });
  }

  /**
   * ステータス計算済み全買主をキャッシュ付きで取得（TTL: 2分）
   * getStatusCategories と getBuyersByStatus で共有して二重計算を防ぐ
   */
  private async fetchAllBuyersWithStatus(): Promise<any[]> {
    const now = Date.now();
    if (_moduleLevelStatusCache && (now - _moduleLevelStatusCache.computedAt) < _MODULE_STATUS_CACHE_TTL) {
      return _moduleLevelStatusCache.buyers;
    }

    const allBuyers = await this.fetchAllBuyers();

    const buyers = allBuyers.map(buyer => {
      try {
        // 🚨 デバッグ: 買主7176のデータを記録
        if (buyer.buyer_number === '7176') {
          console.log('🔍 [DEBUG] Buyer 7176 data before calculateBuyerStatus:', JSON.stringify(buyer, null, 2));
        }
        
        const statusResult = calculateBuyerStatus(buyer);
        
        // 🚨 デバッグ: 買主7176のステータス計算結果を記録
        if (buyer.buyer_number === '7176') {
          console.log('🔍 [DEBUG] Buyer 7176 statusResult:', JSON.stringify(statusResult, null, 2));
        }
        
        return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority };
      } catch (error) {
        console.error(`[BuyerService] Error calculating status for buyer ${buyer.buyer_number}:`, error);
        console.error(`[BuyerService] Buyer data:`, JSON.stringify(buyer, null, 2));
        return { ...buyer, calculated_status: '', status_priority: 999 };
      }
    });

    _moduleLevelStatusCache = { buyers, computedAt: now };
    return buyers;
  }

  /**
   * ステータスカテゴリのカウントのみを返す（サイドバー初期表示用・高速）
   * キャッシュがある場合はそこから計算、なければ全件取得して計算しキャッシュに保存
   */
  async getStatusCategoriesOnly(): Promise<{
    categories: Array<{ status: string; count: number; priority: number; color: string }>;
    normalStaffInitials: string[];
    fromCache: boolean;
  }> {
    const now = Date.now();
    const fromCache = !!(_moduleLevelStatusCache && (now - _moduleLevelStatusCache.computedAt) < _MODULE_STATUS_CACHE_TTL);

    // 全件取得 と employees クエリを並列実行
    const [allBuyers, normalStaffInitials] = await Promise.all([
      this.fetchAllBuyersWithStatus(),
      this.fetchNormalStaffInitials(),
    ]);
    const categories = await this.buildCategoriesFromBuyers(allBuyers);

    return { categories, normalStaffInitials, fromCache };
  }

  /**
   * ステータスカテゴリ + 全買主データを一度に返す（フロントエンドキャッシュ用）
   * buyer_sidebar_counts テーブルからカテゴリを取得し、全買主データも返す
   */
  async getStatusCategoriesWithBuyers(): Promise<{
    categories: any;
    buyers: any[];
    normalStaffInitials: string[];
  }> {
    // サイドバーカウント（buyer_sidebar_countsテーブルから）と全買主データを並列取得
    const [sidebarData, allBuyers] = await Promise.all([
      this.getSidebarCounts(),
      this.fetchAllBuyersWithStatus(),
    ]);

    console.log('🔍 [DEBUG] getStatusCategoriesWithBuyers - sidebarData:', JSON.stringify(sidebarData, null, 2));
    console.log('🔍 [DEBUG] getStatusCategoriesWithBuyers - sidebarData.categoryCounts:', sidebarData.categoryCounts);
    console.log('🔍 [DEBUG] getStatusCategoriesWithBuyers - sidebarData.normalStaffInitials:', sidebarData.normalStaffInitials);

    // ✅ 修正: categoryCounts形式で返す（categories配列に変換しない）
    return {
      categories: sidebarData.categoryCounts, // categoryCounts形式のまま返す
      buyers: allBuyers,
      normalStaffInitials: sidebarData.normalStaffInitials
    };
  }

  /**
   * サイドバー用のカテゴリカウントを取得（高速版）
   * buyer_sidebar_counts テーブルから1クエリで高速取得。
   * テーブルが空または取得失敗の場合は重いDBクエリにフォールバック。
   */
  async getSidebarCounts(): Promise<{
    categoryCounts: any;
    normalStaffInitials: string[];
  }> {
    // 🚨 重要：buyersテーブルから動的に計算（buyer_sidebar_countsテーブルは使用しない）
    console.log('🔍 [BuyerService] getSidebarCounts called - calculating dynamically from buyers table');
    
    // 直接フォールバック（動的計算）を呼び出す
    return this.getSidebarCountsFallback();
  }

  /**
   * サイドバーカウントを動的に計算（buyersテーブルから）
   * 全買主データを取得してステータスを計算し、カテゴリ別にカウント
   */
  private async getSidebarCountsFallback(): Promise<{
    categoryCounts: any;
    normalStaffInitials: string[];
  }> {
    console.log('📊 Calculating sidebar counts dynamically from all buyers');
    
    // 全買主データを取得してステータスを計算
    const allBuyers = await this.fetchAllBuyersWithStatus();
    
    // カテゴリカウントオブジェクトを構築
    // 🚨 重要：買主リスト専用のキーのみを含める（売主専用のキーは削除）
    const result: any = {
      all: allBuyers.length,
      viewingDayBefore: 0,  // ✅ 買主用：内覧日前日
      todayCall: 0,          // ✅ 買主用：当日TEL
      threeCallUnchecked: 0, // ✅ 買主用：３回架電未（新規）
      assignedCounts: {} as Record<string, number>,  // ✅ 買主用：担当別
      todayCallAssignedCounts: {} as Record<string, number>,  // ✅ 買主用：当日TEL担当別
      // 🆕 新カテゴリ（2026年4月）
      inquiryEmailUnanswered: 0,  // 問合メール未対応
      brokerInquiry: 0,  // 業者問合せあり
      generalViewingSellerContactPending: 0,  // 一般媒介_内覧後売主連絡未
      viewingPromotionRequired: 0,  // 要内覧促進客
      pinrichUnregistered: 0,  // ピンリッチ未登録
    };
    
    // 今日の日付（YYYY-MM-DD形式）
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 各買主のステータスをカウント
    allBuyers.forEach((buyer: any) => {
      const status = buyer.calculated_status || '';
      
      // カテゴリキーへのマッピング（買主リスト専用）
      if (status === '内覧日前日') {
        result.viewingDayBefore++;  // ✅ 買主用：内覧日前日
      } else if (status === '当日TEL') {
        result.todayCall++;  // ✅ 買主用：当日TEL
      } else if (status === '3回架電未') {
        result.threeCallUnchecked++;  // ✅ 買主用：３回架電未（新規）
      } else if (status.startsWith('当日TEL(')) {
        // 当日TEL(Y) などの担当別
        const match = status.match(/^当日TEL\((.+)\)$/);
        if (match) {
          const assignee = match[1];
          result.todayCallAssignedCounts[assignee] = (result.todayCallAssignedCounts[assignee] || 0) + 1;
        }
      } else if (status.startsWith('担当(')) {
        // 担当(Y) などの担当別
        const match = status.match(/^担当\((.+)\)$/);
        if (match) {
          const assignee = match[1];
          result.assignedCounts[assignee] = (result.assignedCounts[assignee] || 0) + 1;  // ✅ 買主用：担当別
        }
      }
      // 🚨 売主専用のカテゴリは削除（買主リストには不要）
      // - 内覧済み、未査定、査定（郵送）、当日TEL未着手、Pinrich空欄、専任、一般、訪問後他決、未訪問他決、当日TEL（内容）
      
      // 🆕 新カテゴリの条件式（2026年4月）
      
      // 1. 問合メール未対応
      const inquiryEmailPhone = buyer.inquiry_email_phone || '';
      const inquiryEmailReply = buyer.inquiry_email_reply || '';
      const latestViewingDate = buyer.latest_viewing_date || '';
      
      if (
        inquiryEmailPhone === '未' ||
        inquiryEmailReply === '未' ||
        (
          !latestViewingDate &&
          (inquiryEmailPhone === '不要' || inquiryEmailPhone === '不要') &&
          (inquiryEmailReply === '未' || !inquiryEmailReply)
        )
      ) {
        result.inquiryEmailUnanswered++;
      }
      
      // 2. 業者問合せあり
      const vendorSurvey = buyer.vendor_survey || '';
      if (vendorSurvey === '未') {
        result.brokerInquiry++;
      }
      
      // 3. 一般媒介_内覧後売主連絡未
      const viewingTypeGeneral = buyer.viewing_type_general || '';
      const postViewingSellerContact = buyer.post_viewing_seller_contact || '';
      
      if (
        (
          latestViewingDate >= '2026-03-20' &&
          latestViewingDate < todayStr &&
          viewingTypeGeneral &&
          (postViewingSellerContact === '未' || !postViewingSellerContact)
        ) ||
        postViewingSellerContact === '未'
      ) {
        result.generalViewingSellerContactPending++;
      }
      
      // 4. 要内覧促進客
      const receptionDate = buyer.reception_date || '';
      const followUpAssignee = buyer.follow_up_assignee || '';
      const latestStatus = buyer.latest_status || '';
      const viewingPromotionNotNeeded = buyer.viewing_promotion_not_needed || '';
      const viewingPromotionSender = buyer.viewing_promotion_sender || '';
      const brokerInquiryField = buyer.broker_inquiry || '';
      const inquirySource = buyer.inquiry_source || '';
      const inquiryConfidence = buyer.inquiry_confidence || '';
      
      // broker_inquiry が空（null, '', 'null'）かチェック
      const isBrokerInquiryEmpty = !brokerInquiryField || brokerInquiryField === 'null';
      
      if (receptionDate) {
        const receptionDateObj = new Date(receptionDate);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const fourDaysAgo = new Date(today);
        fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
        
        if (
          receptionDateObj >= fourteenDaysAgo &&
          receptionDateObj <= fourDaysAgo &&
          !latestViewingDate &&
          !followUpAssignee &&
          !latestStatus &&
          viewingPromotionNotNeeded !== '不要' &&
          !viewingPromotionSender &&
          isBrokerInquiryEmpty &&
          inquirySource !== '配信希望アンケート' &&
          !inquirySource.includes('ピンリッチ') &&
          !inquirySource.includes('2件目以降紹介') &&
          inquiryConfidence !== 'e（買付物件の問合せ）' &&
          inquiryConfidence !== 'd（資料送付不要、条件不適合など）' &&
          inquiryConfidence !== 'b（内覧検討）'
        ) {
          result.viewingPromotionRequired++;
        }
      }
      
      // 5. ピンリッチ未登録
      const pinrich = buyer.pinrich || '';
      const email = buyer.email || '';
      
      // pinrich が空（null, '', 'null'）かチェック
      const isPinrichEmpty = !pinrich || pinrich === 'null';
      
      if (
        (
          isPinrichEmpty &&
          email &&
          isBrokerInquiryEmpty
        ) ||
        (
          pinrich === '登録無し' &&
          email &&
          isBrokerInquiryEmpty
        )
      ) {
        result.pinrichUnregistered++;
      }
    });
    
    // 通常スタッフのイニシャルを取得
    const normalStaffInitials = await this.fetchNormalStaffInitials();
    
    // ✅ 修正: categoryCounts形式で返す（categories配列ではなく）
    return { categoryCounts: result, normalStaffInitials };
  }

  /**
   * 通常スタッフのイニシャルを取得（内部ヘルパー）
   */
  private async fetchNormalStaffInitials(): Promise<string[]> {
    try {
      const { data: staffDataNormal, error: normalError } = await this.supabase
        .from('employees')
        .select('initials')
        .eq('is_normal', true);
      if (!normalError && staffDataNormal && staffDataNormal.length > 0) {
        return staffDataNormal.map((s: any) => s.initials).filter((i: string) => i);
      }
      const { data: allStaffData } = await this.supabase
        .from('employees')
        .select('initials');
      return (allStaffData || []).map((s: any) => s.initials).filter((i: string) => i);
    } catch {
      return [];
    }
  }

  /**
   * カテゴリカウントオブジェクトからcategories配列を構築（内部ヘルパー）
   */
  private buildCategoriesFromCounts(counts: any): Array<{
    status: string; count: number; priority: number; color: string;
  }> {
    const categories: Array<{ status: string; count: number; priority: number; color: string }> = [];
    
    // 基本カテゴリ
    categories.push({
      status: '内覧日前日',
      count: counts.viewingDayBefore || 0,
      priority: 3,
      color: '#d32f2f'
    });
    
    categories.push({
      status: '当日TEL',
      count: counts.todayCall || 0,
      priority: 16,
      color: '#555555'
    });
    
    // 担当別カテゴリ
    if (counts.assignedCounts) {
      Object.entries(counts.assignedCounts).forEach(([assignee, count]) => {
        categories.push({
          status: `担当(${assignee})`,
          count: count as number,
          priority: 100,
          color: '#4caf50'
        });
      });
    }
    
    // 当日TEL担当別カテゴリ
    if (counts.todayCallAssignedCounts) {
      Object.entries(counts.todayCallAssignedCounts).forEach(([assignee, count]) => {
        categories.push({
          status: `当日TEL(${assignee})`,
          count: count as number,
          priority: 101,
          color: '#ff5722'
        });
      });
    }
    
    return categories;
  }

  /**
   * ステータス計算済み買主リストからカテゴリを構築（内部ヘルパー）
   */
  private async buildCategoriesFromBuyers(allBuyers: any[]): Promise<Array<{
    status: string; count: number; priority: number; color: string;
  }>> {

    const statusCountMap = new Map<string, number>();
    allBuyers.forEach(buyer => {
      const status = buyer.calculated_status || '';
      // 当日TEL(Y) 等の担当別サブカテゴリはそのまま保持（担当別セクションで表示するため）
      // 「当日TEL」（担当なし）は別カテゴリとして独立して集計
      statusCountMap.set(status, (statusCountMap.get(status) || 0) + 1);
    });

    const categories: Array<{ status: string; count: number; priority: number; color: string }> = [];
    STATUS_DEFINITIONS.forEach((definition) => {
      categories.push({
        status: definition.status,
        count: statusCountMap.get(definition.status) || 0,
        priority: definition.priority,
        color: definition.color
      });
    });

    const assigneePriorityMap = new Map<string, number>();
    const knownAssigneePriorities: Record<string, number> = {
      'Y': 23, 'W': 24, 'U': 25, '生': 26, 'K': 27, '久': 28, 'I': 29, 'R': 30
    };
    let dynamicPriority = 31;

    statusCountMap.forEach((count, status) => {
      if (status === '' || count === 0) return;
      const assigneeMatch = status.match(/^担当\((.+)\)$/);
      if (assigneeMatch) {
        const assignee = assigneeMatch[1];
        const p = knownAssigneePriorities[assignee] ?? dynamicPriority++;
        assigneePriorityMap.set(assignee, p);
      }
    });

    statusCountMap.forEach((count, status) => {
      if (status === '') return;
      if (count === 0) return;
      const alreadyAdded = categories.some(c => c.status === status);
      if (!alreadyAdded) {
        const todayCallMatch = status.match(/^当日TEL\((.+)\)$/);
        if (todayCallMatch) {
          const assignee = todayCallMatch[1];
          const basePriority = assigneePriorityMap.get(assignee) ?? (knownAssigneePriorities[assignee] ?? 23);
          categories.push({ status, count, priority: basePriority + 0.5, color: '#ff5722' });
          return;
        }
        const assigneeMatch = status.match(/^担当\((.+)\)$/);
        if (assigneeMatch) {
          const assignee = assigneeMatch[1];
          const p = assigneePriorityMap.get(assignee) ?? (knownAssigneePriorities[assignee] ?? 23);
          categories.push({ status, count, priority: p, color: '#4caf50' });
        }
      }
    });

    // 空文字ステータス（未分類）の件数を STATUS_DEFINITIONS 由来のエントリに反映
    const emptyStatusCount = statusCountMap.get('') || 0;
    const emptyEntry = categories.find(c => c.status === '');
    if (emptyEntry) {
      emptyEntry.count = emptyStatusCount;
    }

    categories.sort((a, b) => a.priority - b.priority);
    return categories;
  }

  async getStatusCategories(): Promise<Array<{
    status: string;
    count: number;
    priority: number;
    color: string;
  }>> {
    try {
      const allBuyers = await this.fetchAllBuyersWithStatus();

      const statusCountMap = new Map<string, number>();
      allBuyers.forEach(buyer => {
        let status = buyer.calculated_status || '';
        if (status.startsWith('当日TEL（') || status.startsWith('当日TEL(')) {
          status = '当日TEL';
        }
        statusCountMap.set(status, (statusCountMap.get(status) || 0) + 1);
      });

      const categories: Array<{ status: string; count: number; priority: number; color: string }> = [];
      STATUS_DEFINITIONS.forEach((definition) => {
        categories.push({
          status: definition.status,
          count: statusCountMap.get(definition.status) || 0,
          priority: definition.priority,
          color: definition.color
        });
      });

      // STATUS_DEFINITIONSにないステータスも追加（当日TEL(林)、担当(林)などの動的ステータス）
      // まず担当(X)を全て収集してpriorityを割り当て
      const assigneePriorityMap = new Map<string, number>();
      const knownAssigneePriorities: Record<string, number> = {
        'Y': 23, 'W': 24, 'U': 25, '生': 26, 'K': 27, '久': 28, 'I': 29, 'R': 30
      };
      let dynamicPriority = 31;

      statusCountMap.forEach((count, status) => {
        if (status === '' || count === 0) return;
        const assigneeMatch = status.match(/^担当\((.+)\)$/);
        if (assigneeMatch) {
          const assignee = assigneeMatch[1];
          const p = knownAssigneePriorities[assignee] ?? dynamicPriority++;
          assigneePriorityMap.set(assignee, p);
        }
      });

      statusCountMap.forEach((count, status) => {
        if (status === '') return;
        if (count === 0) return;
        const alreadyAdded = categories.some(c => c.status === status);
        if (!alreadyAdded) {
          // 当日TEL(X)形式の動的ステータス（担当あり当日TEL）
          // 対応する担当(X)のpriorityに0.5を加算して直後に配置
          const todayCallMatch = status.match(/^当日TEL\((.+)\)$/);
          if (todayCallMatch) {
            const assignee = todayCallMatch[1];
            const basePriority = assigneePriorityMap.get(assignee) ?? (knownAssigneePriorities[assignee] ?? 23);
            categories.push({ status, count, priority: basePriority + 0.5, color: '#ff5722' });
            return;
          }
          // 担当(X)形式の動的ステータス
          const assigneeMatch = status.match(/^担当\((.+)\)$/);
          if (assigneeMatch) {
            const assignee = assigneeMatch[1];
            const p = assigneePriorityMap.get(assignee) ?? (knownAssigneePriorities[assignee] ?? 23);
            categories.push({ status, count, priority: p, color: '#4caf50' });
          }
        }
      });

      const emptyStatusCount = statusCountMap.get('') || 0;
      if (emptyStatusCount > 0) {
        categories.push({ status: '', count: emptyStatusCount, priority: 999, color: '#9E9E9E' });
      }

      categories.sort((a, b) => a.priority - b.priority);
      return categories;
    } catch (error) {
      throw new Error(`Failed to get status categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 特定のステータスに該当する買主を取得
   */
  async getBuyersByStatus(status: string, options: BuyerQueryOptions = {}): Promise<PaginatedResult<any>> {
    try {
      // キャッシュ済みステータス計算結果を使用（二重計算を防ぐ）
      const allBuyers = await this.fetchAllBuyersWithStatus();

      // 担当カテゴリのパターンマッチング
      // フロントエンドから3つの形式が渡される可能性がある:
      // 1. assigned:Y（サイドバーの親カテゴリから）
      // 2. todayCallAssigned:Y（サイドバーのサブカテゴリから）
      // 3. 担当(Y)（フロントエンドのフィルタリング後）
      const assignedPattern1 = /^assigned:(.+)$/;  // assigned:Y 形式
      const assignedPattern2 = /^担当\((.+)\)$/;   // 担当(Y) 形式
      const todayCallAssignedPattern = /^todayCallAssigned:(.+)$/;  // todayCallAssigned:Y 形式
      const assignedMatch1 = status.match(assignedPattern1);
      const assignedMatch2 = status.match(assignedPattern2);
      const todayCallAssignedMatch = status.match(todayCallAssignedPattern);

      let filteredBuyers: any[];

      if (todayCallAssignedMatch) {
        // 当日TEL(担当)カテゴリの場合
        const assignee = todayCallAssignedMatch[1]; // 'Y', 'I', '久', '外す' など
        
        console.log(`[getBuyersByStatus] 当日TEL(担当)カテゴリ検出: assignee=${assignee}, status=${status}`);
        
        filteredBuyers = allBuyers.filter(buyer => {
          // calculated_status が "当日TEL(Y)" の形式で一致する買主を表示
          const matches = buyer.calculated_status === `当日TEL(${assignee})`;
          
          if (matches) {
            console.log(`  ✅ ${buyer.buyer_number}: calculated_status=${buyer.calculated_status}`);
          }
          
          return matches;
        });
        
        console.log(`[getBuyersByStatus] 当日TEL(${assignee})フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'threeCallUnchecked') {
        // ３回架電未カテゴリの場合（新規）
        console.log(`[getBuyersByStatus] ３回架電未カテゴリ検出: status=${status}`);
        
        filteredBuyers = allBuyers.filter(buyer => {
          // calculated_status が "3回架電未" の買主を表示
          const matches = buyer.calculated_status === '3回架電未';
          
          if (matches) {
            console.log(`  ✅ ${buyer.buyer_number}: calculated_status=${buyer.calculated_status}`);
          }
          
          return matches;
        });
        
        console.log(`[getBuyersByStatus] ３回架電未フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
                 status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired' || 
                 status === 'pinrichUnregistered') {
        // 新カテゴリの場合（2026年4月追加）
        // これらのカテゴリはGASで計算されたカウントのみを使用し、フィルタリングは実装しない
        console.log(`[getBuyersByStatus] 新カテゴリ検出: status=${status}`);
        console.log(`[getBuyersByStatus] 新カテゴリはフィルタリング未実装のため、空配列を返します`);
        filteredBuyers = [];
      } else if (assignedMatch1 || assignedMatch2) {
        // 担当カテゴリの場合、follow_up_assignee または initial_assignee でフィルタリング
        const assignee = assignedMatch1 ? assignedMatch1[1] : assignedMatch2![1]; // 'Y', 'I', '久', '外す' など
        
        console.log(`[getBuyersByStatus] 担当カテゴリ検出: assignee=${assignee}, status=${status}`);
        
        filteredBuyers = allBuyers.filter(buyer => {
          // follow_up_assignee または initial_assignee が一致する買主を全て表示
          const matches = (
            buyer.follow_up_assignee === assignee ||
            (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
          );
          
          if (matches) {
            console.log(`  ✅ ${buyer.buyer_number}: follow_up_assignee=${buyer.follow_up_assignee}, initial_assignee=${buyer.initial_assignee}, calculated_status=${buyer.calculated_status}`);
          }
          
          return matches;
        });
        
        console.log(`[getBuyersByStatus] 担当(${assignee})フィルタ結果: ${filteredBuyers.length}件`);
      } else {
        // 既存のロジック（calculated_statusでフィルタリング）
        filteredBuyers = allBuyers.filter(buyer => buyer.calculated_status === status);
      }

      // 検索フィルタを適用
      filteredBuyers = filteredBuyers.filter(buyer => {
        if (!options.search) return true;
        const s = options.search.toLowerCase();
        const isBuyerNumber = /^\d{4,5}$/.test(options.search);
        if (isBuyerNumber) {
          return (buyer.buyer_number || '') === options.search;
        }
        return (
          (buyer.buyer_number || '').toLowerCase().includes(s) ||
          (buyer.name || '').toLowerCase().includes(s) ||
          (buyer.phone_number || '').toLowerCase().includes(s) ||
          (buyer.property_number || '').toLowerCase().includes(s)
        );
      });

      const { page = 1, limit = 50, sortBy = 'reception_date', sortOrder = 'desc' } = options;
      const offset = (page - 1) * limit;
      const total = filteredBuyers.length;
      const totalPages = Math.ceil(total / limit);

      filteredBuyers.sort((a, b) => {
        const aValue = a[sortBy as string];
        const bValue = b[sortBy as string];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
      });

      return { data: filteredBuyers.slice(offset, offset + limit), total, page, limit, totalPages };
    } catch (error) {
      throw new Error(`Failed to get buyers by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 買主を論理削除
   */
  async softDelete(buyerId: string): Promise<void> {
    const existing = await this.getById(buyerId);
    if (!existing) throw new Error('Buyer not found');

    const { error } = await this.supabase
      .from('buyers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('buyer_id', buyerId);

    if (error) throw new Error(`Failed to delete buyer: ${error.message}`);
  }

  /**
   * 論理削除した買主を復元
   */
  async restore(buyerId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('buyers')
      .update({ deleted_at: null })
      .eq('buyer_id', buyerId)
      .select()
      .single();

    if (error) throw new Error(`Failed to restore buyer: ${error.message}`);
    return data;
  }

  /**
   * ステータス付きで全買主を取得
   */
  async getBuyersWithStatus(): Promise<any[]> {
    // 1000件制限を回避するため全件取得
    const allBuyers = await this.fetchAllBuyers();

    return allBuyers
      .sort((a, b) => {
        if (!a.reception_date && !b.reception_date) return 0;
        if (!a.reception_date) return 1;
        if (!b.reception_date) return -1;
        return b.reception_date.localeCompare(a.reception_date);
      })
      .map(buyer => {
        try {
          const statusResult = calculateBuyerStatus(buyer);
          return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority };
        } catch {
          return { ...buyer, calculated_status: '', status_priority: 999 };
        }
      });
  }

  private normalizePropertyType(type: string): string {
    return type.trim()
      .replace(/中古/g, '')
      .replace(/新築/g, '')
      .replace(/一戸建て/g, '戸建')
      .replace(/一戸建/g, '戸建')
      .replace(/戸建て/g, '戸建')
      .replace(/区分/g, '')
      .trim();
  }

  private parsePriceRange(priceRange: string): { min: number; max: number } {
    let min = 0;
    let max = Number.MAX_SAFE_INTEGER;

    const cleanedRange = priceRange
      .replace(/,/g, '')
      .replace(/円/g, '')
      .replace(/万/g, '0000')
      .replace(/億/g, '00000000')
      .trim();

    const rangeMatch = cleanedRange.match(/(\d+)?\s*[〜～-]\s*(\d+)?/);
    if (rangeMatch) {
      if (rangeMatch[1]) min = parseInt(rangeMatch[1], 10);
      if (rangeMatch[2]) max = parseInt(rangeMatch[2], 10);
      return { min, max };
    }

    const aboveMatch = cleanedRange.match(/(\d+)\s*以上/);
    if (aboveMatch) { min = parseInt(aboveMatch[1], 10); return { min, max }; }

    const belowMatch = cleanedRange.match(/(\d+)\s*以下/);
    if (belowMatch) { max = parseInt(belowMatch[1], 10); return { min, max }; }

    const singleMatch = cleanedRange.match(/^(\d+)$/);
    if (singleMatch) {
      const value = parseInt(singleMatch[1], 10);
      return { min: value * 0.8, max: value * 1.2 };
    }

    return { min, max };
  }

  /**
   * 近隣物件を取得（類似物件機能）
   */
  async getNearbyProperties(propertyNumber: string): Promise<{
    baseProperty: any;
    nearbyProperties: any[];
  }> {
    // 基準物件を取得
    const { data: baseProperty, error: baseError } = await this.supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (baseError || !baseProperty) {
      throw new Error(`Base property not found: ${propertyNumber}`);
    }

    const baseLat: number | null = baseProperty.latitude;
    const baseLng: number | null = baseProperty.longitude;
    const price: number = baseProperty.price || 0;
    const propertyType: string = baseProperty.property_type || '';

    // 基準物件に座標がない場合は空を返す
    if (baseLat === null || baseLng === null) {
      return { baseProperty, nearbyProperties: [] };
    }

    // 価格帯：±500万円（円単位）
    const RANGE = 5000000;
    const minPrice = Math.max(0, price - RANGE);
    const maxPrice = price + RANGE;

    // 半径3kmのバウンディングボックスを計算（簡易近似）
    // 緯度1度 ≈ 111km、経度1度 ≈ 111km × cos(lat)
    const RADIUS_KM = 3;
    const latDelta = RADIUS_KM / 111;
    const lngDelta = RADIUS_KM / (111 * Math.cos((baseLat * Math.PI) / 180));

    const minLat = baseLat - latDelta;
    const maxLat = baseLat + latDelta;
    const minLng = baseLng - lngDelta;
    const maxLng = baseLng + lngDelta;

    // バウンディングボックス内の物件を取得（座標あり・同種別・価格帯）
    let query = this.supabase
      .from('property_listings')
      .select('*')
      .neq('property_number', propertyNumber)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .gte('price', minPrice)
      .lte('price', maxPrice);

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    const { data: candidates, error: nearbyError } = await query;

    if (nearbyError) {
      throw new Error(`Failed to fetch nearby properties: ${nearbyError.message}`);
    }

    // ステータスフィルタ：「非公開」を含むものは除外、ただし「非公開（配信メールのみ）」は含める
    const isValidStatus = (status: string | null): boolean => {
      if (!status) return true;
      if (status.includes('非公開（配信メールのみ）')) return true;
      if (status.includes('非公開')) return false;
      return true;
    };

    // バウンディングボックスは正方形なので、実際の距離でフィルタリング＋ステータスフィルタ
    const nearbyProperties = (candidates || []).filter((p: any) => {
      if (!isValidStatus(p.atbb_status)) return false;
      const dist = this.calcDistanceKm(baseLat, baseLng, p.latitude, p.longitude);
      return dist <= RADIUS_KM;
    });

    // 距離順にソート
    nearbyProperties.sort((a: any, b: any) => {
      const da = this.calcDistanceKm(baseLat, baseLng, a.latitude, a.longitude);
      const db = this.calcDistanceKm(baseLat, baseLng, b.latitude, b.longitude);
      return da - db;
    });

    return { baseProperty, nearbyProperties };
  }

  // Haversine公式で2点間の距離（km）を計算
  private calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
