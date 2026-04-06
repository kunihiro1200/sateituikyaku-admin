/**
 * Bug Condition探索テスト: inquiry_hearingフィールドの即時同期不具合
 * 
 * このテストは未修正コードで実行し、失敗することを確認する（失敗＝バグの存在を証明）
 * 
 * バグ: 買主番号7294で「●問合時ヒアリング」フィールドを更新しても、
 *       データベースには保存されるが、スプレッドシートに反映されない
 * 
 * 根本原因の仮説:
 * 1. BuyerColumnMapper.mapDatabaseToSpreadsheetでinquiry_hearingのマッピングが漏れている
 * 2. HTMLストリップ処理がinquiry_hearingに適用されていない
 * 3. BuyerWriteService.updateFieldsでinquiry_hearingが除外されている
 * 
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';
import { BuyerColumnMapper } from '../services/BuyerColumnMapper';
import { BuyerWriteService } from '../services/BuyerWriteService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 環境変数を読み込み
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../.env.local'),
  path.join(__dirname, '../../.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Bug Condition: inquiry_hearingフィールドの即時同期不具合', () => {
  let sheetsClient: GoogleSheetsClient;
  let columnMapper: BuyerColumnMapper;
  let writeService: BuyerWriteService;

  beforeAll(async () => {
    // GoogleSheetsClientを初期化
    sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    });

    await sheetsClient.authenticate();

    columnMapper = new BuyerColumnMapper();
    writeService = new BuyerWriteService(sheetsClient, columnMapper);
  });

  /**
   * テスト1: 買主番号7294でinquiry_hearingを更新
   * 
   * 期待される結果（未修正コード）:
   * - データベースには保存される
   * - スプレッドシートには反映されない（バグ）
   * 
   * このテストは未修正コードで失敗する（これは正しい - バグの存在を証明）
   */
  test('Bug Condition 1.1: 買主番号7294でinquiry_hearingを更新 → データベースには保存されるが、スプレッドシートには反映されない', async () => {
    const buyerNumber = '7294';
    const testValue = 'テスト内容 - ' + new Date().toISOString();

    console.log('\n[Bug Condition Test 1.1] 買主番号7294でinquiry_hearingを更新');
    console.log(`テスト値: ${testValue}`);

    // ステップ1: データベースを更新
    console.log('\n[Step 1] データベースを更新中...');
    const { data: updatedBuyer, error: updateError } = await supabase
      .from('buyers')
      .update({ inquiry_hearing: testValue })
      .eq('buyer_number', buyerNumber)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedBuyer).not.toBeNull();
    expect(updatedBuyer.inquiry_hearing).toBe(testValue);
    console.log(`✓ データベース更新成功: inquiry_hearing = "${updatedBuyer.inquiry_hearing}"`);

    // ステップ2: BuyerWriteService.updateFieldsを呼び出し
    console.log('\n[Step 2] BuyerWriteService.updateFieldsを呼び出し中...');
    console.log(`[DEBUG] 呼び出しパラメータ: buyerNumber=${buyerNumber}, updates={ inquiry_hearing: "${testValue}" }`);
    
    const writeResult = await writeService.updateFields(buyerNumber, {
      inquiry_hearing: testValue
    });

    console.log(`[DEBUG] writeResult:`, JSON.stringify(writeResult, null, 2));
    expect(writeResult.success).toBe(true);
    console.log(`✓ BuyerWriteService.updateFields成功`);

    // ステップ3: スプレッドシートの値を確認
    console.log('\n[Step 3] スプレッドシートの値を確認中...');
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      range: '買主リスト!A:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    
    // 買主番号はE列（0-indexed: 4）
    const buyerNumberIndex = 4;
    console.log(`[DEBUG] 買主番号の列インデックス: ${buyerNumberIndex}`);
    
    const buyerRow = rows.find(row => row[buyerNumberIndex] === buyerNumber);
    console.log(`[DEBUG] 買主番号${buyerNumber}の行が見つかったか: ${buyerRow ? 'はい' : 'いいえ'}`);

    expect(buyerRow).not.toBeUndefined();

    const inquiryHearingIndex = headers.findIndex(h => h === '●問合時ヒアリング');
    expect(inquiryHearingIndex).toBeGreaterThan(-1);

    const spreadsheetValue = buyerRow![inquiryHearingIndex] || '';
    console.log(`[DEBUG] スプレッドシートの値: "${spreadsheetValue}"`);
    console.log(`[DEBUG] 期待される値: "${testValue}"`);

    // 未修正コードでは、この assertion が失敗する（バグの存在を証明）
    expect(spreadsheetValue).toBe(testValue);
    console.log(`✓ スプレッドシート更新成功: inquiry_hearing = "${spreadsheetValue}"`);
  }, 30000);

  /**
   * テスト2: mapDatabaseToSpreadsheetのログ確認
   * 
   * 期待される結果（未修正コード）:
   * - inquiry_hearingがマッピングされていない可能性
   * 
   * このテストは未修正コードで失敗する可能性がある
   */
  test('Bug Condition 1.2: mapDatabaseToSpreadsheetでinquiry_hearingがマッピングされているか確認', () => {
    console.log('\n[Bug Condition Test 1.2] mapDatabaseToSpreadsheetのマッピング確認');

    const testData = {
      inquiry_hearing: 'テスト内容'
    };

    console.log(`[DEBUG] 入力データ:`, JSON.stringify(testData, null, 2));

    const result = columnMapper.mapDatabaseToSpreadsheet(testData);

    console.log(`[DEBUG] マッピング結果:`, JSON.stringify(result, null, 2));

    // 未修正コードでは、inquiry_hearingがマッピングされていない可能性
    expect(result['●問合時ヒアリング']).toBeDefined();
    expect(result['●問合時ヒアリング']).toBe('テスト内容');
    console.log(`✓ inquiry_hearingが正しくマッピングされている`);
  });

  /**
   * テスト3: HTMLタグ付きinquiry_hearingを更新
   * 
   * 期待される結果（未修正コード）:
   * - HTMLストリップ処理が適用されていない可能性
   * 
   * このテストは未修正コードで失敗する可能性がある
   */
  test('Bug Condition 1.3: HTMLタグ付きinquiry_hearingを更新 → HTMLストリップ処理が適用されるか確認', () => {
    console.log('\n[Bug Condition Test 1.3] HTMLタグ付きinquiry_hearingのHTMLストリップ処理確認');

    const htmlValue = '<p>HTMLタグ付き</p>';
    const expectedPlainText = 'HTMLタグ付き';

    console.log(`[DEBUG] 入力値: "${htmlValue}"`);
    console.log(`[DEBUG] 期待される出力: "${expectedPlainText}"`);

    const result = columnMapper.mapDatabaseToSpreadsheet({
      inquiry_hearing: htmlValue
    });

    console.log(`[DEBUG] マッピング結果:`, JSON.stringify(result, null, 2));

    // 未修正コードでは、HTMLストリップ処理が適用されていない可能性
    expect(result['●問合時ヒアリング']).toBe(expectedPlainText);
    console.log(`✓ HTMLストリップ処理が正しく適用されている`);
  });

  /**
   * テスト4: 空文字のinquiry_hearingを更新
   * 
   * 期待される結果（未修正コード）:
   * - 空文字がスプレッドシートに反映されない可能性
   * 
   * このテストは未修正コードで失敗する可能性がある
   */
  test('Bug Condition 1.4: 空文字のinquiry_hearingを更新 → スプレッドシートに空文字が反映されるか確認', async () => {
    const buyerNumber = '7294';
    const testValue = '';

    console.log('\n[Bug Condition Test 1.4] 空文字のinquiry_hearingを更新');

    // ステップ1: データベースを更新
    console.log('\n[Step 1] データベースを更新中...');
    const { data: updatedBuyer, error: updateError } = await supabase
      .from('buyers')
      .update({ inquiry_hearing: testValue })
      .eq('buyer_number', buyerNumber)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedBuyer).not.toBeNull();
    console.log(`✓ データベース更新成功`);

    // ステップ2: BuyerWriteService.updateFieldsを呼び出し
    console.log('\n[Step 2] BuyerWriteService.updateFieldsを呼び出し中...');
    const writeResult = await writeService.updateFields(buyerNumber, {
      inquiry_hearing: testValue
    });

    expect(writeResult.success).toBe(true);
    console.log(`✓ BuyerWriteService.updateFields成功`);

    // ステップ3: スプレッドシートの値を確認
    console.log('\n[Step 3] スプレッドシートの値を確認中...');
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      range: '買主リスト!A:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    
    // 買主番号はE列（0-indexed: 4）
    const buyerNumberIndex = 4;
    const buyerRow = rows.find(row => row[buyerNumberIndex] === buyerNumber);

    expect(buyerRow).not.toBeUndefined();

    const inquiryHearingIndex = headers.findIndex(h => h === '●問合時ヒアリング');
    expect(inquiryHearingIndex).toBeGreaterThan(-1);

    const spreadsheetValue = buyerRow![inquiryHearingIndex] || '';
    console.log(`[DEBUG] スプレッドシートの値: "${spreadsheetValue}"`);

    // 未修正コードでは、空文字が反映されない可能性
    expect(spreadsheetValue).toBe('');
    console.log(`✓ スプレッドシート更新成功: inquiry_hearing = ""`);
  }, 30000);
});
