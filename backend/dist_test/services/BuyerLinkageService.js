"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerLinkageService = void 0;
// 物件番号に基づいて買主データを効率的に取得するサービス
const supabase_js_1 = require("@supabase/supabase-js");
class BuyerLinkageService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    }
    /**
     * 複数物件の買主カウントを一括取得
     */
    async getBuyerCountsForProperties(propertyNumbers) {
        if (propertyNumbers.length === 0) {
            return new Map();
        }
        const counts = new Map();
        // 初期化（0件の物件も返す）
        for (const propNum of propertyNumbers) {
            counts.set(propNum, 0);
        }
        try {
            // 各物件番号に対して getBuyersForProperty と同じロジックで直接カウント
            await Promise.all(propertyNumbers.map(async (propNum) => {
                const { count, error } = await this.supabase
                    .from('buyers')
                    .select('*', { count: 'exact', head: true })
                    .eq('property_number', propNum)
                    .is('deleted_at', null);
                if (error) {
                    console.error(`Failed to count buyers for property ${propNum}:`, error);
                    counts.set(propNum, 0);
                }
                else {
                    counts.set(propNum, count || 0);
                }
            }));
            return counts;
        }
        catch (error) {
            console.error('Failed to get buyer counts:', error);
            return counts;
        }
    }
    /**
     * 特定物件の買主リストを取得
     */
    async getBuyersForProperty(propertyNumber, options = {}) {
        const { sortBy = 'reception_date', sortOrder = 'desc', limit } = options;
        try {
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
          viewing_insight_executor,
          viewing_insight_companion
        `)
                .eq('property_number', propertyNumber)
                .is('deleted_at', null)
                .order(sortBy, { ascending: sortOrder === 'asc' });
            if (limit) {
                query = query.limit(limit);
            }
            const { data, error } = await query;
            if (error) {
                throw new Error(`Failed to fetch buyers for property: ${error.message}`);
            }
            // buyer_idをidとしても返す（後方互換性のため）
            // viewing_date → latest_viewing_date にリネームしてフロントエンドに返す
            const buyersWithId = (data || []).map((buyer) => ({
                ...buyer,
                id: buyer.buyer_id,
                latest_viewing_date: buyer.viewing_date ?? null,
            }));
            return buyersWithId;
        }
        catch (error) {
            console.error(`Failed to get buyers for property ${propertyNumber}:`, error);
            return [];
        }
    }
    /**
     * 高確度買主を持つ物件番号リストを取得
     */
    async getPropertiesWithHighConfidenceBuyers() {
        try {
            const { data, error } = await this.supabase
                .from('buyers')
                .select('property_number')
                .in('inquiry_confidence', ['A', 'S', 'A+', 'S+'])
                .not('property_number', 'is', null)
                .is('deleted_at', null); // 削除済み買主を除外
            if (error) {
                throw new Error(`Failed to fetch high confidence properties: ${error.message}`);
            }
            // property_numberはカンマ区切りで複数の物件番号を含む可能性があるため、分割して重複を除去
            const propertyNumbers = new Set();
            data?.forEach(row => {
                if (row.property_number) {
                    const numbers = row.property_number.split(',').map((n) => n.trim()).filter((n) => n);
                    numbers.forEach((num) => propertyNumbers.add(num));
                }
            });
            return Array.from(propertyNumbers);
        }
        catch (error) {
            console.error('Failed to get properties with high confidence buyers:', error);
            return [];
        }
    }
    /**
     * 特定物件の買主カウントを取得（単一物件用）
     */
    async getBuyerCountForProperty(propertyNumber) {
        try {
            const { count, error } = await this.supabase
                .from('buyers')
                .select('*', { count: 'exact', head: true })
                .eq('property_number', propertyNumber)
                .is('deleted_at', null); // 削除済み買主を除外
            if (error) {
                throw new Error(`Failed to count buyers: ${error.message}`);
            }
            return count || 0;
        }
        catch (error) {
            console.error(`Failed to get buyer count for property ${propertyNumber}:`, error);
            return 0;
        }
    }
    /**
     * 特定物件に高確度買主がいるかチェック
     */
    async hasHighConfidenceBuyers(propertyNumber) {
        try {
            const { count, error } = await this.supabase
                .from('buyers')
                .select('*', { count: 'exact', head: true })
                .eq('property_number', propertyNumber)
                .in('inquiry_confidence', ['A', 'S', 'A+', 'S+'])
                .is('deleted_at', null); // 削除済み買主を除外
            if (error) {
                throw new Error(`Failed to check high confidence buyers: ${error.message}`);
            }
            return (count || 0) > 0;
        }
        catch (error) {
            console.error(`Failed to check high confidence buyers for property ${propertyNumber}:`, error);
            return false;
        }
    }
}
exports.BuyerLinkageService = BuyerLinkageService;
