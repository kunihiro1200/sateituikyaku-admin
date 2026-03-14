import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 買主7133の物件番号 AA12721 を確認
  const { data: listing, error } = await supabase
    .from('property_listings')
    .select('property_number, address, sales_assignee')
    .eq('property_number', 'AA12721')
    .single();

  console.log('property_listings AA12721:', JSON.stringify(listing, null, 2));
  if (error) console.error('エラー:', error.message);

  // sellers テーブルで AA12721 を確認
  const { data: seller } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, property_address')
    .eq('seller_number', 'AA12721')
    .single();

  console.log('sellers AA12721:', JSON.stringify(seller, null, 2));

  // google_calendar_tokens のトークンが有効か確認
  // token_expiry が過去でもリフレッシュトークンで自動更新されるはずだが念のため
  const { data: token } = await supabase
    .from('google_calendar_tokens')
    .select('employee_id, token_expiry, updated_at, scope')
    .single();

  const expiry = token?.token_expiry ? new Date(token.token_expiry) : null;
  const now = new Date();
  console.log('\ngoogle_calendar_tokens:');
  console.log('  token_expiry:', token?.token_expiry);
  console.log('  現在時刻:', now.toISOString());
  console.log('  期限切れ:', expiry ? expiry < now : '不明');
  console.log('  updated_at:', token?.updated_at);
}

main().catch(console.error);
