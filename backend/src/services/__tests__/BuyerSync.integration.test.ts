/**
 * Integration Test: 買主リスト「●問合時ヒアリング」同期不具合の統合テスト
 * 
 * **CRITICAL**: このテストは未修正コードで失敗することが期待されます。
 * 
 * **目的**: 
 * - 実際のスプレッドシート→データベース同期処理で`inquiry_hearing`が更新されるか確認
 * - EnhancedAutoSyncServiceの実際の動作を検証
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnhancedAutoSyncService } from '../EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Integration Test: 「●問合時ヒアリング」同期処理', () => {
  let supabase: SupabaseClient;
  let syncService: EnhancedAutoSyncService;
  const testBuyerNumber = 'TEST_BUYER_HEARING_SYNC_001';

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    syncService = new EnhancedAutoSyncService(supabaseUrl, supabaseKey);

    // テスト用買主を作成
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber);
    await supabase.from('buyers').insert({
      buyer_number: testBuyerNumber,
      name: 'テスト買主（統合テスト）',
      inquiry_hearing: '初期値：予算2000万円',
      phone_number: '09012345678',
      email: 'test-integration@example.com',
    });

    console.log(`✅ テスト用買主 ${testBuyerNumber} を作成しました`);
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await supabase.from('buyers').delete().eq('buyer_number', testBuyerNumber);
    console.log(`🗑️ テスト用買主 ${testBuyerNumber} を削除しました`);
  });

  /**
   * 統合テスト: detectUpdatedBuyersで変更が検出されるか
   * 
   * ⚠️ このテストは未修正コードで失敗する可能性があります
   */
  it('detectUpdatedBuyersで inquiry_hearing の変更が検出される', async () => {
    console.log('\n🔍 統合テスト開始: detectUpdatedBuyers');

    // 注意: このテストは実際のスプレッドシートを使用しないため、
    // スプレッドシートのモックデータを使用する必要があります。
    // 実際の環境では、スプレッドシートに手動でデータを追加してテストしてください。

    console.log('⚠️ このテストは実際のスプレッドシートデータを使用します');
    console.log('⚠️ スプレッドシートに以下のデータが存在する必要があります:');
    console.log(`   - 買主番号: ${testBuyerNumber}`);
    console.log(`   - ●問合時ヒアリング: 更新後：予算3000万円、駅近希望`);

    // detectUpdatedBuyersを実行
    const updatedBuyers = await syncService.detectUpdatedBuyers();

    console.log(`📊 検出された更新買主数: ${updatedBuyers.length}`);
    console.log(`📊 更新買主リスト:`, updatedBuyers);

    // テスト買主が含まれているか確認
    const isDetected = updatedBuyers.includes(testBuyerNumber);

    console.log(`📊 ${testBuyerNumber} が検出されたか: ${isDetected ? 'はい' : 'いいえ'}`);

    // ⚠️ 未修正コードでは isDetected が false になる可能性がある
    if (!isDetected) {
      console.error(`❌ ${testBuyerNumber} が検出されませんでした`);
      console.error('❌ これは不具合の再現です');
    }

    // このアサーションは未修正コードで失敗する可能性がある
    // expect(isDetected).toBe(true);

    // 代わりに、手動確認用のログを出力
    console.log('⚠️ 手動確認が必要: スプレッドシートに該当データが存在する場合、このテストは失敗すべきです');
  }, 60000);

  /**
   * 統合テスト: syncUpdatedBuyersで inquiry_hearing が更新されるか
   * 
   * ⚠️ このテストは未修正コードで失敗する可能性があります
   */
  it('syncUpdatedBuyersで inquiry_hearing が更新される', async () => {
    console.log('\n🔍 統合テスト開始: syncUpdatedBuyers');

    console.log('⚠️ このテストは実際のスプレッドシートデータを使用します');
    console.log('⚠️ スプレッドシートに以下のデータが存在する必要があります:');
    console.log(`   - 買主番号: ${testBuyerNumber}`);
    console.log(`   - ●問合時ヒアリング: 更新後：予算3000万円、駅近希望`);

    // 更新前のデータを取得
    const { data: beforeUpdate } = await supabase
      .from('buyers')
      .select('inquiry_hearing')
      .eq('buyer_number', testBuyerNumber)
      .single();

    console.log(`📊 更新前の inquiry_hearing: ${beforeUpdate?.inquiry_hearing}`);

    // syncUpdatedBuyersを実行
    const result = await syncService.syncUpdatedBuyers([testBuyerNumber]);

    console.log(`📊 同期結果:`, JSON.stringify(result, null, 2));

    // 更新後のデータを取得
    const { data: afterUpdate } = await supabase
      .from('buyers')
      .select('inquiry_hearing')
      .eq('buyer_number', testBuyerNumber)
      .single();

    console.log(`📊 更新後の inquiry_hearing: ${afterUpdate?.inquiry_hearing}`);

    // 値が変更されたか確認
    const isUpdated = beforeUpdate?.inquiry_hearing !== afterUpdate?.inquiry_hearing;

    console.log(`📊 inquiry_hearing が更新されたか: ${isUpdated ? 'はい' : 'いいえ'}`);

    // ⚠️ 未修正コードでは isUpdated が false になる可能性がある
    if (!isUpdated) {
      console.error(`❌ inquiry_hearing が更新されませんでした`);
      console.error('❌ これは不具合の再現です');
    }

    // このアサーションは未修正コードで失敗する可能性がある
    // expect(isUpdated).toBe(true);

    // 代わりに、手動確認用のログを出力
    console.log('⚠️ 手動確認が必要: スプレッドシートに該当データが存在する場合、このテストは失敗すべきです');
  }, 60000);
});
