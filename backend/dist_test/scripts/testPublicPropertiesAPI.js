"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 公開物件APIが実際に何を返しているか確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function testPublicPropertiesAPI() {
    console.log('🔍 公開物件APIのレスポンスを確認中...\n');
    const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // APIが実際に実行しているクエリを再現
    const { data, error, count } = await supabase
        .from('property_details')
        .select(`
      *,
      property_listings!inner(
        property_number,
        atbb_status,
        address,
        property_type,
        seller_name,
        land_area,
        building_area,
        construction_year_month,
        floor_plan,
        storage_location,
        price,
        sales_price
      )
    `, { count: 'exact' })
        .ilike('property_listings.atbb_status', '%公開中%')
        .order('property_number', { ascending: false });
    console.log(`📊 取得件数: ${count}件`);
    if (error) {
        console.error('❌ エラー:', error);
        process.exit(1);
    }
    if (!data || data.length === 0) {
        console.log('❌ データが0件です');
        // property_detailsテーブルの状況を確認
        const { count: detailsCount } = await supabase
            .from('property_details')
            .select('*', { count: 'exact', head: true });
        console.log(`\nproperty_detailsテーブルの総件数: ${detailsCount}件`);
        // property_listingsで公開中の物件を確認
        const { data: publicListings, count: publicCount } = await supabase
            .from('property_listings')
            .select('property_number, atbb_status', { count: 'exact' })
            .ilike('atbb_status', '%公開中%');
        console.log(`property_listingsで公開中の物件: ${publicCount}件`);
        if (publicListings && publicListings.length > 0) {
            console.log('\n最初の5件:');
            publicListings.slice(0, 5).forEach(p => {
                console.log(`  ${p.property_number}: ${p.atbb_status}`);
            });
            // これらの物件がproperty_detailsにあるか確認
            const propertyNumbers = publicListings.slice(0, 5).map(p => p.property_number);
            const { data: detailsData } = await supabase
                .from('property_details')
                .select('property_number')
                .in('property_number', propertyNumbers);
            console.log(`\nこれらの物件のうち、property_detailsにあるもの: ${detailsData?.length || 0}件`);
            if (detailsData && detailsData.length > 0) {
                detailsData.forEach(d => console.log(`  ${d.property_number}`));
            }
        }
        process.exit(1);
    }
    console.log(`\n✅ データ取得成功: ${data.length}件\n`);
    // 最初の3件を詳細表示
    console.log('最初の3件の詳細:');
    data.slice(0, 3).forEach((property, index) => {
        console.log(`\n--- 物件 ${index + 1} ---`);
        console.log(`物件番号: ${property.property_number}`);
        console.log(`ATBB状態: ${property.property_listings?.atbb_status}`);
        console.log(`住所: ${property.property_listings?.address?.substring(0, 50) || 'なし'}`);
        console.log(`価格: ${property.property_listings?.price || property.property_listings?.sales_price || 'なし'}`);
        console.log(`物件種別: ${property.property_listings?.property_type || 'なし'}`);
        console.log(`おすすめコメント: ${property.recommended_comment?.substring(0, 50) || 'なし'}...`);
        console.log(`お気に入り文言: ${property.favorite_comment?.substring(0, 50) || 'なし'}...`);
        console.log(`画像URL数: ${property.image_urls?.length || 0}件`);
        if (property.image_urls && property.image_urls.length > 0) {
            console.log(`  最初の画像: ${property.image_urls[0]}`);
        }
    });
    process.exit(0);
}
testPublicPropertiesAPI().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
