import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env.production' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductionVisitDateType() {
  console.log('🔍 本番環境のvisit_dateカラム型を確認');

  // AA13729のデータを取得
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
  
  // 時刻を含めて更新
  console.log('\n🔧 visit_dateを2026-04-04 10:00:00に更新');
  const { data: updated, error: updateError } = await supabase
    .from('sellers')
    .update({ visit_date: '2026-04-04 10:00:00' })
    .eq('seller_number', 'AA13729')
    .select('seller_number, visit_date');

  if (updateError) {
    console.error('❌ Update Error:', updateError);
    return;
  }

  console.log('✅ Updated:', updated);
}

checkProductionVisitDateType();
