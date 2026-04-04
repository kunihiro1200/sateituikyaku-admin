import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFI6InDatabase() {
  console.log('🔍 Checking if FI6 exists in database...\n');

  // Check for FI6
  const { data: fi6, error: fi6Error } = await supabase
    .from('sellers')
    .select('seller_number, name, status, created_at, updated_at')
    .eq('seller_number', 'FI6')
    .maybeSingle();

  if (fi6Error) {
    console.error('❌ Error querying FI6:', fi6Error);
    return;
  }

  if (fi6) {
    console.log('✅ FI6 found in database:');
    console.log(JSON.stringify(fi6, null, 2));
  } else {
    console.log('❌ FI6 NOT found in database');
  }

  console.log('\n🔍 Checking for all non-AA sellers...\n');

  // Check for all non-AA sellers
  const { data: nonAASellers, error: nonAAError } = await supabase
    .from('sellers')
    .select('seller_number, name, status, created_at')
    .not('seller_number', 'like', 'AA%')
    .order('seller_number');

  if (nonAAError) {
    console.error('❌ Error querying non-AA sellers:', nonAAError);
    return;
  }

  if (nonAASellers && nonAASellers.length > 0) {
    console.log(`✅ Found ${nonAASellers.length} non-AA sellers:`);
    nonAASellers.forEach(seller => {
      console.log(`  - ${seller.seller_number}: ${seller.name || '(no name)'} (${seller.status || 'no status'})`);
    });
  } else {
    console.log('❌ No non-AA sellers found in database');
  }

  console.log('\n🔍 Checking for FI prefix sellers...\n');

  // Check for FI prefix sellers
  const { data: fiSellers, error: fiError } = await supabase
    .from('sellers')
    .select('seller_number, name, status, created_at')
    .like('seller_number', 'FI%')
    .order('seller_number');

  if (fiError) {
    console.error('❌ Error querying FI sellers:', fiError);
    return;
  }

  if (fiSellers && fiSellers.length > 0) {
    console.log(`✅ Found ${fiSellers.length} FI sellers:`);
    fiSellers.forEach(seller => {
      console.log(`  - ${seller.seller_number}: ${seller.name || '(no name)'} (${seller.status || 'no status'})`);
    });
  } else {
    console.log('❌ No FI sellers found in database');
  }
}

checkFI6InDatabase().catch(console.error);
