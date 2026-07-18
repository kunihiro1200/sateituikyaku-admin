"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
/**
 * 建売専門HP掲載物件数の確認用エンドポイント（認証なし）
 *
 * 使用方法:
 * GET /api/test/tateuri-property-count
 */
async function handler(req, res) {
    // テスト用エンドポイントであることを明示
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
        // 掲載中の建売物件数を取得
        const { count: activeCount, error: activeError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true)
            .eq('is_active', true);
        if (activeError) {
            throw activeError;
        }
        // 全建売物件数も取得
        const { count: totalCount, error: totalError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true);
        if (totalError) {
            throw totalError;
        }
        // source_urlが設定されている物件数
        const { count: withUrlCount, error: urlError } = await supabase
            .from('property_previews')
            .select('*', { count: 'exact', head: true })
            .eq('is_tateuri', true)
            .eq('is_active', true)
            .not('source_url', 'is', null)
            .neq('source_url', '');
        if (urlError) {
            throw urlError;
        }
        // サンプル物件を5件取得
        const { data: sampleProperties, error: sampleError } = await supabase
            .from('property_previews')
            .select('slug, title, price, address, source_url')
            .eq('is_tateuri', true)
            .eq('is_active', true)
            .limit(5);
        if (sampleError) {
            throw sampleError;
        }
        return res.status(200).json({
            success: true,
            activeProperties: activeCount || 0,
            totalProperties: totalCount || 0,
            propertiesWithUrl: withUrlCount || 0,
            sampleProperties: sampleProperties || [],
            message: `掲載中物件: ${activeCount || 0}件 / 全物件: ${totalCount || 0}件 / URL設定済み: ${withUrlCount || 0}件`,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('[Test] 物件数確認エラー:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}
