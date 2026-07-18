"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// storage_locationの状況を確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function checkStorageLocation() {
    console.log('🔍 storage_locationの状況を確認中...\n');
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // storage_locationがある物件を確認
    const { count: withStorage } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .not('storage_location', 'is', null);
    const { count: total } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true });
    console.log(`📊 storage_locationの状況:`);
    console.log(`  総件数: ${total}件`);
    console.log(`  storage_locationがある: ${withStorage}件`);
    console.log(`  storage_locationがない: ${(total || 0) - (withStorage || 0)}件`);
    // 公開中でstorage_locationがある物件
    const { data: publicWithStorage, count: publicWithStorageCount } = await supabase
        .from('property_listings')
        .select('property_number, atbb_status, storage_location', { count: 'exact' })
        .ilike('atbb_status', '%公開中%')
        .not('storage_location', 'is', null);
    console.log(`\n✅ 公開中でstorage_locationがある物件: ${publicWithStorageCount}件`);
    if (publicWithStorage && publicWithStorage.length > 0) {
        console.log('\n最初の3件:');
        publicWithStorage.slice(0, 3).forEach(p => {
            console.log(`  ${p.property_number}: ${p.storage_location?.substring(0, 60)}...`);
        });
    }
    // 公開中でstorage_locationがない物件
    const { count: publicWithoutStorage } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true })
        .ilike('atbb_status', '%公開中%')
        .is('storage_location', null);
    console.log(`\n❌ 公開中でstorage_locationがない物件: ${publicWithoutStorage}件`);
    process.exit(0);
}
checkStorageLocation().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
