/**
 * AA13807: properties テーブルの property_address を修正
 * sellers.property_address の値（大分市高崎１丁目1-7）を properties.property_address にコピー
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  const PROPERTY_ID = '16f45a0b-bd8c-40a8-bfcb-72448666803f';
  const CORRECT_ADDRESS = '大分市高崎１丁目1-7';

  console.log(`properties.property_address を "${CORRECT_ADDRESS}" に更新します...`);

  const { error } = await supabase
    .from('properties')
    .update({ property_address: CORRECT_ADDRESS })
    .eq('id', PROPERTY_ID);

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('properties')
    .select('id, property_address')
    .eq('id', PROPERTY_ID)
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('✅ 更新完了:', data?.property_address);
}

main().catch(console.error);
