import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProperty() {
  try {
    console.log('🔍 Checking AA13886 property...\n');
    
    // sellersテーブルを確認
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('seller_number, id')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (sellerError) {
      console.error('❌ Seller Error:', sellerError);
      return;
    }
    
    console.log('📊 Seller data:');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - id: ${seller.id}`);
    
    // propertiesテーブルをseller_idで検索
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, seller_id, land_area_verified, building_area_verified, land_area, building_area')
      .eq('seller_id', seller.id)
      .maybeSingle();
    
    if (propertyError) {
      console.error('❌ Property Error:', propertyError);
      return;
    }
    
    if (property) {
      console.log('\n📊 Property data (propertiesテーブル):');
      console.log(`   - id: ${property.id}`);
      console.log(`   - seller_id: ${property.seller_id}`);
      console.log(`   - land_area (土地面積): ${property.land_area || '(null)'}`);
      console.log(`   - land_area_verified (土地（当社調べ）): ${property.land_area_verified || '(null)'}`);
      console.log(`   - building_area (建物面積): ${property.building_area || '(null)'}`);
      console.log(`   - building_area_verified (建物（当社調べ）): ${property.building_area_verified || '(null)'}`);
      console.log('\n💡 CallModePage will save to properties table (PUT /properties/:id)');
    } else {
      console.log('\n💡 No property record found for AA13886');
      console.log('   → CallModePage will save to sellers table directly (PUT /api/sellers/:id)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkProperty();
