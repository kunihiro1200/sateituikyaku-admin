import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAA13886() {
  try {
    console.log('🔍 Checking AA13886 verified area data...\n');
    
    // sellersテーブルからAA13886を取得
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('id, seller_number, land_area_verified, building_area_verified, updated_at')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (!seller) {
      console.log('❌ AA13886 not found in database');
      return;
    }
    
    console.log('📊 Database data (sellers table):');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - land_area_verified: ${seller.land_area_verified || '(null)'}`);
    console.log(`   - building_area_verified: ${seller.building_area_verified || '(null)'}`);
    console.log(`   - updated_at: ${seller.updated_at}`);
    
    // propertiesテーブルも確認
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, property_number, land_area_verified, building_area_verified')
      .eq('seller_id', seller.id)
      .maybeSingle();
    
    if (propError) {
      console.error('\n❌ Error checking properties:', propError);
    } else if (property) {
      console.log('\n📊 Properties table data:');
      console.log(`   - property_number: ${property.property_number}`);
      console.log(`   - land_area_verified: ${property.land_area_verified || '(null)'}`);
      console.log(`   - building_area_verified: ${property.building_area_verified || '(null)'}`);
    } else {
      console.log('\n⚠️  No property record found for this seller');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAA13886();
