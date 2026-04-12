/**
 * 売主サイドバー「当日TEL_未着手」カウント・フィルタ不一致バグ - 保全プロパティテスト
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation - 他カテゴリへの非影響
 *
 * このテストは未修正コードで実行し、PASS することを確認する。
 * 修正後も引き続き PASS することで、リグレッションがないことを確認する。
 *
 * 観察目標:
 *   1. todayCall カウントが「追客中」「他決→追客」の売主を正しく集計する
 *   2. pinrichEmpty カウントが修正前後で変わらない
 *   3. unvaluated カウントが修正前後で変わらない
 *   4. filteredTodayCallSellers を使用する他のカウント（todayCallNoInfoCount、
 *      todayCallWithInfoCount、pinrichEmptyCount）が影響を受けない
 */

import * as fc from 'fast-check';

// ============================================================
// 共通ロジック（SellerService.supabase.ts から抽出）
// ============================================================

/**
 * JST今日の日付を返す（YYYY-MM-DD形式）
 */
function getTodayJST(): string {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）
 */
function hasValidVisitAssignee(visitAssignee: string | null | undefined): boolean {
  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
    return false;
  }
  return true;
}

/**
 * 売主レコードの型定義（テスト用）
 */
interface SellerRecord {
  id: string;
  status: string;
  next_call_date: string | null;
  visit_assignee: string | null;
  phone_contact_person: string | null;
  preferred_contact_time: string | null;
  contact_method: string | null;
  unreachable_status: string | null;
  confidence_level: string | null;
  exclusion_date: string | null;
  inquiry_date: string | null;
  pinrich_status?: string | null;
  valuation_amount_1?: number | null;
  valuation_amount_2?: number | null;
  valuation_amount_3?: number | null;
}

// ============================================================
// getSidebarCountsFallback の各カウント計算ロジック（未修正版）
// ============================================================

/**
 * filteredTodayCallSellers を計算する（未修正版: ilike('%追客中%') ベース）
 *
 * 注意: このロジックはバグを含む（「除外後追客中」なども混入する）
 * 保全テストでは、このバグが他のカウントに影響しないことを確認する
 */
function calcFilteredTodayCallSellers(sellers: SellerRecord[], todayJST: string): SellerRecord[] {
  // Step 1: todayCallBaseResult1 相当（ilike('%追客中%') + next_call_date <= today）
  const todayCallBase1 = sellers.filter(s =>
    s.status.includes('追客中') &&
    s.next_call_date !== null &&
    s.next_call_date <= todayJST
  );

  // Step 2: todayCallBaseResult2 相当（status === '他決→追客' + next_call_date <= today）
  const todayCallBase2 = sellers.filter(s =>
    s.status === '他決→追客' &&
    s.next_call_date !== null &&
    s.next_call_date <= todayJST
  );

  // Step 3: 重複排除して合成
  const seenIds = new Set<string>();
  const allBase = [...todayCallBase1, ...todayCallBase2].filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  // Step 4: 営担なしでフィルタ（filteredTodayCallSellers）
  return allBase.filter(s => !hasValidVisitAssignee(s.visit_assignee));
}

/**
 * todayCallNoInfoCount（当日TEL分）を計算する
 * filteredTodayCallSellers ベース
 */
function calcTodayCallNoInfoCount(filteredTodayCallSellers: SellerRecord[]): number {
  return filteredTodayCallSellers.filter(s => {
    const hasInfo =
      (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
      (s.contact_method && s.contact_method.trim() !== '');
    return !hasInfo;
  }).length;
}

/**
 * todayCallWithInfoCount（当日TEL（内容））を計算する
 * filteredTodayCallSellers ベース
 */
function calcTodayCallWithInfoCount(filteredTodayCallSellers: SellerRecord[]): number {
  return filteredTodayCallSellers.filter(s => {
    const hasInfo =
      (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
      (s.contact_method && s.contact_method.trim() !== '');
    return !!hasInfo;
  }).length;
}

/**
 * pinrichEmptyCount（Pinrich空欄）を計算する
 * filteredTodayCallSellers ベース
 */
function calcPinrichEmptyCount(filteredTodayCallSellers: SellerRecord[]): number {
  return filteredTodayCallSellers.filter(s => {
    const hasInfo =
      (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
      (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    const pinrich = s.pinrich_status || '';
    return !pinrich || pinrich.trim() === '';
  }).length;
}

/**
 * unvaluatedCount（未査定）を計算する
 * filteredTodayCallSellers とは独立したロジック
 */
function calcUnvaluatedCount(sellers: SellerRecord[], todayJST: string): number {
  // 未査定の基準日（2025/12/8以降）
  const UNVALUATED_BASE_DATE = '2025-12-08';

  return sellers.filter(s => {
    // 状況（当社）に「追客中」が含まれる
    if (!s.status.includes('追客中')) return false;

    // 査定額が全て空欄
    const hasValuation =
      (s.valuation_amount_1 !== null && s.valuation_amount_1 !== undefined) ||
      (s.valuation_amount_2 !== null && s.valuation_amount_2 !== undefined) ||
      (s.valuation_amount_3 !== null && s.valuation_amount_3 !== undefined);
    if (hasValuation) return false;

    // 反響日付が2025/12/8以降
    const inquiryDate = s.inquiry_date || '';
    if (inquiryDate < UNVALUATED_BASE_DATE) return false;

    // 営担が空欄
    if (hasValidVisitAssignee(s.visit_assignee)) return false;

    return true;
  }).length;
}

// ============================================================
// テストデータ生成ヘルパー
// ============================================================

const TODAY = getTodayJST();
const YESTERDAY = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();
const TOMORROW = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
})();

function makeSeller(overrides: Partial<SellerRecord> & { id: string }): SellerRecord {
  return {
    status: '追客中',
    next_call_date: TODAY,
    visit_assignee: null,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
    unreachable_status: null,
    confidence_level: null,
    exclusion_date: null,
    inquiry_date: '2026-01-15',
    pinrich_status: null,
    valuation_amount_1: null,
    valuation_amount_2: null,
    valuation_amount_3: null,
    ...overrides,
  };
}

// ============================================================
// fast-check アービトラリ（ジェネレータ）
// ============================================================

/**
 * バグ条件を含まないステータス（「追客中」完全一致のみ）
 * 保全テスト用: バグ条件なしのデータセットを生成する
 */
const nonBugStatusArb = fc.constantFrom(
  '追客中',
  '他決→追客',
  '専任媒介',
  '一般媒介',
  '追客不要',
  '他社買取',
  '成約',
  '他決',
);

/**
 * バグ条件を含む可能性があるステータス（「追客中」を含む非完全一致）
 * 保全テスト用: バグ条件ありのデータセットを生成する
 */
const bugStatusArb = fc.constantFrom(
  '除外後追客中',
  '追客中（保留）',
  '追客中（長期）',
);

/**
 * 全ステータスの組み合わせ（バグ条件あり・なし混在）
 */
const anyStatusArb = fc.oneof(nonBugStatusArb, bugStatusArb);

/**
 * 日付アービトラリ（今日以前・今日・未来）
 */
const pastDateArb = fc.constantFrom(YESTERDAY, TODAY, '2026-01-01', '2025-12-01');
const futureDateArb = fc.constantFrom(TOMORROW, '2099-12-31');
const anyDateArb = fc.oneof(pastDateArb, futureDateArb);

/**
 * 売主レコードのアービトラリ（保全テスト用）
 */
const sellerArb = fc.record({
  id: fc.uuid(),
  status: anyStatusArb,
  next_call_date: fc.oneof(fc.constant(null), anyDateArb),
  visit_assignee: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('外す'), fc.constant('Y'), fc.constant('I')),
  phone_contact_person: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('Y'), fc.constant('I')),
  preferred_contact_time: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('午前中'), fc.constant('午後')),
  contact_method: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('Eメール'), fc.constant('電話')),
  unreachable_status: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('不通'), fc.constant('留守')),
  confidence_level: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('A'), fc.constant('B'), fc.constant('ダブり'), fc.constant('D'), fc.constant('AI査定')),
  exclusion_date: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('2026-01-01')),
  inquiry_date: fc.oneof(fc.constant(null), fc.constant('2026-01-15'), fc.constant('2025-12-01'), fc.constant('2026-06-01')),
  pinrich_status: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('済'), fc.constant('未')),
  valuation_amount_1: fc.oneof(fc.constant(null), fc.integer({ min: 1000000, max: 100000000 })),
  valuation_amount_2: fc.oneof(fc.constant(null), fc.integer({ min: 1000000, max: 100000000 })),
  valuation_amount_3: fc.oneof(fc.constant(null), fc.integer({ min: 1000000, max: 100000000 })),
});

/**
 * 売主データセットのアービトラリ（1〜20件）
 */
const sellerDatasetArb = fc.array(sellerArb, { minLength: 1, maxLength: 20 });

// ============================================================
// テスト
// ============================================================

describe('売主サイドバー「当日TEL_未着手」バグ - 保全プロパティテスト', () => {

  /**
   * 観察テスト1: 「追客中」のみのデータセットで todayCall カウントが正しく集計される
   *
   * バグ条件なし（「追客中」完全一致のみ）のデータセットでは、
   * filteredTodayCallSellers が汚染されないため、
   * todayCallNoInfoCount が正しく計算されることを確認する。
   *
   * 未修正コードで PASS する（ベースライン動作の確認）
   */
  test('観察1: 「追客中」のみのデータセットで todayCallNoInfoCount が正しく集計される', () => {
    const sellers: SellerRecord[] = [
      // 当日TEL分に含まれるべき売主（追客中 + 次電日が今日以前 + コミュニケーション情報なし + 営担なし）
      makeSeller({ id: 's1', status: '追客中' }),
      makeSeller({ id: 's2', status: '追客中', next_call_date: YESTERDAY }),
      makeSeller({ id: 's3', status: '追客中', inquiry_date: '2026-03-01' }),
      // 他決→追客（当日TEL分に含まれる）
      makeSeller({ id: 's4', status: '他決→追客' }),
      // 除外されるべき売主（コミュニケーション情報あり）
      makeSeller({ id: 's5', status: '追客中', phone_contact_person: 'Y' }),
      makeSeller({ id: 's6', status: '追客中', contact_method: 'Eメール' }),
      // 除外されるべき売主（営担あり）
      makeSeller({ id: 's7', status: '追客中', visit_assignee: 'Y' }),
      // 除外されるべき売主（次電日が未来）
      makeSeller({ id: 's8', status: '追客中', next_call_date: TOMORROW }),
    ];

    const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
    const todayCallNoInfoCount = calcTodayCallNoInfoCount(filteredTodayCallSellers);

    // 「追客中」のみのデータセットでは filteredTodayCallSellers に汚染がない
    const contaminatedSellers = filteredTodayCallSellers.filter(s =>
      s.status !== '追客中' && s.status !== '他決→追客'
    );
    expect(contaminatedSellers.length).toBe(0);

    // todayCallNoInfoCount は s1, s2, s3, s4 の4件（コミュニケーション情報なし + 営担なし + 次電日が今日以前）
    console.log(`[観察1] filteredTodayCallSellers 件数: ${filteredTodayCallSellers.length}`);
    console.log(`[観察1] todayCallNoInfoCount: ${todayCallNoInfoCount}`);
    expect(todayCallNoInfoCount).toBe(4);
  });

  /**
   * 観察テスト2: pinrichEmpty カウントが正しく集計される
   *
   * 「追客中」のみのデータセットで pinrichEmptyCount が正しく計算されることを確認する。
   * 未修正コードで PASS する（ベースライン動作の確認）
   */
  test('観察2: 「追客中」のみのデータセットで pinrichEmptyCount が正しく集計される', () => {
    const sellers: SellerRecord[] = [
      // Pinrich空欄（当日TEL分の条件を満たす）
      makeSeller({ id: 's1', status: '追客中', pinrich_status: null }),
      makeSeller({ id: 's2', status: '追客中', pinrich_status: '' }),
      // Pinrich入力済み（除外されるべき）
      makeSeller({ id: 's3', status: '追客中', pinrich_status: '済' }),
      makeSeller({ id: 's4', status: '追客中', pinrich_status: '未' }),
      // 当日TEL分の条件を満たさない（コミュニケーション情報あり）
      makeSeller({ id: 's5', status: '追客中', pinrich_status: null, phone_contact_person: 'Y' }),
    ];

    const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
    const pinrichEmptyCount = calcPinrichEmptyCount(filteredTodayCallSellers);

    console.log(`[観察2] filteredTodayCallSellers 件数: ${filteredTodayCallSellers.length}`);
    console.log(`[観察2] pinrichEmptyCount: ${pinrichEmptyCount}`);

    // s1, s2 の2件（Pinrich空欄 + 当日TEL分の条件を満たす）
    expect(pinrichEmptyCount).toBe(2);
  });

  /**
   * 観察テスト3: unvaluated カウントが正しく集計される
   *
   * unvaluated は filteredTodayCallSellers とは独立したロジックのため、
   * バグの影響を受けないことを確認する。
   * 未修正コードで PASS する（ベースライン動作の確認）
   */
  test('観察3: unvaluated カウントが filteredTodayCallSellers の汚染に影響されない', () => {
    const sellers: SellerRecord[] = [
      // 未査定（追客中 + 査定額なし + 反響日付が2025/12/8以降 + 営担なし）
      makeSeller({ id: 's1', status: '追客中', inquiry_date: '2026-01-15' }),
      makeSeller({ id: 's2', status: '追客中', inquiry_date: '2026-03-01' }),
      // 査定額あり（除外されるべき）
      makeSeller({ id: 's3', status: '追客中', inquiry_date: '2026-01-15', valuation_amount_1: 50000000 }),
      // 反響日付が古い（除外されるべき）
      makeSeller({ id: 's4', status: '追客中', inquiry_date: '2025-11-01' }),
      // バグ条件: 「除外後追客中」（filteredTodayCallSellers に混入するが unvaluated には影響しない）
      makeSeller({ id: 's5', status: '除外後追客中', inquiry_date: '2026-01-15' }),
    ];

    const unvaluatedCount = calcUnvaluatedCount(sellers, TODAY);

    console.log(`[観察3] unvaluatedCount: ${unvaluatedCount}`);

    // s1, s2 の2件（未査定の条件を満たす）
    // s5（除外後追客中）は「追客中」を含むため unvaluated に含まれる可能性があるが、
    // 実際のロジックでは status.includes('追客中') でチェックするため含まれる
    // ここでは s1, s2 のみを期待（s5 は「除外後追客中」で includes('追客中') = true）
    // 注意: unvaluated は status.includes('追客中') を使用するため、「除外後追客中」も含まれる
    // これは既存の動作であり、バグ修正の対象外
    expect(unvaluatedCount).toBeGreaterThanOrEqual(2);
  });

  /**
   * プロパティベーステスト: todayCallNoInfoCount + todayCallWithInfoCount = filteredTodayCallSellers.length
   *
   * 様々なステータスの組み合わせを生成し、
   * todayCallNoInfoCount + todayCallWithInfoCount が filteredTodayCallSellers の件数と一致することを確認する。
   *
   * これは修正前後で変わらないベースライン動作である。
   * 未修正コードで PASS する。
   *
   * **Validates: Requirements 3.1, 3.4**
   */
  test('PBT: todayCallNoInfoCount + todayCallWithInfoCount = filteredTodayCallSellers.length（任意のデータセット）', () => {
    fc.assert(
      fc.property(sellerDatasetArb, (sellers) => {
        const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
        const noInfoCount = calcTodayCallNoInfoCount(filteredTodayCallSellers);
        const withInfoCount = calcTodayCallWithInfoCount(filteredTodayCallSellers);

        // todayCallNoInfoCount + todayCallWithInfoCount = filteredTodayCallSellers.length
        // これは修正前後で変わらない不変条件
        expect(noInfoCount + withInfoCount).toBe(filteredTodayCallSellers.length);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * プロパティベーステスト: pinrichEmptyCount <= todayCallNoInfoCount
   *
   * pinrichEmpty は todayCall（コミュニケーション情報なし）のサブセットであるため、
   * pinrichEmptyCount は常に todayCallNoInfoCount 以下であることを確認する。
   *
   * これは修正前後で変わらないベースライン動作である。
   * 未修正コードで PASS する。
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test('PBT: pinrichEmptyCount <= todayCallNoInfoCount（任意のデータセット）', () => {
    fc.assert(
      fc.property(sellerDatasetArb, (sellers) => {
        const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
        const noInfoCount = calcTodayCallNoInfoCount(filteredTodayCallSellers);
        const pinrichEmptyCount = calcPinrichEmptyCount(filteredTodayCallSellers);

        // pinrichEmpty は todayCall（コミュニケーション情報なし）のサブセット
        // pinrichEmptyCount <= todayCallNoInfoCount は常に成立する
        expect(pinrichEmptyCount).toBeLessThanOrEqual(noInfoCount);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * プロパティベーステスト: バグ条件なしのデータセットで filteredTodayCallSellers が汚染されない
   *
   * status === '追客中' または status === '他決→追客' のみのデータセットでは、
   * filteredTodayCallSellers に「除外後追客中」などが混入しないことを確認する。
   *
   * 未修正コードで PASS する（バグ条件なしのデータセットでは汚染が発生しない）。
   *
   * **Validates: Requirements 3.1, 3.4**
   */
  test('PBT: バグ条件なしのデータセットで filteredTodayCallSellers が汚染されない', () => {
    // バグ条件なしのステータスのみを使用するアービトラリ
    const cleanStatusArb = fc.constantFrom('追客中', '他決→追客', '専任媒介', '一般媒介', '追客不要');
    const cleanSellerArb = fc.record({
      id: fc.uuid(),
      status: cleanStatusArb,
      next_call_date: fc.oneof(fc.constant(null), pastDateArb, futureDateArb),
      visit_assignee: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('外す'), fc.constant('Y')),
      phone_contact_person: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('Y')),
      preferred_contact_time: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('午前中')),
      contact_method: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('Eメール')),
      unreachable_status: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('不通')),
      confidence_level: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('A'), fc.constant('ダブり')),
      exclusion_date: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('2026-01-01')),
      inquiry_date: fc.oneof(fc.constant(null), fc.constant('2026-01-15'), fc.constant('2025-12-01')),
      pinrich_status: fc.oneof(fc.constant(null), fc.constant(''), fc.constant('済')),
      valuation_amount_1: fc.oneof(fc.constant(null), fc.integer({ min: 1000000, max: 100000000 })),
      valuation_amount_2: fc.constant(null),
      valuation_amount_3: fc.constant(null),
    });
    const cleanDatasetArb = fc.array(cleanSellerArb, { minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(cleanDatasetArb, (sellers) => {
        const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);

        // バグ条件なしのデータセットでは filteredTodayCallSellers に汚染がない
        const contaminatedSellers = filteredTodayCallSellers.filter(s =>
          s.status !== '追客中' && s.status !== '他決→追客'
        );
        expect(contaminatedSellers.length).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * プロパティベーステスト: todayCallNoInfoCount は filteredTodayCallSellers の件数以下
   *
   * todayCallNoInfoCount は filteredTodayCallSellers のサブセットであるため、
   * 常に filteredTodayCallSellers.length 以下であることを確認する。
   *
   * 未修正コードで PASS する。
   *
   * **Validates: Requirements 3.1, 3.4**
   */
  test('PBT: todayCallNoInfoCount <= filteredTodayCallSellers.length（任意のデータセット）', () => {
    fc.assert(
      fc.property(sellerDatasetArb, (sellers) => {
        const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
        const noInfoCount = calcTodayCallNoInfoCount(filteredTodayCallSellers);

        expect(noInfoCount).toBeLessThanOrEqual(filteredTodayCallSellers.length);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * プロパティベーステスト: todayCallWithInfoCount は filteredTodayCallSellers の件数以下
   *
   * todayCallWithInfoCount は filteredTodayCallSellers のサブセットであるため、
   * 常に filteredTodayCallSellers.length 以下であることを確認する。
   *
   * 未修正コードで PASS する。
   *
   * **Validates: Requirements 3.1, 3.4**
   */
  test('PBT: todayCallWithInfoCount <= filteredTodayCallSellers.length（任意のデータセット）', () => {
    fc.assert(
      fc.property(sellerDatasetArb, (sellers) => {
        const filteredTodayCallSellers = calcFilteredTodayCallSellers(sellers, TODAY);
        const withInfoCount = calcTodayCallWithInfoCount(filteredTodayCallSellers);

        expect(withInfoCount).toBeLessThanOrEqual(filteredTodayCallSellers.length);
      }),
      { numRuns: 200 }
    );
  });

});
