"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
// 環境変数を読み込み
dotenv.config();
async function verifyCallModeData() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ 環境変数が設定されていません');
        console.error('   SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
        console.error('   SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY:', supabaseKey ? '設定済み' : '未設定');
        process.exit(1);
    }
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    console.log('🔍 通話モードデータを検証中...\n');
    // 全売主を取得（最大10000件）
    const { data: sellers, error } = await supabase
        .from('sellers')
        .select('*')
        .order('seller_number', { ascending: true })
        .limit(10000);
    if (error || !sellers) {
        console.error('❌ 売主データの取得に失敗:', error);
        process.exit(1);
    }
    console.log(`✅ ${sellers.length}件の売主データを取得しました\n`);
    const results = [];
    let propertyMissingCount = 0;
    let siteMissingCount = 0;
    let statusMissingCount = 0;
    for (const seller of sellers) {
        const missingData = [];
        // 物件情報の確認
        const { data: property } = await supabase
            .from('properties')
            .select('*')
            .eq('seller_id', seller.id)
            .single();
        if (!property) {
            missingData.push('物件情報');
            propertyMissingCount++;
        }
        // サイト情報の確認（siteフィールドを確認）
        if (!seller.site) {
            missingData.push('サイト情報');
            siteMissingCount++;
        }
        // ステータス情報の確認
        if (!seller.status) {
            missingData.push('ステータス');
            statusMissingCount++;
        }
        if (missingData.length > 0) {
            results.push({
                sellerId: seller.id,
                sellerNumber: seller.seller_number || '不明',
                missingData,
            });
        }
    }
    console.log('\n📊 検証結果:');
    console.log(`   総売主数: ${sellers.length}`);
    console.log(`   データ完全: ${sellers.length - results.length}件`);
    console.log(`   データ不足: ${results.length}件\n`);
    console.log('📈 不足データの内訳:');
    console.log(`   物件情報不足: ${propertyMissingCount}件`);
    console.log(`   サイト情報不足: ${siteMissingCount}件`);
    console.log(`   ステータス不足: ${statusMissingCount}件\n`);
    if (results.length > 0) {
        console.log('⚠️  データが不足している売主（最初の20件）:');
        results.slice(0, 20).forEach(result => {
            console.log(`   ${result.sellerNumber}: ${result.missingData.join(', ')}`);
        });
        if (results.length > 20) {
            console.log(`   ... 他${results.length - 20}件\n`);
        }
    }
    else {
        console.log('✅ 全ての売主データが完全です！\n');
    }
}
verifyCallModeData().catch(error => {
    console.error('❌ 検証中にエラーが発生しました:', error);
    process.exit(1);
});
