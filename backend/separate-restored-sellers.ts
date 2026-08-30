/**
 * 復元レコードを通常リストから完全に分離するスクリプト
 *
 * 【背景】
 * restore-all-deleted-sellers.ts が deleted_at = null にしたため、
 * 復元した142件が通常の全クエリ（deleted_at IS NULL）に混入し、
 * 「当日TEL_未着手」等のサイドバー件数が大量に増えてしまった。
 *
 * 【対応】
 * is_restored = true のレコードに deleted_at を再設定する（復元前の状態に戻す）。
 * これにより既存の全クエリ（deleted_at IS NULL）から自動的に除外される。
 * is_restored / restored_at のマーカーは残すので「復元」カテゴリーからは参照できる。
 *
 * 使い方: npx ts-node backend/separate-restored-sellers.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('='.repeat(80));
  console.log('復元レコードを通常リストから分離');
  console.log('='.repeat(80));

  // 混入しているレコード（is_restored = true かつ deleted_at IS NULL）
  const { data: targets, error: fetchError } = await supabase
    .from('sellers')
    .select('id, seller_number, restored_at, status, next_call_date')
    .eq('is_restored', true)
    .is('deleted_at', null);

  if (fetchError) {
    console.error('❌ 取得エラー:', fetchError.message);
    process.exit(1);
  }

  if (!targets || targets.length === 0) {
    console.log('✅ 混入しているレコードはありません（既に分離済み）');
    return;
  }

  console.log(`\n📊 分離対象: ${targets.length}件\n`);

  let ok = 0;
  let ng = 0;
  const failed: string[] = [];

  for (const seller of targets) {
    // 元の削除日時は失われているため restored_at を deleted_at として使う
    // （「復元」カテゴリーは is_restored = true で抽出するので値自体は識別に使わない）
    const deletedAt = seller.restored_at || new Date().toISOString();

    // 一時的なネットワークエラー（fetch failed）に備えて最大5回リトライ
    let lastError: string | null = null;
    let success = false;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { error: updateError } = await supabase
          .from('sellers')
          .update({ deleted_at: deletedAt })
          .eq('id', seller.id);

        if (!updateError) {
          success = true;
          break;
        }
        lastError = updateError.message;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
      // 指数バックオフ（0.5s, 1s, 2s, 4s）
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }

    if (success) {
      ok++;
    } else {
      console.error(`❌ ${seller.seller_number}: ${lastError}`);
      failed.push(seller.seller_number);
      ng++;
    }
  }

  if (failed.length > 0) {
    console.log(`\n⚠️ 失敗した売主番号: ${failed.join(', ')}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ 分離完了: ${ok}件${ng > 0 ? ` / ❌ 失敗: ${ng}件` : ''}`);
  console.log('='.repeat(80));

  // 検証
  const { count: leaked } = await supabase
    .from('sellers')
    .select('*', { count: 'exact', head: true })
    .eq('is_restored', true)
    .is('deleted_at', null);

  const { count: restoredTotal } = await supabase
    .from('sellers')
    .select('*', { count: 'exact', head: true })
    .eq('is_restored', true);

  console.log(`\n🔍 検証結果`);
  console.log(`  復元レコード総数            : ${restoredTotal}件`);
  console.log(`  通常リストへの混入（0が正常）: ${leaked}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
