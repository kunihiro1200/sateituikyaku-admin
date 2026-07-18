"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Supabase JS SDKを使用してproperty_detailsに直接アクセスするテスト
// 新しいプロジェクトリファレンスで再試行
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
async function testSupabaseJS() {
    console.log('🚀 Testing Supabase JS SDK access to property_details...\n');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('📋 Supabase URL:', supabaseUrl);
    console.log('📋 Using SERVICE_ROLE_KEY for full access\n');
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    try {
        // まず、実際の物件番号を1件取得
        console.log('🔍 Step 0: Getting a real property number...');
        const { data: properties, error: propertiesError } = await supabase
            .from('property_listings')
            .select('property_number')
            .limit(1);
        if (propertiesError || !properties || properties.length === 0) {
            throw new Error('No properties found in property_listings table');
        }
        const testPropertyNumber = properties[0].property_number;
        console.log('✅ Using property number:', testPropertyNumber);
        console.log();
        // 1. データを挿入（UPSERT）
        console.log('📝 Step 1: Inserting test data...');
        const { data: insertData, error: insertError } = await supabase
            .from('property_details')
            .upsert({
            property_number: testPropertyNumber,
            property_about: 'これはSupabase JS SDK経由のテストです',
            recommended_comments: ['Supabase推奨1', 'Supabase推奨2'],
            athome_data: ['Supabase情報1', 'Supabase情報2'],
            favorite_comment: 'Supabaseお気に入り'
        })
            .select();
        if (insertError) {
            console.error('❌ Insert error:', insertError);
            throw insertError;
        }
        console.log('✅ Insert successful!');
        console.log('📊 Inserted data:', JSON.stringify(insertData, null, 2));
        // 2. データを取得
        console.log('\n🔍 Step 2: Retrieving test data...');
        const { data: selectData, error: selectError } = await supabase
            .from('property_details')
            .select('*')
            .eq('property_number', testPropertyNumber)
            .single();
        if (selectError) {
            console.error('❌ Select error:', selectError);
            throw selectError;
        }
        console.log('✅ Select successful!');
        console.log('📊 Retrieved data:', JSON.stringify(selectData, null, 2));
        // 3. データを更新
        console.log('\n📝 Step 3: Updating test data...');
        const { data: updateData, error: updateError } = await supabase
            .from('property_details')
            .update({
            property_about: '更新されたテストデータ（Supabase JS SDK）'
        })
            .eq('property_number', testPropertyNumber)
            .select();
        if (updateError) {
            console.error('❌ Update error:', updateError);
            throw updateError;
        }
        console.log('✅ Update successful!');
        console.log('📊 Updated data:', JSON.stringify(updateData, null, 2));
        // 4. 削除
        console.log('\n🗑️ Step 4: Cleaning up test data...');
        const { error: deleteError } = await supabase
            .from('property_details')
            .delete()
            .eq('property_number', testPropertyNumber);
        if (deleteError) {
            console.error('❌ Delete error:', deleteError);
            throw deleteError;
        }
        console.log('✅ Delete successful!');
        console.log('\n🎉 All tests passed! Supabase JS SDK works with the new project!');
        console.log('\n💡 The schema cache issue is resolved with the new project reference.');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('📋 Error details:', error);
        process.exit(1);
    }
    process.exit(0);
}
testSupabaseJS();
