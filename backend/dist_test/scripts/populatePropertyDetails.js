"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 全物件の追加詳細情報をproperty_detailsテーブルに保存するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyListingService_1 = require("../services/PropertyListingService");
const PropertyDetailsService_1 = require("../services/PropertyDetailsService");
const PropertyService_1 = require("../services/PropertyService");
const RecommendedCommentService_1 = require("../services/RecommendedCommentService");
const FavoriteCommentService_1 = require("../services/FavoriteCommentService");
const AthomeDataService_1 = require("../services/AthomeDataService");
// 環境変数を読み込む
dotenv_1.default.config();
// Google Sheets APIのクォータ制限エラーを検出
function isQuotaError(error) {
    const message = error?.message || '';
    return message.includes('Quota exceeded') ||
        message.includes('rateLimitExceeded') ||
        message.includes('Rate Limit Exceeded');
}
// 指定時間待機（分単位）
async function waitMinutes(minutes) {
    console.log(`\n⏳ Waiting ${minutes} minutes for quota recovery...`);
    const startTime = Date.now();
    const endTime = startTime + (minutes * 60 * 1000);
    // 1分ごとに残り時間を表示
    while (Date.now() < endTime) {
        const remaining = Math.ceil((endTime - Date.now()) / 60000);
        console.log(`   ⏰ ${remaining} minutes remaining...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1分待機
    }
    console.log('✅ Wait complete, resuming...\n');
}
async function populatePropertyDetails() {
    console.log('🚀 Starting property details population (成約済み以外)...\n');
    console.log('📝 Auto-retry enabled: Will wait 60 minutes if quota exceeded\n');
    const propertyListingService = new PropertyListingService_1.PropertyListingService();
    const propertyDetailsService = new PropertyDetailsService_1.PropertyDetailsService();
    const propertyService = new PropertyService_1.PropertyService();
    const recommendedCommentService = new RecommendedCommentService_1.RecommendedCommentService();
    const favoriteCommentService = new FavoriteCommentService_1.FavoriteCommentService();
    const athomeDataService = new AthomeDataService_1.AthomeDataService();
    try {
        // 全物件を取得（ページネーション）
        const BATCH_SIZE = 50;
        let offset = 0;
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        let totalSkipped = 0; // 成約済みでスキップした件数
        while (true) {
            console.log(`\n📊 Fetching properties (offset: ${offset}, limit: ${BATCH_SIZE})...`);
            // すべての物件を取得（フィルターなし）
            const { data: properties, total } = await propertyListingService.getAll({
                limit: BATCH_SIZE,
                offset: offset,
                orderBy: 'created_at',
                orderDirection: 'desc'
            });
            if (!properties || properties.length === 0) {
                console.log('✅ No more properties to process');
                break;
            }
            console.log(`📦 Processing ${properties.length} properties...`);
            // バッチ処理
            for (const property of properties) {
                // 成約済み判定
                const isSold = property.atbb_status &&
                    property.atbb_status.includes('非公開') &&
                    !property.atbb_status.includes('配信メール');
                if (isSold) {
                    console.log(`\n  ⏭️ Skipping ${property.property_number} (成約済み: ${property.atbb_status})`);
                    totalSkipped++;
                    continue;
                }
                let retryCount = 0;
                const MAX_RETRIES = 3;
                while (retryCount <= MAX_RETRIES) {
                    try {
                        console.log(`\n  Processing ${property.property_number}...`);
                        // 並列でデータを取得
                        const [propertyAbout, recommendedComment, favoriteComment, athomeData] = await Promise.all([
                            propertyService.getPropertyAbout(property.property_number).catch(err => {
                                if (isQuotaError(err))
                                    throw err; // クォータエラーは上位に伝播
                                console.log(`    ⚠️ Failed to get property_about: ${err.message}`);
                                return null;
                            }),
                            recommendedCommentService.getRecommendedComment(property.property_number, property.property_type, property.id).catch(err => {
                                if (isQuotaError(err))
                                    throw err; // クォータエラーは上位に伝播
                                console.log(`    ⚠️ Failed to get recommended_comments: ${err.message}`);
                                return { comments: [] };
                            }),
                            favoriteCommentService.getFavoriteComment(property.id).catch(err => {
                                if (isQuotaError(err))
                                    throw err; // クォータエラーは上位に伝播
                                console.log(`    ⚠️ Failed to get favorite_comment: ${err.message}`);
                                return { comment: null };
                            }),
                            athomeDataService.getAthomeData(property.property_number, property.property_type, property.storage_location).catch(err => {
                                if (isQuotaError(err))
                                    throw err; // クォータエラーは上位に伝播
                                console.log(`    ⚠️ Failed to get athome_data: ${err.message}`);
                                return { data: [] };
                            })
                        ]);
                        // property_detailsテーブルにupsert
                        // ⚠️ 重要: nullの値は含めない（既存データを保持するため）
                        try {
                            const updateData = {};
                            if (propertyAbout !== null && propertyAbout !== undefined) {
                                updateData.property_about = propertyAbout;
                            }
                            if (recommendedComment.comments && recommendedComment.comments.length > 0) {
                                updateData.recommended_comments = recommendedComment.comments;
                            }
                            if (athomeData.data && athomeData.data.length > 0) {
                                updateData.athome_data = athomeData.data;
                            }
                            if (favoriteComment.comment !== null && favoriteComment.comment !== undefined) {
                                updateData.favorite_comment = favoriteComment.comment;
                            }
                            // データがある場合のみupsert
                            if (Object.keys(updateData).length === 0) {
                                console.log(`    ⚠️ No data to save for ${property.property_number}`);
                                totalProcessed++;
                                break;
                            }
                            const success = await propertyDetailsService.upsertPropertyDetails(property.property_number, updateData);
                            if (success) {
                                console.log(`    ✅ Saved to database`);
                                totalSuccess++;
                            }
                            else {
                                console.log(`    ❌ Failed to save to database (returned false)`);
                                totalFailed++;
                            }
                        }
                        catch (dbError) {
                            console.error(`    ❌ Database error for ${property.property_number}:`, dbError.message);
                            console.error(`    📋 Error details:`, dbError);
                            totalFailed++;
                        }
                        totalProcessed++;
                        // Google Sheets APIのレート制限を考慮（100ms待機）
                        await new Promise(resolve => setTimeout(resolve, 100));
                        break; // 成功したらループを抜ける
                    }
                    catch (error) {
                        // クォータエラーの場合は60分待機して再試行
                        if (isQuotaError(error)) {
                            console.error(`    ⚠️ Quota exceeded for ${property.property_number}`);
                            if (retryCount < MAX_RETRIES) {
                                console.log(`    🔄 Retry ${retryCount + 1}/${MAX_RETRIES} after waiting...`);
                                await waitMinutes(60); // 60分待機
                                retryCount++;
                                continue; // リトライ
                            }
                            else {
                                console.error(`    ❌ Max retries reached for ${property.property_number}`);
                                totalFailed++;
                                totalProcessed++;
                                break;
                            }
                        }
                        // その他のエラー
                        console.error(`    ❌ Error processing ${property.property_number}:`, error.message);
                        totalFailed++;
                        totalProcessed++;
                        break;
                    }
                }
            }
            // 次のバッチへ
            offset += BATCH_SIZE;
            // 進捗表示
            console.log(`\n📊 Progress: ${totalProcessed + totalSkipped}/${total} (${Math.round((totalProcessed + totalSkipped) / total * 100)}%)`);
            console.log(`   ✅ Success: ${totalSuccess}`);
            console.log(`   ❌ Failed: ${totalFailed}`);
            console.log(`   ⏭️ Skipped (成約済み): ${totalSkipped}`);
            // すべて処理したら終了
            if (offset >= total) {
                break;
            }
            // バッチ間に1秒待機（Google Sheets APIのレート制限を考慮）
            console.log('\n⏳ Waiting 1 second before next batch...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n\n🎉 Population complete!');
        console.log(`📊 Total fetched: ${totalProcessed + totalSkipped}`);
        console.log(`✅ Success: ${totalSuccess}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log(`⏭️ Skipped (成約済み): ${totalSkipped}`);
    }
    catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
    process.exit(0);
}
// スクリプト実行
populatePropertyDetails();
