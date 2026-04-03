import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setAA13729VisitDateTime() {
  console.log('🔧 Setting AA13729 visit_date to 2026-04-04 10:00:00');

  const { data, error } = await supabase
    .from('sellers')
    .update({ visit_date: '2026-04-04 10:00:00' })
    .eq('seller_number', 'AA13729')
    .select('seller_number, visit_date');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Updated:', data);
  
  // 確認
  const { data: check } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .eq('seller_number', 'AA13729')
    .single();
    
  console.log('📊 Current value:', check);
}

setAA13729VisitDateTime();
