"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function checkRealProperties() {
    console.log('🔍 実際に存在する物件を確認中（全ステータス）...\n');
    const { data, error } = await supabase
        .from('property_listings')
        .select('id, property_number, site_display, atbb_status, property_type')
        .like('property_number', 'AA%')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) {
        console.error('❌ エラー:', error);
        return;
    }
    if (!data || data.length === 0) {
        console.log('⚠️ 公開中の物件が見つかりませんでした');
        return;
    }
    console.log(`✅ ${data.length}件の公開中物件が見つかりました:\n`);
    data.forEach((property, index) => {
        console.log(`${index + 1}. ${property.property_number}`);
        console.log(`   ID: ${property.id}`);
        console.log(`   タイプ: ${property.property_type || '未設定'}`);
        console.log(`   サイト表示: ${property.site_display || '未設定'}`);
        console.log('');
    });
    console.log(`\n💡 テストには最初の物件を使用できます: ${data[0].property_number}`);
}
checkRealProperties().catch(console.error);
