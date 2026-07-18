"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
const PropertyService_1 = require("../services/PropertyService");
const RecommendedCommentService_1 = require("../services/RecommendedCommentService");
const FavoriteCommentService_1 = require("../services/FavoriteCommentService");
const AthomeDataService_1 = require("../services/AthomeDataService");
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
async function testSinglePropertyData() {
    try {
        console.log('🔍 Testing data retrieval for a single property...\n');
        // 公開中の物件を1件取得
        const { data: property, error } = await supabase
            .from('property_listings')
            .select('*')
            .eq('atbb_status', '公開中')
            .limit(1)
            .single();
        if (error || !property) {
            console.error('❌ Error fetching property:', error);
            return;
        }
        console.log('📋 Testing with property:');
        console.log(`   Property Number: ${property.property_number}`);
        console.log(`   Property Type: ${property.property_type}`);
        console.log(`   ATBB Status: ${property.atbb_status}`);
        console.log(`   Storage Location: ${property.storage_location || 'NULL'}`);
        console.log('');
        const propertyService = new PropertyService_1.PropertyService();
        const recommendedCommentService = new RecommendedCommentService_1.RecommendedCommentService();
        const favoriteCommentService = new FavoriteCommentService_1.FavoriteCommentService();
        const athomeDataService = new AthomeDataService_1.AthomeDataService();
        // 1. Property About
        console.log('1️⃣ Testing PropertyService.getPropertyAbout()...');
        try {
            const propertyAbout = await propertyService.getPropertyAbout(property.property_number);
            if (propertyAbout) {
                console.log(`   ✅ Success: ${propertyAbout.substring(0, 100)}...`);
            }
            else {
                console.log('   ⚠️ No data returned (null)');
            }
        }
        catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
        console.log('');
        // 2. Recommended Comments
        console.log('2️⃣ Testing RecommendedCommentService.getRecommendedComment()...');
        try {
            const result = await recommendedCommentService.getRecommendedComment(property.property_number, property.property_type, property.id);
            console.log(`   📊 Result:`, JSON.stringify(result, null, 2));
            if (result.comments && result.comments.length > 0) {
                console.log(`   ✅ Success: ${result.comments.length} comments found`);
            }
            else {
                console.log('   ⚠️ No comments returned (empty array)');
            }
        }
        catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
        console.log('');
        // 3. Favorite Comment
        console.log('3️⃣ Testing FavoriteCommentService.getFavoriteComment()...');
        try {
            const result = await favoriteCommentService.getFavoriteComment(property.id);
            console.log(`   📊 Result:`, JSON.stringify(result, null, 2));
            if (result.comment) {
                console.log(`   ✅ Success: ${result.comment.substring(0, 100)}...`);
            }
            else {
                console.log('   ⚠️ No comment returned (null)');
            }
        }
        catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
        console.log('');
        // 4. Athome Data (Image URLs)
        console.log('4️⃣ Testing AthomeDataService.getAthomeData()...');
        try {
            const result = await athomeDataService.getAthomeData(property.property_number, property.property_type, property.storage_location);
            console.log(`   📊 Result:`, JSON.stringify(result, null, 2));
            if (result.data && result.data.length > 0) {
                console.log(`   ✅ Success: ${result.data.length} data items found`);
            }
            else {
                console.log('   ⚠️ No data returned (empty array)');
            }
        }
        catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
    }
}
testSinglePropertyData();
