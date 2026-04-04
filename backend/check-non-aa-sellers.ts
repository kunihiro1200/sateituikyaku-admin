import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNonAASellers() {
  console.log('🔍 Checking for sellers with non-AA prefixes...\n');
  
  // Check for sellers not starting with AA
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number')
    .not('seller_number', 'ilike', 'AA%')
    .limit(20);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('❌ No sellers found with non-AA prefixes');
    console.log('   All sellers in the database start with AA');
    return;
  }
  
  console.log(`✅ Found ${data.length} sellers with non-AA prefixes:`);
  data.forEach(seller => {
    console.log(`   - ${seller.seller_number}`);
  });
}

checkNonAASellers().catch(console.error);
