"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
async function findRealProperty() {
    try {
        console.log('🔍 Finding a real property with data in 業務リスト...\n');
        // 業務リストから直接データを取得
        const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
            spreadsheetId: process.env.GYOMU_LIST_SPREADSHEET_ID,
            sheetName: process.env.GYOMU_LIST_SHEET_NAME || '業務依頼',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        });
        await sheetsClient.authenticate();
        const allData = await sheetsClient.readAll();
        console.log(`📊 Total entries in 業務リスト: ${allData.length}\n`);
        // スプシURLまたは格納先URLがある物件を探す
        const propertiesWithData = allData.filter(row => row['スプシURL'] || row['格納先URL']);
        console.log(`📋 Properties with data: ${propertiesWithData.length}\n`);
        if (propertiesWithData.length === 0) {
            console.log('❌ No properties with data found in 業務リスト');
            return;
        }
        // 最初の5件を表示
        console.log('📝 First 5 properties with data:');
        propertiesWithData.slice(0, 5).forEach((row, index) => {
            console.log(`\n${index + 1}. ${row['物件番号']}`);
            console.log(`   スプシURL: ${row['スプシURL'] ? '✅ あり' : '❌ なし'}`);
            console.log(`   格納先URL: ${row['格納先URL'] ? '✅ あり' : '❌ なし'}`);
        });
        // これらの物件がproperty_listingsに存在し、公開中かチェック
        console.log('\n\n🔍 Checking if these properties exist in property_listings and are 公開中...\n');
        for (const row of propertiesWithData.slice(0, 10)) {
            const propertyNumber = row['物件番号'];
            const { data: property, error } = await supabase
                .from('property_listings')
                .select('property_number, atbb_status, property_type')
                .eq('property_number', propertyNumber)
                .single();
            if (property) {
                const isPublic = property.atbb_status === '公開中';
                console.log(`${isPublic ? '✅' : '⚠️'} ${propertyNumber}: ${property.atbb_status} (${property.property_type})`);
                if (isPublic) {
                    console.log(`\n🎯 Found a good test property: ${propertyNumber}`);
                    console.log(`   Property Type: ${property.property_type}`);
                    console.log(`   ATBB Status: ${property.atbb_status}`);
                    console.log(`   スプシURL: ${row['スプシURL'] ? '✅' : '❌'}`);
                    console.log(`   格納先URL: ${row['格納先URL'] ? '✅' : '❌'}`);
                    break;
                }
            }
            else {
                console.log(`❌ ${propertyNumber}: Not found in property_listings`);
            }
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
findRealProperty();
