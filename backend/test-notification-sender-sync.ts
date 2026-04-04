/**
 * 買主「通知送信者」フィールドDB→スプレッドシート同期テスト
 * 
 * このテストは、バグ条件を確認するための探索的テストです。
 * 期待される結果：テストが失敗する（バグが存在することを確認）
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 🚨 重要: 環境変数を最初に読み込む（他のモジュールをインポートする前）
const envPath = path.join(__dirname, '.env');
console.log(`📁 Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

import { BuyerService } from './src/services/BuyerService';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';
import { BuyerWriteService } from './src/services/BuyerWriteService';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID || '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

console.log(`📋 SPREADSHEET_ID: ${SPREADSHEET_ID}`);
console.log(`📋 SHEET_NAME: ${SHEET_NAME}`);

async function testNotificationSenderSync() {
  console.log('🧪 買主「通知送信者」フィールドDB→スプレッドシート同期テスト');
  console.log('');

  try {
    // Google Sheets認証
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    // サービスを初期化
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
    });
    
    // 認証を実行
    await sheetsClient.authenticate();
    
    const columnMapper = new BuyerColumnMapper();
    const writeService = new BuyerWriteService(sheetsClient, columnMapper);
    const buyerService = new BuyerService();

    // テスト対象の買主番号
    const testBuyerNumber = '7282';
    const testValue = 'Y';

    console.log(`📋 テスト対象: 買主${testBuyerNumber}`);
    console.log(`📝 更新値: notification_sender = "${testValue}"`);
    console.log('');

    // ステップ1: BuyerWriteService.updateFields()を直接呼び出し
    console.log('🔧 ステップ1: BuyerWriteService.updateFields()を直接呼び出し');
    const writeResult = await writeService.updateFields(testBuyerNumber, {
      notification_sender: testValue
    });

    console.log('📊 BuyerWriteService結果:', JSON.stringify(writeResult, null, 2));
    console.log('');

    if (!writeResult.success) {
      console.error('❌ BuyerWriteService.updateFields()が失敗しました');
      console.error('エラー:', writeResult.error);
      return;
    }

    // ステップ2: スプレッドシートから値を取得して確認
    console.log('🔍 ステップ2: スプレッドシートから値を取得');
    
    // 買主番号で行を検索
    const rowNumber = await writeService.findRowByBuyerNumber(testBuyerNumber);
    
    if (!rowNumber) {
      console.error(`❌ 買主${testBuyerNumber}がスプレッドシートに見つかりません`);
      return;
    }

    console.log(`📍 行番号: ${rowNumber}`);

    // 行データを取得
    const rowData = await writeService.getRowData(testBuyerNumber);
    
    if (!rowData) {
      console.error(`❌ 行${rowNumber}のデータを取得できませんでした`);
      return;
    }

    // 「通知送信者」列の値を取得
    const spreadsheetColumnName = columnMapper.getSpreadsheetColumnName('notification_sender');
    
    if (!spreadsheetColumnName) {
      console.error('❌ notification_senderのスプレッドシートカラム名が見つかりません');
      return;
    }

    console.log(`📋 スプレッドシートカラム名: "${spreadsheetColumnName}"`);

    const actualValue = rowData[spreadsheetColumnName];
    console.log(`📊 スプレッドシートの実際の値: "${actualValue}"`);
    console.log('');

    // ステップ3: 検証
    console.log('✅ ステップ3: 検証');
    
    if (actualValue === testValue) {
      console.log(`✅ 成功: スプレッドシートに正しく反映されました`);
      console.log(`   期待値: "${testValue}"`);
      console.log(`   実際の値: "${actualValue}"`);
      console.log('');
      console.log('⚠️  注意: このテストは失敗することが期待されています（バグが存在するため）');
      console.log('   テストが成功した場合、バグが既に修正されている可能性があります');
    } else {
      console.log(`❌ 失敗: スプレッドシートに反映されていません`);
      console.log(`   期待値: "${testValue}"`);
      console.log(`   実際の値: "${actualValue}"`);
      console.log('');
      console.log('✅ バグ条件を確認しました: notification_senderフィールドがスプレッドシートに同期されない');
    }

  } catch (error: any) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    console.error('スタックトレース:', error.stack);
  }
}

// テストを実行
testNotificationSenderSync().catch(console.error);
