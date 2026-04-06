import { createClient } from '@supabase/supabase-js';
import { CacheHelper } from '../utils/cache';
import { isTomorrow, isDaysFromToday, getDayOfWeek } from '../utils/dateHelpers';
import { invalidateBuyerStatusCache } from './BuyerService';

/**
 * サイドバーカウント即時更新サービス
 * 
 * データベース更新時にサイドバーカウントを即座に更新します。
 * GASの10分同期を待たずに、ブラウザUIに即座に反映されます。
 */
export class SidebarCountsUpdateService {
  private supabase;

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient || createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * 買主サイドバーカウントを更新
   * 
   * @param buyerNumberOrId 買主番号または買主ID
   * @param oldBuyerData 更新前の買主データ（オプション）
   */
  async updateBuyerSidebarCounts(buyerNumberOrId: string, oldBuyerData?: any): Promise<void> {
    try {
      console.log(`[SidebarCountsUpdateService] Updating buyer sidebar counts for buyer ${buyerNumberOrId}`);
      console.log(`[SidebarCountsUpdateService] oldBuyerData provided: ${!!oldBuyerData}`);

      // 買主番号かUUIDかを判定
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerNumberOrId);
      
      // 買主データを取得（更新後のデータ）
      let query = this.supabase
        .from('buyers')
        .select('*');
      
      if (isUuid) {
        query = query.eq('buyer_id', buyerNumberOrId);
      } else {
        // buyer_numberは数値型なので、文字列を数値に変換
        const buyerNumberInt = parseInt(buyerNumberOrId, 10);
        console.log(`[SidebarCountsUpdateService] Converted buyer_number to int: ${buyerNumberInt}`);
        query = query.eq('buyer_number', buyerNumberInt);
      }
      
      const { data: buyer, error } = await query.single();

      if (error || !buyer) {
        console.error(`[SidebarCountsUpdateService] Failed to fetch buyer ${buyerNumberOrId}:`, error);
        return;
      }

      console.log(`[SidebarCountsUpdateService] Found buyer: buyer_id=${buyer.buyer_id}, buyer_number=${buyer.buyer_number}`);

      // 更新前のカテゴリーを計算
      // oldBuyerDataが渡された場合はそれを使用、なければ空配列（初回は全て追加として扱う）
      const oldCategories = oldBuyerData 
        ? this.determineBuyerCategories(oldBuyerData)
        : [];
      
      console.log(`[SidebarCountsUpdateService] Old categories:`, oldCategories);

      // 更新後のカテゴリーを判定
      const newCategories = this.determineBuyerCategories(buyer);
      console.log(`[SidebarCountsUpdateService] New categories:`, newCategories);

      // 差分を計算
      const { added, removed } = this.calculateCategoryDiff(oldCategories, newCategories);

      console.log(`[SidebarCountsUpdateService] Buyer ${buyerNumberOrId} category changes:`, {
        added,
        removed
      });

      // カウントを更新
      for (const category of removed) {
        console.log(`[SidebarCountsUpdateService] Decrementing buyer category: ${category.category}, assignee: ${category.assignee}`);
        await this.incrementBuyerSidebarCount(category.category, category.assignee, -1);
      }

      for (const category of added) {
        console.log(`[SidebarCountsUpdateService] Incrementing buyer category: ${category.category}, assignee: ${category.assignee}`);
        await this.incrementBuyerSidebarCount(category.category, category.assignee, 1);
      }

      // Redisキャッシュを無効化
      await CacheHelper.del('buyers:sidebar-counts');
      console.log(`[SidebarCountsUpdateService] Invalidated buyer sidebar counts cache`);

      // 🚨 重要：インメモリキャッシュも無効化
      await invalidateBuyerStatusCache();

    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error updating buyer sidebar counts:`, error);
    }
  }

  /**
   * 売主サイドバーカウントを更新
   * 
   * @param sellerNumberOrId 売主番号または売主ID
   */
  async updateSellerSidebarCounts(sellerNumberOrId: string): Promise<void> {
    try {
      console.log(`[SidebarCountsUpdateService] Updating seller sidebar counts for seller ${sellerNumberOrId}`);

      // 売主番号かUUIDかを判定
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sellerNumberOrId);
      
      // 売主データを取得
      const query = this.supabase
        .from('sellers')
        .select('*');
      
      if (isUuid) {
        query.eq('id', sellerNumberOrId);
      } else {
        query.eq('seller_number', sellerNumberOrId);
      }
      
      const { data: seller, error } = await query.single();

      if (error || !seller) {
        console.error(`[SidebarCountsUpdateService] Failed to fetch seller ${sellerNumberOrId}:`, error);
        return;
      }

      // 更新前のカテゴリーを取得（実装は後で）
      const oldCategories = await this.getSellerCategories(seller.id);

      // 更新後のカテゴリーを判定
      const newCategories = this.determineSellerCategories(seller);

      // 差分を計算
      const { added, removed } = this.calculateCategoryDiff(oldCategories, newCategories);

      console.log(`[SidebarCountsUpdateService] Seller ${sellerNumberOrId} category changes:`, {
        added,
        removed
      });

      // カウントを更新
      for (const category of removed) {
        console.log(`[SidebarCountsUpdateService] Decrementing seller category: ${category.category}, assignee: ${category.assignee}`);
        await this.incrementSellerSidebarCount(category.category, category.assignee, -1);
      }

      for (const category of added) {
        console.log(`[SidebarCountsUpdateService] Incrementing seller category: ${category.category}, assignee: ${category.assignee}`);
        await this.incrementSellerSidebarCount(category.category, category.assignee, 1);
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
    // タイムゾーンを考慮した今日の日付（YYYY-MM-DD形式の文字列で比較）
    const todayStr = new Date().toISOString().split('T')[0];

    console.log(`[determineBuyerCategories] buyer_number=${buyer.buyer_number}, today=${todayStr}`);
    console.log(`[determineBuyerCategories] follow_up_assignee="${buyer.follow_up_assignee}", next_call_date="${buyer.next_call_date}"`);

    // 内覧日前日（dateHelpers.tsの関数を使用してタイムゾーン問題を回避）
    if (buyer.viewing_date && buyer.broker_inquiry !== '業者問合せ' && !buyer.notification_sender) {
      const dayOfWeek = getDayOfWeek(buyer.viewing_date);
      const isThursday = dayOfWeek === '木曜日';
      
      // 木曜内覧の場合は2日前（火曜）、それ以外は1日前
      const isViewingDayBefore = isThursday 
        ? isDaysFromToday(buyer.viewing_date, 2)
        : isTomorrow(buyer.viewing_date);
      
      if (isViewingDayBefore) {
        console.log(`[determineBuyerCategories] Adding viewingDayBefore category (viewing_date=${buyer.viewing_date}, dayOfWeek=${dayOfWeek})`);
        categories.push({ category: 'viewingDayBefore', assignee: null });
      }
    }

    // 当日TEL
    console.log(`[determineBuyerCategories] Checking todayCall: !follow_up_assignee=${!buyer.follow_up_assignee}, has next_call_date=${!!buyer.next_call_date}`);
    if (!buyer.follow_up_assignee && buyer.next_call_date) {
      const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
      console.log(`[determineBuyerCategories] next_call_date=${nextCallDateStr}, today=${todayStr}`);
      console.log(`[determineBuyerCategories] nextCallDateStr <= todayStr: ${nextCallDateStr <= todayStr}`);
      if (nextCallDateStr <= todayStr) {
        console.log(`[determineBuyerCategories] Adding todayCall category`);
        categories.push({ category: 'todayCall', assignee: null });
      }
    }

    // 担当(イニシャル)
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee;
    if (assignee) {
      categories.push({ category: 'assigned', assignee });

      // 当日TEL(イニシャル)
      if (buyer.next_call_date) {
        const nextCallDateStr = new Date(buyer.next_call_date).toISOString().split('T')[0];
        if (nextCallDateStr <= todayStr) {
          categories.push({ category: 'todayCallAssigned', assignee });
        }
      }
    }

    console.log(`[determineBuyerCategories] Final categories:`, categories);
    return categories;
  }

  /**
   * 売主のカテゴリーを判定
   */
  private determineSellerCategories(seller: any): Array<{ category: string; assignee: string | null }> {
    const categories: Array<{ category: string; assignee: string | null }> = [];
    // タイムゾーンを考慮した今日の日付（YYYY-MM-DD形式の文字列で比較）
    const todayStr = new Date().toISOString().split('T')[0];

    // 訪問日前日（dateHelpers.tsの関数を使用してタイムゾーン問題を回避）
    if (seller.visit_assignee && seller.visit_date) {
      const dayOfWeek = getDayOfWeek(seller.visit_date);
      const isThursday = dayOfWeek === '木曜日';
      
      // 木曜訪問の場合は2日前（火曜）、それ以外は1日前
      const isVisitDayBefore = isThursday 
        ? isDaysFromToday(seller.visit_date, 2)
        : isTomorrow(seller.visit_date);
      
      if (isVisitDayBefore) {
        console.log(`[determineSellerCategories] Adding visitDayBefore category (visit_date=${seller.visit_date}, dayOfWeek=${dayOfWeek})`);
        categories.push({ category: 'visitDayBefore', assignee: null });
      }
    }

    // 訪問済み
    if (seller.visit_assignee && seller.visit_date) {
      const visitDateStr = new Date(seller.visit_date).toISOString().split('T')[0];
      // 昨日の日付を計算
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (visitDateStr <= yesterdayStr) {
        categories.push({ category: 'visitCompleted', assignee: seller.visit_assignee });
      }
    }

    // 当日TEL分
    if (seller.status?.includes('追客中') && seller.next_call_date && !seller.visit_assignee) {
      const nextCallDateStr = new Date(seller.next_call_date).toISOString().split('T')[0];
      if (nextCallDateStr <= todayStr) {
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
          const nextCallDateStr = new Date(seller.next_call_date).toISOString().split('T')[0];
          if (nextCallDateStr <= todayStr) {
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
   * 買主の更新前カテゴリーを取得
   * 
   * データベースから更新前の買主データを取得して、カテゴリーを計算する
   */
  private async getBuyerCategories(buyerId: string): Promise<Array<{ category: string; assignee: string | null }>> {
    try {
      // データベースから更新前の買主データを取得
      // 注意: この時点では既に更新後のデータになっている可能性があるため、
      // 実際には更新前のデータを保持しておく必要がある
      // しかし、現在の実装では更新前のデータを保持していないため、
      // 空配列を返す（初回は全てのカテゴリーを「追加」として扱う）
      
      // TODO: 将来的には、updateBuyerSidebarCounts()の呼び出し元で
      // 更新前のデータを渡すようにする
      return [];
    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error fetching buyer categories:`, error);
      return [];
    }
  }

  /**
   * 売主の更新前カテゴリーを取得
   * 
   * seller_sidebar_countsテーブルから現在のカテゴリーを取得する代わりに、
   * 初回は空配列を返して全てのカテゴリーを「追加」として扱う
   */
  private async getSellerCategories(sellerId: string): Promise<Array<{ category: string; assignee: string | null }>> {
    // 初回は空配列を返す（全てのカテゴリーを「追加」として扱う）
    // 将来的には、seller_sidebar_countsテーブルから取得することも可能
    return [];
  }

  /**
   * 買主サイドバーカウントを増減
   */
  private async incrementBuyerSidebarCount(category: string, assignee: string | null, delta: number): Promise<void> {
    try {
      const key = assignee || '';
      
      // 既存のレコードを取得
      const { data: existing, error: fetchError } = await this.supabase
        .from('buyer_sidebar_counts')
        .select('*')
        .eq('category', category)
        .eq('assignee', key)
        .maybeSingle();

      if (fetchError) {
        console.error(`[SidebarCountsUpdateService] Error fetching buyer sidebar count:`, fetchError);
        return;
      }

      if (existing) {
        // 既存レコードを更新
        const newCount = Math.max(0, (existing.count || 0) + delta);
        const { error: updateError } = await this.supabase
          .from('buyer_sidebar_counts')
          .update({ 
            count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('category', category)
          .eq('assignee', key);

        if (updateError) {
          console.error(`[SidebarCountsUpdateService] Error updating buyer sidebar count:`, updateError);
        } else {
          console.log(`[SidebarCountsUpdateService] Updated buyer sidebar count: ${category}/${key} = ${newCount}`);
        }
      } else if (delta > 0) {
        // 新規レコードを作成（deltaが正の場合のみ）
        const { error: insertError } = await this.supabase
          .from('buyer_sidebar_counts')
          .insert({
            category,
            assignee: key,
            label: '',
            count: delta,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`[SidebarCountsUpdateService] Error inserting buyer sidebar count:`, insertError);
        } else {
          console.log(`[SidebarCountsUpdateService] Inserted buyer sidebar count: ${category}/${key} = ${delta}`);
        }
      }
    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error in incrementBuyerSidebarCount:`, error);
    }
  }

  /**
   * 売主サイドバーカウントを増減
   */
  private async incrementSellerSidebarCount(category: string, assignee: string | null, delta: number): Promise<void> {
    try {
      const key = assignee || '';
      
      // 既存のレコードを取得
      const { data: existing, error: fetchError } = await this.supabase
        .from('seller_sidebar_counts')
        .select('*')
        .eq('category', category)
        .eq('assignee', key)
        .maybeSingle();

      if (fetchError) {
        console.error(`[SidebarCountsUpdateService] Error fetching seller sidebar count:`, fetchError);
        return;
      }

      if (existing) {
        // 既存レコードを更新
        const newCount = Math.max(0, (existing.count || 0) + delta);
        const { error: updateError } = await this.supabase
          .from('seller_sidebar_counts')
          .update({ 
            count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('category', category)
          .eq('assignee', key);

        if (updateError) {
          console.error(`[SidebarCountsUpdateService] Error updating seller sidebar count:`, updateError);
        } else {
          console.log(`[SidebarCountsUpdateService] Updated seller sidebar count: ${category}/${key} = ${newCount}`);
        }
      } else if (delta > 0) {
        // 新規レコードを作成（deltaが正の場合のみ）
        const { error: insertError } = await this.supabase
          .from('seller_sidebar_counts')
          .insert({
            category,
            assignee: key,
            label: '',
            count: delta,
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`[SidebarCountsUpdateService] Error inserting seller sidebar count:`, insertError);
        } else {
          console.log(`[SidebarCountsUpdateService] Inserted seller sidebar count: ${category}/${key} = ${delta}`);
        }
      }
    } catch (error) {
      console.error(`[SidebarCountsUpdateService] Error in incrementSellerSidebarCount:`, error);
    }
  }
}
