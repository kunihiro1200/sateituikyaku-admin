import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, created_at, updated_at')
    .eq('seller_number', 'AA13814')
    .single();

  if (error) {
    console.log('❌ AA13814 not found in DB:', error.message);
  } else {
    console.log('✅ AA13814 found in DB:', data);
  }
}

check();
