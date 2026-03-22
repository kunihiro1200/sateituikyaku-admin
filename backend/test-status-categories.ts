/**
 * status-categories APIの結果を確認
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // 全件数を確認
  const { count } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  console.log('deleted_at IS NULL の総件数:', count);

  // デフォルト1000件制限で取得した場合の件数
  const { data: limited } = await supabase
    .from('buyers')
    .select('buyer_number')
    .is('deleted_at', null);
  console.log('デフォルト取得件数:', limited?.length);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
