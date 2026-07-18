"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 公開物件データの状態を確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function checkPublicPropertiesData() {
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('🔍 公開物件データの状態を確認中...\n');
    // 1. 全物件数
    const { count: totalCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true });
    console.log(`📊 全物件数: ${totalCount}`);
    // 2. atbb_statusごとの件数
    const { data: allProperties } = await supabase
        .from('property_listings')
        .select('atbb_status');
    const statusCounts = {};
    allProperties?.forEach(p => {
        const status = p.atbb_status || '未設定';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('\n📋 atbb_statusごとの件数:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}件`);
    });
    // 3. 公開中の物件を確認
    const { data: publicProperties, count: publicCount } = await supabase
        .from('property_listings')
        .select('property_number, atbb_status, price, address', { count: 'exact' })
        .ilike('atbb_status', '%公開中%')
        .limit(10);
    console.log(`\n✅ 公開中の物件: ${publicCount}件`);
    console.log('\n最初の10件:');
    publicProperties?.forEach(p => {
        console.log(`  ${p.property_number}: ${p.atbb_status} - ${p.price}万円 - ${p.address}`);
    });
    // 4. property_detailsテーブルの状態を確認
    const { count: detailsCount } = await supabase
        .from('property_details')
        .select('*', { count: 'exact', head: true });
    console.log(`\n📦 property_detailsテーブル: ${detailsCount}件`);
    // 5. サンプル物件の詳細を確認
    if (publicProperties && publicProperties.length > 0) {
        const sampleProperty = publicProperties[0];
        console.log(`\n🔍 サンプル物件の詳細: ${sampleProperty.property_number}`);
        const { data: details } = await supabase
            .from('property_details')
            .select('*')
            .eq('property_number', sampleProperty.property_number)
            .single();
        if (details) {
            console.log('  ✅ property_detailsに存在');
            console.log(`  - property_about: ${details.property_about ? '有' : '無'}`);
            console.log(`  - recommended_comments: ${details.recommended_comments ? details.recommended_comments.length + '件' : '無'}`);
            console.log(`  - athome_data: ${details.athome_data ? details.athome_data.length + '件' : '無'}`);
            console.log(`  - favorite_comment: ${details.favorite_comment ? '有' : '無'}`);
        }
        else {
            console.log('  ❌ property_detailsに存在しない');
        }
    }
    process.exit(0);
}
checkPublicPropertiesData();
