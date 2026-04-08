import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting migration 111: Add buyer area coordinates...\n');

  try {
    // Step 1: Add desired_area_lat column
    console.log('📄 Step 1: Adding desired_area_lat column...');
    const { error: error1 } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS desired_area_lat DOUBLE PRECISION;'
    });
    
    if (error1) {
      console.error('❌ Failed to add desired_area_lat column:', error1);
      // Continue anyway - column might already exist
    } else {
      console.log('✅ desired_area_lat column added');
    }

    // Step 2: Add desired_area_lng column
    console.log('📄 Step 2: Adding desired_area_lng column...');
    const { error: error2 } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE buyers ADD COLUMN IF NOT EXISTS desired_area_lng DOUBLE PRECISION;'
    });
    
    if (error2) {
      console.error('❌ Failed to add desired_area_lng column:', error2);
      // Continue anyway - column might already exist
    } else {
      console.log('✅ desired_area_lng column added');
    }

    // Step 3: Create index
    console.log('📄 Step 3: Creating index...');
    const { error: error3 } = await supabase.rpc('exec', {
      sql: `CREATE INDEX IF NOT EXISTS idx_buyers_desired_area_coordinates 
            ON buyers(desired_area_lat, desired_area_lng) 
            WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;`
    });
    
    if (error3) {
      console.error('❌ Failed to create index:', error3);
      // Continue anyway - index might already exist
    } else {
      console.log('✅ Index created');
    }

    console.log('\n✅ Migration 111 completed!\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    
    // Check if columns exist by querying the table
    const { data: buyers, error: queryError } = await supabase
      .from('buyers')
      .select('buyer_number, desired_area_lat, desired_area_lng')
      .limit(1);

    if (queryError) {
      console.error('❌ Verification query failed:', queryError);
      console.log('⚠️  This might mean the columns were not added successfully.');
      console.log('⚠️  Please check the database manually.');
    } else {
      console.log('✅ Verification successful! Columns are accessible.');
      console.log('📊 Sample data:', buyers);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

runMigration();
