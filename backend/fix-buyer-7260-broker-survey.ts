/**
 * 買主7260のbroker_surveyを修正するスクリプト
 * vendor_surveyの値をbroker_surveyにコピーする
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('🔍 買主7260の現在の状態を確認...\n');

  // 現在の状態を取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey, broker_survey')
    .eq('buyer_number', '7260')
    .single();

  if (error) {
    console.error('❌ データ取得エラー:', error);
    return;
  }

  console.log('現在の状態:', buyer);
  console.log('');

  // vendor_surveyの値をbroker_surveyにコピー
  if (buyer.vendor_survey) {
    console.log(`📝 broker_surveyを更新: "${buyer.vendor_survey}"`);

    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        broker_survey: buyer.vendor_survey,
      })
      .eq('buyer_number', '7260');

    if (updateError) {
      console.error('❌ 更新エラー:', updateError);
    } else {
      console.log(`✅ 更新成功: broker_survey = "${buyer.vendor_survey}"`);
      
      // 更新後の状態を確認
      const { data: updated } = await supabase
        .from('buyers')
        .select('buyer_number, vendor_survey, broker_survey')
        .eq('buyer_number', '7260')
        .single();
      
      console.log('\n更新後の状態:', updated);
    }
  } else {
    console.log('⚠️ vendor_surveyが空のため、更新をスキップします');
  }
}

main().catch(console.error);
