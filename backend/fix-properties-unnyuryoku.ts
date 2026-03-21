import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixPropertiesUnnyuryoku() {
  // 件数確認
  const { data: countData, error: countError } = await supabase
    .from('properties')
    .select('id, seller_id, property_address')
    .eq('property_address', '未入力');

  if (countError) {
    console.error('Error fetching:', countError);
    return;
  }

  console.log(`properties.property_address = "未入力" の件数: ${countData?.length ?? 0}件`);

  if (!countData || countData.length === 0) {
    console.log('修正対象なし');
    return;
  }

  // 一括で空文字に更新
  const { error: updateError } = await supabase
    .from('properties')
    .update({ property_address: '' })
    .eq('property_address', '未入力');

  if (updateError) {
    console.error('Update error:', updateError);
    return;
  }

  console.log(`✅ ${countData.length}件を空文字に修正しました`);

  // 確認
  const { data: verify } = await supabase
    .from('properties')
    .select('id')
    .eq('property_address', '未入力');

  console.log(`修正後の残件数: ${verify?.length ?? 0}件`);
}

fixPropertiesUnnyuryoku();
