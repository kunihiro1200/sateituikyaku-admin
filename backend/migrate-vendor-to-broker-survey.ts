/**
 * vendor_survey -> broker_survey 全買主データ移行スクリプト
 * 
 * 目的: vendor_surveyに値があり、broker_surveyが空の買主を全員移行する
 * 
 * 実行方法:
 * npx tsx backend/migrate-vendor-to-broker-survey.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('🚀 vendor_survey -> broker_survey 全買主データ移行開始...\n');

  // vendor_surveyに値がある買主を全件取得
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey, broker_survey')
    .not('vendor_survey', 'is', null)
    .is('deleted_at', null);

  if (error) {
    console.error('❌ データ取得エラー:', error);
    return;
  }

  // vendor_surveyに値があり、broker_surveyが空の買主をフィルタ
  const targets = (data || []).filter(
    (b: any) => b.vendor_survey && String(b.vendor_survey).trim() !== ''
  );

  console.log(`📊 対象買主数: ${targets.length}件\n`);

  if (targets.length === 0) {
    console.log('✅ 移行対象の買主はありません');
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const buyer of targets) {
    // broker_surveyに既に値がある場合はスキップ
    if (buyer.broker_survey && String(buyer.broker_survey).trim() !== '') {
      console.log(`SKIP ${buyer.buyer_number}: broker_survey already = "${buyer.broker_survey}"`);
      skipped++;
      continue;
    }

    // vendor_surveyの値をbroker_surveyにコピー
    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        broker_survey: buyer.vendor_survey,
        vendor_survey: null, // vendor_surveyをクリア
      })
      .eq('buyer_number', buyer.buyer_number);

    if (updateError) {
      console.error(`❌ ${buyer.buyer_number}: 更新失敗 - ${updateError.message}`);
      failed++;
    } else {
      console.log(`✅ ${buyer.buyer_number}: broker_survey = "${buyer.vendor_survey}"`);
      success++;
    }
  }

  console.log('\n📊 移行結果:');
  console.log(`  成功: ${success}件`);
  console.log(`  スキップ: ${skipped}件`);
  console.log(`  失敗: ${failed}件`);
  console.log(`  合計: ${targets.length}件`);
}

main().catch(console.error);
