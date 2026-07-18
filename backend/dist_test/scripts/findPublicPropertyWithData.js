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
async function findPublicPropertyWithData() {
    try {
        console.log('🔍 Finding 公開中 properties with data in 業務リスト...\n');
        // 1. 公開中の物件をすべて取得
        const { data: publicProperties, error } = await supabase
            .from('property_listings')
            .select('property_number, property_type, atbb_status')
            .eq('atbb_status', '公開中');
        if (error || !publicProperties) {
            console.error('❌ Error fetching public properties:', error);
            return;
        }
        console.log(`📊 Total 公開中 properties: ${publicProperties.length}\n`);
        // 2. 業務リストから直接データを取得
        const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
            spreadsheetId: process.env.GYOMU_LIST_SPREADSHEET_ID,
            sheetName: process.env.GYOMU_LIST_SHEET_NAME || '業務依頼',
            serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
        });
        await sheetsClient.authenticate();
        const gyomuListData = await sheetsClient.readAll();
        // 業務リストの物件番号をSetに変換
        const gyomuListPropertyNumbers = new Set(gyomuListData
            .filter(row => row['スプシURL'] || row['格納先URL'])
            .map(row => row['物件番号']));
        console.log(`📋 Properties with data in 業務リスト: ${gyomuListPropertyNumbers.size}\n`);
        // 3. 公開中かつ業務リストにある物件を探す
        const matchingProperties = publicProperties.filter(prop => gyomuListPropertyNumbers.has(prop.property_number));
        console.log(`🎯 公開中 AND 業務リストにある物件: ${matchingProperties.length}\n`);
        if (matchingProperties.length === 0) {
            console.log('❌ No matching properties found');
            console.log('\n💡 Suggestion: 業務リストにある物件を「公開中」に変更してください');
            return;
        }
        // 最初の5件を表示
        console.log('📝 First 5 matching properties:');
        for (const prop of matchingProperties.slice(0, 5)) {
            const gyomuData = gyomuListData.find(row => row['物件番号'] === prop.property_number);
            console.log(`\n✅ ${prop.property_number}`);
            console.log(`   Property Type: ${prop.property_type}`);
            console.log(`   ATBB Status: ${prop.atbb_status}`);
            console.log(`   スプシURL: ${gyomuData?.['スプシURL'] ? '✅ あり' : '❌ なし'}`);
            console.log(`   格納先URL: ${gyomuData?.['格納先URL'] ? '✅ あり' : '❌ なし'}`);
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
findPublicPropertyWithData();
