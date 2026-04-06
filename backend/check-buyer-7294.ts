/**
 * 買主7294の「●問合時ヒアリング」同期不具合の詳細調査
 */

import { createClient } from '@supabase/supabase-js';
import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const syncService = new EnhancedAutoSyncService(supabaseUrl, supabaseKey);
  const buyerColumnMapper = new BuyerColumnMapper();

  const buyerNumber = '7294';

  console.log(`🔍 買主${buyerNumber}の「●問合時ヒアリング」同期不具合を調査します\n`);

  // 買主を初期化
  await syncService.initializeBuyer();

  // スプレッドシートから全データを取得
  console.log('📊 スプレッドシートからデータを取得中...');
  const allRows = await syncService['getBuyerSpreadsheetData']();
  console.log(`✅ ${allRows.length}件の買主データを取得しました\n`);

  // 買主7294のデータを検索
  const row = allRows.find(r => String(r['買主番号']) === buyerNumber);

  if (!row) {
    console.error(`❌ 買主${buyerNumber}がスプレッドシートに見つかりません`);
    return;
  }

  console.log(`✅ 買主${buyerNumber}をスプレッドシートで発見\n`);

  // スプレッドシートの値を表示
  const sheetInquiryHearing = row['●問合時ヒアリング'];
  console.log('📊 スプレッドシートの値:');
  console.log(`   「●問合時ヒアリング」: "${sheetInquiryHearing}"`);
  console.log(`   型: ${typeof sheetInquiryHearing}`);
  console.log(`   長さ: ${sheetInquiryHearing ? String(sheetInquiryHearing).length : 0}`);
  console.log(`   null/undefined: ${sheetInquiryHearing === null || sheetInquiryHearing === undefined}`);
  console.log(`   空文字: ${sheetInquiryHearing === ''}`);
  console.log();

  // BuyerColumnMapperでマッピング
  const mappedData = buyerColumnMapper.mapSpreadsheetToDatabase(
    Object.keys(row),
    Object.values(row)
  );

  console.log('📊 BuyerColumnMapperでマッピング後:');
  console.log(`   inquiry_hearing: "${mappedData.inquiry_hearing}"`);
  console.log(`   型: ${typeof mappedData.inquiry_hearing}`);
  console.log(`   長さ: ${mappedData.inquiry_hearing ? String(mappedData.inquiry_hearing).length : 0}`);
  console.log(`   null/undefined: ${mappedData.inquiry_hearing === null || mappedData.inquiry_hearing === undefined}`);
  console.log();

  // データベースから取得
  const { data: dbBuyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', buyerNumber)
    .single();

  if (error || !dbBuyer) {
    console.error(`❌ 買主${buyerNumber}がデータベースに見つかりません:`, error?.message);
    return;
  }

  console.log('📊 データベースの値:');
  console.log(`   inquiry_hearing: "${dbBuyer.inquiry_hearing}"`);
  console.log(`   型: ${typeof dbBuyer.inquiry_hearing}`);
  console.log(`   長さ: ${dbBuyer.inquiry_hearing ? String(dbBuyer.inquiry_hearing).length : 0}`);
  console.log(`   null/undefined: ${dbBuyer.inquiry_hearing === null || dbBuyer.inquiry_hearing === undefined}`);
  console.log();

  // 比較
  const sheetStr = sheetInquiryHearing !== null && sheetInquiryHearing !== undefined ? String(sheetInquiryHearing).trim() : '';
  const dbStr = dbBuyer.inquiry_hearing !== null && dbBuyer.inquiry_hearing !== undefined ? String(dbBuyer.inquiry_hearing).trim() : '';

  console.log('📊 比較結果:');
  console.log(`   スプシ（trim後）: "${sheetStr}"`);
  console.log(`   DB（trim後）:     "${dbStr}"`);
  console.log(`   一致: ${sheetStr === dbStr ? '✅ はい' : '❌ いいえ'}`);
  console.log();

  if (sheetStr !== dbStr) {
    console.log('❌ 不一致が検出されました！');
    console.log(`   差分: スプシ=${sheetStr.length}文字, DB=${dbStr.length}文字`);
    console.log();

    // 文字コード比較
    console.log('📊 文字コード比較（最初の50文字）:');
    const maxLen = Math.min(50, Math.max(sheetStr.length, dbStr.length));
    for (let i = 0; i < maxLen; i++) {
      const sheetChar = sheetStr[i] || '';
      const dbChar = dbStr[i] || '';
      const sheetCode = sheetChar ? sheetChar.charCodeAt(0) : 0;
      const dbCode = dbChar ? dbChar.charCodeAt(0) : 0;
      
      if (sheetChar !== dbChar) {
        console.log(`   [${i}] スプシ: '${sheetChar}' (${sheetCode}) vs DB: '${dbChar}' (${dbCode})`);
      }
    }
    console.log();
  }

  // detectUpdatedBuyersで検出されるか確認
  console.log('🔍 detectUpdatedBuyersで検出されるか確認...');
  const updatedBuyers = await syncService.detectUpdatedBuyers();
  const isDetected = updatedBuyers.includes(buyerNumber);
  console.log(`   結果: ${isDetected ? '✅ 検出された' : '❌ 検出されなかった'}`);
  console.log();

  if (isDetected) {
    console.log('✅ 変更が検出されました。syncUpdatedBuyersを実行します...');
    
    // 同期実行
    const result = await syncService.syncUpdatedBuyers([buyerNumber]);
    console.log('📊 同期結果:', JSON.stringify(result, null, 2));
    console.log();

    // 同期後のデータベース値を確認
    const { data: afterSync } = await supabase
      .from('buyers')
      .select('inquiry_hearing')
      .eq('buyer_number', buyerNumber)
      .single();

    console.log('📊 同期後のデータベース値:');
    console.log(`   inquiry_hearing: "${afterSync?.inquiry_hearing}"`);
    console.log();

    const afterSyncStr = afterSync?.inquiry_hearing !== null && afterSync?.inquiry_hearing !== undefined ? String(afterSync.inquiry_hearing).trim() : '';
    
    if (afterSyncStr === sheetStr) {
      console.log('✅ 同期成功！スプレッドシートとデータベースが一致しました');
    } else {
      console.log('❌ 同期失敗！まだ一致していません');
      console.log(`   スプシ: "${sheetStr}"`);
      console.log(`   DB:     "${afterSyncStr}"`);
    }
  } else {
    console.log('❌ 変更が検出されませんでした。これが不具合の原因です。');
    console.log();
    console.log('🔍 detectUpdatedBuyersのロジックを詳細に確認します...');
    
    // skipFieldsの確認
    const skipFields = new Set([
      'buyer_number', 'buyer_id', 'created_at', 'updated_at', 'created_datetime',
      'db_updated_at', 'last_synced_at', 'deleted_at',
    ]);

    console.log('📊 skipFields:', Array.from(skipFields));
    console.log(`   inquiry_hearingは含まれていない: ${!skipFields.has('inquiry_hearing') ? '✅ はい' : '❌ いいえ'}`);
    console.log();

    // 全フィールドを比較
    console.log('📊 全フィールドの比較:');
    let needsUpdate = false;
    for (const [dbField, sheetValue] of Object.entries(mappedData)) {
      if (skipFields.has(dbField)) continue;

      const dbValue = dbBuyer[dbField];
      const sheetStr = sheetValue !== null && sheetValue !== undefined ? String(sheetValue).trim() : '';
      const dbStr = dbValue !== null && dbValue !== undefined ? String(dbValue).trim() : '';

      if (sheetStr !== dbStr) {
        console.log(`   ❌ ${dbField}: 不一致`);
        console.log(`      スプシ: "${sheetStr.substring(0, 50)}${sheetStr.length > 50 ? '...' : ''}"`);
        console.log(`      DB:     "${dbStr.substring(0, 50)}${dbStr.length > 50 ? '...' : ''}"`);
        needsUpdate = true;
      }
    }

    if (!needsUpdate) {
      console.log('   ✅ 全フィールドが一致しています');
    }
  }

  console.log('\n✅ 調査完了');
}

main().catch(console.error);
