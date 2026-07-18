"use strict";
/**
 * CC8の公開物件サイトの画像表示をテスト
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyImageService_1 = require("../services/PropertyImageService");
dotenv_1.default.config();
async function testCC8PublicImages() {
    console.log('='.repeat(60));
    console.log('CC8公開物件サイト画像表示テスト');
    console.log('='.repeat(60));
    console.log('');
    try {
        const imageService = new PropertyImageService_1.PropertyImageService();
        // CC8の現在の格納先URL
        const storageUrl = 'https://drive.google.com/drive/folders/1Y1HGLsyojfwU_tmeG4ZaWDzix6WePAbT';
        console.log('📋 ステップ1: 格納先URLから画像を取得');
        console.log(`格納先URL: ${storageUrl}`);
        console.log('');
        // 画像を取得
        const result = await imageService.getImagesFromStorageUrl(storageUrl);
        console.log('📊 取得結果:');
        console.log(`  画像数: ${result.images.length}`);
        console.log(`  フォルダID: ${result.folderId}`);
        console.log(`  キャッシュ: ${result.cached ? 'あり' : 'なし'}`);
        console.log('');
        if (result.images.length > 0) {
            console.log('✅ 画像が見つかりました:');
            result.images.forEach((img, index) => {
                console.log(`  ${index + 1}. ${img.name}`);
                console.log(`     サムネイル: ${img.thumbnailUrl}`);
            });
        }
        else {
            console.log('❌ 画像が見つかりませんでした');
        }
        console.log('');
        console.log('📋 ステップ2: キャッシュをクリアして再取得');
        // キャッシュをクリア
        imageService.clearCache(result.folderId || undefined);
        console.log('✅ キャッシュをクリアしました');
        console.log('');
        // 再度取得
        const result2 = await imageService.getImagesFromStorageUrl(storageUrl);
        console.log('📊 再取得結果:');
        console.log(`  画像数: ${result2.images.length}`);
        console.log(`  フォルダID: ${result2.folderId}`);
        console.log(`  キャッシュ: ${result2.cached ? 'あり' : 'なし'}`);
        console.log('');
        if (result2.images.length > 0) {
            console.log('✅ 画像が見つかりました:');
            result2.images.slice(0, 3).forEach((img, index) => {
                console.log(`  ${index + 1}. ${img.name}`);
            });
        }
        console.log('');
        console.log('='.repeat(60));
        console.log('テスト完了');
        console.log('='.repeat(60));
    }
    catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        console.error(error);
    }
}
testCC8PublicImages()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
