import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function main() {
  // seller idを取得
  const { data: seller } = await supabase.from('sellers').select('id, seller_number, status').eq('seller_number', 'AA13585').single();
  console.log('seller:', JSON.stringify(seller));

  if (!seller) return;

  // property_listingsを確認
  const { data: listings } = await supabase.from('property_listings').select('id, property_number, deleted_at').eq('seller_id', seller.id);
  console.log('property_listings:', JSON.stringify(listings));

  // GitHub Actions cronが動いているか確認（sync routeのログ代わりに最近の同期状況を確認）
  const { data: syncLog } = await supabase.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(3);
  console.log('sync_logs:', JSON.stringify(syncLog));
}
main().catch(console.error);
