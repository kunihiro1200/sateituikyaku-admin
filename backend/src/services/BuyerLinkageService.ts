// 物件番号に基づいて買主データを効率的に取得するサービス
import { createClient } from '@supabase/supabase-js';

export interface BuyerSummary {
  id: string;
  buyer_id: string;
  buyer_number: string;
  name: string;
  phone_number: string;
  email: string;
  latest_status: string;
  latest_status_updated_at?: string | null;
  inquiry_confidence: string;
  reception_date: string;
  latest_viewing_date: string | null; // DBカラム名は viewing_date（エイリアス）
  viewing_time: string | null;
  next_call_date: string | null;
}

export interface BuyerListOptions {
  sortBy?: 'reception_date' | 'inquiry_confidence' | 'latest_viewing_date';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export class BuyerLinkageService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * property_number（カンマ区切りで複数物件を含む可能性がある）が
   * 指定した物件番号を「トークンとして完全一致」で含むかどうかを判定する。
   * ILIKE '%AA18%' のような部分一致だと "AA180" や "AA18-2" のような
   * 別物件までマッチしてしまうため、カンマで分割した各トークンと
   * 大文字小文字を無視した完全一致で比較する。
   */
  private static matchesPropertyNumber(rawPropertyNumber: string | null | undefined, propertyNumber: string): boolean {
    if (!rawPropertyNumber) {
      return false;
    }
    const target = propertyNumber.trim().toLowerCase();
    return rawPropertyNumber
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .some((token) => token === target);
  }

  /**
   * 複数物件の買主カウントを一括取得
   */
  async getBuyerCountsForProperties(propertyNumbers: string[]): Promise<Map<string, number>> {
    if (propertyNumbers.length === 0) {
      return new Map();
    }

    const counts = new Map<string, number>();
    // 初期化（0件の物件も返す）
    for (const propNum of propertyNumbers) {
      counts.set(propNum, 0);
    }

    try {
      // property_numberはカンマ区切りで複数物件を含む可能性があるため、
      // ILIKEで候補を絞り込んだ後、トークン単位の完全一致で件数を数える。
      // （ILIKEのみだと"AA18"が"AA180"等の別物件にもマッチしてしまうため）
      await Promise.all(
        propertyNumbers.map(async (propNum) => {
          const { data, error } = await this.supabase
            .from('buyers')
            .select('property_number')
            .ilike('property_number', `%${propNum}%`)
            .is('deleted_at', null);

          if (error) {
            console.error(`Failed to count buyers for property ${propNum}:`, error);
            counts.set(propNum, 0);
          } else {
            const exactCount = (data || []).filter((row) =>
              BuyerLinkageService.matchesPropertyNumber(row.property_number, propNum)
            ).length;
            counts.set(propNum, exactCount);
          }
        })
      );

      return counts;
    } catch (error) {
      console.error('Failed to get buyer counts:', error);
      return counts;
    }
  }

  /**
   * 特定物件の買主リストを取得
   */
  async getBuyersForProperty(
    propertyNumber: string,
    options: BuyerListOptions = {}
  ): Promise<BuyerSummary[]> {
    const {
      sortBy = 'reception_date',
      sortOrder = 'desc',
      limit
    } = options;

    try {
      // property_numberはカンマ区切りで複数物件を含む可能性があるため、
      // ILIKEで候補を絞り込んだ後、トークン単位の完全一致でフィルタする。
      // （ILIKEのみだと"AA18"が"AA180"等の別物件にもマッチしてしまうため）
      let query = this.supabase
        .from('buyers')
        .select(`
          buyer_id,
          buyer_number,
          name,
          phone_number,
          email,
          latest_status,
          latest_status_updated_at,
          inquiry_confidence,
          reception_date,
          viewing_date,
          viewing_time,
          next_call_date,
          follow_up_assignee,
          property_address,
          property_number,
          viewing_insight_executor,
          viewing_insight_companion,
          viewing_result_follow_up,
          budget
        `)
        .ilike('property_number', `%${propertyNumber}%`)
        .is('deleted_at', null)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch buyers for property: ${error.message}`);
      }

      // トークン単位の完全一致に絞り込む
      const exactMatches = (data || []).filter((buyer: any) =>
        BuyerLinkageService.matchesPropertyNumber(buyer.property_number, propertyNumber)
      );

      // limitはDB側のILIKE件数ではなく、完全一致後の件数に適用する
      const limited = limit ? exactMatches.slice(0, limit) : exactMatches;

      // buyer_idをidとしても返す（後方互換性のため）
      // viewing_date → latest_viewing_date にリネームしてフロントエンドに返す
      // property_numberは内部フィルタ用のみなのでレスポンスからは除外する
      const buyersWithId = limited.map((buyer: any) => {
        const { property_number, ...rest } = buyer;
        return {
          ...rest,
          id: buyer.buyer_id,
          latest_viewing_date: buyer.viewing_date ?? null,
        };
      });

      return buyersWithId;
    } catch (error) {
      console.error(`Failed to get buyers for property ${propertyNumber}:`, error);
      return [];
    }
  }

  /**
   * 高確度買主を持つ物件番号リストを取得
   */
  async getPropertiesWithHighConfidenceBuyers(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('property_number')
        .in('inquiry_confidence', ['A', 'S', 'A+', 'S+'])
        .not('property_number', 'is', null)
        .is('deleted_at', null);  // 削除済み買主を除外

      if (error) {
        throw new Error(`Failed to fetch high confidence properties: ${error.message}`);
      }

      // property_numberはカンマ区切りで複数の物件番号を含む可能性があるため、分割して重複を除去
      const propertyNumbers = new Set<string>();
      
      data?.forEach(row => {
        if (row.property_number) {
          const numbers = row.property_number.split(',').map((n: string) => n.trim()).filter((n: string) => n);
          numbers.forEach((num: string) => propertyNumbers.add(num));
        }
      });

      return Array.from(propertyNumbers);
    } catch (error) {
      console.error('Failed to get properties with high confidence buyers:', error);
      return [];
    }
  }

  /**
   * 特定物件の買主カウントを取得（単一物件用）
   */
  async getBuyerCountForProperty(propertyNumber: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('property_number')
        .ilike('property_number', `%${propertyNumber}%`)
        .is('deleted_at', null);  // 削除済み買主を除外

      if (error) {
        throw new Error(`Failed to count buyers: ${error.message}`);
      }

      return (data || []).filter((row) =>
        BuyerLinkageService.matchesPropertyNumber(row.property_number, propertyNumber)
      ).length;
    } catch (error) {
      console.error(`Failed to get buyer count for property ${propertyNumber}:`, error);
      return 0;
    }
  }

  /**
   * 特定物件に高確度買主がいるかチェック
   */
  async hasHighConfidenceBuyers(propertyNumber: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('property_number')
        .ilike('property_number', `%${propertyNumber}%`)
        .in('inquiry_confidence', ['A', 'S', 'A+', 'S+'])
        .is('deleted_at', null);  // 削除済み買主を除外

      if (error) {
        throw new Error(`Failed to check high confidence buyers: ${error.message}`);
      }

      return (data || []).some((row) =>
        BuyerLinkageService.matchesPropertyNumber(row.property_number, propertyNumber)
      );
    } catch (error) {
      console.error(`Failed to check high confidence buyers for property ${propertyNumber}:`, error);
      return false;
    }
  }
}
