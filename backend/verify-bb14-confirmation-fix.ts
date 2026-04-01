// BB14の確認フィールド修正を検証するスクリプト
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { PropertyListingSpreadsheetSync } from './src/services/PropertyListingSpreadsheetSync';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const spreadsheetId = process.env.PROPERTY_LISTING_SPREADSHEET_ID!;
const sheetName = process.env.PROPERTY_LISTING_SHEET_NAME || '物件';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
  console.log('🔍 BB14の確認フィールド修正を検証中...\n');

  // 1. スプレッドシートから直接DQ列を読み取る
  console.log('📊 Step 1: スプレッドシートから直接DQ列を読み取る');
  const sheetsClient = new GoogleSheetsClient(spreadsheetId, sheetName);
  await sheetsClient.authenticate();

  // BB14の行番号を取得
  const bb14RowIndex = await sheetsClient.findRowByColumn('物件番号', 'BB14');
  if (!bb14RowIndex) {
    console.log('❌ BB14がスプレッドシートに見つかりません');
    return;
  }

  console.log(`  BB14の行番号: ${bb14RowIndex}`);

  // DQ列を直接読み取る
  const dqRange = `${sheetName}!DQ${bb14RowIndex}`;
  const dqValue = await sheetsClient.readRawCell(dqRange);
  console.log(`  DQ列の値: ${dqValue}`);
  console.log('');

  // 2. 修正後のsyncConfirmationFromSpreadsheetを実行
  console.log('📊 Step 2: 修正後のsyncConfirmationFromSpreadsheetを実行');
  const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
  const result = await syncService.syncConfirmationFromSpreadsheet();
  console.log(`  更新件数: ${result.updatedCount}`);
  console.log(`  エラー件数: ${result.errorCount}`);
  console.log('');

  // 3. データベースのBB14を確認
  console.log('📊 Step 3: データベースのBB14を確認');
  const { data: bb14, error: bb14Error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation')
    .eq('property_number', 'BB14')
    .single();

  if (bb14Error) {
    console.error('❌ エラー:', bb14Error);
    return;
  }

  if (!bb14) {
    console.log('❌ BB14が見つかりません');
    return;
  }

  console.log('  物件番号:', bb14.property_number);
  console.log('  確認（データベース）:', bb14.confirmation);
  console.log('');

  // 4. 検証結果
  console.log('📊 検証結果:');
  if (dqValue === bb14.confirmation) {
    console.log('✅ 成功: スプレッドシートとデータベースの値が一致しています');
    console.log(`   DQ列: ${dqValue}`);
    console.log(`   データベース: ${bb14.confirmation}`);
  } else {
    console.log('❌ 失敗: スプレッドシートとデータベースの値が一致しません');
    console.log(`   DQ列: ${dqValue}`);
    console.log(`   データベース: ${bb14.confirmation}`);
  }
  console.log('');

  // 5. 「未完了」カテゴリのカウントを確認
  console.log('📊 Step 4: 「未完了」カテゴリのカウントを確認');
  const { data: incompleteProperties, error: incompleteError } = await supabase
    .from('property_listings')
    .select('property_number, confirmation')
    .eq('confirmation', '未');

  if (incompleteError) {
    console.error('❌ エラー:', incompleteError);
    return;
  }

  console.log(`  「未完了」物件数: ${incompleteProperties?.length || 0}`);
  if (incompleteProperties && incompleteProperties.length > 0) {
    console.log('  「未完了」物件一覧:');
    incompleteProperties.forEach(p => {
      console.log(`    - ${p.property_number}`);
    });
  }
  console.log('');

  if (incompleteProperties && incompleteProperties.length > 0) {
    console.log('✅ 成功: 「未完了」カテゴリがサイドバーに表示されるはずです');
  } else {
    console.log('⚠️  警告: 「未完了」物件が0件です。サイドバーに表示されません');
  }
}

verifyFix().catch(console.error);
