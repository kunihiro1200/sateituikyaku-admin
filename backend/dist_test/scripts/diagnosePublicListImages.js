"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 公開物件一覧APIの画像取得を診断するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyListingService_1 = require("../services/PropertyListingService");
dotenv_1.default.config();
async function diagnosePublicListImages() {
    console.log('=== 公開物件一覧の画像取得診断 ===\n');
    const propertyListingService = new PropertyListingService_1.PropertyListingService();
    try {
        // 公開物件一覧を取得（最初の5件）
        console.log('📋 公開物件一覧を取得中...\n');
        const result = await propertyListingService.getPublicProperties({
            limit: 5,
            offset: 0,
        });
        console.log(`✅ 取得件数: ${result.properties.length}件\n`);
        // 各物件の画像情報を確認
        for (const property of result.properties) {
            console.log(`\n--- 物件: ${property.property_number} ---`);
            console.log(`物件ID: ${property.id}`);
            console.log(`物件タイプ: ${property.property_type}`);
            console.log(`ATBB状態: ${property.atbb_status}`);
            console.log(`格納先URL: ${property.storage_location || '(なし)'}`);
            console.log(`画像配列: ${property.images ? `[${property.images.length}件]` : '(なし)'}`);
            if (property.images && property.images.length > 0) {
                console.log(`✅ 画像あり: ${property.images[0]}`);
            }
            else {
                console.log(`❌ 画像なし`);
                // storage_locationがあるのに画像がない場合は詳細調査
                if (property.storage_location) {
                    console.log(`⚠️ storage_locationはあるのに画像が取得できていません`);
                }
            }
        }
        console.log('\n\n=== 診断完了 ===');
    }
    catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error);
    }
}
diagnosePublicListImages();
