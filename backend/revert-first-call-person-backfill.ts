/**
 * first_call_person バックフィルのリバートスクリプト
 *
 * 誤って「不通」の値（「1度目不通」等）が first_call_person に書き込まれたため、
 * AA13000以降の売主の first_call_person を null に戻す。
 *
 * 実行方法:
 *   npx ts-node revert-first-call-person-backfill.ts
 *
 * ドライランモード:
 *   $env:DRY_RUN="true"; npx ts-node revert-first-call-person-backfill.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DRY_RUN = process.env.DRY_RUN === 'true';

// 誤って書き込まれた「不通」系の値のパターン
const UNREACHABLE_PATTERNS = [
  '1度目不通',
  '2度目不通',
  '3度目不通',
  '不通',
  '長期不通',
];

async function main() {
  console.log('🔄 first_call_person バックフィルのリバート開始');
  console.log(`   モード: ${DRY_RUN ? '🔍 ドライラン（更新なし）' : '✏️  実際に更新'}`);
  console.log('   対象: AA13000以降 かつ first_call_person が不通系の値\n');

  // 不通系の値が入っている売主を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, first_call_person')
    .is('deleted_at', null)
    .gte('seller_number', 'AA13000')
    .not('first_call_person', 'is', null)
    .order('seller_number', { ascending: true });

  if (error) {
    console.error('❌ DB取得エラー:', error.message);
    process.exit(1);
  }

  if (!sellers || sellers.length === 0) {
    console.log('✅ 対象売主なし');
    return;
  }

  // 不通系の値が入っているものだけ絞り込む
  const toRevert = sellers.filter((s: any) =>
    UNREACHABLE_PATTERNS.some(p => s.first_call_person?.includes(p))
  );

  console.log(`   first_call_person に値あり: ${sellers.length}件`);
  console.log(`   不通系の値（リバート対象）: ${toRevert.length}件\n`);

  if (toRevert.length === 0) {
    console.log('✅ リバート対象なし');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const seller of toRevert) {
    if (DRY_RUN) {
      console.log(`   [DRY RUN] ${seller.seller_number}: "${seller.first_call_person}" → null`);
      success++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('sellers')
      .update({ first_call_person: null })
      .eq('seller_number', seller.seller_number);

    if (updateError) {
      console.error(`   ❌ ${seller.seller_number}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`   ✅ ${seller.seller_number}: "${seller.first_call_person}" → null`);
      success++;
    }

    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n📊 完了サマリー:`);
  console.log(`   ✅ 成功: ${success}件`);
  if (failed > 0) console.log(`   ❌ 失敗: ${failed}件`);
  if (DRY_RUN) console.log('\n   ※ ドライランのため実際の更新は行われていません');
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err);
  process.exit(1);
});
