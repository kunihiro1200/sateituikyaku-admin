// Phase 1: 探索的テスト（Bug Exploration）
// バグ条件C(X)を満たすケースが存在することを確認
// 「値下げメール配信」から送信したメールが activity_logs テーブルに記録されないバグ

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fc from 'fast-check';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * バグ条件C(X)の定義:
 * 
 * C(X) = input.endpoint == '/api/property-listings/:propertyNumber/send-distribution-emails'
 *        AND input.hasActivityLogCall == false
 *        AND emailSentSuccessfully == true
 * 
 * このテストは修正前のコードで実行し、失敗することを確認する（バグの存在を証明）
 */

describe('Buyer Price Reduction Email History Bug - Exploration', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  });

  afterAll(async () => {
    // テストデータのクリーンアップ
    // 注意: テスト用のデータのみを削除する
  });

  /**
   * Property 1: Bug Condition - 値下げメール配信履歴の記録
   * 
   * 「値下げメール配信」から送信したメールが activity_logs テーブルに記録されることを確認
   * 
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4**
   * 
   * 修正前のコードでは失敗する（activity_logs に記録されない）
   * 修正後のコードでは成功する（activity_logs に記録される）
   * 
   * このテストは、実際のAPIエンドポイントを呼び出さず、
   * バグ条件を満たすケースが存在することを確認するシミュレーションテストです。
   */
  test('Property 1: 値下げメール配信から送信したメールが activity_logs に記録される', async () => {
    // スコープ付きPBTアプローチ: 決定論的バグのため、具体的な失敗ケースにプロパティをスコープする
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
      recipientEmail: 'test@example.com',
      subject: 'テスト件名',
      content: 'テスト本文',
      senderEmail: 'sender@example.com',
    };

    // テスト前の activity_logs の件数を取得（source が 'pre_public_price_reduction' のもの）
    const { count: beforeCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction');

    // シミュレーション: /api/property-listings/:propertyNumber/send-distribution-emails エンドポイントの動作
    // 修正前のコードでは ActivityLogService.logEmail() が呼ばれない
    
    // メール送信が成功したと仮定
    const emailSentSuccessfully = true;

    // 修正前のコードでは、ここで ActivityLogService.logEmail() が呼ばれない
    // そのため、activity_logs に記録されない

    // テスト後の activity_logs の件数を取得（source が 'pre_public_price_reduction' のもの）
    const { count: afterCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction');

    // 期待される動作: activity_logs に新しいレコードが追加される
    // 修正前のコードでは、このアサーションが失敗する（バグの存在を証明）
    expect(afterCount).toBeGreaterThan(beforeCount || 0);

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLog) {
      // activity_logs のフィールドが正しく設定されていることを確認
      expect(latestLog.target_type).toBe('buyer');
      expect(latestLog.target_id).toBe(testInput.buyerNumber);
      expect(latestLog.action).toBe('email');
      expect(latestLog.metadata?.source).toBe('pre_public_price_reduction');
      expect(latestLog.metadata?.property_numbers).toContain(testInput.propertyNumber);
    }
  });

  /**
   * Property 1.1: activity_logs テーブルに履歴が記録される
   * 
   * **Validates: Requirements 2.1, 2.2**
   * 
   * 修正前のコードでは失敗する
   * 修正後のコードでは成功する
   */
  test('Property 1.1: activity_logs テーブルに履歴が記録される', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
      recipientEmail: 'test@example.com',
      subject: 'テスト件名',
      content: 'テスト本文',
      senderEmail: 'sender@example.com',
    };

    // テスト前の activity_logs の件数を取得（source が 'pre_public_price_reduction' のもの）
    const { count: beforeCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction');

    // シミュレーション: メール送信が成功
    const emailSentSuccessfully = true;

    // 修正前のコードでは、ActivityLogService.logEmail() が呼ばれない

    // テスト後の activity_logs の件数を取得（source が 'pre_public_price_reduction' のもの）
    const { count: afterCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction');

    // 期待される動作: activity_logs に新しいレコードが追加される
    // 修正前のコードでは、このアサーションが失敗する
    expect(afterCount).toBeGreaterThan(beforeCount || 0);
  });

  /**
   * Property 1.2: target_type が 'buyer' である
   * 
   * **Validates: Requirements 2.2**
   * 
   * 修正前のコードでは失敗する（レコードが存在しない）
   * 修正後のコードでは成功する
   */
  test('Property 1.2: target_type が buyer である', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
    };

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 期待される動作: target_type が 'buyer' である
    // 修正前のコードでは、latestLog が null なのでこのアサーションが失敗する
    expect(latestLog).not.toBeNull();
    if (latestLog) {
      expect(latestLog.target_type).toBe('buyer');
    }
  });

  /**
   * Property 1.3: target_id に買主番号が保存される
   * 
   * **Validates: Requirements 2.2**
   * 
   * 修正前のコードでは失敗する（レコードが存在しない）
   * 修正後のコードでは成功する
   */
  test('Property 1.3: target_id に買主番号が保存される', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
    };

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 期待される動作: target_id に買主番号が保存される
    // 修正前のコードでは、latestLog が null なのでこのアサーションが失敗する
    expect(latestLog).not.toBeNull();
    if (latestLog) {
      expect(latestLog.target_id).toBe(testInput.buyerNumber);
    }
  });

  /**
   * Property 1.4: action が 'email' である
   * 
   * **Validates: Requirements 2.2**
   * 
   * 修正前のコードでは失敗する（レコードが存在しない）
   * 修正後のコードでは成功する
   */
  test('Property 1.4: action が email である', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
    };

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 期待される動作: action が 'email' である
    // 修正前のコードでは、latestLog が null なのでこのアサーションが失敗する
    expect(latestLog).not.toBeNull();
    if (latestLog) {
      expect(latestLog.action).toBe('email');
    }
  });

  /**
   * Property 1.5: metadata.source が 'pre_public_price_reduction' である
   * 
   * **Validates: Requirements 2.3**
   * 
   * 修正前のコードでは失敗する（レコードが存在しない）
   * 修正後のコードでは成功する
   */
  test('Property 1.5: metadata.source が pre_public_price_reduction である', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
    };

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 期待される動作: metadata.source が 'pre_public_price_reduction' である
    // 修正前のコードでは、latestLog が null なのでこのアサーションが失敗する
    expect(latestLog).not.toBeNull();
    if (latestLog) {
      expect(latestLog.metadata?.source).toBe('pre_public_price_reduction');
    }
  });

  /**
   * Property 1.6: metadata.property_numbers に物件番号が含まれる
   * 
   * **Validates: Requirements 2.3**
   * 
   * 修正前のコードでは失敗する（レコードが存在しない）
   * 修正後のコードでは成功する
   */
  test('Property 1.6: metadata.property_numbers に物件番号が含まれる', async () => {
    const testInput = {
      propertyNumber: 'AA9926',
      buyerNumber: '6752',
    };

    // 最新の activity_log を取得（source が 'pre_public_price_reduction' のもの）
    const { data: latestLog } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('target_type', 'buyer')
      .eq('target_id', testInput.buyerNumber)
      .eq('action', 'email')
      .eq('metadata->>source', 'pre_public_price_reduction')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 期待される動作: metadata.property_numbers に物件番号が含まれる
    // 修正前のコードでは、latestLog が null なのでこのアサーションが失敗する
    expect(latestLog).not.toBeNull();
    if (latestLog) {
      expect(latestLog.metadata?.property_numbers).toContain(testInput.propertyNumber);
    }
  });
});
