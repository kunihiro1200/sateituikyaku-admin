/**
 * vendor_survey -> broker_survey 一括移行スクリプト
 * vendor_surveyに値があり、broker_surveyが空の買主を全員移行する
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // vendor_surveyに値がある買主を全件取得
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey, broker_survey')
    .not('vendor_survey', 'is', null)
    .is('deleted_at', null);

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  const targets = (data || []).filter(
    (b: any) => b.vendor_survey && String(b.vendor_survey).trim()
  );

  console.log(`移行対象: ${targets.length}件`);
  if (targets.length === 0) {
    console.log('移行対象なし');
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const buyer of targets) {
    // broker_surveyに既に値がある場合はスキップ
    if (buyer.broker_survey && String(buyer.broker_survey).trim()) {
      console.log(`SKIP ${buyer.buyer_number}: broker_survey already = "${buyer.broker_survey}"`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('buyers')
      .update({
        broker_survey: buyer.vendor_survey,
        vendor_survey: null,
      })
      .eq('buyer_number', buyer.buyer_number);

    if (updateError) {
      console.error(`FAIL ${buyer.buyer_number}:`, updateError.message);
      failed++;
    } else {
      console.log(`OK   ${buyer.buyer_number}: broker_survey = "${buyer.vendor_survey}"`);
      success++;
    }
  }

  console.log(`\n完了: 成功=${success}, スキップ=${skipped}, 失敗=${failed}`);
}

main().catch(console.error);
