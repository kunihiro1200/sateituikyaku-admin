import { createClient } from '@supabase/supabase-js';
import { CacheHelper } from '../utils/cache';

/**
 * サイドバーカウント即時更新サービス
 * 
 * データベース更新時にサイドバーカウントを即座に更新します。
 * GASの10分同期を待たずに、ブラウザUIに即座に反映されます。
 */
export class SidebarCountsUpdateService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * 買主サイドバーカウントを更新
   * 
   * @param buyerId 買主ID
   */
  async updateBuyerSidebarCounts(buyerId: string): Promise<void> {
    try {
      console.log(`[SidebarCountsUpdateService] Updating buyer sidebar counts for buyer ${buyerId}`);

      // 買主データを取得
      const { data: buyer, error } = await this.supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();

      if (error || !buyer) {
        console.error(`[SidebarCountsUpdateService] Failed to fetch buyer ${buyerId}:`, error);
        return;
      }

      // 更新前のカテゴリーを取得（実装は後で）
      const oldCategories = await this.getBuyerCategories(buyerId);

      // 更新後のカテゴリーを判定
      const newCategories = this.determineBuyerCategories(buyer);

      // 差分を計算
      const { added, removed } = this.calculateCategoryDiff(oldCategories, newCategories);

      console.log(`[SidebarCountsUpdateService] Buyer ${buyerId} category changes:`, {
        added,
        removed
      });

      // カウントを更新（データベース関数は後で実装）
      for (const category of removed) {
        console.log(`[SidebarCountsUpdateService] Would decrement buyer category: ${category}`);
      }

      for (const category of added) {
        console.log(`[SidebarCountsUpdateService] Would increment buyer category: ${category}`);
      }

      // Redisキャッシュを無効化
      await CacheHelper.del('buyers:sidebar-counts');
      console.log(`[SidebarCountsUpdateService] Invalidated buyer sidebar counts cache`);

    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error updating buyer sidebar counts:`, error);
    }
  }

  /**
   * 売主サイドバーカウントを更新
   * 
   * @param sellerId 売主ID
   */
  async updateSellerSidebarCounts(sellerId: string): Promise<void> {
    try {
      console.log(`[SidebarCountsUpdateService] Updating seller sidebar counts for seller ${sellerId}`);

      // 売主データを取得
      const { data: seller, error } = await this.supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (error || !seller) {
        console.error(`[SidebarCountsUpdateService] Failed to fetch seller ${sellerId}:`, error);
        return;
      }

      // 更新前のカテゴリーを取得（実装は後で）
      const oldCategories = await this.getSellerCategories(sellerId);

      // 更新後のカテゴリーを判定
      const newCategories = this.determineSellerCategories(seller);

      // 差分を計算
      const { added, removed } = this.calculateCategoryDiff(oldCategories, newCategories);

      console.log(`[SidebarCountsUpdateService] Seller ${sellerId} category changes:`, {
        added,
        removed
      });

      // カウントを更新（データベース関数は後で実装）
      for (const category of removed) {
        console.log(`[SidebarCountsUpdateService] Would decrement seller category: ${category}`);
      }

      for (const category of added) {
        console.log(`[SidebarCountsUpdateService] Would increment seller category: ${category}`);
      }

      // Redisキャッシュを無効化
      await CacheHelper.del('sellers:sidebar-counts');
      console.log(`[SidebarCountsUpdateService] Invalidated seller sidebar counts cache`);

    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error updating seller sidebar counts:`, error);
    }
  }

  /**
   * 買主のカテゴリーを判定
   */
  private determineBuyerCategories(buyer: any): Array<{ category: string; assignee: string | null }> {
    const categories: Array<{ category: string; assignee: string | null }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 内覧日前日
    if (buyer.viewing_date && !buyer.broker_inquiry && !buyer.notification_sender) {
      const viewingDate = new Date(buyer.viewing_date);
      viewingDate.setHours(0, 0, 0, 0);
      const viewingDay = viewingDate.getDay();
      const daysBeforeViewing = viewingDay === 4 ? 2 : 1;
      const notifyDate = new Date(viewingDate);
      notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

      if (today.getTime() === notifyDate.getTime()) {
        categories.push({ category: 'viewingDayBefore', assignee: null });
      }
    }

    // 当日TEL
    if (!buyer.follow_up_assignee && buyer.next_call_date) {
      const nextCallDate = new Date(buyer.next_call_date);
      nextCallDate.setHours(0, 0, 0, 0);
      if (nextCallDate.getTime() <= today.getTime()) {
        categories.push({ category: 'todayCall', assignee: null });
      }
    }

    // 担当(イニシャル)
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee;
    if (assignee) {
      categories.push({ category: 'assigned', assignee });

      // 当日TEL(イニシャル)
      if (buyer.next_call_date) {
        const nextCallDate = new Date(buyer.next_call_date);
        nextCallDate.setHours(0, 0, 0, 0);
        if (nextCallDate.getTime() <= today.getTime()) {
          categories.push({ category: 'todayCallAssigned', assignee });
        }
      }
    }

    return categories;
  }

  /**
   * 売主のカテゴリーを判定
   */
  private determineSellerCategories(seller: any): Array<{ category: string; assignee: string | null }> {
    const categories: Array<{ category: string; assignee: string | null }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 訪問日前日
    if (seller.visit_assignee && seller.visit_date) {
      const visitDate = new Date(seller.visit_date);
      visitDate.setHours(0, 0, 0, 0);
      const visitDay = visitDate.getDay();
      const daysBeforeVisit = visitDay === 4 ? 2 : 1;
      const notifyDate = new Date(visitDate);
      notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);

      if (today.getTime() === notifyDate.getTime()) {
        categories.push({ category: 'visitDayBefore', assignee: null });
      }
    }

    // 訪問済み
    if (seller.visit_assignee && seller.visit_date) {
      const visitDate = new Date(seller.visit_date);
      visitDate.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (visitDate.getTime() <= yesterday.getTime()) {
        categories.push({ category: 'visitCompleted', assignee: seller.visit_assignee });
      }
    }

    // 当日TEL分
    if (seller.status?.includes('追客中') && seller.next_call_date && !seller.visit_assignee) {
      const nextCallDate = new Date(seller.next_call_date);
      nextCallDate.setHours(0, 0, 0, 0);
      if (nextCallDate.getTime() <= today.getTime()) {
        const hasContactInfo = seller.contact_method || seller.preferred_contact_time || seller.phone_contact_person;
        if (!hasContactInfo) {
          categories.push({ category: 'todayCall', assignee: null });
        }
      }
    }

    // 担当(イニシャル)
    if (seller.visit_assignee) {
      const excludedStatuses = ['一般媒介', '専任媒介', '追客不要', '他社買取'];
      const isExcluded = excludedStatuses.some(status => seller.status?.includes(status));
      if (!isExcluded) {
        categories.push({ category: 'visitAssigned', assignee: seller.visit_assignee });

        // 当日TEL(イニシャル)
        if (seller.next_call_date) {
          const nextCallDate = new Date(seller.next_call_date);
          nextCallDate.setHours(0, 0, 0, 0);
          if (nextCallDate.getTime() <= today.getTime()) {
            categories.push({ category: 'todayCallAssigned', assignee: seller.visit_assignee });
          }
        }
      }
    }

    return categories;
  }

  /**
   * カテゴリーの差分を計算
   */
  private calculateCategoryDiff(
    oldCategories: Array<{ category: string; assignee: string | null }>,
    newCategories: Array<{ category: string; assignee: string | null }>
  ): {
    added: Array<{ category: string; assignee: string | null }>;
    removed: Array<{ category: string; assignee: string | null }>;
  } {
    const added = newCategories.filter(
      newCat => !oldCategories.some(
        oldCat => oldCat.category === newCat.category && oldCat.assignee === newCat.assignee
      )
    );

    const removed = oldCategories.filter(
      oldCat => !newCategories.some(
        newCat => newCat.category === oldCat.category && newCat.assignee === oldCat.assignee
      )
    );

    return { added, removed };
  }

  /**
   * 買主の更新前カテゴリーを取得（実装は後で）
   */
  private async getBuyerCategories(buyerId: string): Promise<Array<{ category: string; assignee: string | null }>> {
    // TODO: 実装
    return [];
  }

  /**
   * 売主の更新前カテゴリーを取得（実装は後で）
   */
  private async getSellerCategories(sellerId: string): Promise<Array<{ category: string; assignee: string | null }>> {
    // TODO: 実装
    return [];
  }
}
