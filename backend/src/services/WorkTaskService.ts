import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorkTaskData } from './WorkTaskColumnMapper';

export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * 業務依頼データサービス
 */
export class WorkTaskService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
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

  /**
   * 売主IDでデータを取得（売主番号 = 物件番号）
   */
  async getBySellerId(sellerId: string): Promise<WorkTaskData | null> {
    // まず売主テーブルから売主番号を取得
    const { data: seller, error: sellerError } = await this.supabase
      .from('sellers')
      .select('seller_number')
      .eq('id', sellerId)
      .single();

    if (sellerError || !seller) {
      return null;
    }

    // 売主番号で業務依頼データを取得
    return this.getByPropertyNumber(seller.seller_number);
  }

  /**
   * 売主番号でデータを取得
   */
  async getBySellerNumber(sellerNumber: string): Promise<WorkTaskData | null> {
    return this.getByPropertyNumber(sellerNumber);
  }

  /**
   * 一覧取得（一覧表示に必要なカラムのみ取得してパフォーマンス改善）
   * property_listingsのsales_contract_completedも結合して返す
   * work_tasks取得とproperty_listings全件取得を並列実行して高速化
   */
  async list(options: ListOptions = {}): Promise<WorkTaskData[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc',
    } = options;

    // work_tasks と property_listings を並列取得
    const [workTasksResult, listingsResult] = await Promise.all([
      this.supabase
        .from('work_tasks')
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1),
      this.supabase
        .from('property_listings')
        .select('property_number, sales_contract_completed'),
    ]);

    if (workTasksResult.error || !workTasksResult.data) {
      return [];
    }

    const data = workTasksResult.data;

    // property_listingsの結合
    try {
      if (listingsResult.data) {
        const listingMap: Record<string, string> = {};
        listingsResult.data.forEach((l: any) => {
          if (l.property_number) listingMap[l.property_number] = l.sales_contract_completed || '';
        });
        return data.map((t: any) => ({
          ...t,
          sales_contract_completed: listingMap[t.property_number] || '',
        })) as WorkTaskData[];
      }
    } catch {
      // 結合失敗時はwork_tasksのみ返す
    }

    return data as WorkTaskData[];
  }

  /**
   * 決済予定月で検索
   */
  async getBySettlementMonth(month: string): Promise<WorkTaskData[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*')
      .eq('settlement_scheduled_month', month)
      .order('settlement_date', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as WorkTaskData[];
  }

  /**
   * 決済日の範囲で検索
   */
  async getBySettlementDateRange(startDate: string, endDate: string): Promise<WorkTaskData[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*')
      .gte('settlement_date', startDate)
      .lte('settlement_date', endDate)
      .order('settlement_date', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as WorkTaskData[];
  }

  /**
   * 総件数を取得
   */
  async count(): Promise<number> {
    const { count, error } = await this.supabase
      .from('work_tasks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return 0;
    }

    return count || 0;
  }

  /**
   * 媒介契約修正履歴を取得（mediation_revision='あり' のレコード）
   * creator未指定で全件、指定時は絞り込み
   */
  async getMediationRevisionsByCreator(creator?: string, excludePropertyNumber?: string): Promise<WorkTaskData[]> {
    let query = this.supabase
      .from('work_tasks')
      .select('property_number, mediation_completed, mediation_checker, mediation_creator, mediation_revision_content, mediation_revision_countermeasure')
      .eq('mediation_revision', 'あり')
      .not('mediation_revision_content', 'is', null)
      .neq('mediation_revision_content', '')
      .order('mediation_completed', { ascending: false })
      .limit(50);

    if (creator) {
      query = query.eq('mediation_creator', creator);
    }

    if (excludePropertyNumber) {
      query = query.neq('property_number', excludePropertyNumber);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as WorkTaskData[];
  }

  /**
   * サイト登録修正履歴を取得（site_registration_revision='あり' のレコード）
   */
  async getSiteRegistrationRevisions(excludePropertyNumber?: string): Promise<WorkTaskData[]> {
    let query = this.supabase
      .from('work_tasks')
      .select('property_number, site_registration_ok_sent, site_registration_confirmer, site_registration_requester, site_registration_revision_content, site_registration_revision_countermeasure')
      .eq('site_registration_revision', 'あり')
      .not('site_registration_revision_content', 'is', null)
      .neq('site_registration_revision_content', '')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (excludePropertyNumber) {
      query = query.neq('property_number', excludePropertyNumber);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as WorkTaskData[];
  }

  /**
   * 間取図修正（当社ミス）履歴を取得（floor_plan_revision_correction='あり' のレコード）
   */
  async getFloorPlanRevisionCorrections(excludePropertyNumber?: string): Promise<WorkTaskData[]> {
    let query = this.supabase
      .from('work_tasks')
      .select('property_number, floor_plan_ok_sent, floor_plan_confirmer, site_registration_requester, floor_plan_revision_correction_content, floor_plan_revision_countermeasure')
      .eq('floor_plan_revision_correction', 'あり')
      .not('floor_plan_revision_correction_content', 'is', null)
      .neq('floor_plan_revision_correction_content', '')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (excludePropertyNumber) {
      query = query.neq('property_number', excludePropertyNumber);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as WorkTaskData[];
  }

  /**
   * 物件番号でデータを更新
   */
  async updateByPropertyNumber(propertyNumber: string, updates: Partial<WorkTaskData>): Promise<WorkTaskData | null> {
    // updated_atを自動更新
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('work_tasks')
      .update(updateData)
      .eq('property_number', propertyNumber)
      .select()
      .single();

    if (error) {
      console.error('業務依頼データ更新エラー:', error);
      throw new Error(`更新に失敗しました: ${error.message}`);
    }

    return data as WorkTaskData;
  }
}
