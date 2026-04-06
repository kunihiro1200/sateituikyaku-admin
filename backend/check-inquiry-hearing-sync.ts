/**
 * 「●問合時ヒアリング」同期不具合の調査スクリプト
 * 
 * 実際の買主データでスプレッドシートとデータベースの差分を確認します。
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

  console.log('🔍 「●問合時ヒアリング」同期不具合の調査を開始します\n');

  // 買主を初期化
  await syncService.initializeBuyer();

  // スプレッドシートから全データを取得
  console.log('📊 スプレッドシートからデータを取得中...');
  const allRows = await syncService['getBuyerSpreadsheetData']();
  console.log(`✅ ${allRows.length}件の買主データを取得しました\n`);

  // inquiry_hearingが空でない買主を抽出（最初の10件）
  const buyersWithInquiryHearing = allRows
    .filter(row => {
      const inquiryHearing = row['●問合時ヒアリング'];
      return inquiryHearing && String(inquiryHearing).trim() !== '';
    })
    .slice(0, 10);

  console.log(`📊 「●問合時ヒアリング」が入力されている買主: ${buyersWithInquiryHearing.length}件\n`);

  // 各買主について、スプレッドシートとデータベースの値を比較
  for (const row of buyersWithInquiryHearing) {
    const buyerNumber = row['買主番号'];
    const sheetInquiryHearing = row['●問合時ヒアリング'];

    if (!buyerNumber) continue;

    // データベースから取得
    const { data: dbBuyer } = await supabase
      .from('buyers')
      .select('buyer_number, inquiry_hearing')
      .eq('buyer_number', buyerNumber)
      .single();

    if (!dbBuyer) {
      console.log(`⚠️ ${buyerNumber}: データベースに存在しません`);
      continue;
    }

    const dbInquiryHearing = dbBuyer.inquiry_hearing;

    // 比較
    const sheetStr = sheetInquiryHearing ? String(sheetInquiryHearing).trim() : '';
    const dbStr = dbInquiryHearing ? String(dbInquiryHearing).trim() : '';

    if (sheetStr !== dbStr) {
      console.log(`\n❌ 不一致検出: ${buyerNumber}`);
      console.log(`   スプシ: "${sheetStr}"`);
      console.log(`   DB:     "${dbStr}"`);
      console.log(`   長さ: スプシ=${sheetStr.length}, DB=${dbStr.length}`);
    } else {
      console.log(`✅ ${buyerNumber}: 一致`);
    }
  }

  console.log('\n🔍 detectUpdatedBuyersを実行して変更検出をテスト...');
  const updatedBuyers = await syncService.detectUpdatedBuyers();
  console.log(`📊 検出された更新買主数: ${updatedBuyers.length}`);

  if (updatedBuyers.length > 0) {
    console.log(`📊 最初の10件: ${updatedBuyers.slice(0, 10).join(', ')}`);
  }

  console.log('\n✅ 調査完了');
}

main().catch(console.error);
