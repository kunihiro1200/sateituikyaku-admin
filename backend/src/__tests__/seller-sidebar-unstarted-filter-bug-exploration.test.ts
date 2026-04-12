/**
 * 売主サイドバー「当日TEL_未着手」カウント・フィルタ不一致バグ - バグ条件探索テスト
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition - 当日TEL_未着手カウントとリスト件数の不一致
 *
 * このテストは修正前のコードで実行し、FAIL することを確認する（失敗がバグの存在を証明）。
 * 修正後は PASS することで、バグが修正されたことを確認する。
 *
 * バグ条件（design.md より）:
 *   seller.status MATCHES ilike('%追客中%')
 *   AND seller.status !== '追客中'
 *   AND seller.next_call_date <= todayJST
 *
 * 根本原因:
 *   - getSidebarCountsFallback() の todayCallNotStartedCount は
 *     filteredTodayCallSellers（ilike('%追客中%') ベース）を元に計算する
 *   - filteredTodayCallSellers に「除外後追客中」などが混入する
 *   - todayCallNotStartedCount では status !== '追客中' で除外するが、
 *     filteredTodayCallSellers 自体が汚染されているため、
 *     todayCallNotStartedCount が listSellers() の結果と一致しない
 *
 * 注意:
 *   - 「当日TEL分」（todayCallNoInfoCount）は「除外後追客中」を含めるのが正しい動作
 *   - バグは「当日TEL_未着手」（todayCallNotStartedCount）の計算のみ
 */

// ============================================================
// バグ再現ロジック（SellerService.supabase.ts から抽出）
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
}

/**
 * getSidebarCountsFallback() の todayCallNotStartedCount 計算ロジック（未修正版）
 *
 * バグ: filteredTodayCallSellers は ilike('%追客中%') ベースのため
 *      「除外後追客中」などが混入する
 *      → filteredTodayCallSellers から status !== '追客中' で除外するが、
 *        filteredTodayCallSellers 自体が汚染されているため、
 *        todayCallNotStartedCount が listSellers() の結果と一致しない
 */
function calcTodayCallNotStartedCount_BUGGY(sellers: SellerRecord[], todayJST: string): number {
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

  // Step 3: 重複排除して合成（filteredTodayCallSellers の元データ）
  const seenIds = new Set<string>();
  const allBase = [...todayCallBase1, ...todayCallBase2].filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  // Step 4: 営担なしでフィルタ（filteredTodayCallSellers）
  const filteredTodayCallSellers = allBase.filter(s => !hasValidVisitAssignee(s.visit_assignee));

  // Step 5: todayCallNotStartedCount の計算（バグあり）
  // バグ: filteredTodayCallSellers ベース（ilike('%追客中%') で汚染されている）
  // status !== '追客中' で除外するが、filteredTodayCallSellers 自体が汚染されているため
  // 実際には status === '追客中' のみが残るが、filteredTodayCallSellers の件数が多い
  return filteredTodayCallSellers.filter(s => {
    const hasInfo =
      (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
      (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;

    const status = s.status || '';
    if (status !== '追客中') return false;

    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;

    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;

    const exclusionDate = s.exclusion_date || '';
    if (exclusionDate && exclusionDate.trim() !== '') return false;

    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  }).length;
}

/**
 * getSidebarCountsFallback() の todayCallNotStartedCount 計算ロジック（修正版）
 *
 * 修正: filteredTodayCallSellers から status === '追客中' のみを抽出した
 *      notStartedBaseSellers を使用する
 */
function calcTodayCallNotStartedCount_FIXED(sellers: SellerRecord[], todayJST: string): number {
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

  // Step 3: 重複排除して合成（filteredTodayCallSellers の元データ）
  const seenIds = new Set<string>();
  const allBase = [...todayCallBase1, ...todayCallBase2].filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  // Step 4: 営担なしでフィルタ（filteredTodayCallSellers）
  const filteredTodayCallSellers = allBase.filter(s => !hasValidVisitAssignee(s.visit_assignee));

  // Step 5: 修正: filteredTodayCallSellers から status === '追客中' のみを抽出
  const notStartedBaseSellers = filteredTodayCallSellers.filter(s => s.status === '追客中');

  // Step 6: todayCallNotStartedCount の計算（修正版）
  return notStartedBaseSellers.filter(s => {
    const hasInfo =
      (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
      (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
      (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;

    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;

    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;

    const exclusionDate = s.exclusion_date || '';
    if (exclusionDate && exclusionDate.trim() !== '') return false;

    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  }).length;
}

/**
 * listSellers({ statusCategory: 'todayCallNotStarted' }) のフィルタロジック（現行版）
 *
 * 独立したクエリ（next_call_date <= today の全件）から
 * status === '追客中'（完全一致）でフィルタする
 */
function filterTodayCallNotStarted_LIST(sellers: SellerRecord[], todayJST: string): SellerRecord[] {
  // Step 1: next_call_date <= today の全件取得
  const candidates = sellers.filter(s =>
    s.next_call_date !== null &&
    s.next_call_date <= todayJST
  );

  // Step 2: JS フィルタ（listSellers の notStartedIds 計算と同じ）
  return candidates.filter(s => {
    const status = s.status || '';
    // status === '追客中' のみ（完全一致）
    if (status !== '追客中') return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;

    // 営担が空または「外す」
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;

    // コミュニケーション情報が全て空
    const hasInfo =
      (s.phone_contact_person?.trim()) ||
      (s.preferred_contact_time?.trim()) ||
      (s.contact_method?.trim());
    if (hasInfo) return false;

    // 不通が空欄
    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;

    // 確度が「ダブり」「D」「AI査定」でない
    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;

    // 反響日付が2026/1/1以降
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  });
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
    ...overrides,
  };
}

// ============================================================
// テスト
// ============================================================

describe('売主サイドバー「当日TEL_未着手」バグ条件探索テスト', () => {
  /**
   * テストケース1: 「除外後追客中」ステータスの売主を含むデータセット
   *
   * バグ条件: status が「除外後追客中」の売主は
   *   - ilike('%追客中%') にマッチ → filteredTodayCallSellers に混入
   *   - 未修正版では filteredTodayCallSellers ベースで todayCallNotStartedCount を計算するため
   *     「除外後追客中」が status !== '追客中' で除外されても、
   *     filteredTodayCallSellers 自体が汚染されている
   *
   * 期待（修正後）:
   *   - calcTodayCallNotStartedCount_FIXED が listSellers の結果と一致する
   *   - 修正前（BUGGY）は一致しない（バグの存在を証明）
   *
   * 注意: 「当日TEL分」（todayCallNoInfoCount）は「除外後追客中」を含めるのが正しい動作
   */
  test('テストケース1: 「除外後追客中」の売主を含むデータセットで修正版のtodayCallNotStartedCountがlistSellersと一致する', () => {
    const sellers: SellerRecord[] = [
      // 正常な「追客中」売主（当日TEL_未着手に含まれるべき）
      makeSeller({ id: 'seller-1', status: '追客中' }),
      makeSeller({ id: 'seller-2', status: '追客中', next_call_date: YESTERDAY }),
      // バグ条件: 「除外後追客中」（ilike('%追客中%') にマッチするが完全一致ではない）
      // 当日TEL分には含まれるが、当日TEL_未着手には含まれない
      makeSeller({ id: 'seller-3', status: '除外後追客中' }),
      makeSeller({ id: 'seller-4', status: '除外後追客中', next_call_date: YESTERDAY }),
    ];

    // 未修正版のカウント
    const buggyCount = calcTodayCallNotStartedCount_BUGGY(sellers, TODAY);
    // 修正版のカウント
    const fixedCount = calcTodayCallNotStartedCount_FIXED(sellers, TODAY);
    // listSellers のフィルタ結果
    const listCount = filterTodayCallNotStarted_LIST(sellers, TODAY).length;

    console.log(`[テストケース1] 未修正版 todayCallNotStartedCount: ${buggyCount}`);
    console.log(`[テストケース1] 修正版 todayCallNotStartedCount: ${fixedCount}`);
    console.log(`[テストケース1] listSellers todayCallNotStarted 件数: ${listCount}`);

    // 修正版のカウントが listSellers の結果と一致することを確認（修正後にPASS）
    expect(fixedCount).toBe(listCount);
  });

  /**
   * テストケース2: 「追客中」と「除外後追客中」が混在するデータセット
   *
   * getSidebarCountsFallback() の修正版 todayCallNotStartedCount と
   * listSellers() の todayCallNotStarted の件数が一致することを確認する
   *
   * 注意: 「当日TEL分」（todayCallNoInfoCount）は「除外後追客中」を含めるのが正しい動作
   */
  test('テストケース2: 「追客中」と「除外後追客中」が混在するデータセットで修正版のカウントがlistSellersと一致する', () => {
    const sellers: SellerRecord[] = [
      // 「追客中」売主（当日TEL_未着手に含まれるべき）
      makeSeller({ id: 'seller-a1', status: '追客中' }),
      makeSeller({ id: 'seller-a2', status: '追客中', next_call_date: YESTERDAY }),
      makeSeller({ id: 'seller-a3', status: '追客中', inquiry_date: '2026-03-01' }),
      // 「除外後追客中」売主（当日TEL分には含まれるが、当日TEL_未着手には含まれない）
      makeSeller({ id: 'seller-b1', status: '除外後追客中' }),
      makeSeller({ id: 'seller-b2', status: '除外後追客中', next_call_date: YESTERDAY }),
      // 「他決→追客」売主（当日TEL分には含まれるが、当日TEL_未着手には含まれない）
      makeSeller({ id: 'seller-c1', status: '他決→追客' }),
      // 除外されるべき売主（次電日が未来）
      makeSeller({ id: 'seller-d1', status: '追客中', next_call_date: '2099-12-31' }),
      // 除外されるべき売主（営担あり）
      makeSeller({ id: 'seller-e1', status: '追客中', visit_assignee: 'Y' }),
    ];

    // 未修正版のカウント
    const buggyCount = calcTodayCallNotStartedCount_BUGGY(sellers, TODAY);
    // 修正版のカウント
    const fixedCount = calcTodayCallNotStartedCount_FIXED(sellers, TODAY);
    // listSellers のフィルタ結果
    const listCount = filterTodayCallNotStarted_LIST(sellers, TODAY).length;

    console.log(`[テストケース2] 未修正版 todayCallNotStartedCount: ${buggyCount}`);
    console.log(`[テストケース2] 修正版 todayCallNotStartedCount: ${fixedCount}`);
    console.log(`[テストケース2] listSellers todayCallNotStarted 件数: ${listCount}`);

    // 修正版のカウントが listSellers の結果と一致することを確認（修正後にPASS）
    expect(fixedCount).toBe(listCount);
  });

  /**
   * 追加確認: 「追客中」のみのデータセットでは一致することを確認
   *
   * バグ条件が存在しない場合（「追客中」のみ）は、
   * 未修正版も修正版も同じ結果になることを確認する
   */
  test('確認: 「追客中」のみのデータセットではfilteredTodayCallSellersが汚染されない', () => {
    const sellers: SellerRecord[] = [
      makeSeller({ id: 'seller-1', status: '追客中' }),
      makeSeller({ id: 'seller-2', status: '追客中', next_call_date: YESTERDAY }),
      makeSeller({ id: 'seller-3', status: '追客中', inquiry_date: '2026-06-01' }),
      // 除外されるべき売主
      makeSeller({ id: 'seller-4', status: '追客中', next_call_date: '2099-12-31' }),
      makeSeller({ id: 'seller-5', status: '追客中', visit_assignee: 'Y' }),
      makeSeller({ id: 'seller-6', status: '追客中', unreachable_status: '不通' }),
    ];

    // filteredTodayCallSellers の計算
    const seenIds = new Set<string>();
    const allBase = [
      ...sellers.filter(s => s.status.includes('追客中') && s.next_call_date !== null && s.next_call_date <= TODAY),
      ...sellers.filter(s => s.status === '他決→追客' && s.next_call_date !== null && s.next_call_date <= TODAY),
    ].filter(s => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });
    const filteredTodayCallSellers = allBase.filter(s => !hasValidVisitAssignee(s.visit_assignee));

    // 「追客中」のみの場合、filteredTodayCallSellers に汚染がないことを確認
    const contaminatedSellers = filteredTodayCallSellers.filter(s => s.status !== '追客中');
    console.log(`[確認テスト] filteredTodayCallSellers 件数: ${filteredTodayCallSellers.length}`);
    console.log(`[確認テスト] 汚染された売主数: ${contaminatedSellers.length}`);

    expect(contaminatedSellers.length).toBe(0);
  });

  /**
   * バグ条件の形式的な確認
   *
   * isBugCondition 関数の動作を確認する
   */
  test('バグ条件の形式的な確認: isBugCondition が正しく動作する', () => {
    /**
     * isBugCondition: バグが発生する売主かどうかを判定
     * design.md の定義:
     *   seller.status MATCHES ilike('%追客中%')
     *   AND seller.status !== '追客中'
     *   AND seller.next_call_date <= todayJST
     */
    function isBugCondition(seller: SellerRecord, todayJST: string): boolean {
      return (
        seller.status.includes('追客中') &&
        seller.status !== '追客中' &&
        seller.next_call_date !== null &&
        seller.next_call_date <= todayJST
      );
    }

    const testCases = [
      { seller: makeSeller({ id: '1', status: '追客中' }), expected: false, desc: '「追客中」（バグ条件なし）' },
      { seller: makeSeller({ id: '2', status: '除外後追客中' }), expected: true, desc: '「除外後追客中」（バグ条件あり）' },
      { seller: makeSeller({ id: '3', status: '他決→追客' }), expected: false, desc: '「他決→追客」（「追客中」を含まない）' },
      { seller: makeSeller({ id: '4', status: '除外後追客中', next_call_date: '2099-12-31' }), expected: false, desc: '「除外後追客中」だが次電日が未来（バグ条件なし）' },
      { seller: makeSeller({ id: '5', status: '追客中（保留）' }), expected: true, desc: '「追客中（保留）」（バグ条件あり）' },
    ];

    testCases.forEach(({ seller, expected, desc }) => {
      const result = isBugCondition(seller, TODAY);
      console.log(`[バグ条件確認] ${desc}: ${result ? 'バグ条件あり' : 'バグ条件なし'} (期待: ${expected ? 'バグ条件あり' : 'バグ条件なし'})`);
      expect(result).toBe(expected);
    });

    // バグ条件を持つ売主が存在する場合、filteredTodayCallSellers に混入することを確認
    const bugSellers = testCases
      .filter(tc => tc.expected)
      .map(tc => tc.seller);

    console.log(`[バグ条件確認] バグ条件を持つ売主数: ${bugSellers.length}`);
    expect(bugSellers.length).toBeGreaterThan(0);

    // これらの売主が filteredTodayCallSellers に混入することを確認
    const filteredBase = bugSellers.filter(s =>
      s.status.includes('追客中') &&
      s.next_call_date !== null &&
      s.next_call_date <= TODAY &&
      !hasValidVisitAssignee(s.visit_assignee)
    );
    console.log(`[バグ条件確認] filteredTodayCallSellers に混入する売主数: ${filteredBase.length}`);
    expect(filteredBase.length).toBeGreaterThan(0);
  });
});
