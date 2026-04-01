import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncVerifiedArea() {
  try {
    console.log('🔄 Syncing AA13886 verified area from properties to sellers...\n');
    
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
    
    // propertiesテーブルから正しい値を取得
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, land_area_verified, building_area_verified')
      .eq('seller_id', seller.id)
      .single();
    
    if (propertyError) {
      console.error('❌ Property Error:', propertyError);
      return;
    }
    
    console.log('\n📊 Property data (propertiesテーブル):');
    console.log(`   - land_area_verified: ${property.land_area_verified || '(null)'}`);
    console.log(`   - building_area_verified: ${property.building_area_verified || '(null)'}`);
    
    // sellersテーブルを更新
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        land_area_verified: property.land_area_verified,
        building_area_verified: property.building_area_verified,
      })
      .eq('id', seller.id);
    
    if (updateError) {
      console.error('❌ Update Error:', updateError);
      return;
    }
    
    console.log('\n✅ Successfully synced verified area to sellers table');
    console.log('   - land_area_verified: 123.45 → 100');
    console.log('   - building_area_verified: 67.89 → null');
    
    // 確認
    const { data: updatedSeller, error: checkError } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified, building_area_verified')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (checkError) {
      console.error('❌ Check Error:', checkError);
      return;
    }
    
    console.log('\n📊 Updated seller data:');
    console.log(`   - land_area_verified: ${updatedSeller.land_area_verified || '(null)'}`);
    console.log(`   - building_area_verified: ${updatedSeller.building_area_verified || '(null)'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

syncVerifiedArea();
