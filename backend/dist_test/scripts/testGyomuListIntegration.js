"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 業務リスト統合テスト
// おすすめコメントと画像URLが正しく取得できるかテスト
const dotenv_1 = __importDefault(require("dotenv"));
const RecommendedCommentService_1 = require("../services/RecommendedCommentService");
const AthomeDataService_1 = require("../services/AthomeDataService");
const GyomuListService_1 = require("../services/GyomuListService");
dotenv_1.default.config();
async function testGyomuListIntegration() {
    console.log('🧪 業務リスト統合テスト開始\n');
    const gyomuListService = new GyomuListService_1.GyomuListService();
    const recommendedCommentService = new RecommendedCommentService_1.RecommendedCommentService();
    const athomeDataService = new AthomeDataService_1.AthomeDataService();
    // テスト対象の物件番号（業務リストに存在する物件を指定）
    const testPropertyNumbers = ['AA10053', 'AA10105']; // 公開物件から2件
    for (const propertyNumber of testPropertyNumbers) {
        console.log(`\n📋 Testing ${propertyNumber}...`);
        console.log('='.repeat(50));
        try {
            // 1. 業務リストからデータ取得
            console.log('\n1️⃣ 業務リストからデータ取得...');
            const gyomuData = await gyomuListService.getByPropertyNumber(propertyNumber);
            if (!gyomuData) {
                console.log(`   ❌ 業務リストに${propertyNumber}が見つかりません`);
                continue;
            }
            console.log(`   ✅ 業務リストデータ取得成功:`);
            console.log(`      - スプシURL: ${gyomuData.spreadsheetUrl ? '✅ あり' : '❌ なし'}`);
            console.log(`      - 格納先URL: ${gyomuData.storageUrl ? '✅ あり' : '❌ なし'}`);
            // 2. おすすめコメント取得
            console.log('\n2️⃣ おすすめコメント取得...');
            const recommendedComment = await recommendedCommentService.getRecommendedComment(propertyNumber, '土地', // テスト用に土地を指定
            'test-id');
            console.log(`   ✅ おすすめコメント取得完了:`);
            console.log(`      - コメント行数: ${recommendedComment.comments.length}`);
            if (recommendedComment.comments.length > 0) {
                console.log(`      - 最初の行: ${recommendedComment.comments[0].join(', ')}`);
            }
            // 3. 画像URL取得
            console.log('\n3️⃣ 画像URL取得...');
            const athomeData = await athomeDataService.getAthomeData(propertyNumber, '土地', null);
            console.log(`   ✅ 画像URL取得完了:`);
            console.log(`      - データ件数: ${athomeData.data.length}`);
            if (athomeData.data.length > 0) {
                console.log(`      - 格納先URL: ${athomeData.data[0]}`);
            }
            console.log(`\n✅ ${propertyNumber} テスト完了`);
        }
        catch (error) {
            console.error(`\n❌ ${propertyNumber} テスト失敗:`, error.message);
            console.error('   詳細:', error);
        }
    }
    console.log('\n\n🎉 テスト完了');
}
testGyomuListIntegration();
