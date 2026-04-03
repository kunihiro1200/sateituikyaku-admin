import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSQLQueryAll() {
  console.log('=== バックエンドのSQLクエリを実行（全件取得） ===\n');

  let allSellers: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .not('visit_date', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (!data || data.length === 0) break;

    allSellers = allSellers.concat(data);
    console.log(`📄 ページ ${page + 1}: ${data.length}件取得（累計: ${allSellers.length}件）`);

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n📊 取得した売主数（全件）: ${allSellers.length}\n`);

  // AA13729とAA10538を検索
  const aa13729 = allSellers.find(s => s.seller_number === 'AA13729');
  const aa10538 = allSellers.find(s => s.seller_number === 'AA10538');

  console.log('=== AA13729 ===');
  if (aa13729) {
    console.log('✅ クエリ結果に含まれている');
    console.log(JSON.stringify(aa13729, null, 2));
  } else {
    console.log('❌ クエリ結果に含まれていない');
  }

  console.log('\n=== AA10538 ===');
  if (aa10538) {
    console.log('✅ クエリ結果に含まれている');
    console.log(JSON.stringify(aa10538, null, 2));
  } else {
    console.log('❌ クエリ結果に含まれていない');
  }
}

checkSQLQueryAll().catch(console.error);
