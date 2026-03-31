import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('=== Checking AA13863 Confirmation Status ===\n');
  
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation, updated_at')
    .eq('property_number', 'AA13863')
    .single();
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log('Property Number:', data.property_number);
  console.log('Confirmation:', JSON.stringify(data.confirmation));
  console.log('Confirmation Type:', typeof data.confirmation);
  console.log('Updated At:', data.updated_at);
}

check();
