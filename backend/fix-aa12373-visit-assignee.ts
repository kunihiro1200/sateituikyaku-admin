/**
 * AA12373の営業担当を「外す」→nullに修正し、最新売主を強制同期するスクリプト
 */
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== AA12373 visit_assignee 確認・修正 ===\n');

  // 現在のDBの状態を確認
  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, status, next_call_date')
    .eq('seller_number', 'AA12373')
    .single();

  if (error) {
    console.error('❌ 取得エラー:', error.message);
    return;
  }

  console.log('現在のDB状態:');
  console.log('  seller_number:', seller.seller_number);
  console.log('  visit_assignee:', seller.visit_assignee);
  console.log('  status:', seller.status);
  console.log('  next_call_date:', seller.next_call_date);

  // visit_assigneeをnullに更新
  console.log('\n→ visit_assigneeをnullに更新します...');
  const { error: updateError } = await supabase
    .from('sellers')
    .update({ visit_assignee: null, updated_at: new Date().toISOString() })
    .eq('seller_number', 'AA12373');

  if (updateError) {
    console.error('❌ 更新エラー:', updateError.message);
    return;
  }

  console.log('✅ AA12373のvisit_assigneeをnullに更新しました');

  // 最新売主番号を確認
  console.log('\n=== 最新売主番号の確認 ===');
  const { data: latestSellers } = await supabase
    .from('sellers')
    .select('seller_number')
    .order('seller_number', { ascending: false })
    .limit(5);

  console.log('DBの最新売主番号（上位5件）:');
  latestSellers?.forEach(s => console.log(' ', s.seller_number));
}

main().catch(console.error);
