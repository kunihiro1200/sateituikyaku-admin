/**
 * バグ条件探索テスト - 複数コミュニケーション情報の結合表示バグ
 *
 * **Feature: sidebar-today-call-combined-label, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * ⚠️ CRITICAL: このテストは修正前のコードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因（仮説）:
 * getTodayCallWithInfoLabel() が優先順位チェーンで最初に見つかった1つの値のみを返す実装になっており、
 * 複数のコミュニケーション情報フィールドに値がある場合に残りの情報を無視する。
 */

import { getTodayCallWithInfoLabel } from '../sellerStatusFilters';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/** テスト用売主データファクトリー */
const createSeller = (overrides: Record<string, any> = {}) => ({
  id: 'test-id-1',
  sellerNumber: 'AA99001',
  name: 'テスト売主',
  status: '追客中',
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  ...overrides,
});

// ============================================================
// バグ条件探索テスト
// ============================================================

describe('Property 1: Bug Condition - 複数コミュニケーション情報の結合表示バグ', () => {
  /**
   * テストケース1: phone_contact_person + contact_method の両方に値がある場合
   *
   * 現在（バグ）: contact_method が優先されて `当日TEL(Eメール)` を返す
   * 期待値: 両方を結合して `当日TEL(I・Eメール)` を返す
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト1: phone_contact_person="I" + contact_method="Eメール" → 当日TEL(I・Eメール) を返すべき（バグ: 当日TEL(Eメール) を返す）', () => {
    const seller = createSeller({
      phone_contact_person: 'I',
      contact_method: 'Eメール',
      preferred_contact_time: '',
    });

    const result = getTodayCallWithInfoLabel(seller);

    // ⚠️ 修正前: contact_method が優先されて `当日TEL(Eメール)` を返す（バグ）
    // ✅ 修正後: 両方を結合して `当日TEL(I・Eメール)` を返す
    expect(result).toBe('当日TEL(I・Eメール)');
  });

  /**
   * テストケース2: phone_contact_person + preferred_contact_time の両方に値がある場合
   *
   * 現在（バグ）: preferred_contact_time が優先されて `当日TEL(午前中)` を返す
   * 期待値: 両方を結合して `当日TEL(Y・午前中)` を返す
   *
   * **Validates: Requirements 1.2**
   */
  it('テスト2: phone_contact_person="Y" + preferred_contact_time="午前中" → 当日TEL(Y・午前中) を返すべき（バグ: 当日TEL(午前中) を返す）', () => {
    const seller = createSeller({
      phone_contact_person: 'Y',
      preferred_contact_time: '午前中',
      contact_method: '',
    });

    const result = getTodayCallWithInfoLabel(seller);

    // ⚠️ 修正前: preferred_contact_time が優先されて `当日TEL(午前中)` を返す（バグ）
    // ✅ 修正後: 両方を結合して `当日TEL(Y・午前中)` を返す
    expect(result).toBe('当日TEL(Y・午前中)');
  });

  /**
   * テストケース3: contact_method + preferred_contact_time の両方に値がある場合
   *
   * 現在（バグ）: contact_method が優先されて `当日TEL(Eメール)` を返す
   * 期待値: 両方を結合して `当日TEL(午前中・Eメール)` を返す（表示順: 連絡取りやすい時間 → 連絡方法）
   *
   * **Validates: Requirements 1.3**
   */
  it('テスト3: contact_method="Eメール" + preferred_contact_time="午前中" → 当日TEL(午前中・Eメール) を返すべき（バグ: 当日TEL(Eメール) を返す）', () => {
    const seller = createSeller({
      phone_contact_person: '',
      preferred_contact_time: '午前中',
      contact_method: 'Eメール',
    });

    const result = getTodayCallWithInfoLabel(seller);

    // ⚠️ 修正前: contact_method が優先されて `当日TEL(Eメール)` を返す（バグ）
    // ✅ 修正後: 表示順（電話担当→連絡取りやすい時間→連絡方法）で結合して `当日TEL(午前中・Eメール)` を返す
    expect(result).toBe('当日TEL(午前中・Eメール)');
  });

  /**
   * テストケース4: 3フィールド全てに値がある場合
   *
   * 現在（バグ）: contact_method が優先されて `当日TEL(Eメール)` を返す
   * 期待値: 全てを結合して `当日TEL(I・午前中・Eメール)` を返す（表示順: 電話担当→連絡取りやすい時間→連絡方法）
   *
   * **Validates: Requirements 1.4**
   */
  it('テスト4: phone_contact_person="I" + preferred_contact_time="午前中" + contact_method="Eメール" → 当日TEL(I・午前中・Eメール) を返すべき（バグ: 当日TEL(Eメール) を返す）', () => {
    const seller = createSeller({
      phone_contact_person: 'I',
      preferred_contact_time: '午前中',
      contact_method: 'Eメール',
    });

    const result = getTodayCallWithInfoLabel(seller);

    // ⚠️ 修正前: contact_method が優先されて `当日TEL(Eメール)` を返す（バグ）
    // ✅ 修正後: 全てを結合して `当日TEL(I・午前中・Eメール)` を返す
    expect(result).toBe('当日TEL(I・午前中・Eメール)');
  });

  /**
   * camelCase フィールド名でも同様のバグが発生することを確認
   *
   * APIレスポンスは camelCase で返ってくる場合があるため、
   * camelCase フィールド名でも同じバグが発生することを確認する
   */
  it('テスト5（camelCase）: phoneContactPerson="I" + contactMethod="Eメール" → 当日TEL(I・Eメール) を返すべき（バグ: 当日TEL(Eメール) を返す）', () => {
    const seller = {
      id: 'test-id-camel',
      phoneContactPerson: 'I',
      contactMethod: 'Eメール',
      preferredContactTime: '',
    };

    const result = getTodayCallWithInfoLabel(seller);

    // ⚠️ 修正前: contactMethod が優先されて `当日TEL(Eメール)` を返す（バグ）
    // ✅ 修正後: 両方を結合して `当日TEL(I・Eメール)` を返す
    expect(result).toBe('当日TEL(I・Eメール)');
  });
});
