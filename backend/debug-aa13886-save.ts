import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSave() {
  try {
    console.log('🔍 Debugging AA13886 save issue...\n');
    
    // sellersテーブルを確認
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('seller_number, id, land_area_verified, building_area_verified, updated_at')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (sellerError) {
      console.error('❌ Seller Error:', sellerError);
      return;
    }
    
    console.log('📊 Sellers table:');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - id: ${seller.id}`);
    console.log(`   - land_area_verified: ${seller.land_area_verified || '(null)'}`);
    console.log(`   - building_area_verified: ${seller.building_area_verified || '(null)'}`);
    console.log(`   - updated_at: ${seller.updated_at}`);
    
    // propertiesテーブルを確認
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, seller_id, land_area_verified, building_area_verified, updated_at')
      .eq('seller_id', seller.id)
      .maybeSingle();
    
    if (propertyError) {
      console.error('❌ Property Error:', propertyError);
      return;
    }
    
    if (property) {
      console.log('\n📊 Properties table:');
      console.log(`   - id: ${property.id}`);
      console.log(`   - seller_id: ${property.seller_id}`);
      console.log(`   - land_area_verified: ${property.land_area_verified || '(null)'}`);
      console.log(`   - building_area_verified: ${property.building_area_verified || '(null)'}`);
      console.log(`   - updated_at: ${property.updated_at}`);
    } else {
      console.log('\n💡 No property record found');
    }
    
    console.log('\n💡 Expected behavior:');
    console.log('   - User enters building_area_verified in CallModePage');
    console.log('   - Frontend sends PUT /properties/:id with buildingAreaVerified');
    console.log('   - Backend updates properties table');
    console.log('   - Backend also updates sellers table (new feature)');
    console.log('   - Both tables should have the same value');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSave();
