import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

async function forceSyncAA13814() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  const supabase = createClient(supabaseUrl, supabaseKey);

  // スプレッドシートで確認済みの値
  const valuationReason = '住宅ローン返済で困っている';
  const valuationMethod = '机上査定（不通）';

  console.log('AA13814 を直接更新します...');
  console.log('  valuation_reason:', valuationReason);
  console.log('  valuation_method:', valuationMethod);

  const { error } = await supabase
    .from('sellers')
    .update({
      valuation_reason: valuationReason,
      valuation_method: valuationMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('seller_number', 'AA13814');

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, valuation_reason, valuation_method')
    .eq('seller_number', 'AA13814')
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('\n✅ 更新完了:');
  console.log('  valuation_reason:', data?.valuation_reason);
  console.log('  valuation_method:', data?.valuation_method);
}

forceSyncAA13814().catch(console.error);
