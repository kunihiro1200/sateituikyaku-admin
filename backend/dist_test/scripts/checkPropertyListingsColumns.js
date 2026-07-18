"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
async function checkColumns() {
    console.log('🔍 property_listingsテーブルのカラムを確認中...\n');
    // 1件だけ取得してカラムを確認
    const { data, error } = await supabase
        .from('property_listings')
        .select('*')
        .limit(1);
    if (error) {
        console.error('❌ エラー:', error);
        return;
    }
    if (!data || data.length === 0) {
        console.log('⚠️ データが見つかりませんでした');
        return;
    }
    const columns = Object.keys(data[0]);
    console.log(`✅ ${columns.length}個のカラムが見つかりました:\n`);
    columns.sort().forEach((col, index) => {
        console.log(`${index + 1}. ${col}`);
    });
}
checkColumns().catch(console.error);
