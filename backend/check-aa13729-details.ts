import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAA13729() {
  console.log('=== AA13729の詳細データ ===\n');

  // 全カラムを取得
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!data) {
    console.log('❌ AA13729が見つかりません');
    return;
  }

  console.log('✅ AA13729が見つかりました\n');

  // SQLクエリの条件をチェック
  console.log('=== SQLクエリの条件チェック ===\n');

  console.log(`1. deleted_at is null: ${data.deleted_at === null ? '✅' : '❌'} (値: ${data.deleted_at})`);
  console.log(`2. visit_assignee is not null: ${data.visit_assignee !== null ? '✅' : '❌'} (値: ${data.visit_assignee})`);
  console.log(`3. visit_assignee != '': ${data.visit_assignee !== '' ? '✅' : '❌'} (値: "${data.visit_assignee}")`);
  console.log(`4. visit_date is not null: ${data.visit_date !== null ? '✅' : '❌'} (値: ${data.visit_date})`);

  console.log('\n=== 全フィールド ===\n');
  console.log(JSON.stringify(data, null, 2));
}

checkAA13729().catch(console.error);
