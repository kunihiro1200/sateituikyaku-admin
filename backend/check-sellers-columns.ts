import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
  try {
    console.log('🔍 Checking sellers table columns...');
    
    // sellersテーブルから1件取得してカラムを確認
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No data in sellers table');
      return;
    }
    
    const columns = Object.keys(data[0]);
    console.log(`✅ Found ${columns.length} columns in sellers table`);
    
    // land_area_verifiedとbuilding_area_verifiedが存在するか確認
    const hasLandAreaVerified = columns.includes('land_area_verified');
    const hasBuildingAreaVerified = columns.includes('building_area_verified');
    
    console.log('\n📊 Target columns:');
    console.log(`  - land_area_verified: ${hasLandAreaVerified ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  - building_area_verified: ${hasBuildingAreaVerified ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!hasLandAreaVerified || !hasBuildingAreaVerified) {
      console.log('\n⚠️  Migration required!');
      console.log('\n📝 Please run the following SQL in Supabase Studio:');
      console.log('---');
      console.log('ALTER TABLE sellers ADD COLUMN IF NOT EXISTS land_area_verified DECIMAL(10, 2);');
      console.log('ALTER TABLE sellers ADD COLUMN IF NOT EXISTS building_area_verified DECIMAL(10, 2);');
      console.log('COMMENT ON COLUMN sellers.land_area_verified IS \'土地面積（当社調べ）- 平方メートル\';');
      console.log('COMMENT ON COLUMN sellers.building_area_verified IS \'建物面積（当社調べ）- 平方メートル\';');
      console.log('---');
    } else {
      console.log('\n✅ All required columns exist!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkColumns();
