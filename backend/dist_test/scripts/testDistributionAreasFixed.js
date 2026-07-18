"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// distribution_areas修正の検証テスト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyListingService_1 = require("../services/PropertyListingService");
const PropertyDetailsService_1 = require("../services/PropertyDetailsService");
const PropertyService_1 = require("../services/PropertyService");
const RecommendedCommentService_1 = require("../services/RecommendedCommentService");
const FavoriteCommentService_1 = require("../services/FavoriteCommentService");
const AthomeDataService_1 = require("../services/AthomeDataService");
dotenv_1.default.config();
async function testDistributionAreasFix() {
    console.log('🧪 Testing distribution_areas fix...\n');
    const propertyListingService = new PropertyListingService_1.PropertyListingService();
    const propertyDetailsService = new PropertyDetailsService_1.PropertyDetailsService();
    const propertyService = new PropertyService_1.PropertyService();
    const recommendedCommentService = new RecommendedCommentService_1.RecommendedCommentService();
    const favoriteCommentService = new FavoriteCommentService_1.FavoriteCommentService();
    const athomeDataService = new AthomeDataService_1.AthomeDataService();
    try {
        // テスト1: 物件を1件取得
        console.log('📊 Test 1: Fetching 1 property...');
        const { data: properties } = await propertyListingService.getAll({
            limit: 1,
            offset: 0
        });
        if (!properties || properties.length === 0) {
            console.error('❌ No properties found');
            process.exit(1);
        }
        const property = properties[0];
        console.log(`✅ Fetched property: ${property.property_number}`);
        // テスト2: 各サービスを呼び出し
        console.log('\n📊 Test 2: Calling all services...');
        try {
            const propertyAbout = await propertyService.getPropertyAbout(property.property_number);
            console.log(`✅ PropertyService.getPropertyAbout: ${propertyAbout ? 'OK' : 'null'}`);
        }
        catch (error) {
            if (error.message.includes('distribution_areas')) {
                console.error(`❌ PropertyService failed with distribution_areas error: ${error.message}`);
                process.exit(1);
            }
            console.log(`⚠️  PropertyService.getPropertyAbout: ${error.message}`);
        }
        try {
            const recommendedComment = await recommendedCommentService.getRecommendedComment(property.property_number, property.property_type, property.id);
            console.log(`✅ RecommendedCommentService: ${recommendedComment.comments.length} comments`);
        }
        catch (error) {
            if (error.message.includes('distribution_areas')) {
                console.error(`❌ RecommendedCommentService failed with distribution_areas error: ${error.message}`);
                process.exit(1);
            }
            console.log(`⚠️  RecommendedCommentService: ${error.message}`);
        }
        try {
            const favoriteComment = await favoriteCommentService.getFavoriteComment(property.id);
            console.log(`✅ FavoriteCommentService: ${favoriteComment.comment ? 'OK' : 'null'}`);
        }
        catch (error) {
            if (error.message.includes('distribution_areas')) {
                console.error(`❌ FavoriteCommentService failed with distribution_areas error: ${error.message}`);
                process.exit(1);
            }
            console.log(`⚠️  FavoriteCommentService: ${error.message}`);
        }
        try {
            const athomeData = await athomeDataService.getAthomeData(property.property_number, property.property_type, property.storage_location);
            console.log(`✅ AthomeDataService: ${athomeData.data.length} items`);
        }
        catch (error) {
            if (error.message.includes('distribution_areas')) {
                console.error(`❌ AthomeDataService failed with distribution_areas error: ${error.message}`);
                process.exit(1);
            }
            console.log(`⚠️  AthomeDataService: ${error.message}`);
        }
        // テスト3: property_detailsにupsert
        console.log('\n📊 Test 3: Upserting to property_details...');
        const success = await propertyDetailsService.upsertPropertyDetails(property.property_number, {
            property_about: 'Test data',
            recommended_comments: [],
            athome_data: [],
            favorite_comment: null
        });
        if (success) {
            console.log(`✅ PropertyDetailsService.upsert: OK`);
        }
        else {
            console.error(`❌ PropertyDetailsService.upsert: Failed`);
            process.exit(1);
        }
        console.log('\n\n🎉 All tests passed! distribution_areas fix is working correctly.');
        console.log('✅ You can now run the full script: npx ts-node src/scripts/populatePropertyDetails.ts');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.message.includes('distribution_areas')) {
            console.error('\n🚨 distribution_areas error still exists!');
            console.error('Please check PropertyListingService.ts for any remaining references.');
        }
        process.exit(1);
    }
    process.exit(0);
}
testDistributionAreasFix();
