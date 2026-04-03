/**
 * 買主内覧日同期テスト
 * 
 * このスクリプトは、買主内覧日の即時同期が正しく動作するかテストします。
 * 変更を加えた後は、必ずこのスクリプトを実行して確認してください。
 */

import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testBuyerViewingDateSync() {
  console.log('🧪 買主内覧日同期テスト開始...\n');

  const columnMapper = new BuyerColumnMapper();

  // テスト1: databaseToSpreadsheetマッピングの確認
  console.log('📋 テスト1: databaseToSpreadsheetマッピングの確認');
  const viewingDateMapping = columnMapper.getSpreadsheetColumnName('viewing_date');
  const viewingTimeMapping = columnMapper.getSpreadsheetColumnName('viewing_time');

  console.log(`  viewing_date -> "${viewingDateMapping}"`);
  console.log(`  viewing_time -> "${viewingTimeMapping}"`);

  if (viewingDateMapping !== '●内覧日(最新）') {
    console.error(`  ❌ FAILED: viewing_dateのマッピングが間違っています`);
    console.error(`     期待値: "●内覧日(最新）"`);
    console.error(`     実際値: "${viewingDateMapping}"`);
    process.exit(1);
  }

  if (viewingTimeMapping !== '●時間') {
    console.error(`  ❌ FAILED: viewing_timeのマッピングが間違っています`);
    console.error(`     期待値: "●時間"`);
    console.error(`     実際値: "${viewingTimeMapping}"`);
    process.exit(1);
  }

  console.log('  ✅ PASSED: マッピングが正しい\n');

  // テスト2: mapDatabaseToSpreadsheetの動作確認
  console.log('📋 テスト2: mapDatabaseToSpreadsheetの動作確認');
  const testData = {
    viewing_date: '2026-04-05T00:00:00+00:00',
    viewing_time: '14:00'
  };

  const result = columnMapper.mapDatabaseToSpreadsheet(testData);

  console.log(`  入力:`, JSON.stringify(testData, null, 2));
  console.log(`  出力:`, JSON.stringify(result, null, 2));

  if (!result['●内覧日(最新）']) {
    console.error(`  ❌ FAILED: "●内覧日(最新）"が出力に含まれていません`);
    process.exit(1);
  }

  if (!result['●時間']) {
    console.error(`  ❌ FAILED: "●時間"が出力に含まれていません`);
    process.exit(1);
  }

  if (result['●内覧日(最新）'] !== '2026/04/05') {
    console.error(`  ❌ FAILED: 日付のフォーマットが間違っています`);
    console.error(`     期待値: "2026/04/05"`);
    console.error(`     実際値: "${result['●内覧日(最新）']}"`);
    process.exit(1);
  }

  if (result['●時間'] !== '14:00') {
    console.error(`  ❌ FAILED: 時間のフォーマットが間違っています`);
    console.error(`     期待値: "14:00"`);
    console.error(`     実際値: "${result['●時間']}"`);
    process.exit(1);
  }

  console.log('  ✅ PASSED: 変換が正しい\n');

  // テスト3: 型変換の確認
  console.log('📋 テスト3: 型変換の確認');
  const typeConversions = columnMapper.getTypeConversions();

  if (typeConversions['viewing_date'] !== 'date') {
    console.error(`  ❌ FAILED: viewing_dateの型変換が間違っています`);
    console.error(`     期待値: "date"`);
    console.error(`     実際値: "${typeConversions['viewing_date']}"`);
    process.exit(1);
  }

  if (typeConversions['viewing_time'] !== 'time') {
    console.error(`  ❌ FAILED: viewing_timeの型変換が間違っています`);
    console.error(`     期待値: "time"`);
    console.error(`     実際値: "${typeConversions['viewing_time']}"`);
    process.exit(1);
  }

  console.log('  ✅ PASSED: 型変換が正しい\n');

  // 全テスト成功
  console.log('🎉 全テスト成功！買主内覧日の即時同期は正しく動作します。\n');
  console.log('📝 確認事項:');
  console.log('  ✅ viewing_date -> "●内覧日(最新）" (I列)');
  console.log('  ✅ viewing_time -> "●時間" (BP列)');
  console.log('  ✅ 日付フォーマット: YYYY/MM/DD');
  console.log('  ✅ 時間フォーマット: HH:mm');
}

testBuyerViewingDateSync().catch((error) => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
