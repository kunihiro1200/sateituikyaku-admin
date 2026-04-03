import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVisitDateColumnType() {
  console.log('🔍 Checking visit_date column type');

  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📊 AA13729 visit_date:', data.visit_date);
  console.log('📊 Type:', typeof data.visit_date);
}

checkVisitDateColumnType();
