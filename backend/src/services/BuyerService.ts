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
import NodeCache from 'node-cache';

// モジュールレベルのキャッシュ（Vercelサーバーレス環境でもインスタンス間で共有される）
// インスタンス変数だとリクエストごとにリセットされるため、モジュールレベルに移動
let _moduleLevelStatusCache: {
  buyers: any[];
  computedAt: number;
} | null = null;
const _MODULE_STATUS_CACHE_TTL = 30 * 60 * 1000; // 30分

// 他社物件新着配信用のキャッシュ（TTL: 10分）
const distributionCache = new NodeCache({ stdTTL: 600 });

// 買付率統計用のキャッシュ（TTL: 30分）
const purchaseRateStatisticsCache = new NodeCache({ stdTTL: 1800 });

/**
 * 業者問合せ買主かどうかを判定する
 * broker_inquiry が null、undefined、空文字列、'0' の場合は通常買主（除外しない）
 * それ以外の値が入っている場合は業者問合せ買主（除外する）
 */
export function isVendorBuyer(brokerInquiry: string | null | undefined): boolean {
  if (brokerInquiry === null || brokerInquiry === undefined) return false;
  if (brokerInquiry === '') return false;
  if (brokerInquiry === '0') return false;
  return true;
}

/**
 * 買主ステータスキャッシュを無効化（外部から呼び出し可能）
 * 買主データ更新時に呼び出してキャッシュをクリアする
 * 
 * 🆕 買付率統計のキャッシュも無効化
 * ⚠️ buyer_sidebar_counts テーブルは削除しない（パフォーマンス保護）
 */
export async function invalidateBuyerStatusCache(): Promise<void> {
  _moduleLevelStatusCache = null;
  console.log('[BuyerService] Buyer status cache invalidated');
  
  // 買付率統計のキャッシュを無効化
  purchaseRateStatisticsCache.flushAll();
  console.log('[BuyerService] Purchase rate statistics cache invalidated');
  
  // buyer_sidebar_counts テーブルは削除しない
  // 理由: SidebarCountsUpdateService が差分更新でテーブルを管理しており、
  //       テーブルを全削除すると次回 getSidebarCounts() 呼び出し時に
  //       フォールバック計算（約20秒）が実行されてパフォーマンスが著しく低下するため。
  //       テーブルの更新は Cron ジョブ（/api/buyers/update-sidebar-counts）が担当する。
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
  viewingMonth?: string; // YYYY-MM形式（内覧月フィルタ）
  followUpAssignee?: string; // 後続担当者フィルタ（完全一致）
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
      viewingMonth,
      followUpAssignee,
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
        // property_listings から住所一致の property_number を取得して OR 条件に追加
        const { data: matchingProperties } = await this.supabase
          .from('property_listings')
          .select('property_number')
          .ilike('address', `%${search}%`);

        const matchingPropertyNumbers = (matchingProperties || [])
          .map((p: any) => p.property_number)
          .filter(Boolean) as string[];

        if (matchingPropertyNumbers.length > 0) {
          query = query.or(
            `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%,property_number.in.(${matchingPropertyNumbers.join(',')})`
          );
        } else {
          query = query.or(
            `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%`
          );
        }
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
    // 内覧月フィルタ（YYYY-MM形式）
    if (viewingMonth) {
      const startDate = `${viewingMonth}-01`;
      const [year, month] = viewingMonth.split('-').map(Number);
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 月末日
      query = query.gte('viewing_date', startDate).lte('viewing_date', endDate);
    }
    // 後続担当者フィルタ（完全一致）
    if (followUpAssignee) {
      query = query.or(`follow_up_assignee.eq.${followUpAssignee},and(follow_up_assignee.is.null,initial_assignee.eq.${followUpAssignee})`);
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
          } else if (dynamicCategory.startsWith('nextCallDateBlank:')) {
            // 次電日空欄(イニシャル): follow_up_assignee = イニシャル AND latest_status IN (A, B) AND next_call_date IS NULL AND broker_inquiry IS NULL OR 空文字
            const assigneeInitial = dynamicCategory.replace('nextCallDateBlank:', '');
            const STATUS_A_QUERY = 'A:この物件を気に入っている（こちらからの一押しが必要）';
            const STATUS_B_QUERY = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
            query = query
              .eq('follow_up_assignee', assigneeInitial)
              .in('latest_status', [STATUS_A_QUERY, STATUS_B_QUERY])
              .is('next_call_date', null)
              .or('broker_inquiry.is.null,broker_inquiry.eq.');
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
    
    // BY_プレフィックス形式（例: BY_MN28sl8yi5yLNI）はそのまま文字列で検索
    // 数値形式の場合はintに変換して検索
    const isByPrefix = /^BY_[A-Za-z0-9_]+$/.test(buyerNumber);
    const searchValue = isByPrefix ? buyerNumber : parseInt(buyerNumber, 10);
    console.log(`[BuyerService.getByBuyerNumber] searchValue=${searchValue} (isByPrefix=${isByPrefix})`);
    
    let query = this.supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', searchValue);

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
          .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`)
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
          `buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`
        )
        .limit(limit);

      if (error) {
        throw new Error(`Failed to search buyers: ${error.message}`);
      }

      return data || [];
    }
  }

  /**
   * 同じメールアドレスの買主の pinrich_500man_registration を一括更新
   */
  async bulkUpdatePinrich500man(email: string, value: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('buyers')
      .update({ pinrich_500man_registration: value })
      .eq('email', email)
      .is('deleted_at', null)
      .select('buyer_number');

    if (error) {
      throw new Error(`Failed to bulk update pinrich_500man_registration: ${error.message}`);
    }

    return data?.length || 0;
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
      .eq('property_number', propertyNumber);

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

    const finalNewBuyer = this.applySecondInquiryRule(newBuyer);

    const { data, error } = await this.supabase
      .from('buyers')
      .insert(finalNewBuyer)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create buyer: ${error.message}`);
    }

    // property_numberがある場合、Google Maps URLから座標を非同期で設定
    if (data?.property_number) {
      this.fetchCoordinatesFromPropertyNumber(data.property_number).then(async (coords) => {
        if (coords) {
          await this.supabase
            .from('buyers')
            .update({ desired_area_lat: coords.lat, desired_area_lng: coords.lng })
            .eq('buyer_number', data.buyer_number);
          console.log(`[BuyerService] Set coordinates for buyer ${data.buyer_number}: (${coords.lat}, ${coords.lng})`);
        }
      }).catch(err => {
        console.warn(`[BuyerService] Failed to set coordinates for buyer ${data.buyer_number}: ${err.message}`);
      });
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
      await this.initSyncServices();      if (this.writeService) {
        // property_numberがある場合、property_listingsから物件情報を取得してスプシに反映
        let appendData = { ...data };
        if (appendData.property_number) {
          try {
            const { data: propertyListing, error: propertyError } = await this.supabase
              .from('property_listings')
              .select('address, display_address, price, sales_assignee, pre_viewing_notes, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking')
              .eq('property_number', appendData.property_number)
              .maybeSingle();

            if (!propertyError && propertyListing) {
              appendData.property_address = propertyListing.address ?? null;
              appendData.display_address = propertyListing.display_address ?? null;
              appendData.price = propertyListing.price ?? null;
              appendData.property_assignee = propertyListing.sales_assignee ?? null;
              appendData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null;
              appendData.sale_reason = propertyListing.sale_reason ?? null;
              appendData.price_reduction_history = propertyListing.price_reduction_history ?? null;
              appendData.viewing_notes = propertyListing.viewing_notes ?? null;
              appendData.parking = propertyListing.parking ?? null;
              appendData.viewing_parking = propertyListing.viewing_parking ?? null;
              console.log(`[BuyerService] Fetched property info for ${appendData.property_number}: address=${appendData.property_address}`);
            }
          } catch (propErr: any) {
            console.warn(`[BuyerService] Failed to fetch property info for ${appendData.property_number}: ${propErr.message}`);
          }
        }

        const appendResult = await this.writeService.appendNewBuyer(appendData);
        if (!appendResult.success) {
          console.warn(`[BuyerService] Failed to append new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendResult.error}`);
        } else {
          console.log(`[BuyerService] Successfully appended buyer ${buyerNumber} to spreadsheet`);
        }
      }
    } catch (appendError: any) {
      console.warn(`[BuyerService] Error appending new buyer to spreadsheet (buyer_number=${buyerNumber}): ${appendError.message}`);
    }

    // DB保存成功後、サイドバーカウントを即時更新（ノンブロッキング）
    try {
      const { SidebarCountsUpdateService } = await import('./SidebarCountsUpdateService');
      const sidebarService = new SidebarCountsUpdateService(this.supabase);
      sidebarService.updateBuyerSidebarCounts(buyerNumber, null).catch(err => {
        console.warn(`[BuyerService] Failed to update sidebar counts after create (buyer_number=${buyerNumber}): ${err.message}`);
      });
    } catch (sidebarError: any) {
      console.warn(`[BuyerService] Error importing SidebarCountsUpdateService after create (buyer_number=${buyerNumber}): ${sidebarError.message}`);
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
    const sidebarFields = ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender', 'inquiry_email_phone', 'pinrich', 'inquiry_source', 'latest_status', 'broker_inquiry', 'pinrich_500man_registration', 'viewing_survey_result', 'viewing_survey_confirmed', 'vendor_survey', 'viewing_type_general', 'post_viewing_seller_contact', 'atbb_status', 'viewing_promotion_not_needed', 'viewing_promotion_sender', 'inquiry_confidence', 'inquiry_email_reply', 'three_call_unchecked', 'seller_viewing_date_contact'];
    return sidebarFields.some(field => field in updateData);
  }

  /**
   * property_numberからGoogle Maps URLを取得し、座標を返す
   * 取得できない場合はnullを返す（ノンブロッキング用）
   */
  private async fetchCoordinatesFromPropertyNumber(propertyNumber: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const firstPropertyNumber = propertyNumber.split(',')[0].trim();
      const { data: property, error } = await this.supabase
        .from('property_listings')
        .select('google_map_url')
        .eq('property_number', firstPropertyNumber)
        .maybeSingle();

      if (error || !property?.google_map_url) return null;

      const { GeolocationService } = await import('./GeolocationService');
      const geoService = new GeolocationService();
      return await geoService.extractCoordinatesFromUrl(property.google_map_url);
    } catch {
      return null;
    }
  }

  /**
   * If inquiry_source is '2件目以降', force pinrich to '登録不要（不可）'
   */
  private applySecondInquiryRule(data: Record<string, any>): Record<string, any> {
    if (data.inquiry_source === '2件目以降') {
      return { ...data, pinrich: '登録不要（不可）' };
    }
    return data;
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

    // latest_status が更新される場合、latest_status_updated_at を記録
    if (allowedData.latest_status !== undefined) {
      allowedData.latest_status_updated_at = new Date().toISOString();
    }

    // Apply second inquiry rule: force pinrich to '登録不要（不可）' if inquiry_source is '2件目以降'
    const finalAllowedData = this.applySecondInquiryRule(allowedData);

    // BY_プレフィックス形式はそのまま文字列で、数値形式はintに変換
    const isByPrefixUpdate = /^BY_[A-Za-z0-9_]+$/.test(buyerNumber);
    const buyerNumberValue = isByPrefixUpdate ? buyerNumber : parseInt(buyerNumber, 10);
    console.log('[BuyerService.update] buyerNumberValue:', buyerNumberValue);

    const { data, error } = await this.supabase
      .from('buyers')
      .update(finalAllowedData)
      .eq('buyer_number', buyerNumberValue)
      .select()
      .single();

    if (error) {
      console.error('[BuyerService.update] Database update failed:', error);
      throw new Error(`Failed to update buyer: ${error.message}`);
    }

    console.log('[BuyerService.update] Database update successful');

    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log('[BuyerService.update] Buyer status cache invalidated');

    // Log audit trail for each changed field
    if (userId && userEmail) {
      for (const key in finalAllowedData) {
        if (key !== 'db_updated_at' && existing[key] !== finalAllowedData[key]) {
          try {
            await AuditLogService.logFieldUpdate(
              'buyer',
              buyerNumber,
              key,
              existing[key],
              finalAllowedData[key],
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
      shouldUpdate: this.shouldUpdateBuyerSidebarCounts(finalAllowedData),
      allowedData: Object.keys(finalAllowedData),
      buyerNumber
    });
    
    if (this.shouldUpdateBuyerSidebarCounts(finalAllowedData)) {
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

    // property_numberが更新された場合、座標を再設定（非同期）
    const newPropertyNumber = finalAllowedData.property_number ?? existing.property_number;
    if (newPropertyNumber && (finalAllowedData.property_number || !existing.desired_area_lat)) {
      this.fetchCoordinatesFromPropertyNumber(newPropertyNumber).then(async (coords) => {
        if (coords) {
          await this.supabase
            .from('buyers')
            .update({ desired_area_lat: coords.lat, desired_area_lng: coords.lng })
            .eq('buyer_number', buyerNumber);
          console.log(`[BuyerService] Updated coordinates for buyer ${buyerNumber}: (${coords.lat}, ${coords.lng})`);
        }
      }).catch(err => {
        console.warn(`[BuyerService] Failed to update coordinates for buyer ${buyerNumber}: ${err.message}`);
      });
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

    // property_number が含まれ、かつ非null・非空文字の場合、property_listingsから物件情報を取得して同期
    if (allowedData.property_number != null && allowedData.property_number !== '') {
      try {
        const { data: propertyListing, error: propertyError } = await this.supabase
          .from('property_listings')
          .select('address, display_address, price, sales_assignee, pre_viewing_notes, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking')
          .eq('property_number', allowedData.property_number)
          .maybeSingle();

        if (!propertyError && propertyListing) {
          // 取得した物件情報をallowedDataに追加してスプレッドシート同期に乗せる
          allowedData.property_address = propertyListing.address ?? null;
          allowedData.display_address = propertyListing.display_address ?? null;
          allowedData.price = propertyListing.price ?? null;
          allowedData.property_assignee = propertyListing.sales_assignee ?? null;
          allowedData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null;
          allowedData.sale_reason = propertyListing.sale_reason ?? null;
          allowedData.price_reduction_history = propertyListing.price_reduction_history ?? null;
          allowedData.viewing_notes = propertyListing.viewing_notes ?? null;
          allowedData.parking = propertyListing.parking ?? null;
          allowedData.viewing_parking = propertyListing.viewing_parking ?? null;
        }
        // property_listingsに対応物件が存在しない場合はスキップ（property_numberのみ保存）
      } catch (propertyFetchError: any) {
        console.error('Failed to fetch property info from property_listings:', propertyFetchError);
        // エラーが発生しても処理を継続（property_numberのみ保存）
      }
    }

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
    const finalAllowedData = this.applySecondInquiryRule(allowedData);
    const { data, error } = await this.supabase
      .from('buyers')
      .update(finalAllowedData)
      .eq('buyer_number', buyerNumber)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update buyer: ${error.message}`);
    }

    // 監査ログを記録（DB更新直後、同期処理の前）
    if (userId && userEmail) {
      for (const key in finalAllowedData) {
        if (key !== 'db_updated_at' && existing[key] !== finalAllowedData[key]) {
          try {
            await AuditLogService.logFieldUpdate(
              'buyer',
              id,
              key,
              existing[key],
              finalAllowedData[key],
              userId,
              userEmail,
              'pending'
            );
          } catch (auditError) {
            console.error('Failed to create audit log:', auditError);
          }
        }
      }
    }

    // syncResult の初期値
    let syncResult: SyncResult = { success: true, syncStatus: 'pending' };

    // スプレッドシート同期を直接実行（Vercelサーバーレス対応: setImmediateは使わない）
    try {
      // 同期サービスを初期化（認証含む）
      await this.initSyncServices();

      if (this.writeService && this.retryHandler) {
        // リトライ付きで同期を実行
        const retryResult = await this.retryHandler.executeWithRetry(
          async () => {
            const writeResult = await this.writeService!.updateFields(buyerNumber, finalAllowedData);
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
          syncResult = { success: true, syncStatus: 'synced' };
        } else {
          // 同期失敗 - キューに追加
          for (const key of Object.keys(finalAllowedData)) {
            if (key !== 'db_updated_at') {
              await this.retryHandler.queueFailedChange({
                buyer_number: buyerNumber,
                field_name: key,
                old_value: existing[key] ? String(existing[key]) : null,
                new_value: finalAllowedData[key] ? String(finalAllowedData[key]) : null,
                retry_count: retryResult.attempts,
                last_error: retryResult.error || null
              });
            }
          }
          syncResult = { success: false, syncStatus: 'failed', error: retryResult.error };
        }
      }
    } catch (syncError: any) {
      // 同期エラー - キューに追加
      if (this.retryHandler) {
        for (const key of Object.keys(finalAllowedData)) {
          if (key !== 'db_updated_at') {
            await this.retryHandler.queueFailedChange({
              buyer_number: buyerNumber,
              field_name: key,
              old_value: existing[key] ? String(existing[key]) : null,
              new_value: finalAllowedData[key] ? String(finalAllowedData[key]) : null,
              retry_count: 0,
              last_error: syncError.message
            });
          }
        }
      }
      console.error('Spreadsheet sync error:', syncError);
      syncResult = { success: false, syncStatus: 'failed', error: syncError.message };
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
    propertyPrice: number | null;
    buildingNamePrice: string;
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
        .select('buyer_number, property_number, reception_date, past_buyer_list, email, phone_number, building_name_price')
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

    // property_numberなしの関連買主も行として追加するためのリスト（自分自身も含む）
    const noPropertyRelatedBuyers: Array<{ buyerNumber: string; inquiryDate: string; buildingNamePrice: string; status: 'current' | 'past' }> = [];

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
    } else {
      // 自分自身もproperty_numberがない場合は行として追加
      noPropertyRelatedBuyers.push({
        buyerNumber: buyer.buyer_number,
        inquiryDate: buyer.reception_date || '',
        buildingNamePrice: buyer.building_name_price || '',
        status: 'current'
      });
    }

    // 同じメールアドレス・電話番号を持つ関連買主の物件番号も統合
    const relatedConditions: string[] = [];
    if (buyer.email) relatedConditions.push(`email.eq.${buyer.email}`);
    if (buyer.phone_number) relatedConditions.push(`phone_number.eq.${buyer.phone_number}`);

    if (relatedConditions.length > 0) {
      const currentBuyerNumber = buyer.buyer_number;
      const { data: relatedBuyers } = await this.supabase
        .from('buyers')
        .select('buyer_number, property_number, reception_date, building_name_price')
        .or(relatedConditions.join(','))
        .is('deleted_at', null)
        .neq('buyer_number', currentBuyerNumber);
      if (relatedBuyers) {
        for (const rb of relatedBuyers) {
          if (rb.property_number) {
            const relatedPropertyNumbers = rb.property_number
              .split(',')
              .map((n: string) => n.trim())
              .filter((n: string) => n);
            relatedPropertyNumbers.forEach((propNum: string) => {
              if (!propertyToBuyerMap.has(propNum)) {
                allPropertyNumbers.push(propNum);
                propertyToBuyerMap.set(propNum, {
                  buyerNumber: rb.buyer_number,
                  status: 'past',
                  inquiryDate: rb.reception_date || ''
                });
              }
            });
          } else {
            // property_numberがない関連買主も履歴行として追加
            noPropertyRelatedBuyers.push({
              buyerNumber: rb.buyer_number,
              inquiryDate: rb.reception_date || '',
              buildingNamePrice: rb.building_name_price || '',
              status: 'past'
            });
          }
        }
      }
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

    // property_numberなしの関連買主のみの場合も対応
    if (uniquePropertyNumbers.length === 0) {
      const historyNoProperty = noPropertyRelatedBuyers.map(rb => ({
        buyerNumber: rb.buyerNumber,
        propertyNumber: '',
        propertyAddress: '',
        propertyPrice: null as number | null,
        buildingNamePrice: rb.buildingNamePrice,
        inquiryDate: rb.inquiryDate,
        status: rb.status,
        propertyId: '',
        propertyListingId: '',
      }));
      historyNoProperty.sort((a, b) => {
        if (!a.inquiryDate) return 1;
        if (!b.inquiryDate) return -1;
        return new Date(b.inquiryDate).getTime() - new Date(a.inquiryDate).getTime();
      });
      return historyNoProperty;
    }

    // Fetch property listings for all property numbers
    const { data: properties, error } = await this.supabase
      .from('property_listings')
      .select(`
        id,
        property_number,
        address,
        price
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
        propertyPrice: property.price ?? null,
        buildingNamePrice: '',
        inquiryDate: buyerInfo?.inquiryDate || '',
        status: buyerInfo?.status || 'current',
        propertyId: property.id,
        propertyListingId: property.id,
      };
    });

    // property_numberなしの関連買主を行として追加
    for (const rb of noPropertyRelatedBuyers) {
      history.push({
        buyerNumber: rb.buyerNumber,
        propertyNumber: '',
        propertyAddress: '',
        propertyPrice: null,
        buildingNamePrice: rb.buildingNamePrice,
        inquiryDate: rb.inquiryDate,
        status: rb.status,
        propertyId: '',
        propertyListingId: '',
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
        viewing_result_follow_up,
        corporate_name
      `)
      .eq('distribution_type', '要')
      .is('deleted_at', null)
      .or('latest_status.is.null,latest_status.not.ilike.*成約*')
      .or('latest_status.is.null,latest_status.not.ilike.*D*');

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
      desired_type: buyer.desired_property_type ?? null,
      corporate_name: buyer.corporate_name ?? null,
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
      // 業者（両手）も含め、全ての買主に物件種別・価格フィルターを適用する
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
    if (!this.hasDistributionRequired(buyer)) return true;
    // 業者（両手）の買主はdesired_area/desired_property_typeが空でも表示する
    const brokerInquiry = (buyer.broker_inquiry || '').trim();
    if (brokerInquiry !== '業者（両手）' && !this.hasMinimumCriteria(buyer)) return true;
    return false;
  }

  private isBusinessInquiry(buyer: any): boolean {
    const inquirySource = (buyer.inquiry_source || '').trim();
    const distributionType = (buyer.distribution_type || '').trim();
    const brokerInquiry = (buyer.broker_inquiry || '').trim();
    // '業者（両手）' は近隣買主リストに含める（業者フィルターボタンで絞り込み可能）
    // inquiry_sourceやdistribution_typeより先に判定する
    if (brokerInquiry === '業者（両手）') return false;
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

  // 大分市エリア番号一覧（㊵大分市全域の判定に使用）
  private readonly OITA_AREA_NUMBERS = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464', '\u2465', '\u2466', '\u2467'];
  // ①=U+2460, ②=U+2461, ③=U+2462, ④=U+2463, ⑤=U+2464, ⑥=U+2465, ⑦=U+2466, ⑧=U+2467

  private matchesAreaCriteria(buyer: any, propertyAreaNumbers: string[]): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    if (!desiredArea) return true;
    if (propertyAreaNumbers.length === 0) return false;
    const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);

    // ㊵（U+32B5）= 大分市全域: 物件が大分市エリア（①〜⑧）のいずれかであれば該当
    const OITA_ALL = '\u32B5'; // ㊵
    if (buyerAreaNumbers.includes(OITA_ALL)) {
      const isOitaProperty = propertyAreaNumbers.some(a => this.OITA_AREA_NUMBERS.includes(a));
      if (isOitaProperty) return true;
    }

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
      'day_of_week', 'pinrich', 'pinrich_500man_registration', 'email_confirmed', 'email_confirmation_assignee',
      'viewing_promotion_not_needed', 'viewing_promotion_sender',
      'past_buyer_list', 'price', 'property_number',
      'desired_area', 'desired_property_type', 'budget',
      'viewing_survey_result', 'viewing_survey_confirmed',
      'seller_viewing_date_contact',
    ].join(', ');

    // count クエリ・最初のバッチ・property_listings を全て並列実行
    const [countResult, firstBatchResult, listingsCountResult] = await Promise.all([
      this.supabase
        .from('buyers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      this.supabase
        .from('buyers')
        .select(BUYER_COLUMNS)
        .is('deleted_at', null)
        .range(0, PAGE_SIZE - 1),
      // property_listings の件数を取得（ページネーション用）
      this.supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true }),
    ]);

    const { count, error: countError } = countResult;
    if (countError) throw new Error(`Failed to count buyers: ${countError.message}`);
    if (firstBatchResult.error) throw new Error(`Failed to fetch buyers: ${firstBatchResult.error.message}`);

    const totalCount = count || 0;
    if (totalCount === 0) return [];

    const allBuyers: any[] = [...(firstBatchResult.data || [])];

    // property_listings を全件取得（1000件超え対応のページネーション）
    const listingsTotalCount = listingsCountResult.count || 0;
    const listingsBatchCount = Math.ceil(listingsTotalCount / PAGE_SIZE);
    const listingsBatchRanges: Array<[number, number]> = [];
    for (let i = 0; i < listingsBatchCount; i++) {
      listingsBatchRanges.push([i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1]);
    }
    const listingsBatchResults = await Promise.all(
      listingsBatchRanges.map(([from, to]) =>
        this.supabase
          .from('property_listings')
          .select('property_number, atbb_status, address, sales_assignee, property_type, price')
          .range(from, to)
      )
    );
    const allListingsData: any[] = [];
    for (const { data } of listingsBatchResults) {
      if (data) allListingsData.push(...data);
    }
    console.log(`🔍 [DEBUG] fetchAllBuyers - property_listings取得件数: ${allListingsData.length}`);

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

    // property_listings のマップを構築（ページネーション取得済み）
    const propertyMap: Record<string, { atbb_status: string; property_address: string | null; sales_assignee: string | null; property_type: string | null; price: number | null }> = {};
    for (const listing of allListingsData) {
      if (listing.property_number) {
        propertyMap[listing.property_number] = {
          atbb_status: listing.atbb_status || '',
          property_address: listing.address ?? null,
          sales_assignee: listing.sales_assignee ?? null,
          property_type: listing.property_type ?? null,
          price: listing.price ?? null,
        };
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
        inquiry_property_price: prop?.price ?? null,
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
        // 🚨 デバッグ: 買主7176・7340・7342のデータを記録
        if (['7176', '7340', '7342'].includes(buyer.buyer_number)) {
          console.log(`🔍 [DEBUG] Buyer ${buyer.buyer_number} data before calculateBuyerStatus:`, JSON.stringify({
            buyer_number: buyer.buyer_number,
            next_call_date: buyer.next_call_date,
            follow_up_assignee: buyer.follow_up_assignee,
            inquiry_email_phone: buyer.inquiry_email_phone,
            inquiry_email_reply: buyer.inquiry_email_reply,
            viewing_date: buyer.viewing_date,
            latest_viewing_date: buyer.latest_viewing_date,
            broker_inquiry: buyer.broker_inquiry,
            notification_sender: buyer.notification_sender,
            three_calls_confirmed: buyer.three_calls_confirmed,
            valuation_survey: buyer.valuation_survey,
            broker_survey: buyer.broker_survey,
          }, null, 2));
        }
        
        const statusResult = calculateBuyerStatus(buyer);
        
        // 🚨 デバッグ: 買主7176・7340・7342のステータス計算結果を記録
        if (['7176', '7340', '7342'].includes(buyer.buyer_number)) {
          console.log(`🔍 [DEBUG] Buyer ${buyer.buyer_number} statusResult:`, JSON.stringify(statusResult, null, 2));
        }
        
        return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority, status_matched_condition: statusResult.matchedCondition };
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
    const startTime = Date.now();  // 処理開始時刻（Requirements 5.1）
    
    try {
      // まずbuyer_sidebar_countsテーブルから取得を試みる（高速）
      console.log('🔍 [BuyerService] getSidebarCounts called - trying buyer_sidebar_counts table first');
      
      const { data, error } = await this.supabase
        .from('buyer_sidebar_counts')
        .select('*');
      
      // テーブルにデータがある場合は高速パスを使用
      if (!error && data && data.length > 0) {
        const duration = Date.now() - startTime;
        console.log(`[INFO] getSidebarCounts from table completed in ${duration}ms`);
        
        // カウントを集計
        const categoryCounts: any = {
          all: 0,
          viewingDayBefore: 0,
          todayCall: 0,
          threeCallUnchecked: 0,
          assignedCounts: {} as Record<string, number>,
          todayCallAssignedCounts: {} as Record<string, number>,
          inquiryEmailUnanswered: 0,
          brokerInquiry: 0,
          generalViewingSellerContactPending: 0,
          viewingPromotionRequired: 0,
          pinrichUnregistered: 0,
          pinrich500manUnregistered: 0,
          nextCallDateBlankCounts: {} as Record<string, number>,
          viewingSurveyUnchecked: 0,  // 内覧アンケート未確認
          viewingUnconfirmed: 0,  // 内覧未確定
          sellerViewingContactPending: 0,  // 売主内覧連絡未
        };
        
        for (const row of data) {
          if (row.category === 'viewingDayBefore') {
            categoryCounts.viewingDayBefore = row.count || 0;
          } else if (row.category === 'todayCall') {
            categoryCounts.todayCall = row.count || 0;
          } else if (row.category === 'threeCallUnchecked') {
            categoryCounts.threeCallUnchecked = row.count || 0;
          } else if (row.category === 'assigned' && row.assignee) {
            categoryCounts.assignedCounts[row.assignee] = row.count || 0;
          } else if (row.category === 'todayCallAssigned' && row.assignee) {
            categoryCounts.todayCallAssignedCounts[row.assignee] = row.count || 0;
          } else if (row.category === 'inquiryEmailUnanswered') {
            categoryCounts.inquiryEmailUnanswered = row.count || 0;
          } else if (row.category === 'brokerInquiry') {
            categoryCounts.brokerInquiry = row.count || 0;
          } else if (row.category === 'generalViewingSellerContactPending') {
            categoryCounts.generalViewingSellerContactPending = row.count || 0;
          } else if (row.category === 'viewingPromotionRequired') {
            categoryCounts.viewingPromotionRequired = row.count || 0;
          } else if (row.category === 'pinrichUnregistered') {
            categoryCounts.pinrichUnregistered = row.count || 0;
          } else if (row.category === 'pinrich500manUnregistered') {
            categoryCounts.pinrich500manUnregistered = row.count || 0;
          } else if (row.category === 'nextCallDateBlank' && row.assignee) {
            categoryCounts.nextCallDateBlankCounts[row.assignee] = row.count || 0;
          } else if (row.category === 'viewingSurveyUnchecked') {
            categoryCounts.viewingSurveyUnchecked = row.count || 0;
          } else if (row.category === 'viewingUnconfirmed') {
            categoryCounts.viewingUnconfirmed = row.count || 0;
          } else if (row.category === 'sellerViewingContactPending') {
            categoryCounts.sellerViewingContactPending = row.count || 0;
          }
        }
        
        // 通常スタッフのイニシャルを取得
        const normalStaffInitials = await this.fetchNormalStaffInitials();
        
        return { categoryCounts, normalStaffInitials };
      }
      
      // テーブルが空または取得失敗の場合は動的計算にフォールバック
      console.log('⚠️ buyer_sidebar_counts empty or error, falling back to dynamic calculation');
      const result = await this.getSidebarCountsFallback();
      
      const duration = Date.now() - startTime;  // 処理時間
      
      // Requirements 5.1: 処理時間をログに記録
      console.log(`[INFO] getSidebarCounts (fallback) completed in ${duration}ms`);
      
      // Requirements 5.2: 5秒超過時の警告ログ
      if (duration > 5000) {
        console.warn(`[WARN] getSidebarCounts took ${duration}ms (> 5000ms)`);
      }
      
      return result;
    } catch (e) {
      const duration = Date.now() - startTime;
      
      // Requirements 5.3: エラー内容とスタックトレースをログに記録
      console.error(`[ERROR] getSidebarCounts error after ${duration}ms:`, e);
      console.error('[ERROR] Stack trace:', (e as Error).stack);
      
      throw e;
    }
  }

  /**
   * サイドバーカウント計算専用：必要最小限のカラムのみ取得（高速化）
   */
  private async fetchBuyersForSidebarCounts(): Promise<any[]> {
    const PAGE_SIZE = 1000;

    // サイドバーカウント計算に必要な最小限のカラムのみ取得（Requirements 4.1）
    const SIDEBAR_COLUMNS = [
      'buyer_number',
      'reception_date',
      'latest_viewing_date',
      'viewing_date',
      'next_call_date',
      'follow_up_assignee',
      'initial_assignee',
      'latest_status',
      'inquiry_confidence',
      'inquiry_email_phone',
      'inquiry_email_reply',
      'three_calls_confirmed',
      'broker_inquiry',
      'inquiry_source',
      'viewing_result_follow_up',
      'viewing_unconfirmed',
      'viewing_type_general',
      'post_viewing_seller_contact',
      'notification_sender',
      'valuation_survey',
      'valuation_survey_confirmed',
      'broker_survey',
      'vendor_survey',
      'day_of_week',
      'pinrich',
      'email',
      'pinrich_500man_registration',
      'email_confirmed',
      'email_confirmation_assignee',
      'viewing_promotion_not_needed',
      'viewing_promotion_sender',
      'past_buyer_list',
      'property_number',
      'viewing_survey_result',
      'viewing_survey_confirmed',
      'seller_viewing_date_contact',
    ].join(', ');

    // count クエリ・最初のバッチ・property_listings件数を並列実行
    const [countResult, firstBatchResult, listingsCountResult2] = await Promise.all([
      this.supabase
        .from('buyers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      this.supabase
        .from('buyers')
        .select(SIDEBAR_COLUMNS)
        .is('deleted_at', null)
        .range(0, PAGE_SIZE - 1),
      // property_listings の件数を取得（ページネーション用）
      this.supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true }),
    ]);

    const { count, error: countError } = countResult;
    if (countError) throw new Error(`Failed to count buyers: ${countError.message}`);
    if (firstBatchResult.error) throw new Error(`Failed to fetch buyers: ${firstBatchResult.error.message}`);

    const totalCount = count || 0;
    if (totalCount === 0) return [];

    const allBuyers: any[] = [...(firstBatchResult.data || [])];

    // property_listings を全件取得（1000件超え対応のページネーション）
    const listingsTotalCount2 = listingsCountResult2.count || 0;
    const listingsBatchCount2 = Math.ceil(listingsTotalCount2 / PAGE_SIZE);
    const listingsBatchRanges2: Array<[number, number]> = [];
    for (let i = 0; i < listingsBatchCount2; i++) {
      listingsBatchRanges2.push([i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1]);
    }
    const listingsBatchResults2 = await Promise.all(
      listingsBatchRanges2.map(([from, to]) =>
        this.supabase
          .from('property_listings')
          .select('property_number, atbb_status, sales_assignee, property_type, price')
          .range(from, to)
      )
    );
    const allListingsData2: any[] = [];
    for (const { data } of listingsBatchResults2) {
      if (data) allListingsData2.push(...data);
    }

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
            .select(SIDEBAR_COLUMNS)
            .is('deleted_at', null)
            .range(from, to)
        )
      );

      for (const { data, error } of batchResults) {
        if (error) throw new Error(`Failed to fetch buyers: ${error.message}`);
        if (data) allBuyers.push(...data);
      }
    }

    // property_listings のマップを構築（ページネーション取得済み）
    const propertyMap: Record<string, { atbb_status: string; sales_assignee: string | null; property_type: string | null; price: number | null }> = {};
    for (const listing of allListingsData2) {
      if (listing.property_number) {
        propertyMap[listing.property_number] = {
          atbb_status: listing.atbb_status || '',
          sales_assignee: listing.sales_assignee ?? null,
          property_type: listing.property_type ?? null,
          price: listing.price ?? null,
        };
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
        property_sales_assignee: prop?.sales_assignee ?? null,
        property_type: prop?.property_type ?? null,
        inquiry_property_price: prop?.price ?? null,
      };
    });
  }

  /**
   * サイドバーカウントを動的に計算（buyersテーブルから）
   * 全買主データを取得してステータスを計算し、カテゴリ別にカウント
   */
  private async getSidebarCountsFallback(): Promise<{
    categoryCounts: any;
    normalStaffInitials: string[];
  }> {
    const startTime = Date.now();  // 処理開始時刻（Requirements 5.1）
    
    try {
      console.log('📊 Calculating sidebar counts dynamically from all buyers');
      
      // Requirements 5.4: 各処理ステップの所要時間を記録
      const fetchStart = Date.now();
      // サイドバーカウント専用の軽量クエリを使用（Requirements 4.1）
      const allBuyersRaw = await this.fetchBuyersForSidebarCounts();
      const fetchDuration = Date.now() - fetchStart;
      console.log(`[INFO] fetchBuyersForSidebarCounts completed in ${fetchDuration}ms`);
      
      // ステータスを計算
      const calcStart = Date.now();
      const allBuyers = allBuyersRaw.map(buyer => {
        try {
          const statusResult = calculateBuyerStatus(buyer);
          return { ...buyer, calculated_status: statusResult.status, status_priority: statusResult.priority };
        } catch (error) {
          console.error(`[BuyerService] Error calculating status for buyer ${buyer.buyer_number}:`, error);
          return { ...buyer, calculated_status: '', status_priority: 999 };
        }
      });
      const calcDuration = Date.now() - calcStart;
      console.log(`[INFO] Status calculation completed in ${calcDuration}ms`);
      
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
        pinrich500manUnregistered: 0,  // Pinrich500万以上登録未
        nextCallDateBlankCounts: {} as Record<string, number>,
        viewingSurveyUnchecked: 0,  // 内覧アンケート未確認
        viewingUnconfirmed: 0,  // 内覧未確定
        sellerViewingContactPending: 0,  // 売主内覧連絡未
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
        // ✅ 修正：calculated_statusを使用してカウント（優先度を考慮）
        
        if (status === '問合メール未対応') {
          result.inquiryEmailUnanswered++;
        } else if (status === '業者問合せあり') {
          result.brokerInquiry++;
        } else if (status === '一般媒介_内覧後売主連絡未') {
          result.generalViewingSellerContactPending++;
        } else if (status === '要内覧促進客') {
          result.viewingPromotionRequired++;
        } else if (status === '内覧未確定') {
          result.viewingUnconfirmed++;
        } else if (status === '売主内覧連絡未') {
          result.sellerViewingContactPending++;
        }
      });
      
      // 次電日空欄(イニシャル)
      const STATUS_A_FALLBACK = 'A:この物件を気に入っている（こちらからの一押しが必要）';
      const STATUS_B_FALLBACK = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
      allBuyers.forEach((buyer: any) => {
        const isStatusAorB = buyer.latest_status === STATUS_A_FALLBACK || buyer.latest_status === STATUS_B_FALLBACK;
        const isBrokerInquiryBlank = !buyer.broker_inquiry || buyer.broker_inquiry === '';
        const isNextCallDateBlank = !buyer.next_call_date;
        const hasFollowUpAssignee = !!buyer.follow_up_assignee && buyer.follow_up_assignee !== '';
        
        if (isStatusAorB && isNextCallDateBlank && isBrokerInquiryBlank && hasFollowUpAssignee) {
          const assignee = buyer.follow_up_assignee;
          result.nextCallDateBlankCounts[assignee] = (result.nextCallDateBlankCounts[assignee] || 0) + 1;
        }
      });
      
      // Pinrich未登録: getBuyersByStatusのフィルタ条件と完全一致させる
      // pinrichが空欄・「登録無し」かつ email存在 かつ broker_inquiry空欄 かつ reception_date >= '2026-01-01'
      // inquiry_source='2件目以降' は除外（登録不要（不可）のため）
      allBuyers.forEach((buyer: any) => {
        const pinrich = buyer.pinrich ?? '';
        const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
        if (
          isPinrichUnregistered &&
          buyer.email && String(buyer.email).trim() &&
          (!buyer.broker_inquiry || buyer.broker_inquiry === '' || buyer.broker_inquiry === '0') &&
          buyer.reception_date && buyer.reception_date >= '2026-01-01' &&
          buyer.inquiry_source !== '2件目以降'
        ) {
          result.pinrichUnregistered++;
        }
      });
      
      // Pinrich500万以上登録未: email非空 AND price<=500万 AND pinrich_500man_registration未 AND reception_date>=2026-01-01
      allBuyers.forEach((buyer: any) => {
        if (
          buyer.email && String(buyer.email).trim() &&
          buyer.inquiry_property_price !== null &&
          buyer.inquiry_property_price !== undefined &&
          Number(buyer.inquiry_property_price) <= 5000000 &&
          (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
          buyer.reception_date && buyer.reception_date >= '2026-01-01'
        ) {
          result.pinrich500manUnregistered++;
        }
      });
      
      // 内覧アンケート未確認: viewing_survey_result が入力済み かつ viewing_survey_confirmed が空欄
      allBuyers.forEach((buyer: any) => {
        const hasSurveyResult = buyer.viewing_survey_result && String(buyer.viewing_survey_result).trim();
        const isConfirmed = buyer.viewing_survey_confirmed && String(buyer.viewing_survey_confirmed).trim();
        if (hasSurveyResult && !isConfirmed) {
          result.viewingSurveyUnchecked++;
        }
      });

      // 通常スタッフのイニシャルを取得
      const normalStaffInitials = await this.fetchNormalStaffInitials();
      
      const duration = Date.now() - startTime;
      
      // Requirements 5.1: 処理時間をログに記録
      console.log(`[INFO] getSidebarCountsFallback completed in ${duration}ms`);
      
      // Requirements 5.2: 5秒超過時の警告ログ
      if (duration > 5000) {
        console.warn(`[WARN] getSidebarCountsFallback took ${duration}ms (> 5000ms)`);
      }
      
      // ✅ 修正: categoryCounts形式で返す（categories配列ではなく）
      return { categoryCounts: result, normalStaffInitials };
    } catch (e) {
      const duration = Date.now() - startTime;
      
      // Requirements 5.3: エラー内容とスタックトレースをログに記録
      console.error(`[ERROR] getSidebarCountsFallback error after ${duration}ms:`, e);
      console.error('[ERROR] Stack trace:', (e as Error).stack);
      
      throw e;
    }
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
      } else if (status === 'pinrich500manUnregistered') {
        // Pinrich500万以上登録未: 4条件でフィルタリング
        // email非空 AND price<=500万 AND pinrich_500man_registration未 AND reception_date>=2026-01-01
        console.log(`[getBuyersByStatus] pinrich500manUnregistered カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          return (
            buyer.email && String(buyer.email).trim() &&
            buyer.inquiry_property_price !== null &&
            buyer.inquiry_property_price !== undefined &&
            Number(buyer.inquiry_property_price) <= 5000000 &&
            (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
            buyer.reception_date && buyer.reception_date >= '2026-01-01'
          );
        });
        console.log(`[getBuyersByStatus] pinrich500manUnregistered フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'pinrichUnregistered' || status === 'ピンリッチ未登録') {
        // Pinrich未登録: pinrichが空欄・「登録無し」かつ reception_date >= '2026-01-01'
        // 英語キー('pinrichUnregistered')と日本語名('ピンリッチ未登録')の両方に対応
        // inquiry_source='2件目以降' は除外（登録不要（不可）のため）
        console.log(`[getBuyersByStatus] pinrichUnregistered カテゴリ検出 (status=${status})`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          const pinrich = buyer.pinrich ?? '';
          const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
          return (
            isPinrichUnregistered &&
            buyer.email && String(buyer.email).trim() &&
            (!buyer.broker_inquiry || buyer.broker_inquiry === '' || buyer.broker_inquiry === '0') &&
            buyer.reception_date && buyer.reception_date >= '2026-01-01' &&
            buyer.inquiry_source !== '2件目以降'
          );
        });
        console.log(`[getBuyersByStatus] pinrichUnregistered フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'viewingSurveyUnchecked') {
        // 内覧アンケート未確認: viewing_survey_result が入力済み かつ viewing_survey_confirmed が空欄
        console.log(`[getBuyersByStatus] viewingSurveyUnchecked カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          const hasSurveyResult = buyer.viewing_survey_result && String(buyer.viewing_survey_result).trim();
          const isSurveyConfirmed = buyer.viewing_survey_confirmed && String(buyer.viewing_survey_confirmed).trim();
          return hasSurveyResult && !isSurveyConfirmed;
        });
        console.log(`[getBuyersByStatus] viewingSurveyUnchecked フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'viewingUnconfirmed') {
        // 内覧未確定: viewing_unconfirmed = '未確定'
        console.log(`[getBuyersByStatus] viewingUnconfirmed カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => buyer.viewing_unconfirmed === '未確定');
        console.log(`[getBuyersByStatus] viewingUnconfirmed フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'sellerViewingContactPending') {
        // 売主内覧連絡未: seller_viewing_date_contact = '未' かつ 内覧日が2026-04-29以降
        console.log(`[getBuyersByStatus] sellerViewingContactPending カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          if (buyer.seller_viewing_date_contact !== '未') return false;
          if (!buyer.viewing_date) return false;
          return buyer.viewing_date >= '2026-04-29';
        });
        console.log(`[getBuyersByStatus] sellerViewingContactPending フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
                 status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired') {
        // 新カテゴリの場合（2026年4月追加）- calculated_statusで直接フィルタリング
        console.log(`[getBuyersByStatus] 新カテゴリ検出: status=${status}`);
        const statusMap: Record<string, string> = {
          'inquiryEmailUnanswered': '問合メール未対応',
          'brokerInquiry': '業者問合せあり',
          'generalViewingSellerContactPending': '一般媒介_内覧後売主連絡未',
          'viewingPromotionRequired': '要内覧促進客',
        };
        const targetStatus = statusMap[status];
        filteredBuyers = allBuyers.filter((buyer: any) => buyer.calculated_status === targetStatus);
        console.log(`[getBuyersByStatus] ${status} フィルタ結果: ${filteredBuyers.length}件`);
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
        
        // 🚨 デバッグ: 当日TELフィルタリング結果を記録
        if (status === '当日TEL') {
          console.log(`[getBuyersByStatus] 当日TELフィルタ結果: ${filteredBuyers.length}件`);
          // 7340・7342のステータスを確認
          const targets = allBuyers.filter(b => ['7340', '7342'].includes(b.buyer_number));
          targets.forEach(b => {
            console.log(`  🔍 買主${b.buyer_number}: calculated_status="${b.calculated_status}", next_call_date=${b.next_call_date}, follow_up_assignee="${b.follow_up_assignee}", matchedCondition="${b.status_matched_condition || ''}"`);
          });
        }
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
    // buyer_idカラムで直接検索（getById()はUUID判定があるため直接検索する）
    const { data: existing, error: fetchError } = await this.supabase
      .from('buyers')
      .select('buyer_id')
      .eq('buyer_id', buyerId)
      .single();

    if (fetchError || !existing) throw new Error('Buyer not found');

    const { error } = await this.supabase
      .from('buyers')
      .update({ deleted_at: new Date().toISOString(), latest_status: '' })
      .eq('buyer_id', buyerId);

    if (error) throw new Error(`Failed to delete buyer: ${error.message}`);
  }

  /**
   * 買主を物理削除（DELETE SQL）
   * Requirements: 3.1, 3.5
   */
  async permanentDelete(buyerIdOrNumber: string): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerIdOrNumber);
    const isNumeric = /^\d+$/.test(buyerIdOrNumber);
    const isByPrefix = /^BY_[A-Za-z0-9_]+$/.test(buyerIdOrNumber);

    // buyer_numberで削除（主キーがTEXTのため、buyer_numberで特定するのが確実）
    let query = this.supabase.from('buyers').delete();

    if (isNumeric || isByPrefix) {
      // 数値形式またはBY_プレフィックス形式はbuyer_numberで削除
      query = query.eq('buyer_number', buyerIdOrNumber);
    } else if (isUuid) {
      query = query.eq('buyer_id', buyerIdOrNumber);
    } else {
      query = query.eq('buyer_id', buyerIdOrNumber);
    }

    const { error } = await query;
    if (error) throw new Error(`Failed to permanently delete buyer: ${error.message}`);
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

  /**
   * buyer_sidebar_countsテーブルを更新（バックエンドから直接実行）
   * GASからの挿入が失敗するため、バックエンドから直接更新する
   * 
   * @returns 更新結果
   */
  async updateSidebarCountsTable(): Promise<{
    success: boolean;
    rowsInserted: number;
    error?: string;
  }> {
    const startTime = Date.now();
    console.log('[BuyerService.updateSidebarCountsTable] ===== START =====');
    
    try {
      // getSidebarCountsFallback()を呼び出して計算
      console.log('[BuyerService.updateSidebarCountsTable] Calling getSidebarCountsFallback()...');
      const { categoryCounts, normalStaffInitials } = await this.getSidebarCountsFallback();
      
      // buyer_sidebar_countsテーブルを全削除
      console.log('[BuyerService.updateSidebarCountsTable] Deleting all rows from buyer_sidebar_counts...');
      const { error: deleteError } = await this.supabase
        .from('buyer_sidebar_counts')
        .delete()
        .neq('category', '___never___'); // 全件削除
      
      if (deleteError) {
        console.error('[BuyerService.updateSidebarCountsTable] Failed to delete:', deleteError);
        return {
          success: false,
          rowsInserted: 0,
          error: `Failed to delete: ${deleteError.message}`
        };
      }
      
      // 挿入するデータを構築
      const rows: Array<{
        category: string;
        count: number;
        label: string | null;
        assignee: string | null;
        updated_at: string;
      }> = [];
      
      const now = new Date().toISOString();
      
      // 固定カテゴリ
      rows.push({ category: 'viewingDayBefore', count: categoryCounts.viewingDayBefore || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'todayCall', count: categoryCounts.todayCall || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'threeCallUnchecked', count: categoryCounts.threeCallUnchecked || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'inquiryEmailUnanswered', count: categoryCounts.inquiryEmailUnanswered || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'brokerInquiry', count: categoryCounts.brokerInquiry || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'generalViewingSellerContactPending', count: categoryCounts.generalViewingSellerContactPending || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'viewingPromotionRequired', count: categoryCounts.viewingPromotionRequired || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'pinrichUnregistered', count: categoryCounts.pinrichUnregistered || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'pinrich500manUnregistered', count: categoryCounts.pinrich500manUnregistered || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'viewingSurveyUnchecked', count: categoryCounts.viewingSurveyUnchecked || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'viewingUnconfirmed', count: categoryCounts.viewingUnconfirmed || 0, label: null, assignee: null, updated_at: now });
      rows.push({ category: 'sellerViewingContactPending', count: categoryCounts.sellerViewingContactPending || 0, label: null, assignee: null, updated_at: now });
      
      // 担当別カテゴリ
      for (const [assignee, count] of Object.entries(categoryCounts.assignedCounts || {})) {
        rows.push({ category: 'assigned', count: count as number, label: null, assignee, updated_at: now });
      }
      
      // 当日TEL担当別カテゴリ
      for (const [assignee, count] of Object.entries(categoryCounts.todayCallAssignedCounts || {})) {
        rows.push({ category: 'todayCallAssigned', count: count as number, label: null, assignee, updated_at: now });
      }
      
      // 次電日空欄担当別カテゴリ
      for (const [assignee, count] of Object.entries(categoryCounts.nextCallDateBlankCounts || {})) {
        rows.push({ category: 'nextCallDateBlank', count: count as number, label: null, assignee, updated_at: now });
      }
      
      console.log(`[BuyerService.updateSidebarCountsTable] Inserting ${rows.length} rows...`);
      
      // 一括挿入
      const { error: insertError } = await this.supabase
        .from('buyer_sidebar_counts')
        .insert(rows);
      
      if (insertError) {
        console.error('[BuyerService.updateSidebarCountsTable] Failed to insert:', insertError);
        return {
          success: false,
          rowsInserted: 0,
          error: `Failed to insert: ${insertError.message}`
        };
      }
      
      const duration = Date.now() - startTime;
      console.log(`[BuyerService.updateSidebarCountsTable] ===== SUCCESS ===== (${duration}ms, ${rows.length} rows inserted)`);
      
      return {
        success: true,
        rowsInserted: rows.length
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[BuyerService.updateSidebarCountsTable] ===== ERROR ===== (${duration}ms):`, error);
      return {
        success: false,
        rowsInserted: 0,
        error: error.message
      };
    }
  }

  /**
   * 他社物件新着配信用の買主を取得
   * @param params フィルタパラメータ（エリア、価格帯、物件種別）
   * @returns 条件に合う買主のリスト
   */
  async getOtherCompanyDistributionBuyers(params: {
    area: string;
    priceRange: string;
    propertyTypes: string[];
  }): Promise<{ buyers: any[]; total: number }> {
    const { area, priceRange, propertyTypes } = params;

    console.log('[getOtherCompanyDistributionBuyers] params:', { area, priceRange, propertyTypes });

    // キャッシュキー生成
    const cacheKey = `${area}:${priceRange}:${propertyTypes.join(',')}`;
    
    // キャッシュチェック
    const cached = distributionCache.get(cacheKey);
    if (cached) {
      console.log('[getOtherCompanyDistributionBuyers] Cache hit');
      return cached as { buyers: any[]; total: number };
    }

    // エリアグループルール適用
    const targetAreas = this.applyAreaGroupRules(area);
    console.log('[getOtherCompanyDistributionBuyers] targetAreas:', targetAreas);

    // クエリ構築
    let query = this.supabase
      .from('buyers')
      .select('buyer_number, name, desired_area, desired_property_type, price_range_house, price_range_apartment, price_range_land, reception_date, phone_number, email, latest_status, inquiry_hearing')
      .is('deleted_at', null);

    // エリアフィルタ（OR条件で複数エリアを検索）
    if (targetAreas.length > 0) {
      const areaConditions = targetAreas.map(a => `desired_area.ilike.%${a}%`).join(',');
      query = query.or(areaConditions);
    }

    // データ取得
    const { data: allBuyers, error } = await query;

    if (error) {
      console.error('[getOtherCompanyDistributionBuyers] Query error:', error);
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    console.log('[getOtherCompanyDistributionBuyers] allBuyers count:', allBuyers?.length || 0);
    
    // デバッグ：最初の3件のデータを出力
    if (allBuyers && allBuyers.length > 0) {
      console.log('[getOtherCompanyDistributionBuyers] Sample buyers (first 3):', 
        allBuyers.slice(0, 3).map(b => ({
          buyer_number: b.buyer_number,
          desired_area: b.desired_area,
          desired_property_type: b.desired_property_type,
          price_range_house: b.price_range_house,
          price_range_apartment: b.price_range_apartment,
          price_range_land: b.price_range_land
        }))
      );
    }

    // 物件種別フィルタ（アプリケーション層）
    const propertyTypeFiltered = (allBuyers || []).filter(buyer => {
      if (!buyer.desired_property_type) {
        console.log(`[getOtherCompanyDistributionBuyers] Buyer ${buyer.buyer_number}: No desired_property_type`);
        return false;
      }
      
      const dbTypes = propertyTypes.map(type => this.mapPropertyTypeToDb(type));
      const matches = dbTypes.some(dbType => 
        buyer.desired_property_type.includes(dbType)
      );
      
      console.log(`[getOtherCompanyDistributionBuyers] Buyer ${buyer.buyer_number}: desired_property_type="${buyer.desired_property_type}", dbTypes=${JSON.stringify(dbTypes)}, matches=${matches}`);
      
      return matches;
    });

    console.log('[getOtherCompanyDistributionBuyers] propertyTypeFiltered count:', propertyTypeFiltered.length);

    // 価格帯フィルタ（アプリケーション層）
    const filteredBuyers = this.filterByPriceRange(propertyTypeFiltered, priceRange, propertyTypes);

    console.log('[getOtherCompanyDistributionBuyers] filteredBuyers count:', filteredBuyers.length);

    const result = {
      buyers: filteredBuyers,
      total: filteredBuyers.length,
    };

    // キャッシュに保存（TTL: 10分）
    distributionCache.set(cacheKey, result);

    return result;
  }

  /**
   * エリアグループルール適用
   * ①～⑧ → ㊵も含める
   * ⑨～⑮ → ㊶も含める
   */
  private applyAreaGroupRules(area: string): string[] {
    // エリア文字列から丸数字を抽出（例：「①中学校（王子、碩田学園、大分西）」→「①」）
    const circledNumberMatch = area.match(/[①-⑳㉑-㉟㊱-㊿]/);
    const areaNumber = circledNumberMatch ? circledNumberMatch[0] : area;

    console.log('[applyAreaGroupRules] input area:', area, 'extracted areaNumber:', areaNumber);

    const oitaCityAreas = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    const beppuCityAreas = ['⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];

    const targetAreas = [areaNumber];

    if (oitaCityAreas.includes(areaNumber)) {
      targetAreas.push('㊵');
    }

    if (beppuCityAreas.includes(areaNumber)) {
      targetAreas.push('㊶');
    }

    console.log('[applyAreaGroupRules] targetAreas:', targetAreas);

    return targetAreas;
  }

  /**
   * 物件種別をDBカラム値にマッピング
   */
  private mapPropertyTypeToDb(type: string): string {
    const mapping: Record<string, string> = {
      '戸建': '戸建て',
      'マンション': 'マンション',
      '土地': '土地',
    };
    return mapping[type] || type;
  }

  /**
   * 価格帯フィルタリング
   */
  /**
   * ペットフィルター
   * 可: pet_allowed_required !== '不可'（null・空欄含む）
   * 不可: pet_allowed_required === '不可' のみ
   * どちらでも: 全件
   */
  public static filterByPet(buyers: any[], pet: string): any[] {
    if (pet === 'どちらでも') return buyers;
    if (pet === '可') {
      return buyers.filter(b => b.pet_allowed_required !== '不可');
    }
    if (pet === '不可') {
      // 不可: 「不可」または空欄（null・空文字）の買主を対象
      return buyers.filter(b => {
        const v = b.pet_allowed_required;
        return !v || v === '' || v === '不可';
      });
    }
    // 不正な値はフォールバック（全件）
    return buyers;
  }

  /**
   * P台数フィルター
   * 不要: null・空欄・1台・2台・不要
   * 1台: null・空欄・不要・1台
   * 2台以上: 2台以上・3台以上・10台以上
   * 3台以上: 3台以上・10台以上
   * 10台以上: 10台以上 のみ
   * 指定なし: 全件
   */
  public static filterByParking(buyers: any[], parking: string): any[] {
    if (parking === '指定なし') return buyers;
    if (parking === '不要') {
      return buyers.filter(b => {
        const v = b.parking_spaces;
        return !v || v === '' || v === '1台' || v === '2台' || v === '不要';
      });
    }
    if (parking === '1台') {
      return buyers.filter(b => {
        const v = b.parking_spaces;
        return !v || v === '' || v === '不要' || v === '1台';
      });
    }
    if (parking === '2台以上') {
      return buyers.filter(b => {
        const v = b.parking_spaces;
        return !v || v === '' || v === '2台以上';
      });
    }
    if (parking === '3台以上') {
      return buyers.filter(b => {
        const v = b.parking_spaces;
        return v === '3台以上' || v === '10台以上';
      });
    }
    if (parking === '10台以上') {
      return buyers.filter(b => b.parking_spaces === '10台以上');
    }
    // 不正な値はフォールバック（全件）
    return buyers;
  }

  /**
   * 温泉フィルター
   * あり: hot_spring_required === 'あり' のみ
   * なし: null・空欄・なし
   * どちらでも: 全件
   */
  public static filterByOnsen(buyers: any[], onsen: string): any[] {
    if (onsen === 'どちらでも') return buyers;
    if (onsen === 'あり') {
      return buyers.filter(b => b.hot_spring_required === 'あり');
    }
    if (onsen === 'なし') {
      return buyers.filter(b => {
        const v = b.hot_spring_required;
        return !v || v === '' || v === 'なし';
      });
    }
    // 不正な値はフォールバック（全件）
    return buyers;
  }

  /**
   * 高層階フィルター
   * 高層階: null・空欄・高層階・どちらでも
   * 低層階: null・空欄・低層階・どちらでも
   * どちらでも: 全件
   */
  public static filterByFloor(buyers: any[], floor: string): any[] {
    if (floor === 'どちらでも') return buyers;
    if (floor === '高層階') {
      return buyers.filter(b => {
        const v = b.high_floor_required;
        return !v || v === '' || v === '高層階' || v === 'どちらでも';
      });
    }
    if (floor === '低層階') {
      return buyers.filter(b => {
        const v = b.high_floor_required;
        return !v || v === '' || v === '低層階' || v === 'どちらでも';
      });
    }
    // 不正な値はフォールバック（全件）
    return buyers;
  }

  private filterByPriceRange(buyers: any[], priceRange: string, propertyTypes: string[]): any[] {
    if (priceRange === '指定なし') {
      console.log('[filterByPriceRange] priceRange is "指定なし", returning all buyers');
      return buyers;
    }

    console.log(`[filterByPriceRange] Filtering ${buyers.length} buyers by priceRange="${priceRange}", propertyTypes=${JSON.stringify(propertyTypes)}`);

    return buyers.filter(buyer => {
      for (const type of propertyTypes) {
        const priceField = this.getPriceFieldForType(type);
        const buyerPrice = buyer[priceField];

        console.log(`[filterByPriceRange] Buyer ${buyer.buyer_number}: type="${type}", priceField="${priceField}", buyerPrice="${buyerPrice}"`);

        if (!buyerPrice) {
          console.log(`[filterByPriceRange] Buyer ${buyer.buyer_number}: No price for ${priceField}`);
          continue;
        }

        const matches = this.matchesPriceRange(buyerPrice, priceRange);
        console.log(`[filterByPriceRange] Buyer ${buyer.buyer_number}: buyerPrice="${buyerPrice}", priceRange="${priceRange}", matches=${matches}`);

        if (matches) {
          return true;
        }
      }
      console.log(`[filterByPriceRange] Buyer ${buyer.buyer_number}: No matching price range`);
      return false;
    });
  }

  /**
   * 物件種別に対応する価格フィールドを取得
   */
  private getPriceFieldForType(type: string): string {
    const mapping: Record<string, string> = {
      '戸建': 'price_range_house',
      'マンション': 'price_range_apartment',
      '土地': 'price_range_land',
    };
    return mapping[type] || 'price_range_house';
  }

  /**
   * 価格帯マッチング
   */
  private matchesPriceRange(buyerPrice: string, priceRange: string): boolean {
    const { min, max } = this.parsePriceRange(buyerPrice);

    console.log(`[matchesPriceRange] buyerPrice="${buyerPrice}", parsed: min=${min}, max=${max}, priceRange="${priceRange}"`);

    switch (priceRange) {
      case '~1900万円':
        // 買主の価格帯の最大値が1900万円以下
        const result1 = max <= 19000000;
        console.log(`[matchesPriceRange] ~1900万円: max(${max}) <= 19000000 = ${result1}`);
        return result1;
      case '1000万円~2999万円':
        // 買主の価格帯が1000万円~2999万円の範囲と重なっている
        // 条件: 買主の最大値 >= 1000万円 AND 買主の最小値 <= 2999万円
        const result2 = max >= 10000000 && min <= 29990000;
        console.log(`[matchesPriceRange] 1000万円~2999万円: max(${max}) >= 10000000 && min(${min}) <= 29990000 = ${result2}`);
        return result2;
      case '2000万円以上':
        // 買主の価格帯の最大値が2000万円以上
        const result3 = max >= 20000000;
        console.log(`[matchesPriceRange] 2000万円以上: max(${max}) >= 20000000 = ${result3}`);
        return result3;
      default:
        console.log(`[matchesPriceRange] Unknown priceRange, returning true`);
        return true;
    }
  }

  /**
   * 半径検索で買主を取得
   * @param params 検索パラメータ（住所または物件番号、価格帯、物件種別）
   * @returns 買主リストと総数
   */
  async getBuyersByRadiusSearch(params: {
    address: string;
    priceRange: string;
    propertyTypes: string[];
    pet?: string;
    parking?: string;
    onsen?: string;
    floor?: string;
  }): Promise<{ buyers: any[]; total: number }> {
    const {
      address,
      priceRange,
      propertyTypes,
      pet = 'どちらでも',
      parking = '指定なし',
      onsen = 'どちらでも',
      floor = 'どちらでも',
    } = params;

    console.log('[getBuyersByRadiusSearch] params:', { address, priceRange, propertyTypes });

    // キャッシュキー生成
    const cacheKey = `radius:v2:${address}:${priceRange}:${propertyTypes.join(',')}:${pet}:${parking}:${onsen}:${floor}`;
    
    // キャッシュチェック（一時的に無効化）
    // const cached = distributionCache.get(cacheKey);
    // if (cached) {
    //   console.log('[getBuyersByRadiusSearch] Cache hit');
    //   return cached as { buyers: any[]; total: number };
    // }

    // 1. 住所から座標を取得
    // まず、物件リストテーブルから座標を検索（住所が物件番号の場合）
    let coordinates: { lat: number; lng: number } | null = null;
    
    // 物件番号の形式（AA9999など）かチェック
    const isPropertyNumber = /^[A-Z]{2}\d{4}$/.test(address.trim());
    
    if (isPropertyNumber) {
      console.log('[getBuyersByRadiusSearch] Searching by property number:', address);
      const { data: property } = await this.supabase
        .from('property_listings')
        .select('latitude, longitude')
        .eq('property_number', address.trim())
        .single();
      
      if (property && property.latitude && property.longitude) {
        coordinates = { lat: property.latitude, lng: property.longitude };
        console.log('[getBuyersByRadiusSearch] Found coordinates from property_listings:', coordinates);
      }
    }
    
    // 物件リストに座標がない場合、または住所の場合はジオコーディング
    if (!coordinates) {
      console.log('[getBuyersByRadiusSearch] Geocoding address:', address);
      const { GeocodingService } = await import('./GeocodingService');
      const geocodingService = new GeocodingService();
      coordinates = await geocodingService.geocodeAddress(address);
      
      if (!coordinates) {
        throw new Error('geocoding failed: Unable to convert address to coordinates');
      }
      console.log('[getBuyersByRadiusSearch] Geocoded coordinates:', coordinates);
    }

    console.log('[getBuyersByRadiusSearch] Using coordinates:', coordinates);

    // GeocodingServiceのインスタンスを作成（距離計算用）
    const { GeocodingService: GeocodingServiceClass } = await import('./GeocodingService');
    const geocodingService = new GeocodingServiceClass();

    // 2. 半径3km圏内の買主を検索
    // まず、全買主を取得（desired_area_lat, desired_area_lngがnullでないもの）
    // 座標ありの全買主を取得（ページネーションで上限を回避）
    let allBuyers: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: pageError } = await this.supabase
        .from('buyers')
        .select('buyer_number, name, desired_area, desired_property_type, price_range_house, price_range_apartment, price_range_land, reception_date, phone_number, email, latest_status, inquiry_hearing, desired_area_lat, desired_area_lng, pet_allowed_required, parking_spaces, hot_spring_required, high_floor_required')
        .is('deleted_at', null)
        .not('desired_area_lat', 'is', null)
        .not('desired_area_lng', 'is', null)
        .range(from, from + pageSize - 1);

      if (pageError) {
        console.error('[getBuyersByRadiusSearch] Query error:', pageError);
        throw new Error(`Failed to fetch buyers: ${pageError.message}`);
      }

      if (!page || page.length === 0) break;
      allBuyers = allBuyers.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    const error = null;

    if (error) {
      console.error('[getBuyersByRadiusSearch] Query error:', error);
      throw new Error(`Failed to fetch buyers: ${error.message}`);
    }

    console.log('[getBuyersByRadiusSearch] allBuyers count:', allBuyers?.length || 0);

    // 3. 半径3km圏内の買主をフィルタリング
    const RADIUS_KM = 3;
    const buyersWithinRadius = (allBuyers || []).filter(buyer => {
      const distance = geocodingService.calculateDistance(
        coordinates.lat,
        coordinates.lng,
        buyer.desired_area_lat,
        buyer.desired_area_lng
      );
      return distance <= RADIUS_KM;
    });

    console.log('[getBuyersByRadiusSearch] buyersWithinRadius count:', buyersWithinRadius.length);

    // 4. 最新状況でフィルタリング（"買"を含む、または"D"で始まるものを除外）
    const statusFiltered = buyersWithinRadius.filter(buyer => {
      if (!buyer.latest_status) return true;
      const status = buyer.latest_status.trim();
      // "買"を含む、または"D"で始まる場合は除外
      return !status.includes('買') && !status.startsWith('D');
    });

    console.log('[getBuyersByRadiusSearch] statusFiltered count:', statusFiltered.length);

    // 5. 物件種別でフィルタリング
    const propertyTypeFiltered = statusFiltered.filter(buyer => {
      if (!buyer.desired_property_type) return false;
      
      const dbTypes = propertyTypes.map(type => this.mapPropertyTypeToDb(type));
      return dbTypes.some(dbType => 
        buyer.desired_property_type.includes(dbType) ||
        dbType.includes(buyer.desired_property_type)
      );
    });

    console.log('[getBuyersByRadiusSearch] propertyTypeFiltered count:', propertyTypeFiltered.length);

    // 6. 価格帯でフィルタリング
    const priceFiltered = this.filterByPriceRange(propertyTypeFiltered, priceRange, propertyTypes);

    console.log('[getBuyersByRadiusSearch] priceFiltered count:', priceFiltered.length);

    // 7. ペット・P台数・温泉・高層階フィルターを適用（AND条件）
    const petFiltered = BuyerService.filterByPet(priceFiltered, pet);
    console.log('[getBuyersByRadiusSearch] petFiltered count:', petFiltered.length);

    const parkingFiltered = BuyerService.filterByParking(petFiltered, parking);
    console.log('[getBuyersByRadiusSearch] parkingFiltered count:', parkingFiltered.length);

    const onsenFiltered = BuyerService.filterByOnsen(parkingFiltered, onsen);
    console.log('[getBuyersByRadiusSearch] onsenFiltered count:', onsenFiltered.length);

    const filteredBuyers = BuyerService.filterByFloor(onsenFiltered, floor);
    console.log('[getBuyersByRadiusSearch] filteredBuyers (after floor filter) count:', filteredBuyers.length);

    // 8. 各買主の最新問い合わせ物件所在地を取得
    // 買主の property_number フィールドから物件番号を取得
    const buyerNumbers = filteredBuyers.map(b => b.buyer_number);
    const { data: buyersWithProperty } = await this.supabase
      .from('buyers')
      .select('buyer_number, property_number')
      .in('buyer_number', buyerNumbers);

    // 買主ごとの問い合わせ物件番号を取得
    const propertyNumberMap = new Map<string, string>();
    if (buyersWithProperty) {
      for (const buyer of buyersWithProperty) {
        if (buyer.property_number) {
          propertyNumberMap.set(buyer.buyer_number, buyer.property_number);
        }
      }
    }

    // 物件番号から所在地を取得（property_listingsテーブルから）
    const propertyNumbers = Array.from(new Set(propertyNumberMap.values()));
    const { data: properties } = await this.supabase
      .from('property_listings')
      .select('property_number, property_type, address, display_address')
      .in('property_number', propertyNumbers);

    const propertyAddressMap = new Map<string, string>();
    if (properties) {
      for (const property of properties) {
        // マンションの場合は住居表示（display_address）、それ以外は所在地（address）
        const address = property.property_type === 'マンション' 
          ? (property.display_address || property.address || '-')
          : (property.address || '-');
        propertyAddressMap.set(property.property_number, address);
      }
    }

    // 9. 距離でソート（近い順）+ 問い合わせ物件所在地を追加
    const sortedBuyers = filteredBuyers.map(buyer => {
      const propertyNumber = propertyNumberMap.get(buyer.buyer_number);
      const inquiredPropertyAddress = propertyNumber 
        ? propertyAddressMap.get(propertyNumber) || '-'
        : '-';

      return {
        ...buyer,
        distance: geocodingService.calculateDistance(
          coordinates.lat,
          coordinates.lng,
          buyer.desired_area_lat,
          buyer.desired_area_lng
        ),
        inquired_property_address: inquiredPropertyAddress,
      };
    }).sort((a, b) => {
      // 受付日の新しい順にソート
      if (!a.reception_date) return 1;
      if (!b.reception_date) return -1;
      return new Date(b.reception_date).getTime() - new Date(a.reception_date).getTime();
    });

    const result = {
      buyers: sortedBuyers,
      total: sortedBuyers.length,
    };

    // キャッシュに保存（TTL: 10分）
    distributionCache.set(cacheKey, result);

    return result;
  }

  /**
   * 買付率統計を取得
   * 2026年1月以降の月ごと・後続担当ごとの買付数、内覧数、買付率を集計
   */
  async getPurchaseRateStatistics(): Promise<Array<{
    month: string;
    total: {
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    };
    assignees: Array<{
      followUpAssignee: string;
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    }>;
  }>> {
    try {
      console.log('[BuyerService.getPurchaseRateStatistics] Starting...');
      
      // キャッシュをチェック
      const cacheKey = 'purchase-rate-statistics';
      const cachedData = purchaseRateStatisticsCache.get<Array<{
        month: string;
        total: {
          viewingCount: number;
          purchaseCount: number;
          purchaseRate: number | null;
        };
        assignees: Array<{
          followUpAssignee: string;
          viewingCount: number;
          purchaseCount: number;
          purchaseRate: number | null;
        }>;
      }>>(cacheKey);
      
      if (cachedData) {
        console.log('[BuyerService.getPurchaseRateStatistics] Returning cached data');
        return cachedData;
      }
      
      // 1. 2026年1月1日以降のデータを取得
      const { data: buyers, error } = await this.supabase
        .from('buyers')
        .select('viewing_date, latest_status, follow_up_assignee, email, phone_number, broker_inquiry')
        .gte('viewing_date', '2026-01-01')
        .not('viewing_date', 'is', null);

      if (error) {
        console.error('[BuyerService.getPurchaseRateStatistics] Supabase error:', error);
        throw new Error(`Failed to fetch buyers: ${error.message}`);
      }

      if (!buyers || buyers.length === 0) {
        console.log('[BuyerService.getPurchaseRateStatistics] No data found');
        return [];
      }

      console.log(`[BuyerService.getPurchaseRateStatistics] Fetched ${buyers.length} buyers`);

      // 2. 月ごと・後続担当ごとにグループ化（2段階）
      const groupedData = this.groupByMonthAndAssignee(buyers);
      console.log(`[BuyerService.getPurchaseRateStatistics] Grouped into ${groupedData.size} months`);

      // 3. 月ごとの統計を計算
      const statistics = this.calculateMonthlyStatistics(groupedData);
      console.log(`[BuyerService.getPurchaseRateStatistics] Calculated ${statistics.length} monthly statistics`);

      // 4. ソート（月の降順）
      statistics.sort((a, b) => b.month.localeCompare(a.month));

      // キャッシュに保存
      purchaseRateStatisticsCache.set(cacheKey, statistics);
      console.log('[BuyerService.getPurchaseRateStatistics] Data cached');

      console.log('[BuyerService.getPurchaseRateStatistics] Completed successfully');
      return statistics;
    } catch (error: any) {
      console.error('[BuyerService.getPurchaseRateStatistics] Error:', error);
      throw error;
    }
  }

  /**
   * 買主データを月ごと・後続担当ごとにグループ化（2段階）
   */
  private groupByMonthAndAssignee(buyers: any[]): Map<string, Map<string, any[]>> {
    const grouped = new Map<string, Map<string, any[]>>();

    for (const buyer of buyers) {
      const viewingDate = new Date(buyer.viewing_date);
      const month = `${viewingDate.getFullYear()}年${viewingDate.getMonth() + 1}月`;
      const assignee = buyer.follow_up_assignee || '未設定';

      // GYOSHAを除外
      if (assignee === 'GYOSHA') {
        continue;
      }

      // 業者問合せ買主を除外
      if (isVendorBuyer(buyer.broker_inquiry)) {
        continue;
      }

      if (!grouped.has(month)) {
        grouped.set(month, new Map());
      }
      
      const monthData = grouped.get(month)!;
      if (!monthData.has(assignee)) {
        monthData.set(assignee, []);
      }
      
      monthData.get(assignee)!.push(buyer);
    }

    return grouped;
  }

  /**
   * 月ごとの統計を計算
   */
  private calculateMonthlyStatistics(groupedData: Map<string, Map<string, any[]>>): Array<{
    month: string;
    total: {
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    };
    assignees: Array<{
      followUpAssignee: string;
      viewingCount: number;
      purchaseCount: number;
      purchaseRate: number | null;
    }>;
  }> {
    const statistics: Array<{
      month: string;
      total: {
        viewingCount: number;
        purchaseCount: number;
        purchaseRate: number | null;
      };
      assignees: Array<{
        followUpAssignee: string;
        viewingCount: number;
        purchaseCount: number;
        purchaseRate: number | null;
      }>;
    }> = [];

    for (const [month, assigneeData] of groupedData.entries()) {
      const assignees: Array<{
        followUpAssignee: string;
        viewingCount: number;
        purchaseCount: number;
        purchaseRate: number | null;
      }> = [];
      
      let totalViewingCount = 0;
      let totalPurchaseCount = 0;

      // 担当者ごとの統計を計算
      for (const [assignee, buyers] of assigneeData.entries()) {
        // 買付数を集計（latest_status に「買（」を含む）
        const purchaseCount = buyers.filter(b => 
          b.latest_status && b.latest_status.includes('買（')
        ).length;

        // 内覧数を集計（重複排除）
        const uniqueViewings = this.getUniqueViewings(buyers);
        const viewingCount = uniqueViewings.size;

        // 買付率を計算
        const purchaseRate = viewingCount > 0
          ? Math.round((purchaseCount / viewingCount) * 1000) / 10
          : null;

        assignees.push({
          followUpAssignee: assignee,
          viewingCount,
          purchaseCount,
          purchaseRate
        });

        totalViewingCount += viewingCount;
        totalPurchaseCount += purchaseCount;
      }

      // 担当者をアルファベット順にソート
      assignees.sort((a, b) => a.followUpAssignee.localeCompare(b.followUpAssignee));

      // 月の合計買付率を計算
      const totalPurchaseRate = totalViewingCount > 0
        ? Math.round((totalPurchaseCount / totalViewingCount) * 1000) / 10
        : null;

      statistics.push({
        month,
        total: {
          viewingCount: totalViewingCount,
          purchaseCount: totalPurchaseCount,
          purchaseRate: totalPurchaseRate
        },
        assignees
      });
    }

    return statistics;
  }

  /**
   * 内覧数の重複排除（同じメールアドレスまたは電話番号は1件としてカウント）
   */
  private getUniqueViewings(buyers: any[]): Set<string> {
    const uniqueViewings = new Set<string>();

    for (const buyer of buyers) {
      const email = buyer.email?.trim() || '';
      const phoneNumber = buyer.phone_number?.trim() || '';

      // メールアドレスまたは電話番号のいずれかが存在する場合のみカウント
      if (email || phoneNumber) {
        const key = `${email}|${phoneNumber}`;
        uniqueViewings.add(key);
      }
    }

    return uniqueViewings;
  }
  /**
   * Validate if a property number exists in property_listings table
   * @param propertyNumber - property number to check
   * @returns true if exists, false if not
   */
  async validatePropertyNumber(propertyNumber: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .select('property_number')
      .eq('property_number', propertyNumber)
      .maybeSingle();
    if (error) throw new Error(`Failed to validate property number: ${error.message}`);
    return data !== null;
  }

}
