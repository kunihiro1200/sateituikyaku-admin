"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 公開中の物件数を確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
// .envファイルを読み込む
dotenv_1.default.config();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function countProperties() {
    console.log('📊 物件数を集計中...\n');
    // 全物件数
    const { count: total } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true });
    // 公開中の物件数
    const { count: publicCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .ilike('atbb_status', '%公開中%');
    // 成約済みの物件数（非公開 AND NOT 配信メール）
    const { data: allProperties } = await supabase
        .from('property_listings')
        .select('atbb_status');
    const soldCount = allProperties?.filter(p => p.atbb_status?.includes('非公開') &&
        !p.atbb_status?.includes('配信メール')).length || 0;
    // 成約済み以外の公開中
    const { data: publicProperties } = await supabase
        .from('property_listings')
        .select('atbb_status')
        .ilike('atbb_status', '%公開中%');
    const publicNotSoldCount = publicProperties?.filter(p => !(p.atbb_status?.includes('非公開') && !p.atbb_status?.includes('配信メール'))).length || 0;
    console.log('📊 集計結果:');
    console.log(`   全物件数: ${total}`);
    console.log(`   公開中: ${publicCount}`);
    console.log(`   成約済み: ${soldCount}`);
    console.log(`   成約済み以外の公開中: ${publicNotSoldCount}`);
    process.exit(0);
}
countProperties();
