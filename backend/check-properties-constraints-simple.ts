import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log('🔍 Checking properties table schema...\n');

  // Get table schema
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Properties table is accessible');
  console.log('Sample data:', data);
  
  // Try to get the failing seller
  console.log('\n🔍 Checking seller 583deedf-c6a1-46a9-b715...\n');
  
  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', '583deedf-c6a1-46a9-b715-208304ea8ba')
    .single();
  
  if (sellerError) {
    console.error('❌ Seller not found:', sellerError);
  } else {
    console.log('✅ Seller found:', seller?.seller_number);
    
    // Check if property exists
    const { data: props, error: propsError } = await supabase
      .from('properties')
      .select('*')
      .eq('seller_id', seller.id);
    
    if (propsError) {
      console.error('❌ Error fetching properties:', propsError);
    } else {
      console.log(`✅ Properties for this seller: ${props?.length || 0}`);
      if (props && props.length > 0) {
        console.log('Property data:', JSON.stringify(props[0], null, 2));
      }
    }
  }
}

checkConstraints().catch(console.error);
