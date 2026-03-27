/**
 * AA13000以降で訪問日が入っている売主の visit_date を一括同期するスクリプト
 * 
 * 実行方法:
 *   npx ts-node sync-visit-date-aa13000plus.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';

async function main() {
  console.log('🚀 AA13000以降・訪問日あり売主の visit_date 一括同期を開始します...\n');

  // Supabaseクライアント
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Google Sheetsクライアント
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    serviceAccountKeyPath: SERVICE_ACCOUNT_KEY_PATH,
  });
  await sheetsClient.authenticate();

  // 同期サービス
  const syncService = new EnhancedAutoSyncService(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await syncService.initialize();

  // スプシから全行を取得
  console.log('📥 スプレッドシートからデータを取得中...');
  const allRows = await sheetsClient.readAll();
  console.log(`   取得行数: ${allRows.length}`);

  // AA13000以降 かつ 訪問日あり でフィルタ
  const targetRows = allRows.filter((row: any) => {
    const sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string') return false;

    // AA13000以降
    const num = parseInt(sellerNumber.replace('AA', ''), 10);
    if (isNaN(num) || num < 13000) return false;

    // 訪問日あり（カラム名: "訪問日 Y/M/D"）
    const visitDate = row['訪問日 Y/M/D'];
    return visitDate && String(visitDate).trim() !== '';
  });

  console.log(`\n🎯 対象売主数: ${targetRows.length} 件 (AA13000以降・訪問日あり)\n`);

  if (targetRows.length === 0) {
    console.log('対象売主が見つかりませんでした。');
    return;
  }

  // 対象売主番号一覧を表示
  const targetNumbers = targetRows.map((r: any) => r['売主番号']);
  console.log('対象売主番号:', targetNumbers.join(', '), '\n');

  let successCount = 0;
  let errorCount = 0;

  for (const row of targetRows) {
    const sellerNumber = row['売主番号'];
    const visitDate = row['訪問日 \nY/M/D'];

    try {
      // DBに既存レコードがあるか確認
      const { data: existing } = await supabase
        .from('sellers')
        .select('seller_number, visit_date')
        .eq('seller_number', sellerNumber)
        .single();

      if (!existing) {
        console.log(`⚠️  ${sellerNumber}: DBにレコードなし - スキップ`);
        continue;
      }

      // 更新実行
      await syncService.updateSingleSeller(sellerNumber, row);
      console.log(`✅ ${sellerNumber}: 同期完了 (訪問日スプシ値: ${row['訪問日 Y/M/D']})`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ ${sellerNumber}: エラー - ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 完了:`);
  console.log(`   ✅ 成功: ${successCount} 件`);
  console.log(`   ❌ エラー: ${errorCount} 件`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
