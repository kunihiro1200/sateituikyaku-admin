/**
 * 学校区判定システム テスト
 *
 * テストケース構成:
 *   1. 正常判定（既知の正解住所）
 *   2. 不一致バグの再発防止（FI637, FI1256, AA15123）
 *   3. 境界住所（同一町名・異なる学区）
 *   4. 丁目範囲
 *   5. 番地範囲
 *   6. 例外住所（"ただし〜を除く"）
 *   7. 全域
 *   8. 住所対応表に未収録 → null 返却（GeoJSONフォールバックへ）
 *   9. matchRange のユニットテスト
 */

import { lookupFukuokaSchool, matchRange, parseAddress } from '../services/FukuokaSchoolAddressService';

// ────────────────────────────────────────────────────────────────────────────
// matchRange ユニットテスト
// ────────────────────────────────────────────────────────────────────────────
describe('matchRange', () => {
  describe('全域', () => {
    test('"全域" は常に match', () => {
      expect(matchRange('全域', null, null)).toBe('match');
      expect(matchRange('全域', 1, 5)).toBe('match');
    });

    test('"全域（ただし〜を除く）" は uncertain', () => {
      expect(matchRange('全域（ただし、1番を除く）', 1, 1)).toBe('uncertain');
      expect(matchRange('全域（ただし、東箱崎小区域を除く）', null, null)).toBe('uncertain');
    });
  });

  describe('丁目範囲', () => {
    test('"1丁目～3丁目" chome=2 → match', () => {
      expect(matchRange('1丁目～3丁目', 2, null)).toBe('match');
    });

    test('"1丁目～3丁目" chome=4 → no_match', () => {
      expect(matchRange('1丁目～3丁目', 4, null)).toBe('no_match');
    });

    test('"1丁目～3丁目" chome=null → uncertain', () => {
      expect(matchRange('1丁目～3丁目', null, null)).toBe('uncertain');
    });

    test('"1丁目" chome=1 → match', () => {
      expect(matchRange('1丁目', 1, null)).toBe('match');
    });

    test('"1丁目" chome=2 → no_match', () => {
      expect(matchRange('1丁目', 2, null)).toBe('no_match');
    });
  });

  describe('番地範囲', () => {
    test('"5丁目1番～16番" chome=5,ban=10 → match', () => {
      expect(matchRange('5丁目1番～16番', 5, 10)).toBe('match');
    });

    test('"5丁目1番～16番" chome=5,ban=16 → match (境界値)', () => {
      expect(matchRange('5丁目1番～16番', 5, 16)).toBe('match');
    });

    test('"5丁目1番～16番" chome=5,ban=17 → no_match', () => {
      expect(matchRange('5丁目1番～16番', 5, 17)).toBe('no_match');
    });

    test('"5丁目1番～16番" chome=4,ban=10 → no_match (丁目違い)', () => {
      expect(matchRange('5丁目1番～16番', 4, 10)).toBe('no_match');
    });
  });

  describe('複合範囲（渡辺通の実データ）', () => {
    // 警固中: "2丁目、4丁目、5丁目20番～24番"
    test('警固中範囲: 5丁目24番 → match', () => {
      expect(matchRange('2丁目、4丁目、5丁目20番～24番', 5, 24)).toBe('match');
    });

    test('警固中範囲: 5丁目19番 → no_match', () => {
      expect(matchRange('2丁目、4丁目、5丁目20番～24番', 5, 19)).toBe('no_match');
    });

    test('警固中範囲: 2丁目 → match (chomeのみ)', () => {
      expect(matchRange('2丁目、4丁目、5丁目20番～24番', 2, null)).toBe('match');
    });

    // 春吉中: "1丁目、3丁目、5丁目1番～16番、25番、26番"
    test('春吉中範囲: 5丁目24番 → no_match', () => {
      expect(matchRange('1丁目、3丁目、5丁目1番～16番、25番、26番', 5, 24)).toBe('no_match');
    });

    test('春吉中範囲: 5丁目25番 → match', () => {
      expect(matchRange('1丁目、3丁目、5丁目1番～16番、25番、26番', 5, 25)).toBe('match');
    });

    test('春吉中範囲: 5丁目26番 → match (最後の番地)', () => {
      expect(matchRange('1丁目、3丁目、5丁目1番～16番、25番、26番', 5, 26)).toBe('match');
    });

    test('春吉中範囲: 1丁目全域 → match', () => {
      expect(matchRange('1丁目、3丁目、5丁目1番～16番、25番、26番', 1, null)).toBe('match');
    });
  });

  describe('ただし除外', () => {
    test('"1丁目(ただし、3番を除く)" → uncertain', () => {
      expect(matchRange('1丁目(ただし、3番を除く)', 1, 3)).toBe('uncertain');
    });

    test('"1丁目～4丁目(ただし、4丁目16番～19番を除く)" → uncertain', () => {
      expect(matchRange('1丁目～4丁目(ただし、4丁目16番～19番を除く)', 4, 17)).toBe('uncertain');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// parseAddress ユニットテスト
// ────────────────────────────────────────────────────────────────────────────
describe('parseAddress', () => {
  test('ハイフン形式: 渡辺通5丁目24-30', () => {
    const r = parseAddress('福岡県福岡市中央区渡辺通5丁目24-30');
    expect(r.ward).toBe('中央区');
    expect(r.town).toBe('渡辺通');
    expect(r.chome).toBe(5);
    expect(r.ban).toBe(24);
  });

  test('番形式: 渡辺通5丁目24番', () => {
    const r = parseAddress('福岡市中央区渡辺通5丁目24番');
    expect(r.ward).toBe('中央区');
    expect(r.town).toBe('渡辺通');
    expect(r.chome).toBe(5);
    expect(r.ban).toBe(24);
  });

  test('3段ハイフン: 重留5丁目13-13-2', () => {
    const r = parseAddress('福岡県福岡市早良区重留5丁目13-13-2');
    expect(r.ward).toBe('早良区');
    expect(r.town).toBe('重留');
    expect(r.chome).toBe(5);
    expect(r.ban).toBe(13);
    expect(r.go).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// lookupFukuokaSchool 統合テスト
// ────────────────────────────────────────────────────────────────────────────
describe('lookupFukuokaSchool', () => {
  // ----------------------------------------------------------------
  // バグ再発防止テスト（今回の3件の不一致）
  // ----------------------------------------------------------------
  describe('バグ再発防止', () => {
    test('[FI637] 渡辺通5丁目24番 → 警固小/警固中 (春吉小/春吉中 ではない)', () => {
      const result = lookupFukuokaSchool('福岡県福岡市中央区渡辺通5丁目24-30東カン第1福岡ビル 1018');
      expect(result).not.toBeNull();
      expect(result!.elementary).toContain('警固小');
      expect(result!.juniorHigh).toContain('警固中');
      expect(result!.confidence).toBe('confirmed');
    });

    test('[FI1256] 重留5丁目13-13 → 入部小/金武中', () => {
      const result = lookupFukuokaSchool('福岡県福岡市早良区重留5丁目13-13');
      expect(result).not.toBeNull();
      expect(result!.elementary).toContain('入部小');
      expect(result!.juniorHigh).toContain('金武中');
    });
  });

  // ----------------------------------------------------------------
  // 境界住所テスト（渡辺通）
  // ----------------------------------------------------------------
  describe('渡辺通 境界テスト', () => {
    test('渡辺通5丁目1番 → 春吉小/春吉中', () => {
      const r = lookupFukuokaSchool('福岡市中央区渡辺通5丁目1番');
      expect(r?.elementary).toContain('春吉小');
      expect(r?.juniorHigh).toContain('春吉中');
    });

    test('渡辺通5丁目16番 → 春吉小/春吉中 (範囲末端)', () => {
      const r = lookupFukuokaSchool('福岡市中央区渡辺通5丁目16番');
      expect(r?.elementary).toContain('春吉小');
    });

    test('渡辺通5丁目20番 → 警固小/警固中 (警固範囲先頭)', () => {
      const r = lookupFukuokaSchool('福岡市中央区渡辺通5丁目20番');
      expect(r?.elementary).toContain('警固小');
    });

    test('渡辺通5丁目24番 → 警固小/警固中 (警固範囲末端)', () => {
      const r = lookupFukuokaSchool('福岡市中央区渡辺通5丁目24番');
      expect(r?.elementary).toContain('警固小');
    });

    test('渡辺通5丁目25番 → 春吉小/春吉中 (飛び番)', () => {
      const r = lookupFukuokaSchool('福岡市中央区渡辺通5丁目25番');
      expect(r?.elementary).toContain('春吉小');
    });
  });

  // ----------------------------------------------------------------
  // 重留 境界テスト
  // ----------------------------------------------------------------
  describe('重留 テスト', () => {
    test('重留1丁目 → 入部小/金武中', () => {
      const r = lookupFukuokaSchool('福岡市早良区重留1丁目1-1');
      expect(r?.juniorHigh).toContain('金武中');
      expect(r?.elementary).toContain('入部小');
    });

    test('重留7丁目1番 → 四箇田小/金武中 (7丁目1番-27番は四箇田小)', () => {
      const r = lookupFukuokaSchool('福岡市早良区重留7丁目1番');
      expect(r?.elementary).toContain('四箇田小');
      expect(r?.juniorHigh).toContain('金武中');
    });

    test('重留7丁目28番 → 入部小/金武中 (7丁目28番-35番は入部小)', () => {
      const r = lookupFukuokaSchool('福岡市早良区重留7丁目28番');
      expect(r?.elementary).toContain('入部小');
      expect(r?.juniorHigh).toContain('金武中');
    });
  });

  // ----------------------------------------------------------------
  // 全域テスト
  // ----------------------------------------------------------------
  describe('全域テスト', () => {
    test('玉川町 → 玉川小/春吉中 (全域)', () => {
      const r = lookupFukuokaSchool('福岡市南区玉川町1番1号');
      expect(r).not.toBeNull();
      expect(r!.elementary).toContain('玉川小');
    });
  });

  // ----------------------------------------------------------------
  // 住所対応表に未収録 → null
  // ----------------------------------------------------------------
  describe('未収録住所', () => {
    test('熊本市 → null (福岡市外)', () => {
      const r = lookupFukuokaSchool('熊本市中央区手取本町1番1号');
      expect(r).toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FI89 再発防止テスト（小笹1丁目 ただし例外節スキップ）
// ────────────────────────────────────────────────────────────────────────────
describe('FI89 小笹1丁目 ただし例外節テスト', () => {
  test('小笹1丁目8-7 → 小笹小/平尾中 (confirmed)', () => {
    // 「1丁目～3丁目（ただし、3丁目20番の一部を除く・・・笹丘小）」
    // 例外は3丁目20番。1丁目8番は明らかに例外外 → confirmed
    const r = lookupFukuokaSchool('福岡県福岡市中央区小笹１丁目8-7ファーネスト平和中央公園408');
    expect(r).not.toBeNull();
    expect(r!.elementary).toContain('小笹小');
    expect(r!.juniorHigh).toContain('平尾中');
    expect(r!.confidence).toBe('confirmed');
  });

  test('小笹3丁目15番 → 小笹小/平尾中 (confirmed, 例外番地ではない)', () => {
    // 例外「3丁目20番の一部」ではない → confirmed
    const r = lookupFukuokaSchool('福岡市中央区小笹3丁目15番');
    expect(r).not.toBeNull();
    expect(r!.elementary).toContain('小笹小');
    expect(r!.confidence).toBe('confirmed');
  });

  test('小笹3丁目20番 → uncertain (例外番地「の一部」)', () => {
    // 例外「3丁目20番の一部を除く」 → 判定不能 → uncertain
    const r = lookupFukuokaSchool('福岡市中央区小笹3丁目20番');
    expect(r).not.toBeNull();
    expect(r!.confidence).toBe('uncertain');
  });
});
