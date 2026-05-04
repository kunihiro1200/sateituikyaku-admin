import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * スクレイピングしたURL情報
 */
export interface ScrapedUrlData {
  url: string;
  referenceUrl?: string; // 参照元URL（スクレイピング元のページURL）
  scrapedResultUrl?: string; // スクレイピング後のURL（公開物件サイトのURL）
  propertyNumber?: string;
  sourceSite: string; // 'athome', 'suumo'など
  title?: string;
  price?: string;
  address?: string;
}

/**
 * 重複チェック結果
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean; // 重複しているかどうか
  existingRecord?: {
    id: string;
    url: string;
    referenceUrl?: string; // 参照元URL
    scrapedResultUrl?: string; // スクレイピング後のURL
    propertyNumber?: string;
    sourceSite: string;
    scrapedAt: string;
    postedToDb: boolean;
    postedAt?: string;
  };
  message: string; // ユーザーへの表示メッセージ
}

/**
 * スクレイピングしたURLの管理サービス
 */
export class ScrapedUrlService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * URLの重複チェック
   */
  async checkDuplicate(url: string): Promise<DuplicateCheckResult> {
    try {
      const { data, error } = await this.supabase
        .from('scraped_urls')
        .select('*')
        .eq('url', url)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = レコードが見つからない（重複なし）
        throw error;
      }

      if (data) {
        // 重複あり
        const postedMessage = data.posted_to_db
          ? `この物件は${new Date(data.posted_at).toLocaleDateString('ja-JP')}に既に掲載されています。`
          : 'この物件は過去にスクレイピングされていますが、まだ掲載されていません。';

        return {
          isDuplicate: true,
          existingRecord: {
            id: data.id,
            url: data.url,
            referenceUrl: data.reference_url,
            scrapedResultUrl: data.scraped_result_url,
            propertyNumber: data.property_number,
            sourceSite: data.source_site,
            scrapedAt: data.scraped_at,
            postedToDb: data.posted_to_db,
            postedAt: data.posted_at,
          },
          message: `⚠️ 重複の可能性があります\n${postedMessage}\n前回スクレイピング日時: ${new Date(
            data.scraped_at
          ).toLocaleString('ja-JP')}`,
        };
      }

      // 重複なし
      return {
        isDuplicate: false,
        message: '✅ 新規物件です。掲載可能です。',
      };
    } catch (error) {
      console.error('Error checking duplicate URL:', error);
      throw error;
    }
  }

  /**
   * 物件番号での重複チェック（athome専用）
   */
  async checkDuplicateByPropertyNumber(
    propertyNumber: string,
    sourceSite: string = 'athome'
  ): Promise<DuplicateCheckResult> {
    try {
      const { data, error } = await this.supabase
        .from('scraped_urls')
        .select('*')
        .eq('property_number', propertyNumber)
        .eq('source_site', sourceSite)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const postedMessage = data.posted_to_db
          ? `この物件は${new Date(data.posted_at).toLocaleDateString('ja-JP')}に既に掲載されています。`
          : 'この物件は過去にスクレイピングされていますが、まだ掲載されていません。';

        return {
          isDuplicate: true,
          existingRecord: {
            id: data.id,
            url: data.url,
            referenceUrl: data.reference_url,
            scrapedResultUrl: data.scraped_result_url,
            propertyNumber: data.property_number,
            sourceSite: data.source_site,
            scrapedAt: data.scraped_at,
            postedToDb: data.posted_to_db,
            postedAt: data.posted_at,
          },
          message: `⚠️ 重複の可能性があります（物件番号: ${propertyNumber}）\n${postedMessage}\n前回スクレイピング日時: ${new Date(
            data.scraped_at
          ).toLocaleString('ja-JP')}`,
        };
      }

      return {
        isDuplicate: false,
        message: '✅ 新規物件です。掲載可能です。',
      };
    } catch (error) {
      console.error('Error checking duplicate by property number:', error);
      throw error;
    }
  }

  /**
   * スクレイピングしたURLを保存
   */
  async saveScrapedUrl(data: ScrapedUrlData): Promise<void> {
    try {
      const { error } = await this.supabase.from('scraped_urls').insert({
        url: data.url,
        reference_url: data.referenceUrl,
        scraped_result_url: data.scrapedResultUrl,
        property_number: data.propertyNumber,
        source_site: data.sourceSite,
        title: data.title,
        price: data.price,
        address: data.address,
        posted_to_db: false,
      });

      if (error) {
        // 重複エラーの場合は更新
        if (error.code === '23505') {
          // unique violation
          await this.updateScrapedUrl(data.url, {
            referenceUrl: data.referenceUrl,
            scrapedResultUrl: data.scrapedResultUrl,
            title: data.title,
            price: data.price,
            address: data.address,
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error saving scraped URL:', error);
      throw error;
    }
  }

  /**
   * スクレイピングしたURLを更新
   */
  async updateScrapedUrl(
    url: string,
    updates: {
      referenceUrl?: string;
      scrapedResultUrl?: string;
      title?: string;
      price?: string;
      address?: string;
    }
  ): Promise<void> {
    try {
      const updateData: any = {};
      if (updates.referenceUrl !== undefined)
        updateData.reference_url = updates.referenceUrl;
      if (updates.scrapedResultUrl !== undefined)
        updateData.scraped_result_url = updates.scrapedResultUrl;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.address !== undefined) updateData.address = updates.address;

      const { error } = await this.supabase
        .from('scraped_urls')
        .update(updateData)
        .eq('url', url);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating scraped URL:', error);
      throw error;
    }
  }

  /**
   * 掲載済みとしてマーク
   */
  async markAsPosted(url: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('scraped_urls')
        .update({
          posted_to_db: true,
          posted_at: new Date().toISOString(),
        })
        .eq('url', url);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error marking URL as posted:', error);
      throw error;
    }
  }

  /**
   * 未掲載のスクレイピング済みURLを取得
   */
  async getUnpostedUrls(sourceSite?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from('scraped_urls')
        .select('*')
        .eq('posted_to_db', false)
        .order('scraped_at', { ascending: false });

      if (sourceSite) {
        query = query.eq('source_site', sourceSite);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting unposted URLs:', error);
      throw error;
    }
  }

  /**
   * スクレイピング履歴を取得
   */
  async getScrapingHistory(
    limit: number = 50,
    sourceSite?: string
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from('scraped_urls')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(limit);

      if (sourceSite) {
        query = query.eq('source_site', sourceSite);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting scraping history:', error);
      throw error;
    }
  }
}
