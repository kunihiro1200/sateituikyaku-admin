import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // property_number に 7133 を含む物件を検索
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, address, sales_assignee')
    .ilike('property_number', '%7133%');

  console.log('物件7133:', JSON.stringify(data, null, 2));
  if (error) console.error('エラー:', error);

  // sellers テーブルでも確認
  const { data: sellers, error: sellerError } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number')
    .ilike('seller_number', '%7133%');

  console.log('売主7133:', JSON.stringify(sellers, null, 2));
}

main().catch(console.error);
