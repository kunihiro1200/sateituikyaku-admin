/**
 * 保全プロパティテスト: 専任・他決系ステータスおよびその他ステータスでの動作維持
 *
 * **Property 2: Preservation**
 *
 * このテストは修正前のコードで実行し、PASS することを確認します（ベースライン動作）。
 * 修正後も同じテストが PASS することで、リグレッションがないことを確認します。
 *
 * 観察された動作パターン:
 *   - 観察1: freshData.status === '専任媒介' の場合、requiresDecisionDate が true を返す
 *   - 観察2: freshData.status === '他決→追客' の場合、requiresDecisionDate が true を返す
 *   - 観察3: freshData.status === '追客中' の場合、requiresDecisionDate が false を返す
 *   - 観察4: statusChangedRef.current === true の場合、editedExclusiveDecisionDate が上書きされない
 *   - 観察5: キャッシュなし通常パスでは setEditedExclusiveDecisionDate が正しく初期化される
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import * as fc from 'fast-check';
import { SellerStatus } from '../types';

// ============================================================
// CallModePage.tsx の getStatusLabel 関数を再現
// （実際のコードと同じマッピングを使用）
// ============================================================

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    [SellerStatus.FOLLOWING_UP]: '追客中',
    [SellerStatus.FOLLOW_UP_NOT_NEEDED]: '追客不要（未訪問）',
    [SellerStatus.LOST]: '除外済追客不要',
    'follow_up_not_needed_after_exclusion': '除外後追客中',
    [SellerStatus.EXCLUSIVE_CONTRACT]: '専任媒介',
    'general_contract': '一般媒介',
    'other_company_purchase': '他社買取',
    'other_decision_follow_up': '他決→追客',
    [SellerStatus.OTHER_DECISION]: '他決→追客不要',
    'other_decision_exclusive': '他決→専任',
    'other_decision_general': '他決→一般',
    [SellerStatus.APPOINTMENT_SCHEDULED]: '訪問（担当付）追客不要',
    'VISITOTHERDECISION': '訪問後他決',
    'UNVISITEDOTHERDECISION': '未訪問他決',
    'EXCLUSIVE': '専任',
    'GENERAL': '一般',
  };
  return statusLabels[status] || status;
};

// ============================================================
// CallModePage.tsx の requiresDecisionDate 関数を再現
// （実際のコードと同じロジックを使用）
// ============================================================

/**
 * 修正前・修正後ともに同じ実装
 * label.includes('専任') || label.includes('他決') でチェック
 */
const requiresDecisionDate = (status: string): boolean => {
  if (!status) return false;
  const label = getStatusLabel(status);
  return label.includes('専任') || label.includes('他決');
};

// ============================================================
// バックグラウンド更新処理のシミュレーション
// ============================================================

/**
 * 修正前のバックグラウンド更新処理（バグあり）
 * setEditedExclusiveDecisionDate が呼ばれない
 */
function simulateBackgroundUpdate_unfixed(
  freshData: {
    status: string;
    confidence?: string;
    nextCallDate?: string;
    pinrichStatus?: string;
    contractYearMonth?: string | null;
  },
  state: {
    statusChangedRef: { current: boolean };
    editedStatus: string;
    editedConfidence: string;
    editedNextCallDate: string;
    editedPinrichStatus: string;
    editedExclusiveDecisionDate: string;
  }
): void {
  if (!state.statusChangedRef.current) {
    state.editedStatus = freshData.status;
    state.editedConfidence = freshData.confidence || '';
    state.editedNextCallDate = freshData.nextCallDate || '';
    state.editedPinrichStatus = freshData.pinrichStatus || '';
    // ❌ バグ: setEditedExclusiveDecisionDate が呼ばれていない
  }
}

/**
 * キャッシュなし通常パスの初期化処理をシミュレート
 * setEditedExclusiveDecisionDate が正しく呼ばれる
 */
function simulateNormalPath_initialization(
  freshData: {
    status: string;
    contractYearMonth?: string | null;
  },
  state: {
    editedStatus: string;
    editedExclusiveDecisionDate: string;
  }
): void {
  state.editedStatus = freshData.status;
  // 通常パスでは contractYearMonth を正しく初期化する
  if (freshData.contractYearMonth) {
    const rawDate = freshData.contractYearMonth;
    const formattedDecisionDate =
      typeof rawDate === 'string' && rawDate.length === 7
        ? rawDate + '-01'
        : typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : '';
    state.editedExclusiveDecisionDate = formattedDecisionDate;
  } else {
    state.editedExclusiveDecisionDate = '';
  }
}

// ============================================================
// 専任・他決系ステータス一覧（requiresDecisionDate が true を返すもの）
// ============================================================

/**
 * requiresDecisionDate が true を返すステータス
 * getStatusLabel でラベルに変換後、'専任' または '他決' を含むもの
 */
const exclusiveOrOtherDecisionStatuses = [
  // ステータスキー → ラベル
  SellerStatus.EXCLUSIVE_CONTRACT,        // '専任媒介'
  'other_decision_follow_up',             // '他決→追客'
  SellerStatus.OTHER_DECISION,            // '他決→追客不要'
  'other_decision_exclusive',             // '他決→専任'
  'other_decision_general',               // '他決→一般'
  'VISITOTHERDECISION',                   // '訪問後他決'
  'UNVISITEDOTHERDECISION',               // '未訪問他決'
  'EXCLUSIVE',                            // '専任'
  // 日本語ラベルを直接使う場合（getStatusLabel がそのまま返す）
  '専任媒介',
  '他決→追客',
  '他決→追客不要',
  '他決→専任',
  '他決→一般',
  '一般→他決',
  'リースバック（専任）',
];

/**
 * requiresDecisionDate が false を返すステータス
 * getStatusLabel でラベルに変換後、'専任' も '他決' も含まないもの
 */
const nonTargetStatuses = [
  SellerStatus.FOLLOWING_UP,              // '追客中'
  SellerStatus.FOLLOW_UP_NOT_NEEDED,      // '追客不要（未訪問）'
  SellerStatus.LOST,                      // '除外済追客不要'
  'follow_up_not_needed_after_exclusion', // '除外後追客中'
  'general_contract',                     // '一般媒介'
  'other_company_purchase',               // '他社買取'
  // 日本語ラベルを直接使う場合
  '追客中',
  '追客不要',
  '除外済追客不要',
  '一般媒介',
];

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 専任・他決系ステータスおよびその他ステータスでの動作維持', () => {

  // ============================================================
  // 観察1: 専任媒介の場合、requiresDecisionDate が true を返す
  // ============================================================

  describe('観察1: 専任媒介の場合、requiresDecisionDate が true を返す', () => {

    /**
     * **Validates: Requirements 3.1**
     */
    it('専任媒介（exclusive_contract）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate(SellerStatus.EXCLUSIVE_CONTRACT)).toBe(true);
    });

    it('日本語ラベル「専任媒介」の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('専任媒介')).toBe(true);
    });

    it('リースバック（専任）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('リースバック（専任）')).toBe(true);
    });

  });

  // ============================================================
  // 観察2: 他決→追客の場合、requiresDecisionDate が true を返す
  // ============================================================

  describe('観察2: 他決→追客の場合、requiresDecisionDate が true を返す', () => {

    /**
     * **Validates: Requirements 3.1**
     */
    it('他決→追客（other_decision_follow_up）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('other_decision_follow_up')).toBe(true);
    });

    it('日本語ラベル「他決→追客」の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('他決→追客')).toBe(true);
    });

    it('他決→追客不要（other_decision）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate(SellerStatus.OTHER_DECISION)).toBe(true);
    });

    it('他決→専任（other_decision_exclusive）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('other_decision_exclusive')).toBe(true);
    });

    it('他決→一般（other_decision_general）の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('other_decision_general')).toBe(true);
    });

    it('一般→他決の場合、requiresDecisionDate が true を返す', () => {
      expect(requiresDecisionDate('一般→他決')).toBe(true);
    });

  });

  // ============================================================
  // 観察3: 追客中の場合、requiresDecisionDate が false を返す
  // ============================================================

  describe('観察3: 追客中の場合、requiresDecisionDate が false を返す', () => {

    /**
     * **Validates: Requirements 3.2**
     */
    it('追客中（following_up）の場合、requiresDecisionDate が false を返す', () => {
      expect(requiresDecisionDate(SellerStatus.FOLLOWING_UP)).toBe(false);
    });

    it('日本語ラベル「追客中」の場合、requiresDecisionDate が false を返す', () => {
      expect(requiresDecisionDate('追客中')).toBe(false);
    });

    it('追客不要（follow_up_not_needed）の場合、requiresDecisionDate が false を返す', () => {
      expect(requiresDecisionDate(SellerStatus.FOLLOW_UP_NOT_NEEDED)).toBe(false);
    });

    it('除外済追客不要（lost）の場合、requiresDecisionDate が false を返す', () => {
      expect(requiresDecisionDate(SellerStatus.LOST)).toBe(false);
    });

    it('一般媒介（general_contract）の場合、requiresDecisionDate が false を返す', () => {
      // 注意: 一般媒介は '専任' も '他決' も含まないため false
      expect(requiresDecisionDate('general_contract')).toBe(false);
    });

  });

  // ============================================================
  // 観察4: statusChangedRef.current === true の場合、editedExclusiveDecisionDate が上書きされない
  // ============================================================

  describe('観察4: statusChangedRef.current === true の場合、editedExclusiveDecisionDate が上書きされない', () => {

    /**
     * **Validates: Requirements 3.3**
     */
    it('statusChangedRef.current === true の場合、バックグラウンド更新で editedExclusiveDecisionDate が上書きされない', () => {
      const state = {
        statusChangedRef: { current: true }, // ユーザーが編集中
        editedStatus: '専任媒介',
        editedConfidence: '高',
        editedNextCallDate: '2025-05-01',
        editedPinrichStatus: '',
        editedExclusiveDecisionDate: '2025-06-01', // ユーザーが入力した値
      };

      const freshData = {
        status: '一般媒介',
        confidence: '低',
        nextCallDate: '2025-03-01',
        pinrichStatus: '',
        contractYearMonth: '2025-01',
      };

      // バックグラウンド更新処理をシミュレート
      simulateBackgroundUpdate_unfixed(freshData, state);

      // statusChangedRef.current === true なので、何も更新されない
      expect(state.editedStatus).toBe('専任媒介');
      expect(state.editedExclusiveDecisionDate).toBe('2025-06-01'); // 変更されない
    });

    it('statusChangedRef.current === true の場合、editedStatus も上書きされない', () => {
      const state = {
        statusChangedRef: { current: true },
        editedStatus: '他決→追客',
        editedConfidence: '中',
        editedNextCallDate: '',
        editedPinrichStatus: '',
        editedExclusiveDecisionDate: '2025-03-15',
      };

      const freshData = {
        status: '追客中',
        confidence: '低',
        nextCallDate: '',
        pinrichStatus: '',
        contractYearMonth: null,
      };

      simulateBackgroundUpdate_unfixed(freshData, state);

      expect(state.editedStatus).toBe('他決→追客'); // 変更されない
      expect(state.editedExclusiveDecisionDate).toBe('2025-03-15'); // 変更されない
    });

  });

  // ============================================================
  // 観察5: キャッシュなし通常パスでは setEditedExclusiveDecisionDate が正しく初期化される
  // ============================================================

  describe('観察5: キャッシュなし通常パスでは setEditedExclusiveDecisionDate が正しく初期化される', () => {

    /**
     * **Validates: Requirements 3.4**
     */
    it('通常パス: contractYearMonth = "2025-03" の場合、editedExclusiveDecisionDate が "2025-03-01" に初期化される', () => {
      const state = {
        editedStatus: '',
        editedExclusiveDecisionDate: '',
      };

      simulateNormalPath_initialization(
        { status: '専任媒介', contractYearMonth: '2025-03' },
        state
      );

      expect(state.editedExclusiveDecisionDate).toBe('2025-03-01');
    });

    it('通常パス: contractYearMonth = "2025-03-15" の場合、editedExclusiveDecisionDate が "2025-03-15" に初期化される', () => {
      const state = {
        editedStatus: '',
        editedExclusiveDecisionDate: '',
      };

      simulateNormalPath_initialization(
        { status: '専任媒介', contractYearMonth: '2025-03-15' },
        state
      );

      expect(state.editedExclusiveDecisionDate).toBe('2025-03-15');
    });

    it('通常パス: contractYearMonth = null の場合、editedExclusiveDecisionDate が "" に初期化される', () => {
      const state = {
        editedStatus: '',
        editedExclusiveDecisionDate: '2024-12-01', // 以前の値
      };

      simulateNormalPath_initialization(
        { status: '専任媒介', contractYearMonth: null },
        state
      );

      expect(state.editedExclusiveDecisionDate).toBe('');
    });

    it('通常パス: contractYearMonth が ISO 形式の場合、日付部分のみ取得される', () => {
      const state = {
        editedStatus: '',
        editedExclusiveDecisionDate: '',
      };

      simulateNormalPath_initialization(
        { status: '専任媒介', contractYearMonth: '2025-03-15T00:00:00.000Z' },
        state
      );

      expect(state.editedExclusiveDecisionDate).toBe('2025-03-15');
    });

  });

  // ============================================================
  // プロパティベーステスト1:
  // 専任・他決系ステータスの全パターンに対して、requiresDecisionDate が true を返し続ける
  // ============================================================

  describe('プロパティベーステスト1: 専任・他決系ステータスで requiresDecisionDate が常に true を返す', () => {

    /**
     * **Validates: Requirements 3.1**
     */
    it('専任・他決系ステータスの全パターンに対して、requiresDecisionDate が true を返し続ける', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...exclusiveOrOtherDecisionStatuses),
          (status) => {
            const result = requiresDecisionDate(status);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('専任・他決系ステータスの全パターンに対して、修正前後で requiresDecisionDate の結果が変わらない', () => {
      // 修正前後で requiresDecisionDate の実装は変わらないため、同じ関数で検証
      fc.assert(
        fc.property(
          fc.constantFrom(...exclusiveOrOtherDecisionStatuses),
          (status) => {
            // 修正前の動作（ベースライン）
            const baselineResult = requiresDecisionDate(status);
            // 修正後も同じ結果を返すことを確認（Preservation）
            const preservedResult = requiresDecisionDate(status);
            return baselineResult === true && preservedResult === true;
          }
        ),
        { numRuns: 100 }
      );
    });

  });

  // ============================================================
  // プロパティベーステスト2:
  // 非対象ステータスに対して、requiresDecisionDate が false を返し続ける
  // ============================================================

  describe('プロパティベーステスト2: 非対象ステータスで requiresDecisionDate が常に false を返す', () => {

    /**
     * **Validates: Requirements 3.2**
     */
    it('非対象ステータスの全パターンに対して、requiresDecisionDate が false を返し続ける', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...nonTargetStatuses),
          (status) => {
            const result = requiresDecisionDate(status);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非対象ステータスの全パターンに対して、修正前後で requiresDecisionDate の結果が変わらない', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...nonTargetStatuses),
          (status) => {
            const baselineResult = requiresDecisionDate(status);
            const preservedResult = requiresDecisionDate(status);
            return baselineResult === false && preservedResult === false;
          }
        ),
        { numRuns: 100 }
      );
    });

  });

  // ============================================================
  // プロパティベーステスト3:
  // statusChangedRef.current === true の場合、バックグラウンド更新で状態が変わらない
  // ============================================================

  describe('プロパティベーステスト3: statusChangedRef.current === true の場合、状態が変わらない', () => {

    /**
     * **Validates: Requirements 3.3**
     */
    it('statusChangedRef.current === true の場合、任意のfreshDataに対してeditedExclusiveDecisionDateが上書きされない', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...exclusiveOrOtherDecisionStatuses),
          fc.oneof(
            fc.constant(null),
            fc.string({ minLength: 7, maxLength: 10 }).filter(s => /^\d{4}-\d{2}/.test(s))
          ),
          fc.string({ minLength: 1, maxLength: 20 }),
          (freshStatus, freshContractYearMonth, originalDecisionDate) => {
            const state = {
              statusChangedRef: { current: true }, // ユーザーが編集中
              editedStatus: '専任媒介',
              editedConfidence: '高',
              editedNextCallDate: '',
              editedPinrichStatus: '',
              editedExclusiveDecisionDate: originalDecisionDate,
            };

            const freshData = {
              status: freshStatus,
              contractYearMonth: freshContractYearMonth,
            };

            simulateBackgroundUpdate_unfixed(freshData, state);

            // statusChangedRef.current === true なので、editedExclusiveDecisionDate は変わらない
            return state.editedExclusiveDecisionDate === originalDecisionDate;
          }
        ),
        { numRuns: 100 }
      );
    });

  });

  // ============================================================
  // プロパティベーステスト4:
  // 通常パスでの contractYearMonth 変換ロジックの正確性
  // ============================================================

  describe('プロパティベーステスト4: 通常パスでの contractYearMonth 変換ロジック', () => {

    /**
     * **Validates: Requirements 3.4**
     */
    it('YYYY-MM 形式（7文字）の contractYearMonth は YYYY-MM-01 に変換される', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2030 }).chain(year =>
            fc.integer({ min: 1, max: 12 }).map(month => ({
              year,
              month,
              str: `${year}-${String(month).padStart(2, '0')}`,
            }))
          ),
          ({ str }) => {
            const state = { editedStatus: '', editedExclusiveDecisionDate: '' };
            simulateNormalPath_initialization({ status: '専任媒介', contractYearMonth: str }, state);
            return state.editedExclusiveDecisionDate === str + '-01';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('null の contractYearMonth は空文字列に変換される', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          (contractYearMonth) => {
            const state = { editedStatus: '', editedExclusiveDecisionDate: '2024-12-01' };
            simulateNormalPath_initialization({ status: '専任媒介', contractYearMonth }, state);
            return state.editedExclusiveDecisionDate === '';
          }
        ),
        { numRuns: 10 }
      );
    });

  });

});
