"use strict";
/**
 * AA13231の画像取得テスト
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const API_BASE_URL = 'http://localhost:3000/api/public';
const PROPERTY_ID = '05ce7162-d6b5-4c81-a1a6-2be9f253f8bc';
async function testImages() {
    console.log('🖼️  Testing AA13231 Images API...\n');
    try {
        // 画像一覧を取得
        console.log(`📥 GET ${API_BASE_URL}/properties/${PROPERTY_ID}/images`);
        const response = await axios_1.default.get(`${API_BASE_URL}/properties/${PROPERTY_ID}/images`);
        console.log('\n📊 Response:');
        console.log(`   Total images: ${response.data.totalCount}`);
        console.log(`   Visible images: ${response.data.visibleCount}`);
        console.log(`   Hidden images: ${response.data.hiddenCount}`);
        console.log(`   Folder ID: ${response.data.folderId}`);
        console.log(`   Cached: ${response.data.cached}`);
        if (response.data.images && response.data.images.length > 0) {
            console.log('\n🖼️  First 3 images:');
            response.data.images.slice(0, 3).forEach((img, index) => {
                console.log(`   ${index + 1}. ${img.name}`);
                console.log(`      Thumbnail: ${img.thumbnailUrl}`);
                console.log(`      Full: ${img.fullImageUrl}`);
            });
            console.log('\n✅ Images retrieved successfully!');
            console.log(`\n🌐 Test in browser: http://localhost:5173/properties/AA13231`);
        }
        else {
            console.log('\n⚠️  No images found');
        }
    }
    catch (error) {
        console.error('\n❌ Error:', error.response?.data || error.message);
    }
}
testImages();
