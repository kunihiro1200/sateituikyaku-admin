import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

(async () => {
  // seller_emailがある物件を確認
  const { data: withEmail, error: e1 } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, seller_email, sales_assignee')
    .not('seller_email', 'is', null)
    .limit(5);

  console.log('=== seller_emailがある物件 ===');
  console.log('error:', JSON.stringify(e1));
  console.log('data:', JSON.stringify(withEmail, null, 2));

  // seller_emailがない物件の件数
  const { count: nullCount } = await supabase
    .from('property_listings')
    .select('*', { count: 'exact', head: true })
    .is('seller_email', null);

  const { count: totalCount } = await supabase
    .from('property_listings')
    .select('*', { count: 'exact', head: true });

  console.log(`\n=== 統計 ===`);
  console.log(`全件数: ${totalCount}`);
  console.log(`seller_emailがnull: ${nullCount}`);
  console.log(`seller_emailがある: ${(totalCount ?? 0) - (nullCount ?? 0)}`);

  // /api/employees/activeのレスポンス形式を確認するため、employeesテーブルを確認
  const { data: employees, error: e2 } = await supabase
    .from('employees')
    .select('id, name, email, initials')
    .eq('is_active', true)
    .limit(5);

  console.log('\n=== employees（active）サンプル ===');
  console.log('error:', JSON.stringify(e2));
  console.log('data:', JSON.stringify(employees, null, 2));
})();
