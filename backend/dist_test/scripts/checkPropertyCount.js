"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 物件数を確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function checkPropertyCount() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    console.log('🔍 Checking property counts...\n');
    // property_listingsの総数
    const { count: totalCount, error: totalError } = await supabase
        .from('property_listings')
        .select('*', { count: 'exact', head: true });
    if (totalError) {
        console.error('❌ Error getting total count:', totalError);
    }
    else {
        console.log(`📊 Total properties in property_listings: ${totalCount}`);
    }
    // 成約済み以外の件数
    const { data: properties, error: propertiesError } = await supabase
        .from('property_listings')
        .select('property_number, atbb_status');
    if (propertiesError) {
        console.error('❌ Error getting properties:', propertiesError);
    }
    else {
        const nonSold = properties?.filter(p => {
            const isSold = p.atbb_status &&
                p.atbb_status.includes('非公開') &&
                !p.atbb_status.includes('配信メール');
            return !isSold;
        });
        console.log(`📊 Non-sold properties (成約済み以外): ${nonSold?.length || 0}`);
    }
    // property_detailsの件数
    const { count: detailsCount, error: detailsError } = await supabase
        .from('property_details')
        .select('*', { count: 'exact', head: true });
    if (detailsError) {
        console.error('❌ Error getting details count:', detailsError);
    }
    else {
        console.log(`📊 Total records in property_details: ${detailsCount}`);
    }
    console.log('\n✅ Check complete!');
    process.exit(0);
}
checkPropertyCount();
