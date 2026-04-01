import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCurrentValue() {
  try {
    console.log('🔍 Checking AA13886 current values...\n');
    
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified, building_area_verified, land_area, building_area, updated_at')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 Current database values:');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - land_area (土地面積): ${seller.land_area || '(null)'}`);
    console.log(`   - land_area_verified (土地（当社調べ）): ${seller.land_area_verified || '(null)'}`);
    console.log(`   - building_area (建物面積): ${seller.building_area || '(null)'}`);
    console.log(`   - building_area_verified (建物（当社調べ）): ${seller.building_area_verified || '(null)'}`);
    console.log(`   - updated_at: ${seller.updated_at}`);
    
    console.log('\n💡 Expected values from screenshot:');
    console.log('   - land_area (土地面積): 120');
    console.log('   - land_area_verified (土地（当社調べ）): 100');
    console.log('   - building_area (建物面積): 100');
    console.log('   - building_area_verified (建物（当社調べ）): (not shown in screenshot)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCurrentValue();
