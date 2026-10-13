/**
 * rollback-nta-update.ts
 *
 * apply-nta-final.ts で行った更新を元に戻す（ロールバック）スクリプト。
 *
 * 実行方法:
 *   npx ts-node --transpile-only backend/rollback-nta-update.ts
 *
 * 動作:
 *   1. construction_prices_backup.json から元の価格を読み込む
 *   2. 変更された行（history テーブルに記録された行）を元の価格に戻す
 *   3. price_source / is_provisional も元の値に戻す
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '.env') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BACKUP_PATH = path.join(__dirname, 'construction_prices_backup.json');

async function main() {
  console.log('===== ロールバックスクリプト =====\n');

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('❌ バックアップファイルが見つかりません:', BACKUP_PATH);
    process.exit(1);
  }

  const backup: any[] = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

  // 変更された行を history から取得
  const { data: history } = await supabase
    .from('construction_unit_price_history')
    .select('construction_unit_price_id, year, structure, old_price')
    .eq('applied_by', 'stage5_nta_update')
    .order('year').order('structure');

  if (!history || history.length === 0) {
    console.log('ロールバック対象なし（history テーブルに stage5 の記録なし）');
    return;
  }

  console.log(`ロールバック対象: ${history.length}行`);

  let restored = 0;
  for (const h of history) {
    const orig = backup.find(r => r.id === h.construction_unit_price_id);
    if (!orig) { console.warn(`  ⚠️ バックアップに行なし: ${h.year}/${h.structure}`); continue; }

    const { error } = await supabase
      .from('construction_unit_prices')
      .update({
        price_per_sqm:      orig.price_per_sqm,
        price_source:       orig.price_source,
        is_provisional:     orig.is_provisional,
        provisional_reason: orig.provisional_reason,
        approved_at:        orig.approved_at,
        approved_by:        orig.approved_by,
        version:            orig.version,
      })
      .eq('id', h.construction_unit_price_id);

    if (!error) { process.stdout.write('.'); restored++; }
    else console.error(`\n❌ ${h.year}/${h.structure}:`, error.message);
  }

  console.log(`\n\n✅ ロールバック完了: ${restored}行を元の価格に復元しました`);
  console.log('⚠️ キャッシュは TTL(6h) 後に自動更新されます');
}

main().catch(e => { console.error(e); process.exit(1); });
