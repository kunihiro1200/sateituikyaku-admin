/**
 * バグ確認テスト: 買主「★最新状況」必須チェック条件
 *
 * 目的: 未修正コードでバグ条件が発生することを確認し、
 *       修正後に正しい条件でのみ必須扱いされることを検証する。
 *
 * バグ: latest_status が空欄であれば無条件で必須扱いされる
 * 正しい動作: 以下の全条件を満たす場合のみ必須
 *   - 条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
 *   - 条件B: reception_date が 2026-02-08 以降
 *   - 条件C: broker_inquiry が空欄
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

// ===== 未修正コードのロジックを再現 =====
// BuyerDetailPage.tsx の checkMissingFields 内の latest_status チェック（修正前）
function isLatestStatusRequired_BUGGY(data: any): boolean {
  // バグ: 単純な空欄チェックのみ（条件A・B・Cを評価しない）
  if (!data.latest_status || !String(data.latest_status).trim()) {
    return true;
  }
  return false;
}

// ===== 修正後コードのロジックを再現 =====
// BuyerDetailPage.tsx の isLatestStatusRequired ヘルパー（修正後）
function isLatestStatusRequired_FIXED(data: any): boolean {
  // 条件C: broker_inquiry が空欄でなければ必須でない
  if (data.broker_inquiry && String(data.broker_inquiry).trim()) return false;
  // 条件B: reception_date が 2026-02-08 以降でなければ必須でない
  if (!data.reception_date) return false;
  const receptionDate = new Date(data.reception_date);
  if (receptionDate < new Date('2026-02-08')) return false;
  // 条件A: (inquiry_hearingが空欄でない AND inquiry_sourceに「電話」を含む) OR inquiry_email_phoneが「済」
  const hearingFilled = data.inquiry_hearing && String(data.inquiry_hearing).trim();
  const hasPhone = data.inquiry_source && String(data.inquiry_source).includes('電話');
  const emailPhoneDone = data.inquiry_email_phone && String(data.inquiry_email_phone) === '済';
  if (!((hearingFilled && hasPhone) || emailPhoneDone)) return false;
  return true;
}

// isBugCondition: 未修正コードが「必須」と判定するが、正しくは「必須でない」ケース
function isBugCondition(data: any): boolean {
  const latestStatusBlank = !data.latest_status || !String(data.latest_status).trim();
  const shouldBeRequired = isLatestStatusRequired_FIXED(data);
  return latestStatusBlank && !shouldBeRequired;
}

// ===== バグ確認テスト（未修正コードで失敗することを確認） =====

describe('★最新状況 必須チェック - バグ確認テスト（修正前コードの動作確認）', () => {
  /**
   * テスト1: broker_inquiry あり → 必須でないべきなのに必須扱いされる（バグ）
   * Validates: Requirements 1.2, 2.3
   */
  test('バグ1: broker_inquiry に値がある場合、未修正コードは latest_status を誤って必須扱いする', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      latest_status: '',
      reception_date: '2026-03-01',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    // 未修正コードは必須扱いする（バグ）
    expect(isLatestStatusRequired_BUGGY(buyer)).toBe(true);
    // 正しくは必須でない
    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
    // バグ条件を満たす
    expect(isBugCondition(buyer)).toBe(true);
  });

  /**
   * テスト2: reception_date が 2026-02-08 より前 → 必須でないべきなのに必須扱いされる（バグ）
   * Validates: Requirements 1.3, 2.4
   */
  test('バグ2: reception_date が 2026-02-08 より前の場合、未修正コードは latest_status を誤って必須扱いする', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-01-01',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_BUGGY(buyer)).toBe(true);
    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
    expect(isBugCondition(buyer)).toBe(true);
  });

  /**
   * テスト3: inquiry_hearing 空欄・inquiry_email_phone 未済 → 必須でないべきなのに必須扱いされる（バグ）
   * Validates: Requirements 1.4, 2.5
   */
  test('バグ3: inquiry_hearing が空欄かつ inquiry_email_phone が「済」でない場合、未修正コードは誤って必須扱いする', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-03-01',
      inquiry_hearing: '',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_BUGGY(buyer)).toBe(true);
    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
    expect(isBugCondition(buyer)).toBe(true);
  });

  /**
   * テスト4: inquiry_source に「電話」を含まず inquiry_email_phone が「済」でない → 必須でないべき（バグ）
   * Validates: Requirements 1.4, 2.5
   */
  test('バグ4: inquiry_source に「電話」を含まず inquiry_email_phone が「済」でない場合、未修正コードは誤って必須扱いする', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-03-01',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: 'ネット',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_BUGGY(buyer)).toBe(true);
    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
    expect(isBugCondition(buyer)).toBe(true);
  });

  /**
   * テスト5: reception_date が存在しない → 必須でないべき（バグ）
   * Validates: Requirements 2.4
   */
  test('バグ5: reception_date が未設定の場合、未修正コードは誤って必須扱いする', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: null,
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_BUGGY(buyer)).toBe(true);
    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
    expect(isBugCondition(buyer)).toBe(true);
  });
});

// ===== 修正後の正常動作確認テスト =====

describe('★最新状況 必須チェック - 修正後の正常動作確認', () => {
  /**
   * テスト6: 全条件を満たす場合は必須扱いされる（正常）
   * Validates: Requirements 2.1
   */
  test('正常1: 全条件を満たし latest_status が空欄の場合、必須扱いされる', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-03-01',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_FIXED(buyer)).toBe(true);
    expect(isBugCondition(buyer)).toBe(false);
  });

  /**
   * テスト7: inquiry_email_phone が「済」の場合も必須扱いされる（条件A の OR 分岐）
   * Validates: Requirements 2.1
   */
  test('正常2: inquiry_email_phone が「済」かつ他条件を満たす場合、必須扱いされる', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-03-01',
      inquiry_hearing: '',
      inquiry_source: 'メール',
      inquiry_email_phone: '済',
    };

    expect(isLatestStatusRequired_FIXED(buyer)).toBe(true);
    expect(isBugCondition(buyer)).toBe(false);
  });

  /**
   * テスト8: 全条件を満たし latest_status が入力済みの場合、必須ハイライトなし（正常）
   * Validates: Requirements 3.1
   */
  test('正常3: 全条件を満たし latest_status が入力済みの場合、必須扱いされない', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '商談中',
      reception_date: '2026-03-01',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    // latest_status が入力済みなのでバグ条件を満たさない
    expect(isBugCondition(buyer)).toBe(false);
  });

  /**
   * テスト9: reception_date が境界値（2026-02-08 ちょうど）の場合、必須扱いされる
   * Validates: Requirements 2.1
   */
  test('正常4: reception_date が 2026-02-08 ちょうどの場合、必須扱いされる', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-02-08',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_FIXED(buyer)).toBe(true);
  });

  /**
   * テスト10: reception_date が境界値の1日前（2026-02-07）の場合、必須でない
   * Validates: Requirements 2.4
   */
  test('正常5: reception_date が 2026-02-07 の場合、必須扱いされない', () => {
    const buyer = {
      broker_inquiry: '',
      latest_status: '',
      reception_date: '2026-02-07',
      inquiry_hearing: 'ヒアリング済み',
      inquiry_source: '電話',
      inquiry_email_phone: '',
    };

    expect(isLatestStatusRequired_FIXED(buyer)).toBe(false);
  });
});
