"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// データベース接続テスト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyDetailsService_1 = require("../services/PropertyDetailsService");
// 環境変数を読み込む
dotenv_1.default.config();
async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...\n');
    const service = new PropertyDetailsService_1.PropertyDetailsService();
    try {
        // テストデータで保存を試みる
        console.log('📝 Attempting to save test data...');
        const success = await service.upsertPropertyDetails('TEST-001', {
            property_about: 'Test property about',
            recommended_comments: [{ comment: 'Test comment' }],
            athome_data: [{ key: 'value' }],
            favorite_comment: 'Test favorite'
        });
        if (success) {
            console.log('✅ Database connection successful!');
        }
        else {
            console.log('❌ Database save failed (returned false)');
        }
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        console.error('📋 Stack:', error.stack);
    }
    process.exit(0);
}
testDatabaseConnection();
