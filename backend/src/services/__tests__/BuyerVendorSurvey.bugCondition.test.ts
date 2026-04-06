/**
 * バグ条件探索テスト - 買主7260の「業者向けアンケート」同期不整合バグ
 *
 * **Feature: buyer-vendor-survey-sidebar-status-issue, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因（仮説）:
 * スプレッドシートの「業者向けアンケート」列が vendor_survey に同期されているが、
 * BuyerStatusCalculator は broker_survey を参照しているため、
 * 買主7260のように vendor_survey = "確認済み" だが broker_survey = "未" の場合、
 * サイドバーに「業者問合せあり」と誤って表示される。
 */

import { createClient } from '@supabase/supabase-js';
import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * バグ条件の判定関数
 *
 * バグ条件:
 * - vendor_survey = "確認済み"（スプレッドシートの「業者向けアンケート」が同期されている）
 * - broker_survey = "未"（ステータス計算で参照されるフィールドが未更新）
 * - calculateBuyerStatus が「業者問合せあり」を返す（誤り）
 */
function isBugCondition(buyer: BuyerData): boolean {
  return (
    buyer.vendor_survey === '確認済み' &&
    buyer.broker_survey === '未'
  );
}

describe('Property 1: Bug Condition - 買主7260の業者向けアンケート同期不整合バグ', () => {
  /**
   * テストケース1: 買主7260の実データを使用したバグ再現テスト
   *
   * 買主7260のデータベースレコードを取得し、バグ条件を満たすことを確認
   * → vendor_survey = "確認済み" だが broker_survey = "未" であることを確認（未修正コードで失敗）
   *
   * **Validates: Requirements 1.2**
   */
  it('テスト1: 買主7260のデータベースレコードがバグ条件を満たす（vendor_survey="確認済み", broker_survey="未"）', async () => {
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('buyer_number, broker_survey, vendor_survey')
      .eq('buyer_number', '7260')
      .single();

    expect(error).toBeNull();
    expect(buyer).not.toBeNull();

    // ✅ 修正後: broker_survey = "確認済み" になるべき
    // ⚠️ 未修正: broker_survey = "未" のまま（バグ）
    console.log('買主7260のデータ:', buyer);

    // バグ条件を満たすことを確認（未修正コードで失敗）
    expect(buyer!.vendor_survey).toBe('確認済み');
    expect(buyer!.broker_survey).toBe('確認済み'); // ⚠️ 未修正コードでは "未" のため失敗
  });

  /**
   * テストケース2: broker_survey = "未" の買主のステータス計算テスト
   *
   * broker_survey = "未" の買主に対して、
   * calculateBuyerStatus が「業者問合せあり」を返すことを確認（正常動作）
   *
   * **Validates: Requirements 2.2**
   */
  it('テスト2: broker_survey="未" の買主のステータスが「業者問合せあり」である（正常動作）', () => {
    const buyer: BuyerData = {
      buyer_number: '8888',
      name: 'テスト買主',
      broker_survey: '未',
      vendor_survey: '未',
      valuation_survey: null,
      valuation_survey_confirmed: null,
    };

    const result = calculateBuyerStatus(buyer);

    console.log('ステータス計算結果:', result);

    // ✅ broker_survey = "未" のため「業者問合せあり」になる（正常動作）
    expect(result.status).toBe('業者問合せあり');
    expect(result.priority).toBe(2);
  });

  /**
   * テストケース3: 期待される動作の確認
   *
   * broker_survey = "確認済み" の買主に対して、
   * calculateBuyerStatus が「業者問合せあり」を返さないことを確認
   *
   * **Validates: Requirements 2.1**
   */
  it('テスト3: broker_survey="確認済み" の買主のステータスが「業者問合せあり」でない（期待される動作）', () => {
    const buyer: BuyerData = {
      buyer_number: '9999',
      name: 'テスト買主',
      broker_survey: '確認済み',
      vendor_survey: '確認済み',
      valuation_survey: null,
      valuation_survey_confirmed: null,
    };

    const result = calculateBuyerStatus(buyer);

    console.log('ステータス計算結果:', result);

    // ✅ broker_survey = "確認済み" のため「業者問合せあり」にならない
    expect(result.status).not.toBe('業者問合せあり');
  });

  /**
   * テストケース4: broker_survey = "未" の買主のステータス確認（重複削除）
   *
   * このテストはテスト2と重複しているため削除
   */
});
