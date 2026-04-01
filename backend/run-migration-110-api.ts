import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running migration 110: Add land_area_verified and building_area_verified to sellers table...');
    
    // Step 1: Add land_area_verified column
    console.log('📝 Adding land_area_verified column...');
    const { error: error1 } = await supabase.rpc('exec', {
      sql: `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS land_area_verified DECIMAL(10, 2);`
    });
    
    if (error1 && !error1.message.includes('already exists')) {
      console.error('❌ Failed to add land_area_verified:', error1);
    } else {
      console.log('✅ land_area_verified column added');
    }
    
    // Step 2: Add building_area_verified column
    console.log('📝 Adding building_area_verified column...');
    const { error: error2 } = await supabase.rpc('exec', {
      sql: `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS building_area_verified DECIMAL(10, 2);`
    });
    
    if (error2 && !error2.message.includes('already exists')) {
      console.error('❌ Failed to add building_area_verified:', error2);
    } else {
      console.log('✅ building_area_verified column added');
    }
    
    // Step 3: Add comments
    console.log('📝 Adding column comments...');
    const { error: error3 } = await supabase.rpc('exec', {
      sql: `COMMENT ON COLUMN sellers.land_area_verified IS '土地面積（当社調べ）- 平方メートル';`
    });
    
    const { error: error4 } = await supabase.rpc('exec', {
      sql: `COMMENT ON COLUMN sellers.building_area_verified IS '建物面積（当社調べ）- 平方メートル';`
    });
    
    if (error3 || error4) {
      console.warn('⚠️  Failed to add comments (non-critical)');
    } else {
      console.log('✅ Column comments added');
    }
    
    console.log('✅ Migration 110 completed successfully!');
    
    // 確認クエリ
    const { data, error: checkError } = await supabase
      .from('sellers')
      .select('land_area_verified, building_area_verified')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Verification failed:', checkError);
    } else {
      console.log('✅ Columns verified:', data ? Object.keys(data[0] || {}) : []);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runMigration();
