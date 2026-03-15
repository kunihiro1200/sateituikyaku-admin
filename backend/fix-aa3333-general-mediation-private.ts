/**
 * AA3333のgeneral_mediation_privateをnullに修正するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fix() {
  // 現在の値を確認
  const { data: before, error: fetchError } = await supabase
    .from('property_listings')
    .select('property_number, general_mediation_private')
    .eq('property_number', 'AA3333')
    .single();

  if (fetchError) {
    console.error('取得エラー:', fetchError.message);
    return;
  }

  console.log('修正前:', before);

  // nullに更新
  const { error: updateError } = await supabase
    .from('property_listings')
    .update({ general_mediation_private: null, updated_at: new Date().toISOString() })
    .eq('property_number', 'AA3333');

  if (updateError) {
    console.error('更新エラー:', updateError.message);
    return;
  }

  // 確認
  const { data: after } = await supabase
    .from('property_listings')
    .select('property_number, general_mediation_private')
    .eq('property_number', 'AA3333')
    .single();

  console.log('修正後:', after);
  console.log('✅ 完了');
}

fix().catch(console.error);
