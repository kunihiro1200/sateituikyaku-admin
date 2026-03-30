import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAA12497() {
  console.log('🔍 Checking AA12497 sales_assignee in database...\n');

  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, sales_assignee')
    .eq('property_number', 'AA12497')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📊 AA12497 in database:');
  console.log('  property_number:', data.property_number);
  console.log('  sales_assignee:', data.sales_assignee || '(null)');
}

checkAA12497();
