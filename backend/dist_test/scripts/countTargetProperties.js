"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 対象物件数を正確にカウントするスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function countTargetProperties() {
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('🔍 Counting target properties...\n');
    // 全物件を取得
    const { data: allProperties, error } = await supabase
        .from('property_listings')
        .select('property_number, atbb_status');
    if (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
    console.log(`📊 Total properties: ${allProperties?.length || 0}`);
    // 成約済み判定
    const nonSold = allProperties?.filter(p => {
        const isSold = p.atbb_status &&
            p.atbb_status.includes('非公開') &&
            !p.atbb_status.includes('配信メール');
        return !isSold;
    });
    console.log(`✅ Non-sold properties (成約済み以外): ${nonSold?.length || 0}`);
    // サンプル表示（最初の10件）
    console.log('\n📋 Sample (first 10):');
    nonSold?.slice(0, 10).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.property_number} - ${p.atbb_status || '(no status)'}`);
    });
    console.log('\n✅ Count complete!');
    process.exit(0);
}
countTargetProperties();
