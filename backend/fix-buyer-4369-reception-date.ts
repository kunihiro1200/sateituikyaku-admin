import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fix() {
  // 修正前の値を確認
  const { data: before } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date, created_datetime')
    .eq('buyer_number', '4369')
    .single();

  console.log('修正前:', JSON.stringify(before, null, 2));

  // reception_dateを正しい値に修正（2026-11-26 → 2024-11-26）
  const { error } = await supabase
    .from('buyers')
    .update({ reception_date: '2024-11-26' })
    .eq('buyer_number', '4369');

  if (error) {
    console.error('修正失敗:', error);
    return;
  }

  // 修正後の値を確認
  const { data: after } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date, created_datetime')
    .eq('buyer_number', '4369')
    .single();

  console.log('修正後:', JSON.stringify(after, null, 2));
  console.log('✅ 修正完了');
}

fix().catch(console.error);
