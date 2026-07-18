"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 同期後のproperty_listingsデータを確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function checkSyncedData() {
    console.log('🔍 同期後のproperty_listingsデータを確認中...\n');
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // 全件数を確認
    const { count: totalCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true });
    console.log(`📊 property_listings総件数: ${totalCount}件\n`);
    // atbb_statusの分布を確認
    const { data: statusData } = await supabase
        .from('property_listings')
        .select('atbb_status')
        .not('atbb_status', 'is', null);
    const statusCounts = {};
    statusData?.forEach(row => {
        const status = row.atbb_status || '未設定';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📋 ATBB状態の分布:');
    Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}件`);
    });
    // 公開中の物件を確認
    const { data: publicProperties, count: publicCount } = await supabase
        .from('property_listings')
        .select('property_number, atbb_status, price, sales_price, address', { count: 'exact' })
        .or('atbb_status.ilike.%公開中%');
    console.log(`\n✅ 公開中の物件: ${publicCount}件`);
    if (publicProperties && publicProperties.length > 0) {
        console.log('\n最初の5件:');
        publicProperties.slice(0, 5).forEach(row => {
            const price = row.price || row.sales_price || 0;
            console.log(`  ${row.property_number}: ${row.atbb_status} - ${price}円 - ${row.address?.substring(0, 30) || '住所なし'}`);
        });
    }
    // priceとsales_priceの状況を確認
    const { count: priceCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .not('price', 'is', null);
    const { count: salesPriceCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .not('sales_price', 'is', null);
    console.log(`\n💰 価格データの状況:`);
    console.log(`  price（価格）がある物件: ${priceCount}件`);
    console.log(`  sales_price（売買価格）がある物件: ${salesPriceCount}件`);
    // addressの状況を確認
    const { count: addressCount } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .not('address', 'is', null);
    console.log(`  address（所在地）がある物件: ${addressCount}件`);
    process.exit(0);
}
checkSyncedData().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
