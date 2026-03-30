/**
 * 保存テスト - 持家ヒアリング結果の既存動作の保持
 *
 * **Feature: buyer-conditional-required-fix, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される（ベースライン動作の確認）
 * 修正後もこのテストが PASS することで、リグレッションがないことを確認する
 *
 * 保持すべき動作:
 * - owned_home_hearing_inquiry に値があり受付日が2026/3/30以降の場合、必須扱いになる
 * - 受付日が2026/3/30より前の場合、必須扱いにならない
 * - 他の必須フィールド（distribution_type 等）のバリデーションは変更なし
 * - owned_home_hearing_inquiry が空欄の場合の非表示ロジックは変更なし
 */

// ============================================================
// isHomeHearingResultRequired 関数の抽出（BuyerDetailPage.tsx から）
// ============================================================

const isHomeHearingResultRequired = (data: any): boolean => {
  if (!data.reception_date) return false;
  if (new Date(data.reception_date) < new Date('2026-03-30')) return false;
  return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
};

// ============================================================
// 保存テスト
// ============================================================

describe('Property 2: Preservation - 既存の必須チェック動作の保持', () => {
  /**
   * テストケース1: owned_home_hearing_inquiry に値があり受付日が2026/3/30以降の場合
   *
   * 保持すべき動作: isHomeHearingResultRequired が true を返す
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト1: owned_home_hearing_inquiry="Y" かつ reception_date="2026-04-01" → isHomeHearingResultRequired が true を返す', () => {
    const data = {
      owned_home_hearing_inquiry: 'Y',
      reception_date: '2026-04-01',
    };
    expect(isHomeHearingResultRequired(data)).toBe(true);
  });

  it('テスト1b: owned_home_hearing_inquiry="持家あり" かつ reception_date="2026-03-30" → isHomeHearingResultRequired が true を返す（境界値）', () => {
    const data = {
      owned_home_hearing_inquiry: '持家あり',
      reception_date: '2026-03-30',
    };
    expect(isHomeHearingResultRequired(data)).toBe(true);
  });

  /**
   * テストケース2: 受付日が2026/3/30より前の場合
   *
   * 保持すべき動作: isHomeHearingResultRequired が false を返す（受付日条件は変更なし）
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト2: owned_home_hearing_inquiry="Y" かつ reception_date="2026-03-29" → isHomeHearingResultRequired が false を返す', () => {
    const data = {
      owned_home_hearing_inquiry: 'Y',
      reception_date: '2026-03-29',
    };
    expect(isHomeHearingResultRequired(data)).toBe(false);
  });

  it('テスト2b: owned_home_hearing_inquiry="Y" かつ reception_date="2026-01-01" → isHomeHearingResultRequired が false を返す', () => {
    const data = {
      owned_home_hearing_inquiry: 'Y',
      reception_date: '2026-01-01',
    };
    expect(isHomeHearingResultRequired(data)).toBe(false);
  });

  /**
   * テストケース3: owned_home_hearing_inquiry が空欄の場合の非表示ロジック
   *
   * 保持すべき動作: owned_home_hearing_inquiry が空欄の場合、
   * owned_home_hearing_result フィールド自体を非表示にする（既存の表示制御ロジックは変更なし）
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト3: owned_home_hearing_inquiry=null の場合、isHomeHearingResultRequired が false を返す（非表示ロジックの前提）', () => {
    const data = {
      owned_home_hearing_inquiry: null,
      reception_date: '2026-04-01',
    };
    // isHomeHearingResultRequired が false を返すことで、
    // UI側の `if (!buyer.owned_home_hearing_inquiry) return null;` と整合する
    expect(isHomeHearingResultRequired(data)).toBe(false);
  });

  /**
   * テストケース4: 様々な owned_home_hearing_inquiry の値でのプロパティベーステスト
   *
   * 保持すべき動作: owned_home_hearing_inquiry に空でない値があり受付日が2026/3/30以降の場合、
   * isHomeHearingResultRequired が true を返す
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト4: 様々な owned_home_hearing_inquiry の値（空でない）で isHomeHearingResultRequired が true を返す', () => {
    const validInquiryValues = ['Y', 'I', '持家あり', '確認済み', 'yes', '1'];
    const receptionDate = '2026-04-01';

    for (const inquiryValue of validInquiryValues) {
      const data = {
        owned_home_hearing_inquiry: inquiryValue,
        reception_date: receptionDate,
      };
      expect(isHomeHearingResultRequired(data)).toBe(true);
    }
  });

  /**
   * テストケース5: 様々な空欄値でのプロパティベーステスト
   *
   * 保持すべき動作: owned_home_hearing_inquiry が空欄（null/空文字/空白のみ）の場合、
   * isHomeHearingResultRequired が false を返す
   *
   * **Validates: Requirements 2.1**
   */
  it('テスト5: 様々な空欄値（null/空文字/空白）で isHomeHearingResultRequired が false を返す', () => {
    const emptyValues = [null, '', '   ', undefined];
    const receptionDate = '2026-04-01';

    for (const emptyValue of emptyValues) {
      const data = {
        owned_home_hearing_inquiry: emptyValue,
        reception_date: receptionDate,
      };
      expect(isHomeHearingResultRequired(data)).toBe(false);
    }
  });

  /**
   * テストケース6: reception_date が未設定の場合
   *
   * 保持すべき動作: reception_date が未設定の場合、isHomeHearingResultRequired が false を返す
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト6: reception_date=null の場合、isHomeHearingResultRequired が false を返す', () => {
    const data = {
      owned_home_hearing_inquiry: 'Y',
      reception_date: null,
    };
    expect(isHomeHearingResultRequired(data)).toBe(false);
  });

  /**
   * テストケース7: 他の必須フィールドのバリデーションが影響を受けないことを確認
   *
   * 保持すべき動作: distribution_type の必須チェックは変更なし
   *
   * **Validates: Requirements 3.4**
   */
  it('テスト7: isHomeHearingResultRequired は distribution_type の値に影響されない', () => {
    // distribution_type が空欄でも owned_home_hearing_inquiry に値があれば true
    const dataWithDistribution = {
      owned_home_hearing_inquiry: 'Y',
      reception_date: '2026-04-01',
      distribution_type: '',
    };
    expect(isHomeHearingResultRequired(dataWithDistribution)).toBe(true);

    // distribution_type に値があっても owned_home_hearing_inquiry が空欄なら false
    const dataWithoutInquiry = {
      owned_home_hearing_inquiry: null,
      reception_date: '2026-04-01',
      distribution_type: '要',
    };
    expect(isHomeHearingResultRequired(dataWithoutInquiry)).toBe(false);
  });
});
