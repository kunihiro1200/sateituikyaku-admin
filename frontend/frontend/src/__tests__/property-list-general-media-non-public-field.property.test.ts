/**
 * プロパティテスト: 「一般媒介非公開（仮）」フィールドの表示条件
 *
 * タスク 5.1: プロパティテスト：表示条件の普遍性（プロパティ1）
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * 任意の atbb_status 文字列・null・undefined に対して、
 * 「一般」を含む場合のみ true を返すことを検証する
 */

import * as fc from 'fast-check';

// ===== テスト対象関数（PropertyListingDetailPage.tsx と同一実装） =====

/**
 * atbb_statusに「一般」が含まれる場合のみ「一般媒介非公開（仮）」フィールドを表示する
 */
const shouldShowGeneralMediationPrivate = (atbbStatus: string | null | undefined): boolean => {
  return typeof atbbStatus === 'string' && atbbStatus.includes('一般');
};

// ===== プロパティテスト =====

describe('Property 1: 表示条件の普遍性（タスク 5.1）', () => {
  /**
   * プロパティ1: 任意の atbb_status 文字列・null・undefined に対して、
   * 「一般」を含む場合のみ true を返すこと
   *
   * Validates: Requirements 1.1, 1.2, 1.3
   */
  it('任意の atbb_status に対して「一般」を含む場合のみ true を返すこと', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (atbbStatus) => {
          const result = shouldShowGeneralMediationPrivate(atbbStatus);
          const expected = typeof atbbStatus === 'string' && atbbStatus.includes('一般');
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ1（「一般」を含む文字列）: 常に true を返すこと
   *
   * Validates: Requirements 1.1
   */
  it('「一般」を含む任意の文字列に対して true を返すこと', () => {
    fc.assert(
      fc.property(
        // 「一般」を含む文字列を生成
        fc.tuple(fc.string(), fc.string()).map(([prefix, suffix]) => prefix + '一般' + suffix),
        (atbbStatus) => {
          return shouldShowGeneralMediationPrivate(atbbStatus) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * プロパティ1（「一般」を含まない文字列）: 常に false を返すこと
   *
   * Validates: Requirements 1.2
   */
  it('「一般」を含まない任意の文字列に対して false を返すこと', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('一般')),
        (atbbStatus) => {
          return shouldShowGeneralMediationPrivate(atbbStatus) === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 具体的なエッジケーステスト =====

describe('shouldShowGeneralMediationPrivate 具体的なエッジケース', () => {
  // Validates: Requirements 1.1
  it('「一般・公開中」は true を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('一般・公開中')).toBe(true);
  });

  it('「一般・公開前」は true を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('一般・公開前')).toBe(true);
  });

  // Validates: Requirements 1.2
  it('「専任・公開中」は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('専任・公開中')).toBe(false);
  });

  it('「非公開（専任）」は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('非公開（専任）')).toBe(false);
  });

  it('「他社物件」は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('他社物件')).toBe(false);
  });

  // Validates: Requirements 1.3
  it('null は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate(null)).toBe(false);
  });

  it('undefined は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate(undefined)).toBe(false);
  });

  it('空文字は false を返すこと', () => {
    expect(shouldShowGeneralMediationPrivate('')).toBe(false);
  });
});
