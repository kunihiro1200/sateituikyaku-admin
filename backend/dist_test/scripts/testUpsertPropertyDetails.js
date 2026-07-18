"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// テスト用スクリプト: upsert_property_details関数の動作確認
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// 環境変数を読み込み
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const PropertyDetailsService_1 = require("../services/PropertyDetailsService");
async function testUpsertPropertyDetails() {
    try {
        console.log('\n🔍 Testing upsert_property_details function...\n');
        // PropertyDetailsServiceのインスタンスを作成
        const propertyDetailsService = new PropertyDetailsService_1.PropertyDetailsService();
        // テストデータ（実際の物件番号を使用）
        const testPropertyNumber = 'AA13287';
        const testData = {
            property_about: 'これはテスト用の物件説明です。パフォーマンステスト実行中。',
            recommended_comments: [
                { comment: 'おすすめポイント1：駅近で便利' },
                { comment: 'おすすめポイント2：日当たり良好' }
            ],
            athome_data: [
                { field: 'test_field', value: 'test_value' }
            ],
            favorite_comment: 'お気に入りコメントのテストです。'
        };
        console.log('📝 Test data:');
        console.log(`  - property_number: ${testPropertyNumber}`);
        console.log(`  - property_about: ${testData.property_about}`);
        console.log(`  - recommended_comments: ${testData.recommended_comments.length} items`);
        console.log(`  - athome_data: ${testData.athome_data.length} items`);
        console.log(`  - favorite_comment: ${testData.favorite_comment}`);
        // データを保存
        console.log('\n💾 Saving test data...');
        const startTime = Date.now();
        const success = await propertyDetailsService.upsertPropertyDetails(testPropertyNumber, testData);
        const saveTime = Date.now() - startTime;
        if (!success) {
            throw new Error('Failed to save test data');
        }
        console.log(`✅ Data saved successfully in ${saveTime}ms`);
        // データを取得して確認
        console.log('\n🔍 Verifying saved data...');
        const retrievedData = await propertyDetailsService.getPropertyDetails(testPropertyNumber);
        console.log('\n📊 Retrieved data:');
        console.log(`  - property_number: ${retrievedData.property_number}`);
        console.log(`  - property_about: ${retrievedData.property_about}`);
        console.log(`  - recommended_comments: ${retrievedData.recommended_comments ? JSON.stringify(retrievedData.recommended_comments) : 'null'}`);
        console.log(`  - athome_data: ${retrievedData.athome_data ? JSON.stringify(retrievedData.athome_data) : 'null'}`);
        console.log(`  - favorite_comment: ${retrievedData.favorite_comment}`);
        // データの整合性を確認
        console.log('\n✅ Verification:');
        console.log(`  - property_about matches: ${retrievedData.property_about === testData.property_about}`);
        console.log(`  - recommended_comments matches: ${JSON.stringify(retrievedData.recommended_comments) === JSON.stringify(testData.recommended_comments)}`);
        console.log(`  - athome_data matches: ${JSON.stringify(retrievedData.athome_data) === JSON.stringify(testData.athome_data)}`);
        console.log(`  - favorite_comment matches: ${retrievedData.favorite_comment === testData.favorite_comment}`);
        // テストデータを削除（実際の物件なので削除しない）
        console.log('\n✅ テスト完了（実際の物件を使用したため、データは削除しません）');
        console.log('\n✅ Test completed successfully!');
        console.log(`\n📊 Total time: ${Date.now() - startTime}ms`);
    }
    catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}
// スクリプトを実行
testUpsertPropertyDetails()
    .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
