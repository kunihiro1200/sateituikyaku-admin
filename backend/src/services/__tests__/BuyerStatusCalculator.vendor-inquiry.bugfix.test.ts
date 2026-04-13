/**
 * バグ条件探索テスト: vendor_survey='未' かつ broker_inquiry='業者問合せ' の場合に Priority 2 を返さないバグ
 *
 * **Feature: buyer-vendor-inquiry-sidebar-exclusion-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因:
 * BuyerStatusCalculator.ts の Priority 2 条件に
 * `!equals(buyer.broker_inquiry, '業者問合せ')` という除外条件が含まれているため、
 * vendor_survey = '未' かつ broker_inquiry = '業者問合せ' の買主が
 * 「業者問合せあり」カテゴリーに分類されない。
 */

import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

/**
 * バグ条件の判定関数
 *
 * バグ条件:
 * - vendor_survey = '未'（業者向けアンケートが未回答）
 * - broker_inquiry = '業者問合せ'（業者からの問合せ）
 * → 期待: { status: '業者問合せあり', priority: 2 }
 * → 実際（未修正）: Priority 2 を返さない（バグ）
 */
function isBugCondition(buyer: BuyerData): boolean {
  return buyer.vendor_survey === '未' && buyer.broker_inquiry === '業者問合せ';
}

describe('Property 1: Bug Condition - vendor_survey="未" かつ broker_inquiry="業者問合せ" の場合に Priority 2 を返さないバグ', () => {
  /**
   * テストケース1: 基本バグ再現
   *
   * vendor_survey = '未' かつ broker_inquiry = '業者問合せ' の買主データで
   * calculateBuyerStatus を呼び出し、Priority 2 が返ることを期待する。
   *
   * ⚠️ 未修正コードでは FAIL する（バグの存在を証明）
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('vendor_survey="未" かつ broker_inquiry="業者問合せ" → status="業者問合せあり" かつ priority=2 を返すこと', () => {
    // Arrange: バグ条件を満たす買主データ
    const buyer: BuyerData = {
      buyer_number: 'BUG_TEST_001',
      name: 'バグ確認用買主',
      // Priority 1 の条件を満たさない
      valuation_survey: null,
      valuation_survey_confirmed: null,
      // バグ条件: vendor_survey = '未' かつ broker_inquiry = '業者問合せ'
      vendor_survey: '未',
      broker_inquiry: '業者問合せ',
    };

    // バグ条件が成立していることを確認
    expect(isBugCondition(buyer)).toBe(true);

    // Act
    const result = calculateBuyerStatus(buyer);

    console.log('calculateBuyerStatus の結果:', result);
    console.log('期待: { status: "業者問合せあり", priority: 2 }');
    console.log('実際:', { status: result.status, priority: result.priority });

    // Assert: 期待される動作（未修正コードでは FAIL する）
    // ⚠️ 未修正コードでは Priority 2 の除外条件 !equals(buyer.broker_inquiry, '業者問合せ') により
    // より低い優先度のステータスが返るため、このアサーションが FAIL する
    expect(result.status).toBe('業者問合せあり');
    expect(result.priority).toBe(2);
  });

  /**
   * テストケース2: Priority 1 との組み合わせ（正常動作の確認）
   *
   * valuation_survey が入力済みの場合は Priority 1 が優先されることを確認。
   * このテストは未修正コードでも PASS する（Priority 1 は影響を受けない）。
   *
   * **Validates: Requirements 1.1**
   */
  it('valuation_survey 入力済み かつ vendor_survey="未" かつ broker_inquiry="業者問合せ" → Priority 1 が優先されること', () => {
    // Arrange: Priority 1 の条件を満たす買主データ
    const buyer: BuyerData = {
      buyer_number: 'BUG_TEST_002',
      name: 'Priority1確認用買主',
      // Priority 1 の条件を満たす
      valuation_survey: '回答済み',
      valuation_survey_confirmed: null,
      // バグ条件も満たす
      vendor_survey: '未',
      broker_inquiry: '業者問合せ',
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    console.log('Priority 1 優先確認の結果:', result);

    // Assert: Priority 1 が優先されること（未修正コードでも PASS する）
    expect(result.status).toBe('査定アンケート回答あり');
    expect(result.priority).toBe(1);
  });

  /**
   * テストケース3: broker_inquiry が null の場合（正常動作の確認）
   *
   * broker_inquiry = null の場合は未修正コードでも Priority 2 を返すことを確認。
   * このテストは未修正コードでも PASS する。
   *
   * **Validates: Requirements 1.1**
   */
  it('vendor_survey="未" かつ broker_inquiry=null → status="業者問合せあり" かつ priority=2 を返すこと（正常動作）', () => {
    // Arrange: broker_inquiry が null の買主データ
    const buyer: BuyerData = {
      buyer_number: 'BUG_TEST_003',
      name: '正常動作確認用買主',
      valuation_survey: null,
      valuation_survey_confirmed: null,
      vendor_survey: '未',
      broker_inquiry: null,
    };

    // Act
    const result = calculateBuyerStatus(buyer);

    console.log('broker_inquiry=null の結果:', result);

    // Assert: broker_inquiry = null の場合は正常に Priority 2 を返す
    expect(result.status).toBe('業者問合せあり');
    expect(result.priority).toBe(2);
  });
});
