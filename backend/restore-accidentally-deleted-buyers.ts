/**
 * 誤削除された買主の一括復元スクリプト
 *
 * 使用方法:
 *   npx ts-node backend/restore-accidentally-deleted-buyers.ts
 *
 * 動作:
 * 1. deleted_at が設定されている全買主を取得
 * 2. 買主スプレッドシートに存在する買主を特定
 * 3. 該当する買主の deleted_at を NULL に更新（復元）
 * 4. 復元結果をログ出力
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const BUYER_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_KEY が設定されていません');
  process.exit(1);
}

if (!BUYER_SPREADSHEET_ID) {
  console.error('❌ GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が設定されていません');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * ユーザーに確認を求める
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 削除済み買主を全件取得
 */
async function getDeletedBuyers(): Promise<Array<{ id: string; buyer_number: string; name: string | null; deleted_at: string }>> {
  const allDeleted: Array<{ id: string; buyer_number: string; name: string | null; deleted_at: string }> = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('buyers')
      .select('id, buyer_number, name, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`削除済み買主の取得に失敗: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allDeleted.push(...data);
      offset += pageSize;
      if (data.length < pageSize) hasMore = false;
    }
  }

  return allDeleted;
}

/**
 * スプレッドシートから買主番号一覧を取得
 */
async function getBuyerNumbersFromSpreadsheet(): Promise<Set<string>> {
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');

  const sheetsConfig = {
    spreadsheetId: BUYER_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };

  const client = new GoogleSheetsClient(sheetsConfig);
  await client.authenticate();

  console.log('📊 スプレッドシートからデータを取得中...');
  const allRows = await client.readAll();

  const buyerNumbers = new Set<string>();
  for (const row of allRows) {
    const buyerNumber = row['買主番号'];
    if (buyerNumber !== null && buyerNumber !== undefined && buyerNumber !== '') {
      buyerNumbers.add(String(buyerNumber).trim());
    }
  }

  return buyerNumbers;
}

/**
 * 買主を復元（deleted_at を NULL に設定）
 */
async function restoreBuyer(buyerNumber: string): Promise<{ success: boolean; error?: string }> {
  // 1. buyers テーブルの deleted_at を NULL に更新
  const { error: buyerError } = await supabase
    .from('buyers')
    .update({ deleted_at: null })
    .eq('buyer_number', buyerNumber)
    .not('deleted_at', 'is', null);

  if (buyerError) {
    return { success: false, error: buyerError.message };
  }

  // 2. 監査ログを更新（存在する場合）
  const recoveredAt = new Date().toISOString();
  await supabase
    .from('buyer_deletion_audit')
    .update({
      recovered_at: recoveredAt,
      recovered_by: 'restore-accidentally-deleted-buyers-script',
    })
    .eq('buyer_number', buyerNumber)
    .is('recovered_at', null);

  return { success: true };
}

/**
 * メイン処理
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🔄 誤削除された買主の一括復元スクリプト');
  console.log('='.repeat(60));
  console.log(`📋 スプレッドシートID: ${BUYER_SPREADSHEET_ID}`);
  console.log('');

  // Step 1: 削除済み買主を取得
  console.log('📥 Step 1: 削除済み買主を取得中...');
  const deletedBuyers = await getDeletedBuyers();
  console.log(`   削除済み買主数: ${deletedBuyers.length} 件`);

  if (deletedBuyers.length === 0) {
    console.log('✅ 削除済み買主はいません。処理を終了します。');
    return;
  }

  // Step 2: スプレッドシートの買主番号を取得
  console.log('');
  console.log('📥 Step 2: スプレッドシートから買主番号を取得中...');
  const sheetBuyerNumbers = await getBuyerNumbersFromSpreadsheet();
  console.log(`   スプレッドシートの買主数: ${sheetBuyerNumbers.size} 件`);

  // Step 3: 復元対象を特定（削除済み かつ スプレッドシートに存在する）
  console.log('');
  console.log('🔍 Step 3: 復元対象を特定中...');
  const toRestore = deletedBuyers.filter(b => sheetBuyerNumbers.has(b.buyer_number));
  const notInSheet = deletedBuyers.filter(b => !sheetBuyerNumbers.has(b.buyer_number));

  console.log(`   復元対象（スプレッドシートに存在）: ${toRestore.length} 件`);
  console.log(`   スキップ（スプレッドシートに存在しない）: ${notInSheet.length} 件`);

  if (toRestore.length === 0) {
    console.log('');
    console.log('✅ 復元対象の買主はいません。処理を終了します。');
    return;
  }

  // Step 4: 復元対象の一覧を表示
  console.log('');
  console.log('📋 復元対象の買主一覧:');
  for (const buyer of toRestore.slice(0, 20)) {
    console.log(`   - ${buyer.buyer_number} (削除日時: ${buyer.deleted_at})`);
  }
  if (toRestore.length > 20) {
    console.log(`   ... 他 ${toRestore.length - 20} 件`);
  }

  // Step 5: 確認プロンプト
  console.log('');
  const confirmed = await askConfirmation(
    `⚠️  上記 ${toRestore.length} 件の買主を復元しますか？ (y/N): `
  );

  if (!confirmed) {
    console.log('❌ キャンセルしました。');
    return;
  }

  // Step 6: 復元実行
  console.log('');
  console.log('🔄 Step 4: 復元を実行中...');
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ buyerNumber: string; error: string }> = [];

  for (const buyer of toRestore) {
    const result = await restoreBuyer(buyer.buyer_number);
    if (result.success) {
      console.log(`   ✅ ${buyer.buyer_number} を復元しました`);
      successCount++;
    } else {
      console.error(`   ❌ ${buyer.buyer_number} の復元に失敗: ${result.error}`);
      errors.push({ buyerNumber: buyer.buyer_number, error: result.error! });
      errorCount++;
    }
  }

  // Step 7: 結果サマリー
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 復元結果サマリー');
  console.log('='.repeat(60));
  console.log(`   ✅ 成功: ${successCount} 件`);
  console.log(`   ❌ 失敗: ${errorCount} 件`);
  console.log(`   ⏭️  スキップ（スプレッドシートに存在しない）: ${notInSheet.length} 件`);

  if (errors.length > 0) {
    console.log('');
    console.log('❌ エラー詳細:');
    for (const { buyerNumber, error } of errors) {
      console.log(`   - ${buyerNumber}: ${error}`);
    }
  }

  console.log('');
  if (errorCount === 0) {
    console.log('🎉 全ての復元が完了しました！');
  } else {
    console.log('⚠️  一部の復元に失敗しました。エラー詳細を確認してください。');
  }
}

main().catch((error) => {
  console.error('❌ スクリプト実行中にエラーが発生しました:', error);
  process.exit(1);
});
