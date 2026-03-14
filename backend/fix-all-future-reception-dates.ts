/**
 * reception_dateが未来日付（2026年以降）になっている買主を一括修正
 * created_datetimeの年を使ってreception_dateを正しい年に修正する
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixAll() {
  // 2026年以降のreception_dateを持つ買主を全件取得
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, reception_date, created_datetime')
    .gte('reception_date', '2026-01-01')
    .order('buyer_number');

  if (error) {
    console.error('取得エラー:', error);
    return;
  }

  console.log(`修正対象: ${data?.length ?? 0}件`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const buyer of data ?? []) {
    const receptionDate = new Date(buyer.reception_date);
    const receptionMonth = receptionDate.getUTCMonth() + 1;
    const receptionDay = receptionDate.getUTCDate();

    // created_datetimeから正しい年を取得
    let correctYear: number;
    if (buyer.created_datetime) {
      const createdDate = new Date(buyer.created_datetime);
      correctYear = createdDate.getUTCFullYear();
    } else {
      // created_datetimeがない場合はスキップ
      console.log(`  SKIP ${buyer.buyer_number}: created_datetimeがnull`);
      skipped++;
      continue;
    }

    // 正しい年が2026年以上の場合はスキップ（本当に2026年以降の受付日の可能性）
    if (correctYear >= 2026) {
      // created_datetimeも2026年以降なら正しいデータ
      console.log(`  SKIP ${buyer.buyer_number}: created_datetime=${buyer.created_datetime}（2026年以降の正常データ）`);
      skipped++;
      continue;
    }

    const correctDate = `${correctYear}-${String(receptionMonth).padStart(2, '0')}-${String(receptionDay).padStart(2, '0')}`;

    const { error: updateError } = await supabase
      .from('buyers')
      .update({ reception_date: correctDate })
      .eq('buyer_number', buyer.buyer_number);

    if (updateError) {
      console.error(`  ERROR ${buyer.buyer_number}:`, updateError.message);
      errors++;
    } else {
      console.log(`  FIX ${buyer.buyer_number}: ${buyer.reception_date.substring(0, 10)} → ${correctDate}`);
      fixed++;
    }
  }

  console.log(`\n完了: 修正=${fixed}件, スキップ=${skipped}件, エラー=${errors}件`);
}

fixAll().catch(console.error);
