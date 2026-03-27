/**
 * 固定資産税路線価の一括バックフィルスクリプト
 *
 * 対象: AA13000以降の売主で、DBの fixed_asset_tax_road_price が null かつ
 *       スプレッドシートのDD列（固定資産税路線価）に値があるもの
 *
 * 実行方法:
 *   npx ts-node backend/backfill-fixed-asset-tax-road-price.ts
 *
 * ドライランモード（実際には更新しない）:
 *   DRY_RUN=true npx ts-node backend/backfill-fixed-asset-tax-road-price.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

// GOOGLE_SERVICE_ACCOUNT_JSONはローカルでパースエラーになるため強制的に無効化
// JSONファイルパス（GOOGLE_SERVICE_ACCOUNT_KEY_PATH）を使用する
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const DRY_RUN = process.env.DRY_RUN === 'true';

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

async function main() {
  console.log('🔄 固定資産税路線価バックフィル開始');
  console.log(`   モード: ${DRY_RUN ? '🔍 ドライラン（更新なし）' : '✏️  実際に更新'}`);
  console.log('   対象: AA13000以降 かつ DB の fixed_asset_tax_road_price が null\n');

  // Step 1: DBからAA13000以降でfixed_asset_tax_road_priceがnullの売主を取得
  console.log('📊 Step 1: 対象売主をDBから取得中...');
  const { data: dbSellers, error: dbError } = await supabase
    .from('sellers')
    .select('seller_number, fixed_asset_tax_road_price')
    .is('fixed_asset_tax_road_price', null)
    .is('deleted_at', null)
    .gte('seller_number', 'AA13000')
    .order('seller_number', { ascending: true });

  if (dbError) {
    console.error('❌ DB取得エラー:', dbError.message);
    process.exit(1);
  }

  if (!dbSellers || dbSellers.length === 0) {
    console.log('✅ 対象売主なし（全員同期済み）');
    return;
  }

  console.log(`   対象売主数（DB側）: ${dbSellers.length}件`);
  const targetSellerNumbers = new Set(dbSellers.map(s => s.seller_number));

  // Step 2: スプレッドシートからデータを取得
  console.log('\n📊 Step 2: スプレッドシートからデータ取得中...');
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');

  // ローカル環境ではJSONファイルパスを優先（GOOGLE_SERVICE_ACCOUNT_JSONのパース問題を回避）
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: keyPath,
  });

  await sheetsClient.authenticate();
  const allRows = await sheetsClient.readAll();
  console.log(`   スプレッドシート総行数: ${allRows.length}件`);

  // Step 3: 対象売主のDD列（固定資産税路線価）を抽出
  console.log('\n📊 Step 3: 対象売主のDD列を抽出中...');
  const toUpdate: Array<{ sellerNumber: string; roadPrice: number }> = [];
  let skippedNoValue = 0;

  for (const row of allRows) {
    const sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string') continue;
    if (!targetSellerNumbers.has(sellerNumber)) continue;

    const roadPriceRaw = row['固定資産税路線価'];
    const roadPrice = parseNumeric(roadPriceRaw);

    if (roadPrice === null) {
      skippedNoValue++;
      continue;
    }

    toUpdate.push({ sellerNumber, roadPrice });
  }

  console.log(`   更新対象: ${toUpdate.length}件`);
  console.log(`   スプシ値なし（スキップ）: ${skippedNoValue}件`);

  if (toUpdate.length === 0) {
    console.log('\n✅ 更新対象なし（スプシのDD列が全て空欄）');
    return;
  }

  // Step 4: DBを更新
  console.log(`\n📊 Step 4: DB更新${DRY_RUN ? '（ドライラン）' : ''}中...`);
  let success = 0;
  let failed = 0;

  for (const { sellerNumber, roadPrice } of toUpdate) {
    if (DRY_RUN) {
      console.log(`   [DRY RUN] ${sellerNumber}: fixed_asset_tax_road_price = ${roadPrice}`);
      success++;
      continue;
    }

    const { error } = await supabase
      .from('sellers')
      .update({ fixed_asset_tax_road_price: roadPrice })
      .eq('seller_number', sellerNumber);

    if (error) {
      console.error(`   ❌ ${sellerNumber}: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ ${sellerNumber}: ${roadPrice}`);
      success++;
    }

    // API負荷軽減
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
