"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
async function checkPropertyDetailsData() {
    try {
        console.log('🔍 Checking property_details data...\n');
        // 公開中の物件を1件取得
        const { data: publicProperty, error: publicError } = await supabase
            .from('property_listings')
            .select('property_number, atbb_status')
            .eq('atbb_status', '公開中')
            .limit(1)
            .single();
        if (publicError) {
            console.error('❌ Error fetching public property:', publicError);
            return;
        }
        console.log('📋 Testing with property:', publicProperty.property_number);
        console.log('   ATBB Status:', publicProperty.atbb_status);
        console.log('');
        // property_detailsテーブルからデータを取得
        const { data: details, error: detailsError } = await supabase
            .from('property_details')
            .select('*')
            .eq('property_number', publicProperty.property_number)
            .single();
        if (detailsError) {
            console.error('❌ Error fetching property details:', detailsError);
            return;
        }
        if (!details) {
            console.log('❌ No data found in property_details');
            return;
        }
        console.log('✅ Data found in property_details:');
        console.log('');
        console.log('📝 Recommended Comments:');
        if (details.recommended_comments && details.recommended_comments.length > 0) {
            console.log(`   ✅ ${details.recommended_comments.length} comments found`);
            details.recommended_comments.forEach((comment, index) => {
                console.log(`   ${index + 1}. ${comment.title}: ${comment.content?.substring(0, 50)}...`);
            });
        }
        else {
            console.log('   ❌ No recommended comments');
        }
        console.log('');
        console.log('🖼️ Image URLs:');
        if (details.image_urls && details.image_urls.length > 0) {
            console.log(`   ✅ ${details.image_urls.length} images found`);
            details.image_urls.slice(0, 3).forEach((url, index) => {
                console.log(`   ${index + 1}. ${url.substring(0, 80)}...`);
            });
        }
        else {
            console.log('   ❌ No image URLs');
        }
        console.log('');
        console.log('💬 Favorite Comment:');
        if (details.favorite_comment) {
            console.log(`   ✅ ${details.favorite_comment.substring(0, 100)}...`);
        }
        else {
            console.log('   ❌ No favorite comment');
        }
        console.log('');
        console.log('📊 Full data structure:');
        console.log(JSON.stringify(details, null, 2));
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
checkPropertyDetailsData();
