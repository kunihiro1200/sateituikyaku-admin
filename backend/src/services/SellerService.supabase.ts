import { BaseRepository } from '../repositories/BaseRepository';
import * as crypto from 'crypto';
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
const SELLER_CACHE_TTL_MS = 0; // キャッシュ無効化（Vercelサーバーレス環境ではインスタンス間でキャッシュが共有されないため）

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

export function invalidateSellerCache(sellerId: string): void {
  _sellerCache.delete(sellerId);
}

// listSellers 用インメモリキャッシュ（60秒TTL）
// Redis が遅い/未接続の場合でも高速レスポンスを返すための前段キャッシュ
const _listSellersCache = new Map<string, { data: any; expiresAt: number }>();
const LIST_SELLERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5分（Vercelコールドスタート対策）

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

export function invalidateListSellersCache(): void {
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

    // 個人情報を暗号化（address は暗号化対象外）
    const encryptedData = {
      name: encrypt(data.name),
      address: data.address,
      phone_number: encryptedPhone,
      email: encryptedEmail || null,
      // 重複検出用ハッシュ（SHA-256）
      phone_number_hash: data.phoneNumber ? crypto.createHash('sha256').update(data.phoneNumber).digest('hex') : null,
      email_hash: data.email ? crypto.createHash('sha256').update(data.email).digest('hex') : null,
      status: (data as any).status || SellerStatus.FOLLOWING_UP,
      // Phase 1 fields
      seller_number: sellerNumber,
      inquiry_source: data.inquirySource,
      inquiry_year: data.inquiryYear,
      inquiry_date: data.inquiryDate,
      inquiry_detailed_datetime: (data as any).inquiryDetailedDateTime || data.inquiryDatetime || null,
      confidence_level: (data as any).confidence || data.confidenceLevel || null,
      first_caller_initials: data.firstCallerInitials || null,
      first_caller_employee_id: data.firstCallerEmployeeId || null,
      is_unreachable: false,
      duplicate_confirmed: false,
      exclusion_date: exclusionDate,
      // 追客情報
      next_call_date: (data as any).nextCallDate || null,
      contact_method: (data as any).contactMethod || null,
      preferred_contact_time: (data as any).preferredContactTime || null,
      // 訪問査定情報
      visit_date: (data as any).visitDate || null,
      visit_time: (data as any).visitTime || null,
      visit_assignee: (data as any).visitAssignee || null,
      visit_notes: (data as any).visitNotes || null,
      // ステータス・コメント
      comments: (data as any).comments || null,
      assigned_to: (data as any).assignedTo || null,
      // 査定情報
      valuation_amount_1: (data as any).valuationAmount1 ? parseFloat(String((data as any).valuationAmount1)) : null,
      valuation_amount_2: (data as any).valuationAmount2 ? parseFloat(String((data as any).valuationAmount2)) : null,
      valuation_amount_3: (data as any).valuationAmount3 ? parseFloat(String((data as any).valuationAmount3)) : null,
      valuation_method: (data as any).valuationMethod || null,
      valuation_assignee: (data as any).valuationAssignee || null,
      // サイト
      inquiry_site: (data as any).site || null,
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
    // property_typeをDBの日本語値にマッピング
    const propertyTypeMap: Record<string, string> = {
      'detached_house': '戸建て',
      'apartment': 'マンション',
      'land': '土地',
      'commercial': '戸建て', // フォールバック
    };
    const mappedPropertyType = propertyTypeMap[data.property.propertyType as string] || data.property.propertyType || '戸建て';

    const { error: propertyError } = await this.table('properties').insert({
      seller_id: seller.id,
      property_address: data.property.address,
      property_type: mappedPropertyType,
      land_area: data.property.landArea || null,
      building_area: data.property.buildingArea || null,
      land_area_verified: data.property.landAreaVerified || null,
      building_area_verified: data.property.buildingAreaVerified || null,
      construction_year: data.property.buildYear || null,
      structure: data.property.structure || null,
      floor_plan: data.property.floorPlan || null,
      current_status: data.property.sellerSituation || null,
      property_address_ieul_apartment: data.property.propertyAddressForIeulMansion || null,
    });

    if (propertyError) {
      // ロールバック: 売主を削除
      await this.table('sellers').delete().eq('id', seller.id);
      throw new Error(`Failed to create property: ${propertyError.message}`);
    }

    // 連番シートC2を更新（ベストエフォート）
    try {
      const { GoogleSheetsClient } = await import('./GoogleSheetsClient');
      const renbanClient = new GoogleSheetsClient({
        spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
        sheetName: '連番',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      });
      await renbanClient.authenticate();
      const values = await renbanClient.readRawRange('C2');
      const currentNum = parseInt(values[0]?.[0] || '0', 10);
      await renbanClient.writeRawCell('C2', String(currentNum + 1));
      console.log(`✅ 連番シートC2を更新: ${currentNum} → ${currentNum + 1}`);
    } catch (err) {
      console.error('⚠️ 連番シートC2更新失敗（ベストエフォート）:', err);
    }

    // 売主リストスプレッドシートの最終行に追加（ベストエフォート）
    try {
      const { GoogleSheetsClient } = await import('./GoogleSheetsClient');
      const sellerListClient = new GoogleSheetsClient({
        spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
        sheetName: '売主リスト',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      });
      await sellerListClient.authenticate();

      // seller-spreadsheet-column-mapping.md に従ってデータを書き込む
      // B列: seller_number, C列: name, D列: address, E列: phone_number, F列: email
      await sellerListClient.appendRow({
        // 既存フィールド（変更なし）
        '売主番号': sellerNumber || '',
        '名前(漢字のみ）': data.name || '',
        '依頼者住所(物件所在と異なる場合）': data.address || '',
        '電話番号\nハイフン不要': data.phoneNumber || '',
        'メールアドレス': data.email || '',
        '物件所在地': data.property?.address || '',
        '種別': data.property?.propertyType || '',
        '反響日付': (data.inquiryDate instanceof Date ? data.inquiryDate.toISOString().split('T')[0] : data.inquiryDate) || '',
        'サイト': data.inquirySource || '',
        // 追加フィールド
        '次電日': (data as any).nextCallDate || '',
        '訪問日 \nY/M/D': (data as any).visitDate || '',
        '訪問時間': (data as any).visitTime || '',
        '営担': (data as any).visitAssignee || '',
        '訪問メモ': (data as any).visitNotes || '',
        '確度': (data as any).confidence || (data as any).confidenceLevel || '',
        '状況（当社）': (data as any).status || '',
        'コメント': (data as any).comments || '',
        '査定額1': (data as any).valuationAmount1 ? String((data as any).valuationAmount1) : '',
        '査定額2': (data as any).valuationAmount2 ? String((data as any).valuationAmount2) : '',
        '査定額3': (data as any).valuationAmount3 ? String((data as any).valuationAmount3) : '',
        '査定方法': (data as any).valuationMethod || '',
        '査定担当': (data as any).valuationAssignee || '',
        '連絡方法': (data as any).contactMethod || '',
        '連絡取りやすい日、時間帯': (data as any).preferredContactTime || '',
        '1番電話': (data as any).firstCallPerson || '',
      });
      console.log(`✅ 売主リストスプレッドシートに追加: ${sellerNumber}`);
    } catch (err) {
      console.error('⚠️ 売主リストスプレッドシート追加失敗（ベストエフォート）:', err);
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

    // 売主情報を取得（UUID または 売主番号でフォールバック検索）
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    let { data: seller, error: sellerError } = await query.single();
    console.log(`[PERF] getSeller DB query: ${Date.now() - _t0}ms`);

    // UUID検索で見つからない場合、seller_number でフォールバック検索
    if (sellerError || !seller) {
      console.log(`[getSeller] UUID検索失敗、seller_number でフォールバック: ${sellerId}`);
      let fallbackQuery = this.table('sellers')
        .select('*')
        .eq('seller_number', sellerId);
      if (!includeDeleted) {
        fallbackQuery = fallbackQuery.is('deleted_at', null);
      }
      const { data: fallbackSeller, error: fallbackError } = await fallbackQuery.single();
      console.log(`[PERF] getSeller fallback DB query: ${Date.now() - _t0}ms`);
      if (fallbackError || !fallbackSeller) {
        return null;
      }
      seller = fallbackSeller;
      // seller_number 検索の場合は seller.id を使って物件を取得する
      sellerId = fallbackSeller.id;
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
        isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
        null;
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

    // 暗号化が必要なフィールド（address は暗号化対象外）
    if (data.name !== undefined) {
      updates.name = encrypt(data.name);
    }
    if (data.address !== undefined) {
      updates.address = data.address;
    }
    if (data.phoneNumber !== undefined) {
      updates.phone_number = encrypt(data.phoneNumber);
      updates.phone_number_hash = data.phoneNumber ? crypto.createHash('sha256').update(data.phoneNumber).digest('hex') : null;
    }
    if (data.email !== undefined) {
      updates.email = data.email ? encrypt(data.email) : null;
      updates.email_hash = data.email ? crypto.createHash('sha256').update(data.email).digest('hex') : null;
    }

    // 暗号化不要なフィールド
    if (data.status !== undefined) {
      updates.status = data.status;
    }
    if (data.confidence !== undefined) {
      updates.confidence_level = data.confidence;
    }
    if (data.assignedTo !== undefined) {
      updates.assigned_to = data.assignedTo;
      // visit_assignee にも同期（訪問統計・サイドバー表示で使用）
      updates.visit_assignee = data.assignedTo;
    }
    // visitAssignee を直接指定した場合（訪問予約フォームから）
    if ((data as any).visitAssignee !== undefined) {
      updates.visit_assignee = (data as any).visitAssignee;
    }
    // visitDate を直接指定した場合（訪問予約フォームから、TIMESTAMP型として保存）
    if ((data as any).visitDate !== undefined) {
      updates.visit_date = (data as any).visitDate; // TIMESTAMP形式（YYYY-MM-DD HH:mm:ss）
    }
    // visitTime を直接指定した場合（訪問予約フォームから）
    if ((data as any).visitTime !== undefined) {
      updates.visit_time = (data as any).visitTime; // HH:mm 形式
    }
    if ((data as any).visitAcquisitionDate !== undefined) {
      updates.visit_acquisition_date = (data as any).visitAcquisitionDate; // YYYY-MM-DD形式のまま保存
    }
    if (data.nextCallDate !== undefined) {
      updates.next_call_date = data.nextCallDate;
    }
    if (data.appointmentDate !== undefined) {
      updates.appointment_date = data.appointmentDate;
      // appointmentDate経由のvisit_date変換は削除（visitDateを直接使用）
      // appointmentDateがnullの場合はvisit_dateを変更しない（意図しない消去を防ぐ）
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
    if ((data as any).valuationAssignee !== undefined) {
      updates.valuation_assignee = (data as any).valuationAssignee;
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
      updates.inquiry_site = data.site;
    }

    // Exclusion action field
    if ((data as any).exclusionAction !== undefined) {
      // 空文字列の場合はnullに変換（除外アクション解除）
      updates.exclusion_action = (data as any).exclusionAction === '' ? null : (data as any).exclusionAction;
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

    // コミュニケーション情報フィールド
    if ((data as any).phoneContactPerson !== undefined) {
      updates.phone_contact_person = (data as any).phoneContactPerson;
    }
    if ((data as any).preferredContactTime !== undefined) {
      updates.preferred_contact_time = (data as any).preferredContactTime;
    }
    if ((data as any).contactMethod !== undefined) {
      updates.contact_method = (data as any).contactMethod;
    }

    // 除外日を計算（inquiryDateまたはsiteが更新される場合）
    if (data.inquiryDate !== undefined || data.site !== undefined) {
      // 現在の売主データを取得して、更新されないフィールドの値を使用
      const { data: currentSeller } = await this.table('sellers')
        .select('inquiry_date, inquiry_site')
        .eq('id', sellerId)
        .single();
      
      const inquiryDateForCalc = data.inquiryDate !== undefined ? data.inquiryDate : currentSeller?.inquiry_date;
      const siteForCalc = data.site !== undefined ? data.site : currentSeller?.inquiry_site;
      
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
    if ((data as any).pinrichStatus !== undefined) {
      updates.pinrich_status = (data as any).pinrichStatus;
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
      // UUIDでなくseller_numberが渡された場合のフォールバック
      const isUuidError = error.message?.includes('invalid input syntax for type uuid') ||
                          error.code === '22P02';
      if (isUuidError) {
        console.log(`[updateSeller] UUID検索失敗、seller_number でフォールバック: ${sellerId}`);
        // seller_numberでUUIDを取得してから更新
        const { data: found } = await this.table('sellers')
          .select('id')
          .eq('seller_number', sellerId)
          .is('deleted_at', null)
          .single();
        if (!found) {
          throw new Error(`Seller not found: ${sellerId}`);
        }
        const { data: sellerByNumber, error: error2 } = await this.table('sellers')
          .update(updates)
          .eq('id', found.id)
          .select()
          .single();
        if (error2 || !sellerByNumber) {
          throw new Error(`Failed to update seller: ${error2?.message}`);
        }
        const decryptedSeller = await this.decryptSeller(sellerByNumber);
        invalidateSellerCache(found.id);
        invalidateListSellersCache();
        await CacheHelper.del(CacheHelper.generateKey('seller', found.id));
        await CacheHelper.delPattern('sellers:list:*');
        await CacheHelper.del('sellers:sidebar-counts');
        this.syncDirectToSpreadsheet(found.id);
        return decryptedSeller;
      }
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

    // サイドバーカウント更新（非同期、ノンブロッキング）
    // 更新されたフィールドに影響するカテゴリだけ再計算（全件再計算より大幅に高速）
    if (this.shouldUpdateSellerSidebarCounts(updates)) {
      const updatedFields = Object.keys(updates);
      import('./SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
        const sidebarService = new SellerSidebarCountsUpdateService(this.supabase);
        sidebarService.updateAffectedCategories(updatedFields).catch((err: any) => {
          console.error('⚠️ Failed to update affected sidebar categories:', err);
        });
      }).catch((err: any) => console.error('⚠️ [SidebarCounts] Import error:', err));
    }

    // スプレッドシートに同期（非同期・ノンブロッキング）
    // SyncQueueが利用可能な場合はキュー経由、そうでない場合は直接同期
    const activeSyncQueue2 = this.getActiveSyncQueue();
    if (activeSyncQueue2) {
      activeSyncQueue2.enqueue({
        type: 'update',
        sellerId: sellerId,
      }).catch((err: any) => {
        console.error('⚠️ SyncQueue enqueue failed, falling back to direct sync:', err);
        this.syncDirectToSpreadsheet(sellerId);
      });
    } else {
      // Vercel環境でSyncQueueが未初期化の場合は直接同期
      this.syncDirectToSpreadsheet(sellerId);
    }

    return decryptedSeller;
  }

  /**
   * SyncQueueを使わずスプレッドシートに直接同期（Vercel環境フォールバック用）
   */
  private syncDirectToSpreadsheet(sellerId: string): void {
    (async () => {
      try {
        const { SpreadsheetSyncService } = await import('./SpreadsheetSyncService');
        const { GoogleSheetsClient } = await import('./GoogleSheetsClient');

        const sheetsClient = new GoogleSheetsClient({
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
          sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
          serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        });
        await sheetsClient.authenticate();

        const syncService = new SpreadsheetSyncService(sheetsClient, this.supabase);
        const result = await syncService.syncToSpreadsheet(sellerId);
        if (result.success) {
          console.log(`✅ Direct sync succeeded for seller: ${sellerId}`);
        } else {
          console.error(`❌ Direct sync failed for seller: ${sellerId}`, result.error);
        }
      } catch (err) {
        console.error(`❌ Direct sync error for seller: ${sellerId}`, err);
      }
    })();
  }

  /**
   * サイドバーカウント更新が必要かどうかを判定
   * @param updates 更新データ
   * @returns サイドバーカウント更新が必要な場合はtrue
   */
  private shouldUpdateSellerSidebarCounts(updates: any): boolean {
    // サイドバーカテゴリーに影響するフィールド
    const sidebarFields = [
      'next_call_date', 'visit_assignee', 'visit_date', 'status',
      'phone_contact_person', 'preferred_contact_time', 'contact_method',
      'unreachable_status', 'confidence_level', 'inquiry_date',
      'valuation_amount_1', 'valuation_amount_2', 'valuation_amount_3',
      'valuation_method', 'mailing_status', 'pinrich_status',
      'contract_year_month', 'exclusive_other_decision_meeting', 'visit_reminder_assignee',
    ];
    return sidebarFields.some(field => field in updates);
  }

  /**
   * 売主情報を更新し、予約情報があればカレンダーイベントを作成/更新
   */
  async updateSellerWithAppointment(
    sellerId: string,
    data: UpdateSellerRequest & { appointmentDate?: string; assignedTo?: string; appointmentNotes?: string; visitAssignee?: string },
    creatorEmployeeId: string
  ): Promise<Seller> {
    console.log('📅 Updating seller with appointment:', {
      sellerId,
      appointmentDate: data.appointmentDate,
      assignedTo: data.assignedTo,
      visitAssignee: data.visitAssignee,
    });

    // まず売主情報を更新
    const updatedSeller = await this.updateSeller(sellerId, data);

    // 予約情報がある場合、カレンダーイベントを作成/更新
    // visitAssigneeまたはassignedToのいずれかが存在する場合
    const assigneeIdentifier = data.visitAssignee || data.assignedTo;
    if (data.appointmentDate && assigneeIdentifier) {
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

        // 担当者の情報を取得（スタッフ管理シートから直接取得）
        let assignedEmployee: { id: string; name: string; email: string } | null = null;
        
        // assigneeIdentifierがイニシャル（文字列）の場合、スタッフ管理シートから取得
        if (typeof assigneeIdentifier === 'string' && assigneeIdentifier.length <= 3) {
          console.log('📋 Fetching employee from staff sheet by initials:', assigneeIdentifier);
          
          const { GoogleSheetsClient } = await import('./GoogleSheetsClient');
          const sheetsClient = new GoogleSheetsClient({
            spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
            sheetName: 'スタッフ',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
          });
          await sheetsClient.authenticate();
          
          const values = await sheetsClient.readRawRange('A:H');
          if (values && values.length > 0) {
            const headers = values[0];
            const initialsIndex = headers.indexOf('イニシャル');
            const nameIndex = headers.indexOf('姓名');
            const emailIndex = headers.indexOf('メアド');
            
            const staffRow = values.find((row, index) => 
              index > 0 && row[initialsIndex] === assigneeIdentifier
            );
            
            if (staffRow) {
              // employeesテーブルからUUIDを取得（カレンダーイベント作成に必要）
              const { data: empData } = await this.table('employees')
                .select('id')
                .eq('initials', assigneeIdentifier)
                .single();
              
              assignedEmployee = {
                id: empData?.id || 'dummy-id',
                name: staffRow[nameIndex] || assigneeIdentifier,
                email: staffRow[emailIndex] || `${assigneeIdentifier}@dummy.local`,
              };
              
              console.log('✅ Employee found in staff sheet:', assignedEmployee);
            }
          }
        } else {
          // assigneeIdentifierがUUIDの場合、employeesテーブルから取得
          const { data: empData } = await this.table('employees')
            .select('id, name, email')
            .eq('id', assigneeIdentifier)
            .single();
          
          if (empData) {
            assignedEmployee = empData;
          }
        }

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
              updatedSeller.name,
              updatedSeller.phoneNumber,
              property.address,
              assignedEmployee.email // 営担のメールアドレスを渡す
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
            updatedSeller.name,
            updatedSeller.phoneNumber,
            property.address,
            assignedEmployee.email // 営担のメールアドレスを渡す
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
      inquirySite, // サイトフィルター
      propertyType: propertyTypeFilter, // 種別フィルター
      statusFilter, // 状況（当社）フィルター
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
          
          // 🚨 重要: ページネーション処理を追加（Supabaseのデフォルト制限1000件を超える場合に対応）
          let visitDayBeforeSellers: any[] = [];
          let vdbPage = 0;
          const vdbPageSize = 1000;
          
          while (true) {
            const { data, error } = await this.table('sellers')
              .select('id, visit_date, visit_assignee, visit_reminder_assignee')
              .is('deleted_at', null)
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              // 「外す」は有効な営業担当として扱う
              .not('visit_date', 'is', null)
              .order('id')
              .range(vdbPage * vdbPageSize, (vdbPage + 1) * vdbPageSize - 1);
            
            if (error) {
              console.error('❌ visitDayBeforeSellers取得エラー:', error);
              break;
            }
            
            if (!data || data.length === 0) break;
            
            visitDayBeforeSellers = visitDayBeforeSellers.concat(data);
            
            if (data.length < vdbPageSize) break;
            vdbPage++;
          }
          
          console.log(`[visitDayBefore] todayJST=${todayJST}, candidates=${visitDayBeforeSellers?.length ?? 0}`);
          // visitDayBefore に該当するIDを計算
          const visitDayBeforeIds = (visitDayBeforeSellers || []).filter((s: any) => {
            // visitReminderAssigneeに値がある場合は除外（通知担当が既に割り当て済み）
            const reminderAssignee = (s as any).visit_reminder_assignee || '';
            if (reminderAssignee.trim() !== '') return false;
            const vd = (s as any).visit_date;
            if (!vd) return false;
            // TIMESTAMP型対応: 日付部分のみを抽出
            const visitDateOnly = vd.split('T')[0].split(' ')[0];
            const parts = visitDateOnly.split('-');
            if (parts.length !== 3) return false;
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // 0-indexed
            const day = parseInt(parts[2]);
            const visitDateUTC = new Date(Date.UTC(year, month, day));
            const dow = visitDateUTC.getUTCDay();
            const days = dow === 4 ? 2 : 1;
            const notify = new Date(visitDateUTC);
            notify.setUTCDate(visitDateUTC.getUTCDate() - days);
            const notifyStr = `${notify.getUTCFullYear()}-${String(notify.getUTCMonth() + 1).padStart(2, '0')}-${String(notify.getUTCDate()).padStart(2, '0')}`;
            console.log(`[visitDayBefore] seller=${s.id} visit_date=${vd} dow=${dow} notifyStr=${notifyStr} match=${notifyStr === todayJST}`);
            return notifyStr === todayJST;
          }).map((s: any) => s.id);
          console.log(`[visitDayBefore] matched IDs: ${visitDayBeforeIds.length}`);
          if (visitDayBeforeIds.length === 0) {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
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
          // 当日TEL（担当）（営担あり AND 次電日が今日以前 AND 追客中を含む AND 追客不要・専任媒介・一般媒介・他社買取を除外）
          // 🔧 修正: カウント計算（SellerSidebarCountsUpdateService）と条件を一致させる
          // - .ilike('status', '%追客中%') を追加（カウント計算と一致）
          // - .not('status', 'ilike', '%他社買取%') を追加（カウント計算と一致）
          query = query
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '')
            .lte('next_call_date', todayJST)
            .ilike('status', '%追客中%')
            .not('status', 'ilike', '%追客不要%')
            .not('status', 'ilike', '%専任媒介%')
            .not('status', 'ilike', '%一般媒介%')
            .not('status', 'ilike', '%他社買取%');
          break;
        case 'todayCall':
          // 当日TEL分（追客中 OR 他決→追客 AND 次電日が今日以前 AND コミュニケーション情報なし AND 営担なし）
          // 🚨 重要: 「他決→追客」も含める（getSidebarCountsFallback()と同じロジック）
          // 🚨 重要: FI売主（seller_numberがFIで始まる）は福岡専用カテゴリーに表示するため除外
          // 全件取得してJSでフィルタ（ORクエリが複雑なため）
          let todayCallCandidates: any[] = [];
          let tcPage = 0;
          const tcPageSize = 1000;
          
          while (true) {
            const { data, error } = await this.table('sellers')
              .select('id, seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, confidence_level, inquiry_date')
              .is('deleted_at', null)
              .not('next_call_date', 'is', null)
              .lte('next_call_date', todayJST)
              .order('id')
              .range(tcPage * tcPageSize, (tcPage + 1) * tcPageSize - 1);
            
            if (error) {
              console.error('❌ todayCallCandidates取得エラー:', error);
              break;
            }
            
            if (!data || data.length === 0) break;
            
            todayCallCandidates = todayCallCandidates.concat(data);
            
            if (data.length < tcPageSize) break;
            tcPage++;
          }
          
          // JSでフィルタ
          const todayCallIds = (todayCallCandidates || []).filter((s: any) => {
            // FI売主（福岡）は福岡専用カテゴリーに表示するため除外
            const sellerNum = (s.seller_number || '').toString();
            if (sellerNum.toUpperCase().startsWith('FI')) return false;

            const status = s.status || '';
            // 「追客中」を含む OR 「他決→追客」と完全一致
            const isFollowingUp = status.includes('追客中') || status === '他決→追客';
            if (!isFollowingUp) return false;
            
            // 追客不要、専任媒介、一般媒介を除外
            if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) {
              return false;
            }
            
            // 営担が空または「外す」
            const visitAssignee = s.visit_assignee || '';
            if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') {
              return false;
            }
            
            // コミュニケーション情報が全て空
            const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                           (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                           (s.contact_method && s.contact_method.trim() !== '');
            if (hasInfo) return false;
            
            // 当日TEL_未着手（todayCallNotStarted）に該当する場合は除外（未着手を優先）
            const unreachable = s.unreachable_status || '';
            const confidence = s.confidence_level || '';
            const inquiryDate = s.inquiry_date || '';
            const isTodayCallNotStarted = (
              status === '追客中' &&
              !unreachable &&
              confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
              inquiryDate >= '2026-01-01'
            );
            if (isTodayCallNotStarted) return false;
            
            return true;
          }).map((s: any) => s.id);
          
          if (todayCallIds.length === 0) {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            query = query.in('id', todayCallIds);
          }
          break;
        case 'todayCallWithInfo':
          // 当日TEL（内容）（追客中 OR 他決→追客 AND 次電日が今日以前 AND コミュニケーション情報あり AND 営担なし）
          // 🚨 重要: 「他決→追客」も含める（getSidebarCountsFallback()と同じロジック）
          // 全件取得してJSでフィルタ（ORクエリが複雑なため）
          let todayCallWithInfoCandidates: any[] = [];
          let tcwiPage = 0;
          const tcwiPageSize = 1000;
          
          while (true) {
            const { data, error } = await this.table('sellers')
              .select('id, seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method')
              .is('deleted_at', null)
              .not('next_call_date', 'is', null)
              .lte('next_call_date', todayJST)
              .order('id')
              .range(tcwiPage * tcwiPageSize, (tcwiPage + 1) * tcwiPageSize - 1);
            
            if (error) {
              console.error('❌ todayCallWithInfoCandidates取得エラー:', error);
              break;
            }
            
            todayCallWithInfoCandidates = todayCallWithInfoCandidates.concat(data);
            
            if (data.length < tcwiPageSize) break;
            tcwiPage++;
          }
          
          // JSでフィルタ
          const todayCallWithInfoIds = (todayCallWithInfoCandidates || []).filter((s: any) => {
            // FI売主（福岡）は福岡専用カテゴリーに表示するため除外
            const sellerNum = (s.seller_number || '').toString();
            if (sellerNum.toUpperCase().startsWith('FI')) return false;

            const status = s.status || '';
            // 「追客中」を含む OR 「他決→追客」と完全一致
            const isFollowingUp = status.includes('追客中') || status === '他決→追客';
            if (!isFollowingUp) return false;
            
            // 追客不要、専任媒介、一般媒介を除外
            if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) {
              return false;
            }
            
            // 営担が空または「外す」
            const visitAssignee = s.visit_assignee || '';
            if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') {
              return false;
            }
            
            // コミュニケーション情報のいずれかに入力あり
            const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                           (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                           (s.contact_method && s.contact_method.trim() !== '');
            return hasInfo;
          }).map((s: any) => s.id);
          
          if (todayCallWithInfoIds.length === 0) {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            query = query.in('id', todayCallWithInfoIds);
          }
          break;
        case 'unvaluated': {
          // 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空（「外す」含む））
          // 🚨 重要: 当日TEL_未着手の条件を満たす売主は除外する（getSidebarCountsFallback()と同じロジック）
          // 🚨 重要: valuation_method（査定方法）が「不要」の売主も除外する
          
          // まず全件取得（ページネーション対応）
          let unvaluatedCandidates: any[] = [];
          let uvPage = 0;
          const uvPageSize = 1000;
          
          while (true) {
            const { data, error } = await this.table('sellers')
              .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, valuation_method, inquiry_date, unreachable_status, confidence_level, exclusion_date, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
              .is('deleted_at', null)
              .ilike('status', '%追客中%')
              .gte('inquiry_date', cutoffDate)
              .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
              .is('valuation_amount_1', null)
              .is('valuation_amount_2', null)
              .is('valuation_amount_3', null)
              .order('id')
              .range(uvPage * uvPageSize, (uvPage + 1) * uvPageSize - 1);
            
            if (error) {
              console.error('❌ unvaluatedCandidates取得エラー:', error);
              break;
            }
            
            if (!data || data.length === 0) break;
            
            unvaluatedCandidates = unvaluatedCandidates.concat(data);
            
            if (data.length < uvPageSize) break;
            uvPage++;
          }
          
          // JavaScriptで当日TEL_未着手の条件を満たす売主を除外
          const unvaluatedIds = unvaluatedCandidates.filter(s => {
            // FI売主（福岡）は福岡専用カテゴリーに表示するため除外
            const sellerNum = (s.seller_number || '').toString();
            if (sellerNum.toUpperCase().startsWith('FI')) return false;

            const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
            const valuationMethod = s.valuation_method || '';
            const isNotRequired = valuationMethod === '不要';
            if (!hasNoValuation || isNotRequired) return false;
            
            // 当日TEL_未着手の条件を満たす場合は除外（未着手が優先）
            const status = s.status || '';
            const nextCallDate = s.next_call_date || '';
            const hasInfo = (s.phone_contact_person?.trim()) ||
                            (s.preferred_contact_time?.trim()) ||
                            (s.contact_method?.trim());
            const unreachable = s.unreachable_status || '';
            const confidence = s.confidence_level || '';
            const exclusionDate = s.exclusion_date || '';
            const inquiryDate = s.inquiry_date || '';
            
            const isTodayCallNotStarted = (
              status === '追客中' &&
              nextCallDate && nextCallDate <= todayJST &&
              !hasInfo &&
              !unreachable &&
              confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
              inquiryDate >= '2026-01-01'
            );
            
            return !isTodayCallNotStarted;
          }).map(s => s.id);
          
          console.log(`[unvaluated] matched IDs: ${unvaluatedIds.length}`);
          
          if (unvaluatedIds.length === 0) {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          } else {
            query = query.in('id', unvaluatedIds);
          }
          break;
        }
        case 'mailingPending':
          // 査定（郵送）: SellerSidebarCountsUpdateServiceと同じ条件
          query = query
            .in('status', ['追客中', '除外後追客中', '他決→追客'])
            .eq('valuation_method', '机上査定（郵送）')
            .eq('mailing_status', '未');
          break;
        case 'todayCallNotStarted': {
          // 当日TEL_未着手: 全条件をDBレベルで直接フィルタ（IDリスト方式を廃止）
          // null を含むフィールドは or(field.is.null,...) で対応
          // 🚨 重要: FI売主（seller_numberがFIで始まる）は福岡専用カテゴリーに表示するため除外
          query = query
            .eq('status', '追客中')
            .not('next_call_date', 'is', null)
            .lte('next_call_date', todayJST)
            .gte('inquiry_date', '2026-01-01')
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            .or('unreachable_status.is.null,unreachable_status.eq.')
            .or('confidence_level.is.null,and(confidence_level.neq.ダブり,confidence_level.neq.D,confidence_level.neq.AI査定)')
            .or('phone_contact_person.is.null,phone_contact_person.eq.')
            .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
            .or('contact_method.is.null,contact_method.eq.')
            .not('seller_number', 'ilike', 'FI%');
          break;
        }
        case 'pinrichEmpty': {
          // Pinrich空欄: 次電日に関係なく「追客中 + Pinrich空欄 + 反響日2026/1/1以降 + 営担なし」
          query = query
            .ilike('status', '%追客%')
            .not('status', 'ilike', '%追客不要%')
            .not('status', 'ilike', '%専任媒介%')
            .not('status', 'ilike', '%一般媒介%')
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
            .or('pinrich_status.is.null,pinrich_status.eq.')
            .gte('inquiry_date', '2026-01-01');
          break;
        }
        case 'pinrichChangeRequired': {
          // Pinrich要変更（条件A〜DのいずれかにマッチするIDを先に取得してIN絞り込み）
          // 条件A: visit_assignee='外す' AND pinrich_status='クローズ' AND status='追客中'
          // 条件B: confidence_level='D' AND pinrich_status NOT IN (除外リスト)
          // 条件C: visit_date あり AND pinrich_status='配信中' AND visit_assignee あり AND status IN (専任媒介,追客中,除外後追客中)
          // 条件D: status IN (他決→追客,他決→追客不要,一般媒介) AND pinrich_status='クローズ' AND contract_year_month >= '2025-05-01'
          let pinrichAllCandidates: any[] = [];
          let pinrichPage = 0;
          const pinrichPageSize = 1000;
          while (true) {
            const { data: pageData, error: pageError } = await this.supabase
              .from('sellers')
              .select('id, visit_assignee, pinrich_status, status, confidence_level, visit_date, contract_year_month')
              .is('deleted_at', null)
              .or('pinrich_status.eq.配信中,pinrich_status.eq.クローズ,confidence_level.eq.D')
              .range(pinrichPage * pinrichPageSize, (pinrichPage + 1) * pinrichPageSize - 1);
            if (pageError || !pageData || pageData.length === 0) break;
            pinrichAllCandidates = pinrichAllCandidates.concat(pageData);
            if (pageData.length < pinrichPageSize) break;
            pinrichPage++;
          }

          const excludedPinrichB = new Set(['クローズ', '登録不要', 'アドレスエラー', '配信不要（他決後、訪問後、担当付）', '△配信停止']);
          const validStatusC = new Set(['専任媒介', '追客中', '除外後追客中']);
          const validStatusD = new Set(['他決→追客', '他決→追客不要', '一般媒介']);

          const pinrichIds = pinrichAllCandidates.filter(s => {
            const pinrich = s.pinrich_status || '';
            const status = s.status || '';
            const assignee = s.visit_assignee || '';
            const confidence = s.confidence_level || '';
            const visitDate = s.visit_date || '';
            const contractYM = s.contract_year_month ? String(s.contract_year_month).substring(0, 10) : '';

            const condA = assignee === '外す' && pinrich === 'クローズ' && status === '追客中';
            const condB = confidence === 'D' && !excludedPinrichB.has(pinrich);
            const condC = !!visitDate && pinrich === '配信中' && !!assignee && assignee.trim() !== '' && validStatusC.has(status);
            const condD = validStatusD.has(status) && pinrich === 'クローズ' && contractYM >= '2025-05-01';

            return condA || condB || condC || condD;
          }).map(s => s.id);

          query = pinrichIds.length === 0
            ? query.eq('id', '00000000-0000-0000-0000-000000000000')
            : query.in('id', pinrichIds);
          break;
        }
        case 'exclusive':
          // 専任カテゴリー（専任他決打合せ <> "完了" + 次電日 <> TODAY() + 状況が専任媒介関連）
          query = query
            .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
            .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
            .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']);
          break;
        case 'general':
          // 一般カテゴリー（専任他決打合せ <> "完了" + 次電日 <> TODAY() + 状況が一般媒介 + 契約年月 >= 2025/6/23）
          query = query
            .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
            .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
            .eq('status', '一般媒介')
            .not('contract_year_month', 'is', null)
            .gte('contract_year_month', '2025-06-23');
          break;
        case 'visitOtherDecision':
          // 訪問後他決カテゴリー（専任他決打合せ <> "完了" + 次電日 <> TODAY() + 状況が他決関連 + 営担あり（「外す」含む））
          query = query
            .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
            .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
            .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
            .not('visit_assignee', 'is', null)
            .neq('visit_assignee', '');
          break;
        case 'unvisitedOtherDecision':
          // 未訪問他決カテゴリー（専任他決打合せ <> "完了" + 次電日 <> TODAY() + 状況が他決関連 + 営担なし（「外す」も空欄扱い））
          query = query
            .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
            .or(`next_call_date.is.null,next_call_date.neq.${todayJST}`)
            .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
            .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す');
          break;
        default: {
          // visitAssigned:xxx または todayCallAssigned:xxx または todayCallWithInfo:xxx または fi:xxx の動的カテゴリ
          const dynamicCategory = statusCategory as string;
          if (dynamicCategory.startsWith('fi:')) {
            // 福岡（FI）カテゴリ：seller_numberがFIで始まる売主のみ
            const fiSubCat = dynamicCategory.replace('fi:', '');
            query = query.ilike('seller_number', 'FI%');
            if (fiSubCat === 'todayCall') {
              // コミュニケーション情報が全て空 AND 未着手除外（unreachable_statusあり OR inquiry_date < 2026-01-01）
              query = query
                .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
                .lte('next_call_date', todayJST)
                .or('status.ilike.%追客中%,status.eq.他決→追客')
                .not('status', 'ilike', '%追客不要%')
                .or('phone_contact_person.is.null,phone_contact_person.eq.')
                .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
                .or('contact_method.is.null,contact_method.eq.');
            } else if (fiSubCat === 'todayCallNotStarted') {
              query = query
                .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
                .lte('next_call_date', todayJST)
                .eq('status', '追客中')
                .not('status', 'ilike', '%追客不要%');
            } else if (fiSubCat === 'todayCallWithInfo' || fiSubCat.startsWith('todayCallWithInfo:')) {
              // コミュニケーション情報のいずれかに入力あり
              query = query
                .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
                .lte('next_call_date', todayJST)
                .or('status.ilike.%追客中%,status.eq.他決→追客')
                .not('status', 'ilike', '%追客不要%')
                .or('phone_contact_person.not.is.null,preferred_contact_time.not.is.null,contact_method.not.is.null');
            } else if (fiSubCat === 'unvaluated') {
              query = query
                .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
                .ilike('status', '%追客中%')
                .gte('inquiry_date', '2025-12-08');
            }
          } else if (dynamicCategory.startsWith('visitAssigned:')) {
            const assignee = dynamicCategory.replace('visitAssigned:', '');
            // 担当者別（営担が指定のイニシャルの全売主、一般媒介・専任媒介・追客不要・他社買取は除外）
            query = query
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              .neq('visit_assignee', '外す')
              .eq('visit_assignee', assignee)
              .not('status', 'ilike', '%一般媒介%')
              .not('status', 'ilike', '%専任媒介%')
              .not('status', 'ilike', '%追客不要%')
              .not('status', 'ilike', '%他社買取%');
          } else if (dynamicCategory.startsWith('todayCallAssigned:')) {
            const assignee = dynamicCategory.replace('todayCallAssigned:', '');
            // 当日TEL（担当）（営担が指定のイニシャル AND 次電日が今日以前 AND 追客中を含む AND 追客不要を含まない AND 専任媒介・一般媒介・他社買取を除外）
            query = query
              .not('visit_assignee', 'is', null)
              .neq('visit_assignee', '')
              .neq('visit_assignee', '外す')
              .eq('visit_assignee', assignee)
              .lte('next_call_date', todayJST)
              .ilike('status', '%追客中%')
              .not('status', 'ilike', '%追客不要%')
              .not('status', 'ilike', '%専任媒介%')
              .not('status', 'ilike', '%一般媒介%')
              .not('status', 'ilike', '%他社買取%');
          } else if (dynamicCategory.startsWith('todayCallWithInfo:')) {
            // 当日TEL（内容）ラベル別（追客中 AND 次電日が今日以前 AND 営担なし AND コミュニケーション情報あり）
            // ラベルによる絞り込みはJS側で行う（DBクエリでは当日TEL（内容）全件を取得）
            query = query
              .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
              .lte('next_call_date', todayJST)
              .or('status.ilike.%追客中%,status.ilike.%除外後追客中%,status.ilike.%他決→追客%')
              .or('phone_contact_person.not.is.null,preferred_contact_time.not.is.null,contact_method.not.is.null');
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
    if (inquirySite) {
      query = query.eq('inquiry_site', inquirySite); // 修正: site → inquiry_site（正しいカラム名）
    }
    if (propertyTypeFilter) {
      query = query.eq('property_type', propertyTypeFilter); // 修正: 種別 → property_type（正しいカラム名）
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter); // 修正: ilike → eq（完全一致）
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

    // 各売主の最新通話日時を一括取得（N+1を避けるため IN クエリで一括取得）
    // seller_id（UUID）→ sellerNumber のマップを作成
    const sellerIds = decryptedSellers.map((s: any) => s.id).filter(Boolean);
    const idToSellerNumber: Record<string, string> = {};
    for (const s of decryptedSellers) {
      if (s.id && s.sellerNumber) idToSellerNumber[s.id] = s.sellerNumber;
    }
    // lastCalledAtMap のキーは sellerNumber
    let lastCalledAtMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      try {
        const { data: latestCalls } = await this.table('activities')
          .select('seller_id, created_at')
          .in('seller_id', sellerIds)
          .eq('type', 'phone_call')
          .order('created_at', { ascending: false })
          .limit(sellerIds.length * 5); // 各売主最大5件分で十分（最新1件のみ使用）

        if (latestCalls) {
          // 各売主の最新通話日時のみを保持（最初に出てきたものが最新）
          for (const call of latestCalls) {
            const sellerNumber = idToSellerNumber[call.seller_id];
            if (sellerNumber && !lastCalledAtMap[sellerNumber]) {
              lastCalledAtMap[sellerNumber] = call.created_at;
            }
          }
        }
      } catch (e) {
        // 取得失敗時は無視（lastCalledAtはオプション）
      }
    }

    // todayCallWithInfo:xxx または fi:todayCallWithInfo:xxx の場合、ラベルでJS側フィルタリング
    let finalSellers = decryptedSellers;
    const isLabelFilter = (typeof statusCategory === 'string') &&
      (statusCategory.startsWith('todayCallWithInfo:') || statusCategory.startsWith('fi:todayCallWithInfo:'));
    if (isLabelFilter) {
      const targetLabel = (statusCategory as string).startsWith('fi:todayCallWithInfo:')
        ? (statusCategory as string).replace('fi:todayCallWithInfo:', '')
        : (statusCategory as string).replace('todayCallWithInfo:', '');
      const isValidVal = (v: string | null | undefined): boolean =>
        !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
      finalSellers = decryptedSellers.filter((s: any) => {
        const parts: string[] = [];
        const phone = s.phoneContactPerson || s.phone_contact_person || '';
        const preferred = s.preferredContactTime || s.preferred_contact_time || '';
        const contact = s.contactMethod || s.contact_method || '';
        if (isValidVal(phone)) parts.push(phone.trim());
        if (isValidVal(preferred)) parts.push(preferred.trim());
        if (isValidVal(contact)) parts.push(contact.trim());
        const label = parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
        return label === targetLabel;
      });
    }

    // fi:todayCallNotStarted の場合、JS側で不通・確度・反響日付フィルタリング
    if (typeof statusCategory === 'string' && statusCategory === 'fi:todayCallNotStarted') {
      const todayJSTStr = (() => {
        const now = new Date();
        const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
      })();
      finalSellers = decryptedSellers.filter((s: any) => {
        const hasInfo = (s.phoneContactPerson || s.phone_contact_person || '').trim() ||
                        (s.preferredContactTime || s.preferred_contact_time || '').trim() ||
                        (s.contactMethod || s.contact_method || '').trim();
        if (hasInfo) return false;
        const unreachable = s.unreachableStatus || s.unreachable_status || '';
        if (unreachable && unreachable.trim() !== '') return false;
        const confidence = s.confidenceLevel || s.confidence_level || '';
        if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
        const inquiryDate = (s.inquiryDate || s.inquiry_date || '').substring(0, 10);
        return inquiryDate >= '2026-01-01';
      });
    }

    // lastCalledAt を各売主に付与（キーは sellerNumber）
    const sellersWithCallDate = finalSellers.map((seller: any) => ({
      ...seller,
      lastCalledAt: (seller.sellerNumber && lastCalledAtMap[seller.sellerNumber]) || null,
    }));

    const result = {
      data: sellersWithCallDate,
      total: isLabelFilter || statusCategory === 'fi:todayCallNotStarted'
        ? sellersWithCallDate.length
        : (count || 0),
      page,
      pageSize,
      totalPages: Math.ceil((isLabelFilter || statusCategory === 'fi:todayCallNotStarted'
        ? sellersWithCallDate.length
        : (count || 0)) / pageSize),
    };

    // キャッシュに保存（インメモリ + Redis）
    // 日付依存カテゴリ（visitDayBefore等）はキャッシュしない（日付が変わると結果が変わるため）
    const skipCache = statusCategory === 'visitDayBefore' || statusCategory === 'visitCompleted' || isLabelFilter ||
      (typeof statusCategory === 'string' && statusCategory.startsWith('fi:'));
    
    // 復号失敗チェック：nameが暗号文のまま（Base64形式）の場合はキャッシュしない
    const hasEncryptedName = sellersWithCallDate.some((s: any) => {
      const name = s.name || '';
      // Base64文字列の特徴：英数字+/+=のみで構成され、長さが96バイト以上
      return name.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(name);
    });
    
    if (hasEncryptedName) {
      console.error('❌ 復号失敗を検出：暗号文がnameに含まれているためキャッシュをスキップ');
    } else if (!skipCache) {
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
  /**
   * 売主リストに lastCalledAt を付与するヘルパー
   */
  private async _attachLastCalledAt(sellers: Seller[]): Promise<Seller[]> {
    if (sellers.length === 0) return sellers;
    const sellerIds = sellers.map((s: any) => s.id).filter(Boolean);
    const idToSellerNumber: Record<string, string> = {};
    for (const s of sellers) {
      if ((s as any).id && s.sellerNumber) idToSellerNumber[(s as any).id] = s.sellerNumber;
    }
    let lastCalledAtMap: Record<string, string> = {};
    if (sellerIds.length > 0) {
      try {
        const { data: latestCalls } = await this.table('activities')
          .select('seller_id, created_at')
          .in('seller_id', sellerIds)
          .eq('type', 'phone_call')
          .order('created_at', { ascending: false })
          .limit(sellerIds.length * 5); // 各売主最大5件分で十分（最新1件のみ使用）
        if (latestCalls) {
          for (const call of latestCalls) {
            const sellerNumber = idToSellerNumber[call.seller_id];
            if (sellerNumber && !lastCalledAtMap[sellerNumber]) {
              lastCalledAtMap[sellerNumber] = call.created_at;
            }
          }
        }
      } catch (e) {
        // 取得失敗時は無視
      }
    }
    return sellers.map((seller: any) => ({
      ...seller,
      lastCalledAt: (seller.sellerNumber && lastCalledAtMap[seller.sellerNumber]) || null,
    }));
  }

  async searchSellers(query: string, includeDeleted: boolean = false): Promise<Seller[]> {
    console.log('🔍 searchSellers called with query:', query);
    
    const lowerQuery = query.toLowerCase().trim();
    
    // 売主番号での検索を優先（暗号化されていないので高速）
    // AA12903、FI123、BB456のような形式の場合、データベースで直接検索
    if (lowerQuery.match(/^[a-z]{2}\d+$/i)) {
      console.log('🚀 Fast path: Searching by seller_number in database');

      // 売主番号は2文字プレフィックス + 5桁ゼロパディング形式（例: AA01949、FI00123）
      // 入力がAA1949の場合、AA01949に変換して検索する
      const upperQuery = lowerQuery.toUpperCase();
      const prefix = upperQuery.match(/^[a-z]{2}/i)?.[0] || 'AA';
      const numPart = upperQuery.replace(/^[a-z]{2}/i, '');
      const paddedQuery = `${prefix}${numPart.padStart(5, '0')}`;

      // ゼロパディングあり・なし両方で完全一致検索
      const exactCandidates = [...new Set([upperQuery, paddedQuery])];
      for (const candidate of exactCandidates) {
        let exactQuery = this.table('sellers')
          .select('*')
          .eq('seller_number', candidate);
        if (!includeDeleted) {
          exactQuery = exactQuery.is('deleted_at', null);
        }
        const { data: exactSellers, error: exactError } = await exactQuery;
        if (exactError) {
          throw new Error(`Failed to search sellers by exact number: ${exactError.message}`);
        }
        if (exactSellers && exactSellers.length > 0) {
          console.log(`✅ Found exact match for seller_number: ${candidate}`);
          const decryptedSellers = await Promise.all(exactSellers.map(seller => this.decryptSeller(seller)));
          return await this._attachLastCalledAt(decryptedSellers);
        }
      }

      // 完全一致がなければ前方一致で検索
      // 数字部分が5桁未満の場合、ゼロパディングありとなしの両方で検索
      let sellerQuery;
      if (numPart.length < 5) {
        // 例: FI6 → FI6%（FI2にマッチ）またはFI00006%（FI00006にマッチ）
        sellerQuery = this.table('sellers')
          .select('*')
          .or(`seller_number.ilike.${upperQuery}%,seller_number.ilike.${paddedQuery}%`)
          .order('seller_number', { ascending: true })
          .limit(50);
      } else {
        // 数字部分が5桁以上の場合、そのまま検索
        sellerQuery = this.table('sellers')
          .select('*')
          .ilike('seller_number', `${upperQuery}%`)
          .order('seller_number', { ascending: true })
          .limit(50);
      }
      
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
        return await this._attachLastCalledAt(decryptedSellers);
      }
    }
    
    // 電話番号パターン（数字のみ7桁以上）→ phone_number_hash で検索
    if (lowerQuery.match(/^\d{7,}$/)) {
      console.log('🚀 Fast path: Searching by phone_number_hash in database');
      const phoneHash = crypto.createHash('sha256').update(lowerQuery).digest('hex');
      let hashQuery = this.table('sellers')
        .select('*')
        .eq('phone_number_hash', phoneHash);
      if (!includeDeleted) {
        hashQuery = hashQuery.is('deleted_at', null);
      }
      const { data: hashSellers, error: hashError } = await hashQuery;
      if (hashError) throw new Error(`Failed to search by phone hash: ${hashError.message}`);
      if (hashSellers && hashSellers.length > 0) {
        const decryptedSellers = await Promise.all(hashSellers.map(s => this.decryptSeller(s)));
        return await this._attachLastCalledAt(decryptedSellers);
      }
      // ヒットしない場合は全件スキャンにフォールバック
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
        return await this._attachLastCalledAt(decryptedSellers);
      }
    }
    
    // メールアドレスパターン → email_hash で検索
    if (lowerQuery.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      console.log('🚀 Fast path: Searching by email_hash in database');
      const emailHash = crypto.createHash('sha256').update(lowerQuery).digest('hex');
      let hashQuery = this.table('sellers')
        .select('*')
        .eq('email_hash', emailHash);
      if (!includeDeleted) {
        hashQuery = hashQuery.is('deleted_at', null);
      }
      const { data: hashSellers, error: hashError } = await hashQuery;
      if (hashError) throw new Error(`Failed to search by email hash: ${hashError.message}`);
      if (hashSellers && hashSellers.length > 0) {
        const decryptedSellers = await Promise.all(hashSellers.map(s => this.decryptSeller(s)));
        return await this._attachLastCalledAt(decryptedSellers);
      }
      // ヒットしない場合は全件スキャンにフォールバック
    }
    
    // 名前、住所、電話番号、メールアドレスでの検索は全件取得が必要（暗号化されているため）
    console.log('⚠️  Slow path: Full scan required for encrypted field search');
    
    // 最大500件に制限して検索速度を改善（メールアドレス検索のため増加）
    let sellerQuery = this.table('sellers')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500);
    
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
        (seller.email && seller.email.toLowerCase().includes(lowerQuery)) ||
        (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery)) ||
        (seller.propertyAddress && seller.propertyAddress.toLowerCase().includes(lowerQuery))
    );

    console.log(`🎯 Found ${results.length} matching sellers`);

    // lastCalledAt を付与（ヘルパーを使用）
    return await this._attachLastCalledAt(results);
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
      
      // デバッグログ追加
      if (seller.visit_assignee) {
        console.log('=== decryptSeller 営担デバッグ ===');
        console.log('seller.visit_assignee:', seller.visit_assignee);
        console.log('initialsMap[seller.visit_assignee]:', initialsMap[seller.visit_assignee]);
        console.log('visitAssigneeFullName:', visitAssigneeFullName);
        console.log('最終的なvisitAssignee:', visitAssigneeFullName || seller.visit_assignee || undefined);
      }
      
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
        inquiryDatetime: (seller.inquiry_detailed_datetime || seller.inquiry_datetime) ? new Date(seller.inquiry_detailed_datetime || seller.inquiry_datetime) : undefined,
        inquiryDetailedDatetime: (seller.inquiry_detailed_datetime || seller.inquiry_datetime) ? new Date(seller.inquiry_detailed_datetime || seller.inquiry_datetime) : undefined,
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
        exclusiveDecisionDate: seller.contract_year_month, // 専任（他決）決定日（contract_year_monthのエイリアス）
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
        visitDate: seller.visit_date || undefined, // TIMESTAMP型（ISO 8601形式: YYYY-MM-DDTHH:mm:ss.sssZ）
        visitAcquisitionDate: seller.visit_acquisition_date || undefined, // 文字列のまま返す（YYYY-MM-DD形式、タイムゾーン変換なし）
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
        situation_company: seller.situation_company,  // 状況（当社）
        // 担当者設定フィールド（call-mode-assignee-section）
        unreachableSmsAssignee: seller.unreachable_sms_assignee,
        valuationSmsAssignee: seller.valuation_sms_assignee,
        valuationReasonEmailAssignee: seller.valuation_reason_email_assignee,
        valuationReason: seller.valuation_reason,
        cancelNoticeAssignee: seller.cancel_notice_assignee,
        longTermEmailAssignee: seller.long_term_email_assignee,
        callReminderEmailAssignee: seller.call_reminder_email_assignee,
        visitReminderAssignee: seller.visit_reminder_assignee,
        // inquiry_id と site_url
        inquiryId: seller.inquiry_id,
        siteUrl: seller.site_url,
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
        assigned_to,
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
      // メールアドレスでもマッピング（assigned_to はメールアドレスの場合がある）
      if (emp.email) {
        employeeMap.set(emp.email, { id: emp.id, name: emp.name || emp.email, initials: emp.initials || emp.name || emp.email });
      }
    }

    // 営担ごとの訪問数を集計
    const statsByEmployee: Record<string, { count: number; name: string; initials: string; employeeId: string }> = {};
    let totalVisits = 0;

    for (const seller of sellers || []) {
      // visit_assignee を優先、なければ assigned_to を使用
      const assignee = (seller as any).visit_assignee || (seller as any).assigned_to;
      
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
   * seller_sidebar_counts テーブルから1クエリで高速取得。
   * テーブルが空または取得失敗の場合は重いDBクエリにフォールバック。
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
    pinrichChangeRequired: number;
    exclusive: number;
    general: number;
    visitOtherDecision: number;
    unvisitedOtherDecision: number;
    visitAssignedCounts: Record<string, number>;
    todayCallAssignedCounts: Record<string, number>;
    todayCallWithInfoLabels: string[];
    todayCallWithInfoLabelCounts: Record<string, number>;
    // 福岡（FI）専用カウント
    fi_todayCall: number;
    fi_todayCallNotStarted: number;
    fi_todayCallWithInfo: number;
    fi_unvaluated: number;
    fi_todayCallWithInfoLabelCounts: Record<string, number>;
  }> {
    try {
      // seller_sidebar_countsテーブルから全行を取得（1クエリで高速）
      const { data: rows, error } = await this.table('seller_sidebar_counts')
        .select('category, count, label, assignee');

      if (error || !rows || rows.length === 0) {
        console.warn('⚠️ [SidebarCounts] Table empty or error, falling back to DB calculation:', error?.message);
        return this.getSidebarCountsFallback();
      }

      // テーブルのデータを返却形式に変換
      const getCount = (category: string) =>
        rows.find((r: any) => r.category === category && !r.label && !r.assignee)?.count ?? 0;

      const visitAssignedCounts: Record<string, number> = {};
      const todayCallAssignedCounts: Record<string, number> = {};
      const todayCallWithInfoLabelCounts: Record<string, number> = {};
      const fi_todayCallWithInfoLabelCounts: Record<string, number> = {};

      rows.forEach((r: any) => {
        if (r.category === 'visitAssigned' && r.assignee) {
          visitAssignedCounts[r.assignee] = r.count;
        } else if (r.category === 'todayCallAssigned' && r.assignee) {
          todayCallAssignedCounts[r.assignee] = r.count;
        } else if (r.category === 'todayCallWithInfo' && r.label) {
          todayCallWithInfoLabelCounts[r.label] = r.count;
        } else if (r.category === 'fi_todayCallWithInfo' && r.label) {
          fi_todayCallWithInfoLabelCounts[r.label] = r.count;
        }
      });

      const todayCallWithInfoLabels = Object.keys(todayCallWithInfoLabelCounts);

      console.log('✅ [SidebarCounts] Served from seller_sidebar_counts table (fast path)');

      return {
        todayCall: getCount('todayCall'),
        todayCallWithInfo: getCount('todayCallWithInfo'),
        todayCallAssigned: getCount('todayCallAssigned'),
        visitDayBefore: getCount('visitDayBefore'),
        visitCompleted: getCount('visitCompleted'),
        unvaluated: getCount('unvaluated'),
        mailingPending: getCount('mailingPending'),
        todayCallNotStarted: getCount('todayCallNotStarted'),
        pinrichEmpty: getCount('pinrichEmpty'),
        pinrichChangeRequired: getCount('pinrichChangeRequired'),
        exclusive: getCount('exclusive'),
        general: getCount('general'),
        visitOtherDecision: getCount('visitOtherDecision'),
        unvisitedOtherDecision: getCount('unvisitedOtherDecision'),
        visitAssignedCounts,
        todayCallAssignedCounts,
        todayCallWithInfoLabels,
        todayCallWithInfoLabelCounts,
        // 福岡（FI）専用カウント
        fi_todayCall: getCount('fi_todayCall'),
        fi_todayCallNotStarted: getCount('fi_todayCallNotStarted'),
        fi_todayCallWithInfo: getCount('fi_todayCallWithInfo'),
        fi_unvaluated: getCount('fi_unvaluated'),
        fi_todayCallWithInfoLabelCounts,
      };
    } catch (err) {
      console.warn('⚠️ [SidebarCounts] Unexpected error, falling back to DB calculation:', err);
      return this.getSidebarCountsFallback();
    }
  }

    /**
   * サイドバーカウントのフォールバック（重いDBクエリ版）
   * seller_sidebar_counts テーブルが空または取得失敗時に使用
   */
  private async getSidebarCountsFallback(): Promise<{
    todayCall: number;
    todayCallWithInfo: number;
    todayCallAssigned: number;
    visitDayBefore: number;
    visitCompleted: number;
    unvaluated: number;
    mailingPending: number;
    todayCallNotStarted: number;
    pinrichEmpty: number;
    pinrichChangeRequired: number;
    exclusive: number;
    general: number;
    visitOtherDecision: number;
    unvisitedOtherDecision: number;
    visitAssignedCounts: Record<string, number>;
    todayCallAssignedCounts: Record<string, number>;
    todayCallWithInfoLabels: string[];
    todayCallWithInfoLabelCounts: Record<string, number>;
    fi_todayCall: number;
    fi_todayCallNotStarted: number;
    fi_todayCallWithInfo: number;
    fi_unvaluated: number;
    fi_todayCallWithInfoLabelCounts: Record<string, number>;
  }> {
    // JST今日の日付を計算
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    // キャッシュなし: 常にDBの現在値から計算する（即時反映のため）

    console.log('🚀 [Performance] Starting sidebar counts calculation');
    const startTime = Date.now();

    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // 訪問日前日用データをページネーションで全件取得（Supabaseは range() でも最大1000件制限があるため）
    let visitAssigneeForDayBeforeAllData: any[] = [];
    {
      let vdbFallbackPage = 0;
      const vdbFallbackPageSize = 1000;
      while (true) {
        const { data: vdbData, error: vdbError } = await this.table('sellers')
          .select('visit_date, visit_assignee, visit_reminder_assignee')
          .is('deleted_at', null)
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .not('visit_date', 'is', null)
          .order('id')
          .range(vdbFallbackPage * vdbFallbackPageSize, (vdbFallbackPage + 1) * vdbFallbackPageSize - 1);
        if (vdbError || !vdbData || vdbData.length === 0) break;
        visitAssigneeForDayBeforeAllData = visitAssigneeForDayBeforeAllData.concat(vdbData);
        if (vdbData.length < vdbFallbackPageSize) break;
        vdbFallbackPage++;
      }
    }

    // 🚀 パフォーマンス改善: COUNT()クエリを使用してデータ取得量を最小限に抑える
    // 訪問日前日のみJavaScript計算が必要なため、データを取得
    const [
      visitCompletedCountResult,
      todayCallAssignedResult,
      allAssignedResult,
      todayCallBaseResult1,
      todayCallBaseResult2,
      unvaluatedSellersResult,
      mailingPendingCountResult,
      exclusiveSellersResult,
      generalSellersResult,
      visitOtherDecisionSellersResult,
      unvisitedOtherDecisionSellersResult,
    ] = await Promise.all([
      // 1. 訪問済みカウント
      this.table('sellers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .lt('visit_date', todayJST),
      // 3. 当日TEL（担当）用データ（イニシャル別カウントが必要）
      this.table('sellers')
        .select('visit_assignee')
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .lte('next_call_date', todayJST)
        .ilike('status', '%追客中%')
        .not('status', 'ilike', '%追客不要%')
        .not('status', 'ilike', '%専任媒介%')
        .not('status', 'ilike', '%一般媒介%')
        .not('status', 'ilike', '%他社買取%'),
      // 4. 担当(イニシャル)親カテゴリ用データ（イニシャル別カウントが必要）
      this.table('sellers')
        .select('visit_assignee')
        .is('deleted_at', null)
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', '')
        .not('status', 'ilike', '%一般媒介%')
        .not('status', 'ilike', '%専任媒介%')
        .not('status', 'ilike', '%追客不要%')
        .not('status', 'ilike', '%他社買取%'),
      // 5. 当日TEL分/当日TEL（内容）用データ（複雑なフィルタリングが必要）
      this.table('sellers')
        .select('id, seller_number, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
      this.table('sellers')
        .select('id, seller_number, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, inquiry_date, pinrich_status, confidence_level, exclusion_date, status')
        .is('deleted_at', null)
        .eq('status', '他決→追客')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', todayJST),
      // 6. 未査定用データ（複雑なフィルタリングが必要）
      this.table('sellers')
        .select('id, seller_number, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, valuation_method, inquiry_date, unreachable_status, confidence_level, exclusion_date, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
        .is('deleted_at', null)
        .ilike('status', '%追客中%')
        .gte('inquiry_date', cutoffDate)
        .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す'),
      // 7. 査定（郵送）カウント（条件: SellerSidebarCountsUpdateServiceと同じ）
      this.table('sellers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .in('status', ['追客中', '除外後追客中', '他決→追客'])
        .eq('valuation_method', '机上査定（郵送）')
        .eq('mailing_status', '未'),
      // 8. 専任カテゴリー用データ
      this.table('sellers')
        .select('exclusive_other_decision_meeting, next_call_date')
        .is('deleted_at', null)
        .in('status', ['専任媒介', '他決→専任', 'リースバック（専任）']),
      // 9. 一般カテゴリー用データ
      this.table('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, contract_year_month')
        .is('deleted_at', null)
        .eq('status', '一般媒介')
        .gte('contract_year_month', '2025-06-23'),
      // 10. 訪問後他決カテゴリー用データ
      this.table('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
        .is('deleted_at', null)
        .in('status', ['他決→追客', '他決→追客不要', '一般→他決', '他社買取'])
        .not('visit_assignee', 'is', null)
        .neq('visit_assignee', ''),
      // 11. 未訪問他決カテゴリー用データ
      this.table('sellers')
        .select('exclusive_other_decision_meeting, next_call_date, visit_assignee')
        .is('deleted_at', null)
        .in('status', ['他決→追客', '他決→追客不要', '一般→他決']),
    ]);

    // 12. Pinrich要変更カテゴリー用データ（ページネーション対応）
    let pinrichCandidatesAllFallback: any[] = [];
    {
      let pcPage = 0;
      const pcPageSize = 1000;
      while (true) {
        const { data: pcData, error: pcError } = await this.table('sellers')
          .select('id, visit_assignee, pinrich_status, status, confidence_level, visit_date, contract_year_month')
          .is('deleted_at', null)
          .or('pinrich_status.eq.配信中,pinrich_status.eq.クローズ,confidence_level.eq.D')
          .range(pcPage * pcPageSize, (pcPage + 1) * pcPageSize - 1);
        if (pcError || !pcData || pcData.length === 0) break;
        pinrichCandidatesAllFallback = pinrichCandidatesAllFallback.concat(pcData);
        if (pcData.length < pcPageSize) break;
        pcPage++;
      }
    }

    console.log(`⏱️ [Performance] Parallel queries completed in ${Date.now() - startTime}ms`);

    // ヘルパー関数: 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）
    const hasValidVisitAssignee = (visitAssignee: string | null | undefined): boolean => {
      if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
        return false;
      }
      return true;
    };

    // 1. 訪問日前日のカウント計算（JavaScript計算が必要）
    const visitAssigneeSellers = visitAssigneeForDayBeforeAllData;
    const visitDayBeforeCount = visitAssigneeSellers.filter(s => {
      const visitDateStr = s.visit_date;
      if (!visitDateStr) return false;
      const reminderAssignee = (s as any).visit_reminder_assignee || '';
      if (reminderAssignee.trim() !== '') return false;
      
      const visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
      const parts = visitDateOnly.split('-');
      if (parts.length !== 3) return false;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 0-indexed
      const day = parseInt(parts[2]);
      const visitDateUTC = new Date(Date.UTC(year, month, day));
      const visitDayOfWeek = visitDateUTC.getUTCDay();
      const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
      const expectedNotifyUTC = new Date(visitDateUTC);
      expectedNotifyUTC.setUTCDate(visitDateUTC.getUTCDate() - daysBeforeVisit);
      const expectedNotifyStr = `${expectedNotifyUTC.getUTCFullYear()}-${String(expectedNotifyUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(expectedNotifyUTC.getUTCDate()).padStart(2, '0')}`;
      return expectedNotifyStr === todayJST;
    }).length;

    // 2. 訪問済みカウント
    const visitCompletedCount = visitCompletedCountResult.count || 0;

    // 3. 当日TEL（担当）のカウントとイニシャル別集計
    const todayCallAssignedSellers = todayCallAssignedResult.data || [];
    const todayCallAssignedCount = todayCallAssignedSellers.length;
    const todayCallAssignedCounts: Record<string, number> = {};
    todayCallAssignedSellers.forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) todayCallAssignedCounts[a] = (todayCallAssignedCounts[a] || 0) + 1;
    });

    // 4. 担当(イニシャル)親カテゴリのイニシャル別集計
    const allAssignedSellers = allAssignedResult.data || [];
    const visitAssignedCounts: Record<string, number> = {};
    allAssignedSellers.forEach((s: any) => {
      const a = s.visit_assignee;
      if (a) visitAssignedCounts[a] = (visitAssignedCounts[a] || 0) + 1;
    });

    // 5. 当日TEL分/当日TEL（内容）の計算
    const allTodayCallBase = [...(todayCallBaseResult1.data || []), ...(todayCallBaseResult2.data || [])];
    const seenIds = new Set<string>();
    const todayCallBaseSellers = allTodayCallBase.filter(s => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
      return !hasValidVisitAssignee(s.visit_assignee);
    });

    // FI（福岡）売主と通常売主を分離（seller_numberがFIで始まるかどうか）
    const isFiSeller = (s: any): boolean => {
      const num = (s.seller_number || s.sellerNumber || '').toString();
      return num.startsWith('FI');
    };

    const filteredTodayCallNormal = filteredTodayCallSellers.filter(s => !isFiSeller(s));
    const filteredTodayCallFI = filteredTodayCallSellers.filter(s => isFiSeller(s));

    const todayCallWithInfoSellers = filteredTodayCallNormal.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return hasInfo;
    });
    const todayCallWithInfoCount = todayCallWithInfoSellers.length;

    const labelCountMap: Record<string, number> = {};
    const isValidValue = (v: string | null | undefined): boolean =>
      !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
    todayCallWithInfoSellers.forEach(s => {
      const parts: string[] = [];
      if (isValidValue(s.phone_contact_person)) parts.push(s.phone_contact_person!.trim());
      if (isValidValue(s.preferred_contact_time)) parts.push(s.preferred_contact_time!.trim());
      if (isValidValue(s.contact_method)) parts.push(s.contact_method!.trim());
      const label = parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
      labelCountMap[label] = (labelCountMap[label] || 0) + 1;
    });
    const todayCallWithInfoLabels = Object.keys(labelCountMap);

    const todayCallNoInfoCount = filteredTodayCallNormal.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      // 当日TEL_未着手（todayCallNotStarted）に該当する場合は除外（未着手を優先）
      const status = (s as any).status || '';
      const unreachable = (s as any).unreachable_status || '';
      const confidence = (s as any).confidence_level || '';
      const inquiryDate = (s as any).inquiry_date || '';
      const isNotStarted = (
        status === '追客中' &&
        !unreachable &&
        confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
        inquiryDate >= '2026-01-01'
      );
      return !isNotStarted;
    }).length;

    // 6. 未査定のカウント（FI分離）
    const unvaluatedSellers = unvaluatedSellersResult.data || [];
    const unvaluatedFilterFn = (s: any): boolean => {
      const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
      const valuationMethod = (s as any).valuation_method || '';
      const isNotRequired = valuationMethod === '不要';
      if (!hasNoValuation || isNotRequired) return false;
      const status = (s as any).status || '';
      const nextCallDate = (s as any).next_call_date || '';
      const hasInfo = ((s as any).phone_contact_person?.trim()) ||
                      ((s as any).preferred_contact_time?.trim()) ||
                      ((s as any).contact_method?.trim());
      const unreachable = (s as any).unreachable_status || '';
      const confidence = (s as any).confidence_level || '';
      const inquiryDate = (s as any).inquiry_date || '';
      const isTodayCallNotStarted = (
        status === '追客中' &&
        nextCallDate && nextCallDate <= todayJST &&
        !hasInfo &&
        !unreachable &&
        confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
        inquiryDate >= '2026-01-01'
      );
      return !isTodayCallNotStarted;
    };
    const isFiSellerNum = (s: any): boolean => {
      const num = (s.seller_number || s.sellerNumber || '').toString();
      return num.startsWith('FI');
    };
    const unvaluatedCount = unvaluatedSellers.filter(s => !isFiSellerNum(s) && unvaluatedFilterFn(s)).length;
    const fi_unvaluatedCount = unvaluatedSellers.filter(s => isFiSellerNum(s) && unvaluatedFilterFn(s)).length;

    // 7. 査定（郵送）カウント
    const mailingPendingCount = mailingPendingCountResult.count || 0;

    // 8. 当日TEL_未着手
    // バグ修正: filteredTodayCallSellers は ilike('%追客中%') ベースのため「除外後追客中」などが混入する
    // listSellers() の todayCallNotStarted と同じ条件（status === '追客中' 完全一致）を使用するため
    // filteredTodayCallSellers から status === '追客中' のみを抽出した notStartedBaseSellers を使用する
    const notStartedBaseSellers = filteredTodayCallNormal.filter(s => (s as any).status === '追客中');
    const todayCallNotStartedCount = notStartedBaseSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      const unreachable = (s as any).unreachable_status || '';
      if (unreachable && unreachable.trim() !== '') return false;
      const confidence = (s as any).confidence_level || '';
      if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
      const inquiryDate = (s as any).inquiry_date || '';
      return inquiryDate >= '2026-01-01';
    }).length;

    // FI（福岡）専用カウント計算
    const isValidValueFI = (v: string | null | undefined): boolean =>
      !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');
    const fi_todayCallWithInfoSellers = filteredTodayCallFI.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      return hasInfo;
    });
    const fi_todayCallWithInfoCount = fi_todayCallWithInfoSellers.length;
    const fi_labelCountMap: Record<string, number> = {};
    fi_todayCallWithInfoSellers.forEach(s => {
      const parts: string[] = [];
      if (isValidValueFI(s.phone_contact_person)) parts.push(s.phone_contact_person!.trim());
      if (isValidValueFI(s.preferred_contact_time)) parts.push(s.preferred_contact_time!.trim());
      if (isValidValueFI(s.contact_method)) parts.push(s.contact_method!.trim());
      const label = parts.length > 0 ? `当日TEL(${parts.join('・')})` : '当日TEL（内容）';
      fi_labelCountMap[label] = (fi_labelCountMap[label] || 0) + 1;
    });
    const fi_notStartedBaseSellers = filteredTodayCallFI.filter(s => (s as any).status === '追客中');
    const fi_todayCallNotStartedCount = fi_notStartedBaseSellers.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      const unreachable = (s as any).unreachable_status || '';
      if (unreachable && unreachable.trim() !== '') return false;
      const confidence = (s as any).confidence_level || '';
      if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
      const inquiryDate = (s as any).inquiry_date || '';
      return inquiryDate >= '2026-01-01';
    }).length;
    const fi_todayCallNoInfoCount = filteredTodayCallFI.filter(s => {
      const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                      (s.contact_method && s.contact_method.trim() !== '');
      if (hasInfo) return false;
      const status = (s as any).status || '';
      const unreachable = (s as any).unreachable_status || '';
      const confidence = (s as any).confidence_level || '';
      const inquiryDate = (s as any).inquiry_date || '';
      const isNotStarted = (
        status === '追客中' &&
        !unreachable &&
        confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
        inquiryDate >= '2026-01-01'
      );
      return !isNotStarted;
    }).length;

    // 9. Pinrich空欄: 次電日に関係なく「追客中 + Pinrich空欄 + 反響日2026/1/1以降 + 営担なし」
    // ※ filteredTodayCallSellers（次電日が今日以前）には依存しない
    let pinrichEmptyAllSellers: any[] = [];
    {
      let pePage = 0;
      const pePageSize = 1000;
      while (true) {
        const { data: peData, error: peError } = await this.table('sellers')
          .select('id, visit_assignee, pinrich_status, inquiry_date, status')
          .is('deleted_at', null)
          .ilike('status', '%追客%')
          .not('status', 'ilike', '%追客不要%')
          .not('status', 'ilike', '%専任媒介%')
          .not('status', 'ilike', '%一般媒介%')
          .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
          .or('pinrich_status.is.null,pinrich_status.eq.')
          .gte('inquiry_date', '2026-01-01')
          .range(pePage * pePageSize, (pePage + 1) * pePageSize - 1);
        if (peError || !peData || peData.length === 0) break;
        pinrichEmptyAllSellers = pinrichEmptyAllSellers.concat(peData);
        if (peData.length < pePageSize) break;
        pePage++;
      }
    }
    const pinrichEmptyCount = pinrichEmptyAllSellers.length;

    // 10. Pinrich要変更カテゴリー（条件A〜DのいずれかにマッチするものをJSでフィルタリング）
    const _excludedPinrichB = new Set(['クローズ', '登録不要', 'アドレスエラー', '配信不要（他決後、訪問後、担当付）', '△配信停止']);
    const _validStatusC = new Set(['専任媒介', '追客中', '除外後追客中']);
    const _validStatusD = new Set(['他決→追客', '他決→追客不要', '一般媒介']);
    const pinrichChangeRequiredCount = pinrichCandidatesAllFallback.filter(s => {
      const pinrich = s.pinrich_status || '';
      const status = s.status || '';
      const assignee = s.visit_assignee || '';
      const confidence = s.confidence_level || '';
      const visitDate = s.visit_date || '';
      const contractYM = s.contract_year_month ? String(s.contract_year_month).substring(0, 10) : '';

      const condA = assignee === '外す' && pinrich === 'クローズ' && status === '追客中';
      const condB = confidence === 'D' && !_excludedPinrichB.has(pinrich);
      const condC = !!visitDate && pinrich === '配信中' && !!assignee && assignee.trim() !== '' && _validStatusC.has(status);
      const condD = _validStatusD.has(status) && pinrich === 'クローズ' && contractYM >= '2025-05-01';

      return condA || condB || condC || condD;
    }).length;

    // 11. 専任カテゴリー
    const exclusiveSellers = exclusiveSellersResult.data || [];
    const exclusiveCount = exclusiveSellers.filter(s => {
      const meeting = s.exclusive_other_decision_meeting;
      if (meeting === '完了') return false;
      const nextCallDate = s.next_call_date;
      if (!nextCallDate) return true;
      return nextCallDate !== todayJST;
    }).length;

    // 11. 一般カテゴリー
    const generalSellers = generalSellersResult.data || [];
    const generalCount = generalSellers.filter(s => {
      const meeting = s.exclusive_other_decision_meeting;
      if (meeting === '完了') return false;
      const nextCallDate = s.next_call_date;
      if (!nextCallDate) return true;
      return nextCallDate !== todayJST;
    }).length;

    // 12. 訪問後他決カテゴリー
    const visitOtherDecisionSellers = visitOtherDecisionSellersResult.data || [];
    const visitOtherDecisionCount = visitOtherDecisionSellers.filter(s => {
      const meeting = s.exclusive_other_decision_meeting;
      if (meeting === '完了') return false;
      const nextCallDate = s.next_call_date;
      if (!nextCallDate) return true;
      return nextCallDate !== todayJST;
    }).length;

    // 13. 未訪問他決カテゴリー
    const unvisitedOtherDecisionSellers = unvisitedOtherDecisionSellersResult.data || [];
    const unvisitedOtherDecisionCount = unvisitedOtherDecisionSellers.filter(s => {
      const meeting = s.exclusive_other_decision_meeting;
      if (meeting === '完了') return false;
      const nextCallDate = s.next_call_date;
      if (!nextCallDate || nextCallDate !== todayJST) {
        const visitAssignee = s.visit_assignee;
        return !visitAssignee || visitAssignee === '' || visitAssignee === '外す';
      }
      return false;
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
      pinrichChangeRequired: pinrichChangeRequiredCount || 0,
      exclusive: exclusiveCount || 0,
      general: generalCount || 0,
      visitOtherDecision: visitOtherDecisionCount || 0,
      unvisitedOtherDecision: unvisitedOtherDecisionCount || 0,
      visitAssignedCounts,
      todayCallAssignedCounts,
      todayCallWithInfoLabels,
      todayCallWithInfoLabelCounts: labelCountMap,
      // 福岡（FI）専用カウント
      fi_todayCall: fi_todayCallNoInfoCount || 0,
      fi_todayCallNotStarted: fi_todayCallNotStartedCount || 0,
      fi_todayCallWithInfo: fi_todayCallWithInfoCount || 0,
      fi_unvaluated: fi_unvaluatedCount || 0,
      fi_todayCallWithInfoLabelCounts: fi_labelCountMap,
    };

    console.log(`✅ [Performance] Sidebar counts calculation completed in ${Date.now() - startTime}ms`);

    return sidebarResult;
  }
}
