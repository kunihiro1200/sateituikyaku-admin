// 買主リストのCRUDサービス
import { createClient } from '@supabase/supabase-js';
import { AuditLogService } from './AuditLogService';
import { BuyerWriteService } from './BuyerWriteService';
import { ConflictResolver, ConflictInfo } from './ConflictResolver';
import { RetryHandler } from './RetryHandler';
import { BuyerColumnMapper } from './BuyerColumnMapper';
import { GoogleSheetsClient } from './GoogleSheetsClient';
import { calculateBuyerStatus } from './BuyerStatusCalculator';

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
    } = options;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('buyers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null); // 論理削除済みを除外

    // 検索
    if (search) {
      query = query.or(
        `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,property_number.ilike.%${search}%`
      );
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

    return {
      data: data || [],
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
    const { data, error } = await this.supabase
      .from('buyers')
      .select('*')
      .eq('id', id)
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
    console.log(`[BuyerService.getByBuyerNumber] buyerNumber=${buyerNumber}`);
    let query = this.supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', buyerNumber);

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

    console.log(`[BuyerService.getByBuyerNumber] found buyer id=${data?.id}`);
    return data;
  }


  /**
   * 検索
   */
  async search(query: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('buyers')
      .select('id, buyer_number, name, phone_number, email, property_number, latest_status, initial_assignee')
      .or(
        `buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`
      )
      .limit(limit);

    if (error) {
      throw new Error(`Failed to search buyers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 買主に紐づく物件リストを取得
   */
  async getLinkedProperties(buyerId: string): Promise<any[]> {
    // まず買主を取得
    const buyer = await this.getById(buyerId);
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
      db_created_at: new Date().toISOString(),
      db_updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('buyers')
      .insert(newBuyer)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create buyer: ${error.message}`);
    }

    return data;
  }

  /**
   * 買主番号を自動生成（最新の番号+1）
   */
  private async generateBuyerNumber(): Promise<string> {
    // 最新の買主番号を取得
    const { data, error } = await this.supabase
      .from('buyers')
      .select('buyer_number')
      .order('buyer_number', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to generate buyer number: ${error.message}`);
    }

    if (!data || data.length === 0) {
      // 最初の買主番号
      return '1';
    }

    // 最新の番号を取得して+1
    const latestNumber = parseInt(data[0].buyer_number, 10);
    if (isNaN(latestNumber)) {
      throw new Error('Invalid buyer number format');
    }

    return String(latestNumber + 1);
  }

  /**
   * 買主情報を更新
   */
  async update(id: string, updateData: Partial<any>, userId?: string, userEmail?: string): Promise<any> {
    // 存在確認
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Buyer not found');
    }

    // 更新不可フィールドを除外
    const protectedFields = ['id', 'db_created_at', 'synced_at'];
    const allowedData: any = {};
    
    for (const key in updateData) {
      if (!protectedFields.includes(key)) {
        allowedData[key] = updateData[key];
      }
    }

    // 更新タイムスタンプを追加
    allowedData.db_updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update buyer: ${error.message}`);
    }

    // Log audit trail for each changed field
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
              userEmail
            );
          } catch (auditError) {
            // Log error but don't fail the update
            console.error('Failed to create audit log:', auditError);
          }
        }
      }
    }

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

    // 存在確認
    const existing = await this.getById(id);
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

    // 更新タイムスタンプを追加
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

    // DB更新
    const { data, error } = await this.supabase
      .from('buyers')
      .update(allowedData)
      .eq('id', id)
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
            .eq('id', id);

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
   * エリア・種別・価格で買主をフィルタリングして返す（近隣買主機能用）
   */
  async getBuyersByAreas(
    areas: string[],
    propertyType: string | null,
    salesPrice: number | null
  ): Promise<any[]> {
    // 全買主を取得
    const { data: buyers, error } = await this.supabase
      .from('buyers')
      .select(`
        buyer_number,
        name,
        desired_area,
        desired_property_type,
        distribution_type,
        broker_inquiry,
        inquiry_source,
        latest_status,
        latest_viewing_date,
        reception_date,
        inquiry_hearing,
        viewing_result_follow_up,
        email,
        phone_number,
        property_address,
        property_type,
        price_range_house,
        price_range_apartment,
        price_range_land
      `)
      .order('reception_date', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    const allBuyers = buyers || [];

    // エリア番号を抽出（丸数字）
    const extractAreaNumbers = (areaString: string): string[] => {
      return areaString.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]/g) || [];
    };

    // 種別を正規化
    const normalizePropertyType = (type: string): string => {
      return type.trim()
        .replace(/中古/g, '')
        .replace(/新築/g, '')
        .replace(/一戸建て/g, '戸建')
        .replace(/一戸建/g, '戸建')
        .replace(/戸建て/g, '戸建')
        .replace(/分譲/g, '')
        .trim();
    };

    // 価格帯チェック
    const matchesPriceRange = (priceRange: string, price: number): boolean => {
      const cleaned = priceRange
        .replace(/,/g, '')
        .replace(/円/g, '')
        .replace(/万/g, '0000')
        .replace(/億/g, '00000000')
        .trim();

      const rangeMatch = cleaned.match(/(\d+)?\s*[〜～\-]\s*(\d+)?/);
      if (rangeMatch) {
        const min = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
        const max = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : Number.MAX_SAFE_INTEGER;
        return price >= min && price <= max;
      }
      const aboveMatch = cleaned.match(/(\d+)\s*以上/);
      if (aboveMatch) return price >= parseInt(aboveMatch[1], 10);
      const belowMatch = cleaned.match(/(\d+)\s*以下/);
      if (belowMatch) return price <= parseInt(belowMatch[1], 10);
      return true;
    };

    const propertyAreaNumbers = extractAreaNumbers(areas.join(''));

    const filtered = allBuyers.filter(buyer => {
      // 業者問合せ除外
      const inquirySource = (buyer.inquiry_source || '').trim();
      const distributionType = (buyer.distribution_type || '').trim();
      const brokerInquiry = (buyer.broker_inquiry || '').trim();
      if (
        inquirySource.includes('業者') ||
        distributionType.includes('業者') ||
        (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false')
      ) return false;

      // 配信種別「要」チェック
      if (distributionType !== '要') return false;

      // 最新状況チェック（買付・D・E除外）
      const latestStatus = (buyer.latest_status || '').trim();
      if (latestStatus.includes('買付') || latestStatus.includes('D') || latestStatus.includes('E')) return false;

      // エリアチェック
      const desiredArea = (buyer.desired_area || '').trim();
      if (desiredArea) {
        const buyerAreaNumbers = extractAreaNumbers(desiredArea);
        if (!propertyAreaNumbers.some(a => buyerAreaNumbers.includes(a))) return false;
      }

      // 種別チェック
      const desiredType = (buyer.desired_property_type || '').trim();
      if (desiredType && desiredType !== '指定なし' && propertyType) {
        const normalizedPropType = normalizePropertyType(propertyType);
        const normalizedDesiredTypes = desiredType.split(/[,、\s]+/).map(normalizePropertyType);
        if (!normalizedDesiredTypes.some(dt =>
          dt === normalizedPropType ||
          normalizedPropType.includes(dt) ||
          dt.includes(normalizedPropType)
        )) return false;
      }

      // 価格チェック
      if (salesPrice && propertyType) {
        const normalizedType = normalizePropertyType(propertyType);
        let priceRange: string | null = null;
        if (normalizedType.includes('戸建')) priceRange = buyer.price_range_house;
        else if (normalizedType.includes('マンション')) priceRange = buyer.price_range_apartment;
        else if (normalizedType.includes('土地')) priceRange = buyer.price_range_land;

        if (priceRange && priceRange.trim()) {
          if (!matchesPriceRange(priceRange, salesPrice)) return false;
        }
      }

      return true;
    });

    // NearbyBuyersList の NearbyBuyer インターフェースに合わせて整形
    return filtered.map(buyer => ({
      buyer_number: buyer.buyer_number,
      name: buyer.name,
      distribution_areas: buyer.desired_area
        ? (buyer.desired_area.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶][^①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]*/g) || [])
        : [],
      latest_status: buyer.latest_status,
      latest_viewing_date: buyer.latest_viewing_date,
      reception_date: buyer.reception_date,
      inquiry_hearing: buyer.inquiry_hearing,
      viewing_result_follow_up: buyer.viewing_result_follow_up,
      email: buyer.email,
      phone_number: buyer.phone_number,
      property_address: buyer.property_address,
      inquiry_property_type: buyer.property_type,
      inquiry_price: null,
    }));
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
    // Get the buyer
    const buyer = await this.getById(buyerId);
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

    // Get past buyer numbers and their property numbers
    const pastBuyerNumbers = this.parsePastBuyerList(buyer.past_buyer_list);
    
    for (const pastBuyerNumber of pastBuyerNumbers) {
      // Fetch past buyer data
      const { data: pastBuyer, error: pastBuyerError } = await this.supabase
        .from('buyers')
        .select('buyer_number, property_number, reception_date')
        .eq('buyer_number', pastBuyerNumber)
        .single();

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
   * ステータス付きで買主リストを取得
   */
  async getBuyersWithStatus(options: BuyerQueryOptions = {}): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('buyers')
      .select('*')
      .is('deleted_at', null)
      .order('reception_date', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to fetch buyers with status: ${error.message}`);
    }

    const buyers = data || [];
    return buyers.map(buyer => {
      const result = calculateBuyerStatus(buyer);
      return {
        ...buyer,
        calculated_status: result.status,
        status_color: result.color,
        status_priority: result.priority,
      };
    });
  }

  /**
   * サイドバー用ステータスカテゴリ一覧を取得
   */
  async getStatusCategories(): Promise<Array<{
    status: string;
    count: number;
    color: string;
    priority: number;
  }>> {
    const buyers = await this.getBuyersWithStatus();

    const categoryMap = new Map<string, { count: number; color: string; priority: number }>();

    for (const buyer of buyers) {
      const status = buyer.calculated_status || '';
      const existing = categoryMap.get(status);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(status, {
          count: 1,
          color: buyer.status_color || '#cccccc',
          priority: buyer.status_priority || 0,
        });
      }
    }

    const categories = Array.from(categoryMap.entries()).map(([status, info]) => ({
      status,
      count: info.count,
      color: info.color,
      priority: info.priority,
    }));

    // 優先度順にソート（優先度が高い＝数値が小さい順）
    categories.sort((a, b) => {
      if (a.priority === 0 && b.priority !== 0) return 1;
      if (b.priority === 0 && a.priority !== 0) return -1;
      return a.priority - b.priority;
    });

    return categories;
  }

  /**
   * ステータスでフィルタリングして買主を取得
   */
  async getBuyersByStatus(status: string, options: BuyerQueryOptions = {}): Promise<any[]> {
    const buyers = await this.getBuyersWithStatus(options);
    return buyers.filter(b => b.calculated_status === status);
  }

  /**
   * 買主を論理削除
   */
  async softDelete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Buyer not found');
    }

    const { error } = await this.supabase
      .from('buyers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete buyer: ${error.message}`);
    }
  }

  /**
   * 論理削除した買主を復元
   */
  async restore(id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('buyers')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to restore buyer: ${error.message}`);
    }

    return data;
  }
}
