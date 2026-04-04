/**
 * 買主内覧日マッピング検証テスト
 * 
 * このテストは、buyer-column-mapping.jsonの設定が正しいことを検証します。
 * 特に、viewing_dateのマッピングが一貫していることを確認します。
 * 
 * 実行方法:
 * npx ts-node backend/test-buyer-viewing-date-mapping-validation.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ColumnMapping {
  spreadsheetToDatabase: Record<string, string>;
  databaseToSpreadsheet: Record<string, string>;
  typeConversions: Record<string, string>;
}

function validateBuyerViewingDateMapping(): void {
  console.log('🔍 買主内覧日マッピング検証開始...\n');

  // buyer-column-mapping.jsonを読み込む
  const mappingPath = path.join(__dirname, 'src', 'config', 'buyer-column-mapping.json');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mapping: ColumnMapping = JSON.parse(mappingContent);

  let hasError = false;

  // 検証1: spreadsheetToDatabaseで「●内覧日(最新）」がviewing_dateにマッピングされているか
  console.log('✅ 検証1: spreadsheetToDatabase["●内覧日(最新）"] === "viewing_date"');
  const spreadsheetToDbViewingDate = mapping.spreadsheetToDatabase['●内覧日(最新）'];
  if (spreadsheetToDbViewingDate === 'viewing_date') {
    console.log(`   ✅ 正しい: "${spreadsheetToDbViewingDate}"\n`);
  } else {
    console.error(`   ❌ エラー: "${spreadsheetToDbViewingDate}" (期待値: "viewing_date")`);
    console.error(`   🚨 これは絶対に "viewing_date" でなければなりません！`);
    console.error(`   🚨 "latest_viewing_date" にすると即時同期が壊れます！\n`);
    hasError = true;
  }

  // 検証2: databaseToSpreadsheetでviewing_dateが「●内覧日(最新）」にマッピングされているか
  console.log('✅ 検証2: databaseToSpreadsheet["viewing_date"] === "●内覧日(最新）"');
  const dbToSpreadsheetViewingDate = mapping.databaseToSpreadsheet['viewing_date'];
  if (dbToSpreadsheetViewingDate === '●内覧日(最新）') {
    console.log(`   ✅ 正しい: "${dbToSpreadsheetViewingDate}"\n`);
  } else {
    console.error(`   ❌ エラー: "${dbToSpreadsheetViewingDate}" (期待値: "●内覧日(最新）")`);
    console.error(`   🚨 これは絶対に "●内覧日(最新）" でなければなりません！\n`);
    hasError = true;
  }

  // 検証3: マッピングの一貫性（両方向でviewing_dateを使用）
  console.log('✅ 検証3: マッピングの一貫性');
  if (spreadsheetToDbViewingDate === 'viewing_date' && dbToSpreadsheetViewingDate === '●内覧日(最新）') {
    console.log(`   ✅ 一貫性OK: 両方向で "viewing_date" を使用\n`);
  } else {
    console.error(`   ❌ エラー: マッピングが一貫していません`);
    console.error(`   スプシ→DB: "●内覧日(最新）" -> "${spreadsheetToDbViewingDate}"`);
    console.error(`   DB→スプシ: "viewing_date" -> "${dbToSpreadsheetViewingDate}"`);
    console.error(`   🚨 両方向で "viewing_date" を使用する必要があります！\n`);
    hasError = true;
  }

  // 検証4: viewing_timeのマッピング
  console.log('✅ 検証4: viewing_timeのマッピング');
  // viewing_timeはspreadsheetToDatabaseExtendedセクションに存在する可能性がある
  const spreadsheetToDatabaseExtended = (mapping as any).spreadsheetToDatabaseExtended || {};
  const spreadsheetToDbViewingTime = mapping.spreadsheetToDatabase['●時間'] || spreadsheetToDatabaseExtended['●時間'];
  const dbToSpreadsheetViewingTime = mapping.databaseToSpreadsheet['viewing_time'];
  if (spreadsheetToDbViewingTime === 'viewing_time' && dbToSpreadsheetViewingTime === '●時間') {
    console.log(`   ✅ 正しい: viewing_time <-> ●時間\n`);
  } else {
    console.error(`   ❌ エラー: viewing_timeのマッピングが正しくありません`);
    console.error(`   スプシ→DB: "●時間" -> "${spreadsheetToDbViewingTime}"`);
    console.error(`   DB→スプシ: "viewing_time" -> "${dbToSpreadsheetViewingTime}"\n`);
    hasError = true;
  }

  // 検証5: typeConversionsにviewing_dateとviewing_timeが定義されているか
  console.log('✅ 検証5: typeConversionsの定義');
  const viewingDateType = mapping.typeConversions['viewing_date'];
  const viewingTimeType = mapping.typeConversions['viewing_time'];
  if (viewingDateType === 'date' && viewingTimeType === 'time') {
    console.log(`   ✅ 正しい: viewing_date=date, viewing_time=time\n`);
  } else {
    console.error(`   ❌ エラー: typeConversionsが正しくありません`);
    console.error(`   viewing_date: "${viewingDateType}" (期待値: "date")`);
    console.error(`   viewing_time: "${viewingTimeType}" (期待値: "time")\n`);
    hasError = true;
  }

  // 結果サマリー
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (hasError) {
    console.error('❌ 検証失敗: buyer-column-mapping.jsonに問題があります');
    console.error('🚨 即時同期が壊れる可能性があります！');
    console.error('🚨 .kiro/steering/buyer-viewing-date-sync-protection.md を参照してください');
    process.exit(1);
  } else {
    console.log('✅ 検証成功: buyer-column-mapping.jsonは正しく設定されています');
    console.log('✅ 買主内覧日の即時同期は正常に動作します');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// テスト実行
validateBuyerViewingDateMapping();
