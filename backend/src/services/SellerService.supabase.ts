import { BaseRepository } from '../repositories/BaseRepository';
import {
  Seller,
  CreateSellerRequest,
  UpdateSellerRequest,
  ListSellersParams,
  PaginatedResult,
  SellerStatus,
  CreateSellerResponse,
  DuplicateWarning,
} from '../types';
import { encrypt, decrypt } from '../utils/encryption';
import { CacheHelper, CACHE_TTL } from '../utils/cache';
import { sellerNumberService } from './SellerNumberService';
import { duplicateDetectionService } from './DuplicateDetectionService';
import { CalendarService } from './CalendarService.supabase';
import { ExclusionDateCalculator } from './ExclusionDateCalculator';
import { SyncQueue } from './SyncQueue';
import { createClient } from '@supabase/supabase-js';

// モジュールレベルのインメモリキャッシュ（プロセス内で持続、Redis 不要）
// Vercel サーバーレスでは同一プロセス内のリクエスト間でキャッシュが共有される
let _employeeInitialsMap: Record<string, string> | null = null;
let _employeeInitialsCachedAt = 0;
const EMPLOYEE_INITIALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5分
let _employeeInitialsRefreshing = false; // 重複リフレッシュ防止

/**
 * スタッフ情報のキャッシュを更新（モジュールレベルのインメモリキャッシュに保存）
 */
async function refreshEmployeeCache(): Promise<void> {
  if (_employeeInitialsRefreshing) return; // 重複リフレッシュ防止
  _employeeInitialsRefreshing = true;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: employees, error } = await supabase
      .from('employees')
      .select('initials, name')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch employees for initials mapping:', error);
      return;
    }

    const initialsMap: Record<string, string> = {};
    employees?.forEach((emp: any) => {
      if (emp.initials && emp.name) {
        initialsMap[emp.initials] = emp.name;
      }
    });

    _employeeInitialsMap = initialsMap;
    _employeeInitialsCachedAt = Date.now();
    console.log(`✅ Employee initials cache updated (in-memory): ${Object.keys(initialsMap).length} employees`);
  } catch (error) {
    console.error('Error refreshing employee cache:', error);
  } finally {
    _employeeInitialsRefreshing = false;
  }
}

/**
 * イニシャルマップを取得（キャッシュ有効期限チェック付き）
 * キャッシュが古い場合はバックグラウンドで更新（stale-while-revalidate）
 */
function getInitialsMap(): Record<string, string> {
  const now = Date.now();
  if (_employeeInitialsMap && (now - _employeeInitialsCachedAt) < EMPLOYEE_INITIALS_CACHE_TTL_MS) {
    return _employeeInitialsMap;
  }
  // キャッシュが古い or 未初期化 → バックグラウンドで更新（今回は古いデータを返す）
  refreshEmployeeCache().catch(console.error);
  return _employeeInitialsMap || {};
}

// getSeller 用インメモリキャッシュ（30秒TTL）
const _sellerCache = new Map<string, { data: any; expiresAt: number }>();
const SELLER_CACHE_TTL_MS = 30 * 1000; // 30秒

function getSellerCache(sellerId: string): any | null {
  const entry = _sellerCache.get(sellerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _sellerCache.delete(sellerId);
    return null;
  }
  return entry.data;
}

function setSellerCache(sellerId: string, data: any): void {
  _sellerCache.set(sellerId, { data, expiresAt: Date.now() + SELLER_CACHE_TTL_MS });
}

function invalidateSellerCache(sellerId: string): void {
  _sellerCache.delete(sellerId);
}

// listSellers 用インメモリキャッシュ（60秒TTL）
// Redis が遅い/未接続の場合でも高速レスポンスを返すための前段キャッシュ
const _listSellersCache = new Map<string, { data: any; expiresAt: number }>();
const LIST_SELLERS_CACHE_TTL_MS = 60 * 1000; // 60秒

function getListSellersCache(cacheKey: string): any | null {
  const entry = _listSellersCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _listSellersCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setListSellersCache(cacheKey: string, data: any): void {
  _listSellersCache.set(cacheKey, { data, expiresAt: Date.now() + LIST_SELLERS_CACHE_TTL_MS });
}

function invalidateListSellersCache(): void {
  _listSellersCache.clear();
}

export class SellerService extends BaseRepository {
  private syncQueue?: SyncQueue;
  // 全インスタンスで共有するstaticなsyncQueue
  private static sharedSyncQueue?: SyncQueue;

  /**
   * 同期キューを設定（インスタンス）
   */
  setSyncQueue(syncQueue: SyncQueue): void {
    this.syncQueue = syncQueue;
  }

  /**
   * 同期キューをグローバルに設定（全インスタンスで共有）
   */
  static setSharedSyncQueue(syncQueue: SyncQueue): void {
    SellerService.sharedSyncQueue = syncQueue;
    console.log('✅ SellerService: sharedSyncQueue set');
  }

  /**
   * 有効なsyncQueueを取得（インスタンス優先、なければshared）
   */
  private getActiveSyncQueue(): SyncQueue | undefined {
    return this.syncQueue ?? SellerService.sharedSyncQueue;
  }

  /**
   * 売主を登録（Phase 1拡張版）
   */
  async createSeller(data: CreateSellerRequest, employeeId: string): Promise<CreateSellerResponse> {
    // Phase 1: 重複チェック
    const encryptedPhone = encrypt(data.phoneNumber);
    const encryptedEmail = data.email ? encrypt(data.email) : undefined;
    
    const duplicateMatches = await duplicateDetectionService.instance.checkDuplicates(
      encryptedPhone,
      encryptedEmail
    );

    const duplicateWarning: DuplicateWarning | undefined = duplicateMatches.length > 0
      ? {
          hasDuplicates: true,
          matches: duplicateMatches,
          canProceed: true,
        }
      : undefined;

    // Phase 1: 売主番号を生成（提供されていない場合）
    let sellerNumber = data.sellerNumber;
    if (!sellerNumber) {
      try {
        sellerNumber = await sellerNumberService.generateWithRetry();
      } catch (error) {
        console.error('Failed to generate seller number, using fallback:', error);
        // Fallback: generate a temporary number based on timestamp
        const timestamp = Date.now().toString().slice(-5);
        sellerNumber = `AA${timestamp}`;
      }
    }

    // 除外日を計算
    const exclusionDate = ExclusionDateCalculator.calculateExclusionDate(
      data.inquiryDate,
      data.site
    );

    // 個人情報を暗号化
    const encryptedData = {
      name: encrypt(data.name),
      address: encrypt(data.address),
      phone_number: encryptedPhone,
      email: encryptedEmail || null,
      status: SellerStatus.FOLLOWING_UP,
      assigned_to: employeeId,
      // Phase 1 fields
      seller_number: sellerNumber,
      inquiry_source: data.inquirySource,
      inquiry_year: data.inquiryYear,
      inquiry_date: data.inquiryDate,
      inquiry_datetime: data.inquiryDatetime || null,
      confidence: data.confidenceLevel || null,
      first_caller_initials: data.firstCallerInitials || null,
      first_caller_employee_id: data.firstCallerEmployeeId || null,
      is_unreachable: false,
      duplicate_confirmed: false,
      exclusion_date: exclusionDate,
    };

    // 売主を作成
    const { data: seller, error: sellerError } = await this.table('sellers')
      .insert(encryptedData)
      .select()
      .single();

    if (sellerError || !seller) {
      throw new Error(`Failed to create seller: ${sellerError?.message}`);
    }

    // Phase 1: 重複履歴を記録
    if (duplicateMatches.length > 0) {
      for (const match of duplicateMatches) {
        try {
          await duplicateDetectionService.instance.recordDuplicateHistory(
            seller.id,
            match.sellerId,
            match.matchType
          );
        } catch (error) {
          console.error('Failed to record duplicate history:', error);
          // 履歴記録の失敗は致命的ではないので続行
        }
      }
    }

    // 物件情報を作成
    const { error: propertyError } = await this.table('properties').insert({
      seller_id: seller.id,
      address: data.property.address,
      prefecture: data.property.prefecture,
      city: data.property.city,
      property_type: data.property.propertyType,
      land_area: data.property.landArea,
      building_area: data.property.buildingArea,
      build_year: data.property.buildYear,
      structure: data.property.structure,
      floors: data.property.floors,
      rooms: data.property.rooms,
      parking: data.property.parking,
      additional_info: data.property.additionalInfo,
    });

    if (propertyError) {
      // ロールバック: 売主を削除
      await this.table('sellers').delete().eq('id', seller.id);
      throw new Error(`Failed to create property: ${propertyError.message}`);
    }

    // 復号化して返す
    const decryptedSeller = await this.decryptSeller(seller);
    
    // キャッシュを無効化（新しいセラーが追加されたのでリストキャッシュをクリア）
    invalidateListSellersCache(); // インメモリリストキャッシュを即座に無効化
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（新規売主追加により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');
    
    // スプレッドシートに同期（非同期）
    const activeSyncQueue = this.getActiveSyncQueue();
    if (activeSyncQueue) {
      await activeSyncQueue.enqueue({
        type: 'create',
        sellerId: seller.id,
      });
    }
    
    // Phase 1: 重複警告と一緒に返す
    return {
      seller: decryptedSeller,
      duplicateWarning,
    };
  }

  /**
   * 売主情報を取得
   * @param sellerId - 売主ID
   * @param includeDeleted - 削除済み売主も含めるか（デフォルト: false）
   */
  async getSeller(sellerId: string, includeDeleted: boolean = false): Promise<Seller | null> {
    const _t0 = Date.now();
    // インメモリキャッシュをチェック（Redis await を排除）
    if (!includeDeleted) {
      const cached = getSellerCache(sellerId);
      if (cached) {
        console.log(`[PERF] getSeller cache hit (in-memory): ${Date.now() - _t0}ms`);
        return cached;
      }
    }
    console.log(`[PERF] getSeller cache miss: ${Date.now() - _t0}ms`);

    // 売主情報を取得
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: seller, error: sellerError } = await query.single();
    console.log(`[PERF] getSeller DB query: ${Date.now() - _t0}ms`);

    if (sellerError || !seller) {
      return null;
    }

    // 物件情報取得と decryptSeller を並列実行（パフォーマンス改善）
    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([
      this.table('properties')
        .select('*')
        .eq('seller_id', sellerId),
      this.decryptSeller(seller),
    ]);
    console.log(`[PERF] getSeller properties+decrypt: ${Date.now() - _t0}ms`);
    
    // 除外日を計算
    const exclusionDate = ExclusionDateCalculator.calculateExclusionDate(
      decryptedSeller.inquiryDate,
      decryptedSeller.site
    );
    decryptedSeller.exclusionDate = exclusionDate;
    
    // 物件情報を追加（カラム名をcamelCaseに変換）
    if (!propertyError && properties && properties.length > 0) {
      const property = properties[0]; // 最初の物件を使用
      // property_address が '未入力' の場合は sellers.property_address にフォールバック
      const isValidAddress = (addr: string | null | undefined): boolean =>
        !!addr && addr.trim() !== '' && addr.trim() !== '未入力';
      const resolvedAddress =
        isValidAddress(property.property_address) ? property.property_address :
        isValidAddress(property.address) ? property.address :
        isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
        property.property_address || property.address; // 全て無効な場合はそのまま返す
      decryptedSeller.property = {
        id: property.id,
        sellerId: property.seller_id,
        address: resolvedAddress, // sellers.property_addressにフォールバック済み
        prefecture: property.prefecture,
        city: property.city,
        propertyType: property.property_type,
        landArea: property.land_area,
        buildingArea: property.building_area,
        landAreaVerified: property.land_area_verified,
        buildingAreaVerified: property.building_area_verified,
        buildYear: property.construction_year || property.build_year, // construction_yearを優先
        structure: property.structure,
        floorPlan: property.floor_plan,
        floors: property.floors,
        rooms: property.rooms,
        sellerSituation: property.current_status || property.seller_situation, // current_statusを優先
        parking: property.parking,
        additionalInfo: property.additional_info,
      };
    }

    // インメモリキャッシュに保存（30秒TTL、Redis await を排除）
    if (!includeDeleted) {
      setSellerCache(sellerId, decryptedSeller);
    }

    return decryptedSeller;
  }

  /**
   * 売主情報を更新
   */
  async updateSeller(sellerId: string, data: UpdateSellerRequest): Promise<Seller> {
    const updates: any = {};

    // 暗号化が必要なフィールド
    if (data.name !== undefined) {
      updates.name = encrypt(data.name);
    }
    if (data.address !== undefined) {
      updates.address = encrypt(data.address);
    }
    if (data.phoneNumber !== undefined) {
      updates.phone_number = encrypt(data.phoneNumber);
    }
    if (data.email !== undefined) {
      updates.email = data.email ? encrypt(data.email) : null;
    }

    // 暗号化不要なフィールド
    if (data.status !== undefined) {
      updates.status = data.status;
    }
    if (data.confidence !== undefined) {
      updates.confidence = data.confidence;
    }
    if (data.assignedTo !== undefined) {
      updates.assigned_to = data.assignedTo;
    }
    if (data.nextCallDate !== undefined) {
      updates.next_call_date = data.nextCallDate;
    }
    if (data.appointmentDate !== undefined) {
      updates.appointment_date = data.appointmentDate;
      // appointmentDateをvisit_dateとvisit_timeに分割して保存
      if (data.appointmentDate) {
        const appointmentDateObj = new Date(data.appointmentDate);
        updates.visit_date = appointmentDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        const hours = appointmentDateObj.getHours().toString().padStart(2, '0');
        const minutes = appointmentDateObj.getMinutes().toString().padStart(2, '0');
        updates.visit_time = `${hours}:${minutes}:00`; // HH:mm:ss
      } else {
        updates.visit_date = null;
        updates.visit_time = null;
      }
    }
    if (data.appointmentNotes !== undefined) {
      updates.appointment_notes = data.appointmentNotes;
    }
    if ((data as any).visitValuationAcquirer !== undefined) {
      updates.visit_valuation_acquirer = (data as any).visitValuationAcquirer;
    }
    if (data.fixedAssetTaxRoadPrice !== undefined) {
      updates.fixed_asset_tax_road_price = data.fixedAssetTaxRoadPrice;
    }
    if (data.valuationAmount1 !== undefined) {
      updates.valuation_amount_1 = data.valuationAmount1;
    }
    if (data.valuationAmount2 !== undefined) {
      updates.valuation_amount_2 = data.valuationAmount2;
    }
    if (data.valuationAmount3 !== undefined) {
      updates.valuation_amount_3 = data.valuationAmount3;
    }
    if (data.valuationAssignedBy !== undefined) {
      updates.valuation_assigned_by = data.valuationAssignedBy;
    }
    if ((data as any).valuationMethod !== undefined) {
      updates.valuation_method = (data as any).valuationMethod;
    }
    if ((data as any).landAreaVerified !== undefined) {
      updates.land_area_verified = (data as any).landAreaVerified;
    }
    if ((data as any).buildingAreaVerified !== undefined) {
      updates.building_area_verified = (data as any).buildingAreaVerified;
    }

    // 競合情報フィールド
    if ((data as any).competitorName !== undefined) {
      updates.competitor_name = (data as any).competitorName;
    }
    if ((data as any).competitors !== undefined) {
      // competitorsはcompetitor_nameとして保存（カンマ区切りの文字列）
      updates.competitor_name = (data as any).competitors;
    }
    if ((data as any).exclusiveDecisionDate !== undefined) {
      // exclusive_decision_dateカラムは存在しないため、contract_year_monthに保存
      updates.contract_year_month = (data as any).exclusiveDecisionDate;
    }
    if ((data as any).exclusiveOtherDecisionFactors !== undefined) {
      // exclusive_other_decision_factorは単数形（配列をカンマ区切り文字列として保存）
      const factors = (data as any).exclusiveOtherDecisionFactors;
      if (Array.isArray(factors) && factors.length > 0) {
        updates.exclusive_other_decision_factor = factors.join(', ');
      } else {
        updates.exclusive_other_decision_factor = null;
      }
    }
    if ((data as any).otherDecisionCountermeasure !== undefined) {
      updates.other_decision_countermeasure = (data as any).otherDecisionCountermeasure;
    }
    if ((data as any).contractYearMonth !== undefined) {
      updates.contract_year_month = (data as any).contractYearMonth;
    }
    if ((data as any).exclusiveOtherDecisionMeeting !== undefined) {
      updates.exclusive_other_decision_meeting = (data as any).exclusiveOtherDecisionMeeting;
    }
    if ((data as any).competitorNameAndReason !== undefined) {
      updates.competitor_name_and_reason = (data as any).competitorNameAndReason;
    }

    // Site field
    if (data.site !== undefined) {
      updates.site = data.site;
    }

    // Exclusion action field
    if ((data as any).exclusionAction !== undefined) {
      updates.exclusion_action = (data as any).exclusionAction;
    }

    // 内覧前伝達事項
    if (data.viewingNotes !== undefined) {
      updates.viewing_notes = this.sanitizeViewingNotes(data.viewingNotes);
    }

    // 最新状況
    if (data.latestStatus !== undefined) {
      updates.latest_status = this.sanitizeLatestStatus(data.latestStatus);
    }

    // Phase 1 fields
    if (data.inquirySource !== undefined) {
      updates.inquiry_source = data.inquirySource;
    }
    if (data.inquiryYear !== undefined) {
      updates.inquiry_year = data.inquiryYear;
    }
    if (data.inquiryDate !== undefined) {
      updates.inquiry_date = data.inquiryDate;
    }

    // 郵送ステータスフィールド
    if ((data as any).mailingStatus !== undefined) {
      updates.mailing_status = (data as any).mailingStatus;
    }
    if ((data as any).mailSentDate !== undefined) {
      updates.mail_sent_date = (data as any).mailSentDate;
    }

    // コメントフィールド
    if ((data as any).comments !== undefined) {
      updates.comments = (data as any).comments;
    }

    // 1番電話フィールド
    if (data.firstCallPerson !== undefined) {
      updates.first_call_person = data.firstCallPerson;
    }

    // 除外日を計算（inquiryDateまたはsiteが更新される場合）
    if (data.inquiryDate !== undefined || data.site !== undefined) {
      // 現在の売主データを取得して、更新されないフィールドの値を使用
      const { data: currentSeller } = await this.table('sellers')
        .select('inquiry_date, site')
        .eq('id', sellerId)
        .single();
      
      const inquiryDateForCalc = data.inquiryDate !== undefined ? data.inquiryDate : currentSeller?.inquiry_date;
      const siteForCalc = data.site !== undefined ? data.site : currentSeller?.site;
      
      const exclusionDate = ExclusionDateCalculator.calculateExclusionDate(
        inquiryDateForCalc,
        siteForCalc
      );
      updates.exclusion_date = exclusionDate || null;
    }
    if (data.isUnreachable !== undefined) {
      updates.is_unreachable = data.isUnreachable;
      if (data.isUnreachable) {
        updates.unreachable_since = new Date();
      } else {
        updates.unreachable_since = null;
      }
    }
    if (data.confidenceLevel !== undefined) {
      updates.confidence = data.confidenceLevel;
    }
    if (data.firstCallerInitials !== undefined) {
      // First caller immutability check - only allow if not already set
      const { data: currentSeller } = await this.table('sellers')
        .select('first_caller_initials')
        .eq('id', sellerId)
        .single();
      
      if (currentSeller?.first_caller_initials) {
        throw new Error('First caller cannot be modified once set');
      }
      updates.first_caller_initials = data.firstCallerInitials;
    }
    if (data.duplicateConfirmed !== undefined) {
      updates.duplicate_confirmed = data.duplicateConfirmed;
      if (data.duplicateConfirmed) {
        updates.duplicate_confirmed_at = new Date();
        // duplicate_confirmed_by should be set by the calling code
      }
    }

    // assignee fields (call-mode-assignee-section)
    if ((data as any).unreachableSmsAssignee !== undefined) {
      updates.unreachable_sms_assignee = (data as any).unreachableSmsAssignee;
    }
    if ((data as any).valuationSmsAssignee !== undefined) {
      updates.valuation_sms_assignee = (data as any).valuationSmsAssignee;
    }
    if ((data as any).valuationReasonEmailAssignee !== undefined) {
      updates.valuation_reason_email_assignee = (data as any).valuationReasonEmailAssignee;
    }
    if ((data as any).valuationReason !== undefined) {
      updates.valuation_reason = (data as any).valuationReason;
    }
    if ((data as any).cancelNoticeAssignee !== undefined) {
      updates.cancel_notice_assignee = (data as any).cancelNoticeAssignee;
    }
    if ((data as any).longTermEmailAssignee !== undefined) {
      updates.long_term_email_assignee = (data as any).longTermEmailAssignee;
    }
    if ((data as any).callReminderEmailAssignee !== undefined) {
      updates.call_reminder_email_assignee = (data as any).callReminderEmailAssignee;
    }
    if ((data as any).visitReminderAssignee !== undefined) {
      updates.visit_reminder_assignee = (data as any).visitReminderAssignee;
    }
    if ((data as any).unreachableStatus !== undefined) {
      updates.unreachable_status = (data as any).unreachableStatus;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update');
    }

    console.log('💾 Updating seller with:', {
      sellerId,
      updates: {
        ...updates,
        phone_number: updates.phone_number ? `${updates.phone_number.substring(0, 20)}...` : undefined,
      },
    });

    const { data: seller, error } = await this.table('sellers')
      .update(updates)
      .eq('id', sellerId)
      .select()
      .single();

    if (error) {
      console.error('❌ Update seller error:', error);
      throw new Error(`Failed to update seller: ${error.message}`);
    }

    if (!seller) {
      throw new Error('Seller not found after update');
    }

    console.log('✅ Updated seller from DB:', {
      id: seller.id,
      phone_number: (seller as any).phone_number ? `${(seller as any).phone_number.substring(0, 20)}...` : 'empty',
      raw_phone_number_length: (seller as any).phone_number?.length || 0,
    });

    // データベースから再度取得して確認
    const { data: verifyData, error: verifyError } = await this.table('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();

    if (!verifyError && verifyData) {
      console.log('🔍 Verification - Data in DB:', {
        id: verifyData.id,
        phone_number_exists: !!verifyData.phone_number,
        phone_number_length: verifyData.phone_number?.length || 0,
        phone_number_preview: verifyData.phone_number ? `${verifyData.phone_number.substring(0, 20)}...` : 'null',
      });
    }

    const decryptedSeller = await this.decryptSeller(seller);

    // キャッシュを無効化（インメモリ + Redis）
    invalidateSellerCache(sellerId); // インメモリキャッシュを即座に無効化
    invalidateListSellersCache(); // リストキャッシュも無効化
    await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（売主データ変更により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');

    // スプレッドシートに同期（非同期）
    const activeSyncQueue2 = this.getActiveSyncQueue();
    if (activeSyncQueue2) {
      await activeSyncQueue2.enqueue({
        type: 'update',
        sellerId: sellerId,
      });
    }

    return decryptedSeller;
  }

  /**
   * 売主情報を更新し、予約情報があればカレンダーイベントを作成/更新
   */
  async updateSellerWithAppointment(
    sellerId: string,
    data: UpdateSellerRequest & { appointmentDate?: string; assignedTo?: string; appointmentNotes?: string },
    creatorEmployeeId: string
  ): Promise<Seller> {
    console.log('📅 Updating seller with appointment:', {
      sellerId,
      appointmentDate: data.appointmentDate,
      assignedTo: data.assignedTo,
    });

    // まず売主情報を更新
    const updatedSeller = await this.updateSeller(sellerId, data);

    // 予約情報がある場合、カレンダーイベントを作成/更新
    if (data.appointmentDate && data.assignedTo) {
      try {
        const calendarService = new CalendarService();

        // 売主の詳細情報を取得
        const { data: property } = await this.table('properties')
          .select('*')
          .eq('seller_id', sellerId)
          .single();

        if (!property) {
          console.warn('⚠️  Property not found for seller, skipping calendar event');
          return updatedSeller;
        }

        // 担当者の情報を取得
        const { data: assignedEmployee } = await this.table('employees')
          .select('id, name, email')
          .eq('id', data.assignedTo)
          .single();

        if (!assignedEmployee) {
          console.warn('⚠️  Assigned employee not found, skipping calendar event');
          return updatedSeller;
        }

        console.log('📅 Creating/updating calendar event for:', {
          assignedEmployeeId: assignedEmployee.id,
          assignedEmployeeName: assignedEmployee.name,
          assignedEmployeeEmail: assignedEmployee.email,
        });

        // 既存の予約があるか確認
        const { data: existingAppointments } = await this.table('appointments')
          .select('*')
          .eq('seller_id', sellerId)
          .order('created_at', { ascending: false })
          .limit(1);

        const appointmentDate = new Date(data.appointmentDate);
        const endDate = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1時間後

        if (existingAppointments && existingAppointments.length > 0) {
          const existingAppointment = existingAppointments[0];
          
          // 担当者が変更された場合は、古いイベントを削除して新しいイベントを作成
          if (existingAppointment.assigned_employee_id !== assignedEmployee.id) {
            console.log('🔄 Assigned employee changed, recreating calendar event');
            console.log('  Old employee:', existingAppointment.assigned_employee_id);
            console.log('  New employee:', assignedEmployee.id);
            
            // 古いアポイントメントを削除（カレンダーイベントも削除される）
            await calendarService.cancelAppointment(existingAppointment.id);
            
            // 新しいアポイントメントを作成
            console.log('✨ Creating new appointment for new assignee');
            await calendarService.createAppointment(
              {
                sellerId,
                employeeId: creatorEmployeeId,
                startTime: appointmentDate,
                endTime: endDate,
                location: property.address,
                assignedTo: data.assignedTo,
                assignedEmployeeId: assignedEmployee.id,
                notes: data.appointmentNotes,
                createdByName: '', // Will be filled by the service
              },
              assignedEmployee.id,
              updatedSeller.name,
              updatedSeller.phoneNumber,
              property.address
            );
          } else {
            // 担当者が同じ場合は、既存の予約を更新
            console.log('📝 Updating existing appointment (same assignee)');
            await calendarService.updateAppointment(existingAppointment.id, {
              startTime: appointmentDate,
              endTime: endDate,
              location: property.address,
              notes: data.appointmentNotes,
            });
          }
        } else {
          // 新しい予約を作成
          console.log('✨ Creating new appointment');
          await calendarService.createAppointment(
            {
              sellerId,
              employeeId: creatorEmployeeId,
              startTime: appointmentDate,
              endTime: endDate,
              location: property.address,
              assignedTo: data.assignedTo,
              assignedEmployeeId: assignedEmployee.id,
              notes: data.appointmentNotes,
              createdByName: '', // Will be filled by the service
            },
            assignedEmployee.id,
            updatedSeller.name,
            updatedSeller.phoneNumber,
            property.address
          );
        }

        console.log('✅ Calendar event created/updated successfully');
      } catch (calendarError: any) {
        console.error('❌ Failed to create/update calendar event:', calendarError.message);
        // カレンダーエラーは無視して続行（売主情報は更新済み）
      }
    }

    return updatedSeller;
  }

  /**
   * 売主リストを取得（ページネーション、フィルタ対応）
   */
  async listSellers(params: ListSellersParams): Promise<PaginatedResult<Seller>> {
    const {
      page = 1,
      pageSize = 50,
      status,
      assignedTo,
      nextCallDateFrom,
      nextCallDateTo,
      sortBy = 'inquiry_date',
      sortOrder = 'desc',
      includeDeleted = false, // デフォルトで削除済みを除外
      statusCategory, // サイドバーカテゴリフィルター
      valuationNotRequired, // 査定不要フィルター
    } = params;

    // JST今日の日付を取得
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    
    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // キャッシュキーを生成
    const cacheKey = CacheHelper.generateKey(
      'sellers:list',
      page,
      pageSize,
      status || 'all',
      assignedTo || 'all',
      sortBy,
      sortOrder,
      includeDeleted ? 'with-deleted' : 'active-only',
      statusCategory || 'all'
    );

    // キャッシュをチェック（インメモリ優先、次にRedis）
    const inMemoryCached = getListSellersCache(cacheKey);
    if (inMemoryCached) {
      console.log('✅ Cache hit for sellers list (in-memory)');
      return inMemoryCached;
    }
    const cached = await CacheHelper.get<PaginatedResult<Seller>>(cacheKey);
    if (cached) {
      console.log('✅ Cache hit for sellers list');
      setListSellersCache(cacheKey, cached); // インメモリにも保存
      return cached;
    }

    // クエリを構築（物件情報も含める）
    let query = this.table('sellers').select('*, properties(*)', { count: 'exact' });

    // デフォルトで削除済みを除外（マイグレーション051で追加済み）
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // サイドバーカテゴリフィルターを適用
    if (statusCategory && statusCategory !== 'all') {
      switch (statusCategory) {
        case 'visitDayBefore': {
          // 訪問日前日（営担あり AND 訪問日あり）→ 全件取得してJSでフィルタ
          // 前営業日ロジック（木曜訪問→2日前、それ以外→1日前）はDBでは表現できないためJS側で処理
          const { data: visitDayBeforeSellers, error: vdbError } = await this.table('sellers')
            .select('id, visit_date, visit_assignee')
            .is('deleted_at', null)
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .neq('visit_assignee', '外す')
            .not('visit_date', 'is', null);
          console.log(`[visitDayBefore] todayJST=${todayJST}, candidates=${visitDayBeforeSellers?.length ?? 0}, error=${vdbError?.message}`);
          // visitDayBefore に該当するIDを計算
          const visitDayBeforeIds = (visitDayBeforeSellers || []).filter((s: any) => {
            const vd = (s as any).visit_date;
            if (!vd) return false;
            const parts = vd.split('-');
            if (parts.length !== 3) return false;
            const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const dow = visitDate.getDay();
            const days = dow === 4 ? 2 : 1;
            const notify = new Date(visitDate);
            notify.setDate(visitDate.getDate() - days);
            const notifyStr = `${notify.getFullYear()}-${String(notify.getMonth() + 1).padStart(2, '0')}-${String(notify.getDate()).padStart(2, '0')}`;
            console.log(`[visitDayBefore] seller=${s.id} visit_date=${vd} dow=${dow} notifyStr=${notifyStr} match=${notifyStr === todayJST}`);
            return notifyStr === todayJST;
          }).map((s: any) => s.id);
          console.log(`[visitDayBefore] matched IDs: ${visitDayBeforeIds.length}`);
          if (visitDayBeforeIds.length === 0) {
            query = query.in('id', ['__no_match__']);
          } else {
            query = query.in('id', visitDayBeforeIds);
          }
          break;
        }
        case 'visitScheduled':
          // 訪問予定（営担に入力あり AND 訪問日が今日以降）
          query = query
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .gte('visit_date', todayJST);
          break;
        case 'visitCompleted':
          // 訪問済み（営担に入力あり AND 訪問日が昨日以前）
          query = query
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .lt('visit_date', todayJST);
          break;
        case 'todayCallAssigned':
          // 当日TEL（担当）（営担あり（「外す」以外） AND 次電日が今日以前 AND 追客不要を含まない）
          query = query
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .neq('visit_assignee', '外す')
            .lte('next_call_date', todayJST)
            .not('status', 'ilike', '%追客不要%');
          break;
        case 'todayCall':
          // 当日TEL分（追客中 AND 次電日が今日以前 AND コミュニケーション情報なし AND 営担なし）
          query = query
            .ilike('status', '%追客中%')
            .lte('next_call_date', todayJST)
            // 営担が空または「外す」
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            // コミュニケーション情報が全て空
            .or('phone_contact_person.is.null,phone_contact_person.eq.')
            .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
            .or('contact_method.is.null,contact_method.eq.');
          break;
        case 'todayCallWithInfo':
          // 当日TEL（内容）（追客中 AND 次電日が今日以前 AND コミュニケーション情報あり AND 営担なし）
          query = query
            .ilike('status', '%追客中%')
            .lte('next_call_date', todayJST)
            // 営担が空または「外す」
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            // コミュニケーション情報のいずれかに入力あり
            .or('phone_contact_person.neq.,preferred_contact_time.neq.,contact_method.neq.');
          break;
        case 'unvaluated':
          // 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空（「外す」含む））
          query = query
            .ilike('status', '%追客中%')
            .gte('inquiry_date', cutoffDate)
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            .is('valuation_amount_1', null)
            .is('valuation_amount_2', null)
            .is('valuation_amount_3', null)
            .or('mailing_status.is.null,mailing_status.neq.不要');
          break;
        case 'mailingPending':
          // 査定（郵送）（郵送ステータスが「未」）
          query = query.eq('mailing_status', '未');
          break;
        case 'todayCallNotStarted':
          // 当日TEL_未着手（当日TEL分の条件 + 不通が空欄 + 反響日付が2026/1/1以降）
          query = query
            .ilike('status', '%追客中%')
            .lte('next_call_date', todayJST)
            // 営担が空または「外す」
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            // コミュニケーション情報が全て空
            .or('phone_contact_person.is.null,phone_contact_person.eq.')
            .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
            .or('contact_method.is.null,contact_method.eq.')
            // 不通が空欄
            .or('unreachable_status.is.null,unreachable_status.eq.')
            // 反響日付が2026/1/1以降
            .gte('inquiry_date', '2026-01-01');
          break;
        case 'pinrichEmpty':
          // Pinrich空欄（当日TEL分の条件 + Pinrichが空欄）
          query = query
            .ilike('status', '%追客中%')
            .lte('next_call_date', todayJST)
            // 営担が空または「外す」
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            // コミュニケーション情報が全て空
            .or('phone_contact_person.is.null,phone_contact_person.eq.')
            .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
            .or('contact_method.is.null,contact_method.eq.')
            // Pinrichが空欄
            .or('pinrich_status.is.null,pinrich_status.eq.');
          break;
        default: {
          // visitAssigned:xxx または todayCallAssigned:xxx の動的カテゴリ
          const dynamicCategory = statusCategory as string;
          if (dynamicCategory.startsWith('visitAssigned:')) {
            const assignee = dynamicCategory.replace('visitAssigned:', '');
            // 訪問予定（営担が指定のイニシャル AND 訪問日が今日以降）
            query = query
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              .neq('visit_assignee', '外す')
              .eq('visit_assignee', assignee)
              .gte('visit_date', todayJST);
          } else if (dynamicCategory.startsWith('todayCallAssigned:')) {
            const assignee = dynamicCategory.replace('todayCallAssigned:', '');
            // 当日TEL（担当）（営担が指定のイニシャル AND 次電日が今日以前 AND 追客不要を含まない）
            query = query
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              .neq('visit_assignee', '外す')
              .eq('visit_assignee', assignee)
              .lte('next_call_date', todayJST)
              .not('status', 'ilike', '%追客不要%');
          }
          break;
        }
      }
    }

    // フィルタ条件を適用
    if (status) {
      query = query.eq('status', status);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (nextCallDateFrom) {
      query = query.gte('next_call_date', nextCallDateFrom);
    }
    if (nextCallDateTo) {
      query = query.lte('next_call_date', nextCallDateTo);
    }
    if (valuationNotRequired === true) {
      query = query.eq('valuation_not_required', true);
    }

    // ソート（inquiry_dateがnullのものは最後に表示、同日の場合は売主番号が大きいほうを最新とする）
    if (sortBy === 'inquiry_date') {
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .order('seller_number', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // ページネーション
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: sellers, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list sellers: ${error.message}`);
    }

    // 復号化して物件情報を追加
    const decryptedSellers = await Promise.all((sellers || []).map(async (seller) => {
      const decrypted = await this.decryptSeller(seller);
      
      // 物件情報を追加（配列の場合は最初の要素を使用）
      if (seller.properties) {
        const property = Array.isArray(seller.properties) ? seller.properties[0] : seller.properties;
        if (property) {
          decrypted.property = {
            id: property.id,
            sellerId: property.seller_id,
            address: property.property_address || property.address, // property_addressを優先
            prefecture: property.prefecture,
            city: property.city,
            propertyType: property.property_type,
            landArea: property.land_area,
            buildingArea: property.building_area,
            landAreaVerified: property.land_area_verified,
            buildingAreaVerified: property.building_area_verified,
            buildYear: property.construction_year || property.build_year, // construction_yearを優先
            structure: property.structure,
            floorPlan: property.floor_plan,
            floors: property.floors,
            rooms: property.rooms,
            sellerSituation: property.current_status || property.seller_situation, // current_statusを優先
            parking: property.parking,
            additionalInfo: property.additional_info,
          };
        }
      }
      
      return decrypted;
    }));

    // 各売主の最新通話日時を取得（一時的にコメントアウト）
    // const sellersWithCallDate = await Promise.all(
    //   decryptedSellers.map(async (seller) => {
    //     const { data: latestCall } = await this.table('activities')
    //       .select('created_at')
    //       .eq('seller_id', seller.id)
    //       .eq('type', 'phone_call')
    //       .order('created_at', { ascending: false })
    //       .limit(1)
    //       .single();

    //     return {
    //       ...seller,
    //       lastCallDate: latestCall?.created_at || null,
    //     };
    //   })
    // );

    const result = {
      data: decryptedSellers,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };

    // キャッシュに保存（インメモリ + Redis）
    // 日付依存カテゴリ（visitDayBefore等）はキャッシュしない（日付が変わると結果が変わるため）
    const skipCache = statusCategory === 'visitDayBefore' || statusCategory === 'visitCompleted';
    if (!skipCache) {
      setListSellersCache(cacheKey, result);
      await CacheHelper.set(cacheKey, result, CACHE_TTL.SELLER_LIST);
    }

    return result;
  }

  /**
   * 売主を検索（部分一致）
   * 最適化: 売主番号での検索は高速化（暗号化されていないため）
   * @param query - 検索クエリ
   * @param includeDeleted - 削除済み売主も含めるか（デフォルト: false）
   */
  async searchSellers(query: string, includeDeleted: boolean = false): Promise<Seller[]> {
    console.log('🔍 searchSellers called with query:', query);
    
    const lowerQuery = query.toLowerCase().trim();
    
    // 売主番号での検索を優先（暗号化されていないので高速）
    // AA12903のような形式の場合、データベースで直接検索
    if (lowerQuery.match(/^aa\d+$/i)) {
      console.log('🚀 Fast path: Searching by seller_number in database');

      // まず完全一致で検索（AA6 → AA6のみ、AA60等を除外）
      const upperQuery = lowerQuery.toUpperCase();
      let exactQuery = this.table('sellers')
        .select('*')
        .eq('seller_number', upperQuery);
      if (!includeDeleted) {
        exactQuery = exactQuery.is('deleted_at', null);
      }
      const { data: exactSellers, error: exactError } = await exactQuery;
      if (exactError) {
        throw new Error(`Failed to search sellers by exact number: ${exactError.message}`);
      }
      if (exactSellers && exactSellers.length > 0) {
        console.log(`✅ Found exact match for seller_number: ${upperQuery}`);
        const decryptedSellers = await Promise.all(exactSellers.map(seller => this.decryptSeller(seller)));
        return decryptedSellers;
      }

      // 完全一致がなければ前方一致で検索（AA6 → AA60, AA61...）
      let sellerQuery = this.table('sellers')
        .select('*')
        .ilike('seller_number', `${lowerQuery}%`)
        .order('seller_number', { ascending: true })
        .limit(50);
      
      // デフォルトで削除済みを除外（マイグレーション051で追加済み）
      if (!includeDeleted) {
        sellerQuery = sellerQuery.is('deleted_at', null);
      }
      
      const { data: sellers, error } = await sellerQuery;

      if (error) {
        throw new Error(`Failed to search sellers by number: ${error.message}`);
      }

      if (sellers && sellers.length > 0) {
        console.log(`✅ Found ${sellers.length} sellers by seller_number`);
        const decryptedSellers = await Promise.all(sellers.map(seller => this.decryptSeller(seller)));
        return decryptedSellers;
      }
    }
    
    // 数字のみの場合も売主番号として検索
    if (lowerQuery.match(/^\d+$/)) {
      console.log('🚀 Fast path: Searching by seller_number (numeric) in database');
      let sellerQuery = this.table('sellers')
        .select('*')
        .ilike('seller_number', `%${lowerQuery}%`)
        .order('seller_number', { ascending: true })
        .limit(50);
      
      // デフォルトで削除済みを除外
      if (!includeDeleted) {
        sellerQuery = sellerQuery.is('deleted_at', null);
      }
      
      const { data: sellers, error } = await sellerQuery;

      if (error) {
        throw new Error(`Failed to search sellers by number: ${error.message}`);
      }

      if (sellers && sellers.length > 0) {
        console.log(`✅ Found ${sellers.length} sellers by seller_number`);
        const decryptedSellers = await Promise.all(sellers.map(seller => this.decryptSeller(seller)));
        return decryptedSellers;
      }
    }
    
    // 名前、住所、電話番号での検索は全件取得が必要（暗号化されているため）
    console.log('⚠️  Slow path: Full scan required for encrypted field search');
    
    // 最大100件に制限して検索速度を改善
    let sellerQuery = this.table('sellers')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      sellerQuery = sellerQuery.is('deleted_at', null);
    }
    
    const { data: sellers, error } = await sellerQuery;

    if (error) {
      throw new Error(`Failed to search sellers: ${error.message}`);
    }

    if (!sellers || sellers.length === 0) {
      return [];
    }

    console.log(`📊 Retrieved ${sellers.length} recent sellers for search`);

    const decryptedSellers: Seller[] = [];
    for (const seller of sellers) {
      try {
        const decrypted = await this.decryptSeller(seller);
        decryptedSellers.push(decrypted);
      } catch (error) {
        console.error(`❌ Failed to decrypt seller ${seller.id}:`, error);
        // Skip this seller and continue
      }
    }

    // 復号化後に部分一致検索
    const results = decryptedSellers.filter(
      (seller) =>
        (seller.name && seller.name.toLowerCase().includes(lowerQuery)) ||
        (seller.address && seller.address.toLowerCase().includes(lowerQuery)) ||
        (seller.phoneNumber && seller.phoneNumber.toLowerCase().includes(lowerQuery)) ||
        (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery))
    );

    console.log(`🎯 Found ${results.length} matching sellers`);
    
    return results;
  }

  /**
   * 売主データを復号化
   */
  private async decryptSeller(seller: any): Promise<Seller> {
    const _dt0 = Date.now();
    try {
      // モジュールレベルのインメモリキャッシュからイニシャルマップを同期的に取得
      // Redis await を排除してパフォーマンスを改善
      const initialsMap = getInitialsMap();
      const visitAssigneeFullName = seller.visit_assignee ? (initialsMap[seller.visit_assignee] || null) : null;
      const visitValuationAcquirerFullName = seller.visit_valuation_acquirer ? (initialsMap[seller.visit_valuation_acquirer] || null) : null;
      console.log(`[PERF] decryptSeller getEmployeeNames (sync): ${Date.now() - _dt0}ms`);

      const decrypted = {
        id: seller.id,
        name: seller.name ? decrypt(seller.name) : '',
        address: seller.address ? decrypt(seller.address) : '',
        phoneNumber: seller.phone_number ? decrypt(seller.phone_number) : '',
        email: seller.email ? decrypt(seller.email) : undefined,
        status: seller.status,
        confidence: seller.confidence_level,
        assignedTo: seller.assigned_to,
        appointmentDate: seller.appointment_date,
        appointmentNotes: seller.appointment_notes,
        nextCallDate: seller.next_call_date,
        createdAt: seller.created_at ? new Date(seller.created_at) : new Date(),
        updatedAt: new Date(seller.updated_at),
        // Phase 1 fields
        sellerNumber: seller.seller_number,
        inquirySource: seller.inquiry_source,
        inquiryYear: seller.inquiry_year,
        inquiryDate: seller.inquiry_date ? new Date(seller.inquiry_date) : undefined,
        inquiryDatetime: seller.inquiry_detailed_datetime ? new Date(seller.inquiry_detailed_datetime) : undefined,
        inquiryDetailedDatetime: seller.inquiry_detailed_datetime ? new Date(seller.inquiry_detailed_datetime) : undefined,
        isUnreachable: seller.is_unreachable || false,
        unreachableStatus: seller.unreachable_status, // 不通ステータス（文字列）
        unreachableSince: seller.unreachable_since ? new Date(seller.unreachable_since) : undefined,
        firstCallerInitials: seller.first_caller_initials,
        firstCallerEmployeeId: seller.first_caller_employee_id,
        confidenceLevel: seller.confidence_level,
        duplicateConfirmed: seller.duplicate_confirmed || false,
        duplicateConfirmedAt: seller.duplicate_confirmed_at ? new Date(seller.duplicate_confirmed_at) : undefined,
        duplicateConfirmedBy: seller.duplicate_confirmed_by,
        fixedAssetTaxRoadPrice: seller.fixed_asset_tax_road_price,
        valuationAmount1: seller.valuation_amount_1,
        valuationAmount2: seller.valuation_amount_2,
        valuationAmount3: seller.valuation_amount_3,
        valuationAssignedBy: seller.valuation_assigned_by,
        // 競合情報フィールド
        competitorName: seller.competitor_name,
        competitorNameAndReason: seller.competitor_name_and_reason,
        exclusiveOtherDecisionFactors: seller.exclusive_other_decision_factor 
          ? seller.exclusive_other_decision_factor.split(', ').filter((f: string) => f.trim())
          : [],
        otherDecisionCountermeasure: seller.other_decision_countermeasure,
        contractYearMonth: seller.contract_year_month,
        exclusiveOtherDecisionMeeting: seller.exclusive_other_decision_meeting,
        // Site field
        inquirySite: seller.inquiry_site,
        site: seller.inquiry_site,  // 後方互換性のため残す
        // Exclusion date field
        exclusionDate: seller.exclusion_date ? new Date(seller.exclusion_date) : undefined,
        // Exclusion action field
        exclusionAction: seller.exclusion_action,
        // Comments field
        comments: seller.comments,
        // Visit appointment fields
        visitDate: seller.visit_date ? new Date(seller.visit_date) : undefined,
        visitTime: seller.visit_time,
        visitAcquisitionDate: seller.visit_acquisition_date ? new Date(seller.visit_acquisition_date) : undefined,
        // イニシャルをフルネームに変換（フォールバック付き）
        visitAssignee: visitAssigneeFullName || seller.visit_assignee || undefined,
        visitAssigneeInitials: seller.visit_assignee || undefined, // 元のイニシャルを保持
        visitValuationAcquirer: visitValuationAcquirerFullName || seller.visit_valuation_acquirer || undefined,
        valuationAssignee: seller.valuation_assignee,
        phoneAssignee: seller.phone_assignee,
        // Communication fields
        phoneContactPerson: seller.phone_contact_person,
        preferredContactTime: seller.preferred_contact_time,
        contactMethod: seller.contact_method,
        firstCallPerson: seller.first_call_person,
        // New call mode fields (migration 032)
        inquiryMedium: seller.inquiry_medium,
        inquiryContent: seller.inquiry_content,
        saleReason: seller.sale_reason,
        desiredTiming: seller.desired_timing,
        desiredPrice: seller.desired_price,
        notes: seller.notes,
        visitNotes: seller.visit_notes,
        // Mailing status fields
        mailingStatus: seller.mailing_status,
        mailSentDate: seller.mail_sent_date ? new Date(seller.mail_sent_date) : undefined,
        // Valuation method field
        valuationMethod: seller.valuation_method,
        // Valuation text field (I列「査定額」テキスト形式)
        valuationText: seller.valuation_text,
        // 内覧前伝達事項と最新状況
        viewingNotes: seller.viewing_notes,
        latestStatus: seller.latest_status,
        // Pinrich status
        pinrichStatus: seller.pinrich_status,
        // Property fields (物件関連フィールド)
        propertyAddress: seller.property_address,
        propertyType: seller.property_type,
        landArea: seller.land_area,
        buildingArea: seller.building_area,
        landAreaVerified: seller.land_area_verified,
        buildingAreaVerified: seller.building_area_verified,
        buildYear: seller.build_year,
        structure: seller.structure,
        floorPlan: seller.floor_plan,
        currentStatus: seller.current_status, // 状況（売主）
        // 担当者設定フィールド（call-mode-assignee-section）
        unreachableSmsAssignee: seller.unreachable_sms_assignee,
        valuationSmsAssignee: seller.valuation_sms_assignee,
        valuationReasonEmailAssignee: seller.valuation_reason_email_assignee,
        valuationReason: seller.valuation_reason,
        cancelNoticeAssignee: seller.cancel_notice_assignee,
        longTermEmailAssignee: seller.long_term_email_assignee,
        callReminderEmailAssignee: seller.call_reminder_email_assignee,
        visitReminderAssignee: seller.visit_reminder_assignee,
      };
      
      console.log(`[PERF] decryptSeller total: ${Date.now() - _dt0}ms`);
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error for seller:', seller.id, seller.seller_number);
      console.error('Error details:', error);
      console.error('Raw seller data:', {
        name_exists: !!seller.name,
        name_length: seller.name?.length,
        address_exists: !!seller.address,
        address_length: seller.address?.length,
        phone_number_exists: !!seller.phone_number,
        phone_number_length: seller.phone_number?.length,
      });
      throw error;
    }
  }

  /**
   * Phase 1: Mark seller as unreachable
   */
  async markAsUnreachable(sellerId: string): Promise<Seller> {
    const { data: seller, error } = await this.table('sellers')
      .update({
        is_unreachable: true,
        unreachable_since: new Date(),
      })
      .eq('id', sellerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark seller as unreachable: ${error.message}`);
    }

    if (!seller) {
      throw new Error('Seller not found');
    }

    // キャッシュを無効化
    const cacheKey = CacheHelper.generateKey('seller', sellerId);
    await CacheHelper.del(cacheKey);

    return await this.decryptSeller(seller);
  }

  /**
   * Phase 1: Clear unreachable status
   */
  async clearUnreachable(sellerId: string): Promise<Seller> {
    const { data: seller, error } = await this.table('sellers')
      .update({
        is_unreachable: false,
        unreachable_since: null,
      })
      .eq('id', sellerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to clear unreachable status: ${error.message}`);
    }

    if (!seller) {
      throw new Error('Seller not found');
    }

    // キャッシュを無効化
    const cacheKey = CacheHelper.generateKey('seller', sellerId);
    await CacheHelper.del(cacheKey);

    return await this.decryptSeller(seller);
  }

  /**
   * Phase 1: Confirm duplicate seller
   */
  async confirmDuplicate(sellerId: string, employeeId: string): Promise<Seller> {
    const { data: seller, error } = await this.table('sellers')
      .update({
        duplicate_confirmed: true,
        duplicate_confirmed_at: new Date(),
        duplicate_confirmed_by: employeeId,
      })
      .eq('id', sellerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to confirm duplicate: ${error.message}`);
    }

    if (!seller) {
      throw new Error('Seller not found');
    }

    // キャッシュを無効化
    const cacheKey = CacheHelper.generateKey('seller', sellerId);
    await CacheHelper.del(cacheKey);

    return await this.decryptSeller(seller);
  }

  /**
   * Phase 1: Get duplicate history for a seller
   */
  async getDuplicateHistory(sellerId: string) {
    return duplicateDetectionService.instance.getDuplicateHistory(sellerId);
  }

  /**
   * Phase 1: Check for duplicate sellers
   */
  async checkDuplicates(phoneNumber: string, email?: string, excludeId?: string) {
    const encryptedPhone = encrypt(phoneNumber);
    const encryptedEmail = email ? encrypt(email) : undefined;
    return duplicateDetectionService.instance.checkDuplicates(encryptedPhone, encryptedEmail, excludeId);
  }

  /**
   * 訪問統計を取得
   * @param month - 対象月（YYYY-MM形式）
   */
  async getVisitStats(month: string) {
    console.log('📊 getVisitStats called with month:', month);
    
    // 月の開始日と終了日を計算
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // 前月の最終日
    endDate.setHours(23, 59, 59, 999);

    console.log('Date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // 訪問予約がある売主を取得（visit_dateを使用）
    // visit_dateはDATE型なのでYYYY-MM-DD形式で比較
    const startDateStr = `${month}-01`;
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const { data: sellers, error } = await this.table('sellers')
      .select(`
        id,
        visit_assignee,
        visit_date
      `)
      .gte('visit_date', startDateStr)
      .lte('visit_date', endDateStr);

    console.log('Query result:', {
      sellersCount: sellers?.length || 0,
      error: error?.message,
    });

    if (error) {
      throw new Error(`Failed to get visit stats: ${error.message}`);
    }

    // 従業員一覧を取得してイニシャルから名前を解決
    const { data: employees } = await this.table('employees')
      .select('id, name, initials, email');
    
    const employeeMap = new Map<string, { id: string; name: string; initials: string }>();
    for (const emp of employees || []) {
      // イニシャルでマッピング
      if (emp.initials) {
        employeeMap.set(emp.initials, { id: emp.id, name: emp.name || emp.email, initials: emp.initials });
      }
      // 名前でもマッピング
      if (emp.name) {
        employeeMap.set(emp.name, { id: emp.id, name: emp.name, initials: emp.initials || emp.name });
      }
    }

    // 営担ごとの訪問数を集計
    const statsByEmployee: Record<string, { count: number; name: string; initials: string; employeeId: string }> = {};
    let totalVisits = 0;

    for (const seller of sellers || []) {
      // visit_assigneeを使用
      const assignee = (seller as any).visit_assignee;
      
      if (assignee) {
        // イニシャルまたは名前から従業員情報を取得
        const employee = employeeMap.get(assignee);
        const employeeKey = assignee; // イニシャルをキーとして使用
        const employeeName = employee?.name || assignee;
        const employeeInitials = employee?.initials || assignee;
        const employeeId = employee?.id || assignee;

        if (!statsByEmployee[employeeKey]) {
          statsByEmployee[employeeKey] = {
            count: 0,
            name: employeeName,
            initials: employeeInitials,
            employeeId: employeeId,
          };
        }

        statsByEmployee[employeeKey].count++;
        totalVisits++;
      }
    }

    // 山本マネージャーの訪問率を計算
    // イニシャルがY（山本）のスタッフを探す
    const yamamoto = Object.values(statsByEmployee).find(
      (stat) => stat.name.includes('山本') || stat.initials === 'Y'
    );

    const yamamotoRate = yamamoto && totalVisits > 0 
      ? (yamamoto.count / totalVisits) * 100 
      : 0;

    return {
      month,
      totalVisits,
      statsByEmployee: Object.values(statsByEmployee).sort((a, b) => b.count - a.count),
      yamamotoStats: yamamoto ? {
        count: yamamoto.count,
        rate: yamamotoRate,
        name: yamamoto.name,
        initials: yamamoto.initials,
      } : null,
    };
  }

  /**
   * 内覧前伝達事項をサニタイズ
   * @param value - 内覧前伝達事項の値
   * @returns サニタイズされた値（10,000文字以内）またはnull
   */
  private sanitizeViewingNotes(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') {
      return null;
    }
    // 10,000文字制限
    return value.substring(0, 10000);
  }

  /**
   * 最新状況をサニタイズ
   * @param value - 最新状況の値
   * @returns サニタイズされた値（255文字以内）またはnull
   */
  private sanitizeLatestStatus(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') {
      return null;
    }
    // 255文字制限
    return value.substring(0, 255);
  }

  /**
   * 担当者（visit_assignee）のユニーク一覧を取得
   * サイドバーの担当者別カテゴリー表示用
   * 「外す」と空文字は除外する
   */
  async getUniqueAssigneeInitials(): Promise<string[]> {
    const { data, error } = await this.table('sellers')
      .select('visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す');

    if (error) {
      console.error('getUniqueAssigneeInitials error:', error);
      return [];
    }

    // ユニークな値を抽出してソート
    const unique = [...new Set((data || []).map((row: any) => row.visit_assignee as string))]
      .filter(Boolean)
      .sort();

    return unique;
  }

  /**
   * サイドバー用のカテゴリカウントを取得
   * 各カテゴリの条件に合う売主のみをデータベースから直接カウント
   * 
   * 【優先順位】
   * 1. 訪問予定（営担あり + 訪問日が今日以降）← 最優先
   * 2. 訪問済み（営担あり + 訪問日が昨日以前）← 2番目
   * 3. 当日TEL（担当）（営担あり + 次電日が今日以前）← 3番目
   * 4. 当日TEL分/当日TEL（内容）← 営担なしの場合のみ
   */
  async getSidebarCounts(): Promise<{
    todayCall: number;
    todayCallWithInfo: number;
    todayCallAssigned: number;
    visitDayBefore: number;
    visitCompleted: number;
    unvaluated: number;
    mailingPending: number;
    todayCallNotStarted: number;
    pinrichEmpty: number;
    visitAssignedCounts: Record<string, number>;
    todayCallAssignedCounts: Record<string, number>;
    todayCallWithInfoLabels: string[];
    todayCallWithInfoLabelCounts: Record<string, number>;
  }> {
    // キャッシュキー（日付を含めることで日付変更時に自動無効化）
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    const sidebarCacheKey = `sellers:sidebar-counts:${todayJST}`;

    // キャッシュをチェック（60秒TTL）
    const cachedCounts = await CacheHelper.get<{
      todayCall: number;
      todayCallWithInfo: number;
      todayCallAssigned: number;
      visitDayBefore: number;
      visitCompleted: number;
      unvaluated: number;
      mailingPending: number;
      todayCallNotStarted: number;
      pinrichEmpty: number;
      visitAssignedCounts: Record<string, number>;
      todayCallAssignedCounts: Record<string, number>;
      todayCallWithInfoLabels: string[];
      todayCallWithInfoLabelCounts: Record<string, number>;
    }>(sidebarCacheKey);
    if (cachedCounts) {
      console.log('✅ Cache hit for sidebar counts');
      return cachedCounts;
    }

    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // ヘルパー関数: 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）
    const hasValidVisitAssignee = (visitAssignee: string | null | undefined): boolean => {
      if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
        return false;
      }
      return true;
    };

    // 1. 訪問日前日（営担に入力あり AND 訪問日あり）← 前営業日ロジックをJSで計算
    // 木曜訪問の場合は2日前（水曜定休のため火曜に通知）、それ以外は1日前
    const { data: visitAssigneeSellers } = await this.table('sellers')
      .select('visit_date, visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .not('visit_date', 'is', null);

    // 前営業日ロジック: 今日が訪問日の前営業日かどうかを判定
    // visit_date は "YYYY-MM-DD" 形式。ローカル日付として扱うため T00:00:00 のみ付与（タイムゾーン指定なし）
    const visitDayBeforeCount = (visitAssigneeSellers || []).filter(s => {
      const visitDateStr = s.visit_date;
      if (!visitDateStr) return false;
      // YYYY-MM-DD をローカル日付として解釈（タイムゾーンオフセットなし）
      const parts = visitDateStr.split('-');
      if (parts.length !== 3) return false;
      const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const visitDayOfWeek = visitDate.getDay(); // 0=日, 1=月, ..., 4=木, ...
      // 木曜訪問の場合は2日前（火曜）、それ以外は1日前
      const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
      const expectedNotifyDate = new Date(visitDate);
      expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
      const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
      return expectedNotifyStr === todayJST;
    }).length;

    // 2. 訪問済み（営担に入力あり AND 訪問日が昨日以前）← 2番目
    const { count: visitCompletedCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .lt('visit_date', todayJST);

    // 3. 当日TEL（担当）（営担あり + 次電日が今日以前 + 追客不要を含まない）
    // 訪問日の有無に関係なく、営担があり次電日が今日以前であれば対象
    const { data: todayCallAssignedSellers } = await this.table('sellers')
      .select('id, visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す')
      .lte('next_call_date', todayJST)
      .not('status', 'ilike', '%追客不要%');

    const todayCallAssignedCount = (todayCallAssignedSellers || []).length;

    // 担当者別カウント（visitAssignedCounts）: 営担あり（「外す」以外）の売主の全件数
    // 次電日条件・追客不要除外は不要（担当に割り当てられている全売主を対象）
    const { data: allAssignedSellers } = await this.table('sellers')
      .select('visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .neq('visit_assignee', '外す');

    const visitAssignedCounts: Record<string, number> = {};
    (allAssignedSellers || []).forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) visitAssignedCounts[a] = (visitAssignedCounts[a] || 0) + 1;
    });

    // 当日TEL（担当）の担当者別カウント（todayCallAssignedCounts）
    const todayCallAssignedCounts: Record<string, number> = {};
    (todayCallAssignedSellers || []).forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) todayCallAssignedCounts[a] = (todayCallAssignedCounts[a] || 0) + 1;
    });

    // 4. 当日TEL分/当日TEL（内容）
    // 追客中/除外後追客中/他決→追客 AND 次電日が今日以前 AND 営担なしの売主を取得
    // 「除外後追客中」は「追客中」を含むので ilike('%追客中%') でヒットする
    // 「他決→追客」は「追客中」を含まないため、別途 eq で取得してマージする
    const [todayCallBaseResult1, todayCallBaseResult2] = await Promise.all([
      // 「追客中」「除外後追客中」を含む（ilike）
      this.table('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
      // 「他決→追客」（完全一致）
      this.table('sellers')
        .select('id, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .eq('status', '他決→追客')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
    ]);
    // 重複を除いてマージ（idで重複排除）
    const allTodayCallBase = [...(todayCallBaseResult1.data || []), ...(todayCallBaseResult2.data || [])];
    const seenIds = new Set<string>();
    const todayCallBaseSellers = allTodayCallBase.filter(s => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    // 営担がある売主を除外（訪問日の有無に関係なく）
    const filteredTodayCallSellers = (todayCallBaseSellers || []).filter(s => {
      // 営担に入力がある場合は当日TEL分/当日TEL（内容）から除外
      return !hasValidVisitAssignee(s.visit_assignee);
    });

    // コミュニケーション情報があるものをカウント（当日TEL（内容））
    const todayCallWithInfoSellers = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return hasInfo;
    });
    const todayCallWithInfoCount = todayCallWithInfoSellers.length;

    // 当日TEL（内容）のユニークラベル一覧を生成（表示優先順位: contact_method > preferred_contact_time > phone_contact_person）
    const labelCountMap: Record<string, number> = {};
    todayCallWithInfoSellers.forEach(s => {
      const content = s.contact_method?.trim() || s.preferred_contact_time?.trim() || s.phone_contact_person?.trim() || '';
      const label = `当日TEL(${content})`;
      labelCountMap[label] = (labelCountMap[label] || 0) + 1;
    });
    const todayCallWithInfoLabels = Object.keys(labelCountMap);

    // コミュニケーション情報がないものをカウント（当日TEL分）
    const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return !hasInfo;
    }).length;

    // 5. 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空）
    const { data: unvaluatedSellers } = await this.table('sellers')
      .select('id, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, mailing_status')
      .is('deleted_at', null)
      .ilike('status', '%追客中%')
      .gte('inquiry_date', cutoffDate)
      .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す');

    // 査定額が全て空で、郵送ステータスが「不要」でないものをカウント
    const unvaluatedCount = (unvaluatedSellers || []).filter(s => {
      const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
      const isNotRequired = s.mailing_status === '不要';
      return hasNoValuation && !isNotRequired;
    }).length;

    // 6. 査定（郵送）（郵送ステータスが「未」）
    const { count: mailingPendingCount } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('mailing_status', '未');

    // 7. 当日TEL_未着手（当日TEL分の条件 + 不通が空欄 + 反響日付が2026/1/1以降 + 確度チェック + 除外日チェック）
    // APPSHEETの「当日TEL分_未着手」条件:
    // - 状況（当社）= "追客中"（完全一致）
    // - 営担 = ""
    // - 不通 = ""
    // - 確度 <> "ダブり", "D", "AI査定"
    // - 次電日 <= TODAY()
    // - 除外日にすること = ""
    // - 反響日付 >= 2026/1/1（独自設定）
    const todayCallNotStartedCount = filteredTodayCallSellers.filter(s => {
      // コミュニケーション情報が全て空（当日TEL分の条件）
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      // 状況が「追客中」のみ（完全一致、「除外後追客中」「他決→追客」は除外）
      const status = (s as any).status || '';
      if (status !== '追客中') return false;
      // 不通が空欄
      const unreachable = (s as any).unreachable_status || '';
      if (unreachable && unreachable.trim() !== '') return false;
      // 確度が「ダブり」「D」「AI査定」の場合は除外
      const confidence = (s as any).confidence_level || '';
      if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
      // 除外日にすること が空かチェック
      const exclusionDate = (s as any).exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') return false;
      // 反響日付が2026/1/1以降
      const inquiryDate = (s as any).inquiry_date || '';
      return inquiryDate >= '2026-01-01';
    }).length;

    // 8. Pinrich空欄（当日TEL分の条件 + Pinrichが空欄）
    const pinrichEmptyCount = filteredTodayCallSellers.filter(s => {
      // コミュニケーション情報が全て空（当日TEL分の条件）
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      // Pinrichが空欄
      const pinrich = (s as any).pinrich_status || '';
      return !pinrich || pinrich.trim() === '';
    }).length;

    const sidebarResult = {
      todayCall: todayCallNoInfoCount || 0,
      todayCallWithInfo: todayCallWithInfoCount || 0,
      todayCallAssigned: todayCallAssignedCount || 0,
      visitDayBefore: visitDayBeforeCount || 0,
      visitCompleted: visitCompletedCount || 0,
      unvaluated: unvaluatedCount || 0,
      mailingPending: mailingPendingCount || 0,
      todayCallNotStarted: todayCallNotStartedCount || 0,
      pinrichEmpty: pinrichEmptyCount || 0,
      visitAssignedCounts,
      todayCallAssignedCounts,
      todayCallWithInfoLabels,
      todayCallWithInfoLabelCounts: labelCountMap,
    };

    // キャッシュに保存（60秒TTL）
    await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SELLER_LIST);

    return sidebarResult;
  }
}

