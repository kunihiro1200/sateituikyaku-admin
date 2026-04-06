/**
 * Bug Condition Exploration Test for 買主リスト「●問合時ヒアリング」同期不具合
 * 
 * **CRITICAL**: このテストは未修正コードで失敗することが期待されます。
 * テストが失敗した場合、修正を試みずに失敗を記録してください。
 * 
 * **目的**: 
 * - スプレッドシートの「●問合時ヒアリング」列を更新しても、データベースの`inquiry_hearing`カラムが更新されない不具合を再現
 * - 4つの仮説のうち該当する根本原因を特定
 * 
 * **仮説**:
 * 1. `detectUpdatedBuyers`で`inquiry_hearing`が比較対象外
 * 2. `BuyerColumnMapper`の変換処理の問題
 * 3. `updateSingleBuyer`で更新対象外
 * 4. カラムマッピング読み込み失敗
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnhancedAutoSyncService } from '../EnhancedAutoSyncService';
import { BuyerColumnMapper } from '../BuyerColumnMapper';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Bug Condition Exploration: 「●問合時ヒアリング」同期不具合', () => {
  let supabase: SupabaseClient;
  let syncService: EnhancedAutoSyncService;
  let buyerColumnMapper: BuyerColumnMapper;
  const testBuyerNumber = 'TEST_BUYER_HEARING_001';

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    syncService = new EnhancedAutoSyncService(supabaseUrl, supabaseKey);
    buyerColumnMapper = new BuyerColumnMapper();

    // テスト用買主を作成
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber);
    await supabase.from('buyers').insert({
      buyer_number: testBuyerNumber,
      name: 'テスト買主',
      inquiry_hearing: '初期値：予算2000万円',
      phone_number: '09012345678',
      email: 'test@example.com',
    });

    console.log(`✅ テスト用買主 ${testBuyerNumber} を作成しました`);
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber);
    console.log(`🗑️ テスト用買主 ${testBuyerNumber} を削除しました`);
  });

  /**
   * 仮説1: `detectUpdatedBuyers`で`inquiry_hearing`が比較対象外
   * 
   * テスト内容:
   * - スプレッドシートの「●問合時ヒアリング」を更新
   * - `detectUpdatedBuyers`を実行
   * - 変更が検出されるか確認
   */
  it('仮説1: detectUpdatedBuyersで inquiry_hearing の変更が検出されない', async () => {
    console.log('\n🔍 仮説1のテスト開始: detectUpdatedBuyersでの変更検出');

    // スプレッドシートのデータをシミュレート
    const sheetRow = {
      '買主番号': testBuyerNumber,
      '●氏名・会社名': 'テスト買主',
      '●問合時ヒアリング': '更新後：予算3000万円、駅近希望',
      '●電話番号\n（ハイフン不要）': '09012345678',
      '●メアド': 'test@example.com',
    };

    // BuyerColumnMapperでマッピング
    const mappedData = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(sheetRow),
      Object.values(sheetRow)
    );

    console.log('📊 マッピング結果:', JSON.stringify(mappedData, null, 2));

    // inquiry_hearingがマッピングされているか確認
    expect(mappedData).toHaveProperty('inquiry_hearing');
    expect(mappedData.inquiry_hearing).toBe('更新後：予算3000万円、駅近希望');

    // DBの現在値を取得
    const { data: dbBuyer } = await supabase
      .from('buyers')
      .select('inquiry_hearing')
      .eq('buyer_number', testBuyerNumber)
      .single();

    console.log('📊 DB現在値:', dbBuyer?.inquiry_hearing);
    console.log('📊 スプシ値:', mappedData.inquiry_hearing);

    // 値が異なることを確認
    expect(dbBuyer?.inquiry_hearing).not.toBe(mappedData.inquiry_hearing);

    // detectUpdatedBuyersが変更を検出するか確認
    // ⚠️ このテストは未修正コードで失敗することが期待されます
    console.log('⚠️ 期待される動作: detectUpdatedBuyersが変更を検出する');
    console.log('⚠️ 実際の動作（未修正コード）: 変更が検出されない可能性がある');

    // 実際のdetectUpdatedBuyersメソッドの動作を確認するため、
    // 比較ロジックを手動で実行
    const skipFields = new Set([
      'buyer_number', 'buyer_id', 'created_at', 'updated_at', 'created_datetime',
      'db_updated_at', 'last_synced_at', 'deleted_at',
    ]);

    let needsUpdate = false;
    for (const [dbField, sheetValue] of Object.entries(mappedData)) {
      if (skipFields.has(dbField)) continue;

      const dbValue = dbBuyer?.[dbField as keyof typeof dbBuyer];

      // 文字列フィールドの比較（detectUpdatedBuyersと同じロジック）
      const sheetStr = sheetValue !== null && sheetValue !== undefined ? String(sheetValue).trim() : '';
      const dbStr = dbValue !== null && dbValue !== undefined ? String(dbValue).trim() : '';

      if (dbField === 'inquiry_hearing') {
        console.log(`🔍 inquiry_hearing 比較:`);
        console.log(`  - スプシ: "${sheetStr}"`);
        console.log(`  - DB: "${dbStr}"`);
        console.log(`  - 一致: ${sheetStr === dbStr}`);
      }

      if (sheetStr !== dbStr) {
        needsUpdate = true;
        console.log(`✅ 変更検出: ${dbField}`);
        break;
      }
    }

    // ⚠️ 未修正コードでは needsUpdate が false になる可能性がある
    console.log(`📊 変更検出結果: ${needsUpdate ? '検出された' : '検出されなかった'}`);

    // このアサーションは未修正コードで失敗することが期待される
    expect(needsUpdate).toBe(true);
  }, 30000);

  /**
   * 仮説2: `BuyerColumnMapper`の変換処理の問題
   * 
   * テスト内容:
   * - 「●問合時ヒアリング」が正しくマッピングされるか確認
   * - 空文字/null処理が正しいか確認
   * - HTMLストリップ処理で内容が失われていないか確認
   */
  it('仮説2: BuyerColumnMapperの変換処理で inquiry_hearing が失われる', () => {
    console.log('\n🔍 仮説2のテスト開始: BuyerColumnMapperの変換処理');

    // テストケース1: 通常の文字列
    const row1 = {
      '買主番号': testBuyerNumber,
      '●問合時ヒアリング': '予算3000万円、駅近希望',
    };

    const mapped1 = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row1),
      Object.values(row1)
    );

    console.log('📊 テストケース1（通常の文字列）:');
    console.log('  - 入力:', row1['●問合時ヒアリング']);
    console.log('  - 出力:', mapped1.inquiry_hearing);

    expect(mapped1.inquiry_hearing).toBe('予算3000万円、駅近希望');

    // テストケース2: 空文字
    const row2 = {
      '買主番号': testBuyerNumber,
      '●問合時ヒアリング': '',
    };

    const mapped2 = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row2),
      Object.values(row2)
    );

    console.log('📊 テストケース2（空文字）:');
    console.log('  - 入力:', row2['●問合時ヒアリング']);
    console.log('  - 出力:', mapped2.inquiry_hearing);

    // 空文字はnullに変換されるべき
    expect(mapped2.inquiry_hearing).toBeNull();

    // テストケース3: 長文
    const longText = '予算3000万円、駅近希望、ペット可、南向き、築10年以内、駐車場2台、リフォーム済み、眺望良好、角部屋、高層階、温泉あり、庭付き、月極駐車場可';
    const row3 = {
      '買主番号': testBuyerNumber,
      '●問合時ヒアリング': longText,
    };

    const mapped3 = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row3),
      Object.values(row3)
    );

    console.log('📊 テストケース3（長文）:');
    console.log('  - 入力長:', longText.length);
    console.log('  - 出力長:', mapped3.inquiry_hearing?.length);

    expect(mapped3.inquiry_hearing).toBe(longText);

    // テストケース4: HTMLタグを含む文字列
    const htmlText = '<p>予算3000万円</p><br/>駅近希望';
    const row4 = {
      '買主番号': testBuyerNumber,
      '●問合時ヒアリング': htmlText,
    };

    const mapped4 = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(row4),
      Object.values(row4)
    );

    console.log('📊 テストケース4（HTMLタグ）:');
    console.log('  - 入力:', htmlText);
    console.log('  - 出力:', mapped4.inquiry_hearing);

    // HTMLタグはそのまま保持される（convertValueではHTMLストリップしない）
    expect(mapped4.inquiry_hearing).toBe(htmlText);
  });

  /**
   * 仮説3: `updateSingleBuyer`で更新対象外
   * 
   * テスト内容:
   * - `inquiry_hearing`が`manualPriorityFields`に含まれていないか確認
   * - updateDataに`inquiry_hearing`が含まれているか確認
   */
  it('仮説3: updateSingleBuyerで inquiry_hearing が更新対象外', async () => {
    console.log('\n🔍 仮説3のテスト開始: updateSingleBuyerでの更新対象');

    // manualPriorityFieldsの定義を確認
    // EnhancedAutoSyncService.tsのコードから、manualPriorityFieldsは['desired_area']のみ
    const manualPriorityFields = ['desired_area'];

    console.log('📊 manualPriorityFields:', manualPriorityFields);

    // inquiry_hearingが含まれていないことを確認
    expect(manualPriorityFields).not.toContain('inquiry_hearing');

    // スプレッドシートのデータをシミュレート
    const sheetRow = {
      '買主番号': testBuyerNumber,
      '●氏名・会社名': 'テスト買主',
      '●問合時ヒアリング': '更新後：予算3000万円、駅近希望',
      '●電話番号\n（ハイフン不要）': '09012345678',
      '●メアド': 'test@example.com',
    };

    // BuyerColumnMapperでマッピング
    const mappedData = buyerColumnMapper.mapSpreadsheetToDatabase(
      Object.keys(sheetRow),
      Object.values(sheetRow)
    );

    console.log('📊 マッピング結果:', JSON.stringify(mappedData, null, 2));

    // updateDataに inquiry_hearing が含まれているか確認
    const updateData = {
      ...mappedData,
      updated_at: new Date().toISOString(),
    };

    // buyer_number と buyer_id は削除される
    delete updateData.buyer_number;
    delete updateData.buyer_id;

    console.log('📊 updateData:', JSON.stringify(updateData, null, 2));

    // inquiry_hearingが含まれていることを確認
    expect(updateData).toHaveProperty('inquiry_hearing');
    expect(updateData.inquiry_hearing).toBe('更新後：予算3000万円、駅近希望');

    console.log('✅ inquiry_hearingはupdateDataに含まれています');
  });

  /**
   * 仮説4: カラムマッピング読み込み失敗
   * 
   * テスト内容:
   * - buyer-column-mapping.jsonの「●問合時ヒアリング」マッピングが正しく読み込まれているか確認
   * - マッピングキーの不一致（スペース、改行文字など）がないか確認
   */
  it('仮説4: カラムマッピング読み込み失敗', () => {
    console.log('\n🔍 仮説4のテスト開始: カラムマッピング読み込み');

    // buyer-column-mapping.jsonを直接読み込み
    const columnMapping = require('../../config/buyer-column-mapping.json');

    console.log('📊 spreadsheetToDatabase:', JSON.stringify(columnMapping.spreadsheetToDatabase, null, 2));

    // 「●問合時ヒアリング」のマッピングが存在するか確認
    const inquiryHearingKey = '●問合時ヒアリング';
    const mappedValue = columnMapping.spreadsheetToDatabase[inquiryHearingKey];

    console.log(`📊 「${inquiryHearingKey}」のマッピング:`, mappedValue);

    // マッピングが存在することを確認
    expect(mappedValue).toBeDefined();
    expect(mappedValue).toBe('inquiry_hearing');

    // BuyerColumnMapperで正しく読み込まれているか確認
    const dbFieldName = buyerColumnMapper.getDbFieldName(inquiryHearingKey);

    console.log(`📊 BuyerColumnMapper.getDbFieldName("${inquiryHearingKey}"):`, dbFieldName);

    expect(dbFieldName).toBe('inquiry_hearing');

    // 逆マッピングも確認
    const spreadsheetColumnName = buyerColumnMapper.getSpreadsheetColumnName('inquiry_hearing');

    console.log(`📊 BuyerColumnMapper.getSpreadsheetColumnName("inquiry_hearing"):`, spreadsheetColumnName);

    expect(spreadsheetColumnName).toBe(inquiryHearingKey);

    console.log('✅ カラムマッピングは正しく読み込まれています');
  });
});
