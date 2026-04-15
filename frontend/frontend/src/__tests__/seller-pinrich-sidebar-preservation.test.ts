/**
 * Preservation Property Test
 *
 * Property 2: Preservation - 既存カテゴリの動作保持
 *
 * 観察優先メソドロジーに従い、未修正コードで既存カテゴリの動作を観察する。
 * このテストは未修正コードで PASS すること（ベースラインの動作を確認する）。
 *
 * 保全要件（design.md の Preservation Requirements より）:
 *   - pinrichEmpty カテゴリ: pinrich_status が空欄の売主が正しくカウントされる
 *   - todayCall カテゴリ: 当日TEL対象の売主が正しくカウントされる
 *   - exclusive カテゴリ: 専任媒介の売主が正しくカウントされる
 *   - general カテゴリ: 一般媒介の売主が正しくカウントされる
 *   - pinrichChangeRequired 条件に関係しない全ての売主に対して、
 *     既存カテゴリのカウントが変わらないことを検証する
 *
 * 期待される結果: テスト PASS（ベースラインの動作を確認する）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import * as fc from 'fast-check';
import {
  isPinrichEmpty,
  isTodayCall,
  isExclusive,
  isGeneral,
  filterSellersByCategory,
  getCategoryCounts,
} from '../utils/sellerStatusFilters';

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 今日の日付文字列を返す（YYYY-MM-DD形式）
 */
const getTodayStr = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const jstDate = new Date(utcMs + jstOffset * 60 * 1000);
  return `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
};

/**
 * 昨日の日付文字列を返す（YYYY-MM-DD形式）
 */
const getYesterdayStr = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const jstDate = new Date(utcMs + jstOffset * 60 * 1000);
  jstDate.setDate(jstDate.getDate() - 1);
  return `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
};

/**
 * 明日の日付文字列を返す（YYYY-MM-DD形式）
 */
const getTomorrowStr = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const jstDate = new Date(utcMs + jstOffset * 60 * 1000);
  jstDate.setDate(jstDate.getDate() + 1);
  return `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
};

/**
 * 当日TEL分の基本条件を満たす売主データを生成する
 * （追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）
 */
const makeTodayCallSeller = (overrides: Record<string, any> = {}) => ({
  seller_number: 'TEST001',
  status: '追客中',
  next_call_date: getTodayStr(),
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  visit_assignee: '',
  pinrich_status: '',
  confidence_level: '',
  visit_date: null,
  contract_year_month: null,
  exclusive_other_decision_meeting: '',
  ...overrides,
});

/**
 * 専任カテゴリの基本条件を満たす売主データを生成する
 */
const makeExclusiveSeller = (overrides: Record<string, any> = {}) => ({
  seller_number: 'TEST002',
  status: '専任媒介',
  next_call_date: getTomorrowStr(), // 今日以外
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  visit_assignee: '',
  pinrich_status: '',
  confidence_level: '',
  visit_date: null,
  contract_year_month: null,
  exclusive_other_decision_meeting: '', // 「完了」以外
  ...overrides,
});

/**
 * 一般カテゴリの基本条件を満たす売主データを生成する
 */
const makeGeneralSeller = (overrides: Record<string, any> = {}) => ({
  seller_number: 'TEST003',
  status: '一般媒介',
  next_call_date: getTomorrowStr(), // 今日以外
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  visit_assignee: '',
  pinrich_status: '',
  confidence_level: '',
  visit_date: null,
  contract_year_month: '2025-07-01', // 2025/6/23以降
  exclusive_other_decision_meeting: '', // 「完了」以外
  ...overrides,
});

// ============================================================
// テストケース1: pinrichEmpty カテゴリの動作確認
// ============================================================
describe('Preservation Test - pinrichEmpty カテゴリの動作保持', () => {
  it('pinrich_status が空欄の当日TEL分売主は isPinrichEmpty が true を返す', () => {
    const seller = makeTodayCallSeller({ pinrich_status: '' });
    expect(isPinrichEmpty(seller)).toBe(true);
  });

  it('pinrich_status が null の当日TEL分売主は isPinrichEmpty が true を返す', () => {
    const seller = makeTodayCallSeller({ pinrich_status: null });
    expect(isPinrichEmpty(seller)).toBe(true);
  });

  it('pinrich_status に値がある当日TEL分売主は isPinrichEmpty が false を返す', () => {
    const seller = makeTodayCallSeller({ pinrich_status: '配信中' });
    expect(isPinrichEmpty(seller)).toBe(false);
  });

  it('pinrich_status が「クローズ」の当日TEL分売主は isPinrichEmpty が false を返す', () => {
    const seller = makeTodayCallSeller({ pinrich_status: 'クローズ' });
    expect(isPinrichEmpty(seller)).toBe(false);
  });

  it('当日TEL分の条件を満たさない売主は isPinrichEmpty が false を返す（追客中でない）', () => {
    const seller = makeTodayCallSeller({
      status: '専任媒介',
      pinrich_status: '',
    });
    expect(isPinrichEmpty(seller)).toBe(false);
  });

  it('filterSellersByCategory(sellers, "pinrichEmpty") が pinrich_status 空欄の当日TEL分売主のみを返す', () => {
    const pinrichEmptySeller = makeTodayCallSeller({
      seller_number: 'AA00001',
      pinrich_status: '',
    });
    const pinrichFilledSeller = makeTodayCallSeller({
      seller_number: 'AA00002',
      pinrich_status: '配信中',
    });
    const nonTodayCallSeller = makeTodayCallSeller({
      seller_number: 'AA00003',
      status: '専任媒介',
      pinrich_status: '',
    });

    const sellers = [pinrichEmptySeller, pinrichFilledSeller, nonTodayCallSeller];
    const result = filterSellersByCategory(sellers, 'pinrichEmpty');

    expect(result).toHaveLength(1);
    expect(result[0].seller_number).toBe('AA00001');
  });
});

// ============================================================
// テストケース2: todayCall カテゴリの動作確認
// ============================================================
describe('Preservation Test - todayCall カテゴリの動作保持', () => {
  it('追客中 + 次電日が今日以前 + コミュニケーション情報なし + 営担なし → isTodayCall が true', () => {
    const seller = makeTodayCallSeller();
    expect(isTodayCall(seller)).toBe(true);
  });

  it('追客中 + 次電日が昨日 + コミュニケーション情報なし + 営担なし → isTodayCall が true', () => {
    const seller = makeTodayCallSeller({ next_call_date: getYesterdayStr() });
    expect(isTodayCall(seller)).toBe(true);
  });

  it('追客中 + 次電日が明日 → isTodayCall が false', () => {
    const seller = makeTodayCallSeller({ next_call_date: getTomorrowStr() });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('追客中 + 次電日が今日以前 + コミュニケーション情報あり → isTodayCall が false', () => {
    const seller = makeTodayCallSeller({ contact_method: 'Eメール' });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('追客中 + 次電日が今日以前 + 営担あり → isTodayCall が false', () => {
    const seller = makeTodayCallSeller({ visit_assignee: 'Y' });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('営担が「外す」の場合は当日TEL分に含まれる（担当なし扱い）', () => {
    const seller = makeTodayCallSeller({ visit_assignee: '外す' });
    expect(isTodayCall(seller)).toBe(true);
  });

  it('filterSellersByCategory(sellers, "todayCall") が当日TEL分の売主のみを返す', () => {
    const todayCallSeller = makeTodayCallSeller({ seller_number: 'AA10001' });
    const withContactInfoSeller = makeTodayCallSeller({
      seller_number: 'AA10002',
      contact_method: 'Eメール',
    });
    const withAssigneeSeller = makeTodayCallSeller({
      seller_number: 'AA10003',
      visit_assignee: 'Y',
    });

    const sellers = [todayCallSeller, withContactInfoSeller, withAssigneeSeller];
    const result = filterSellersByCategory(sellers, 'todayCall');

    // todayCallNotStarted の条件（unreachable_status が空 + inquiry_date が2026/1/1以降）を
    // 満たす場合は todayCall から除外されるが、ここでは inquiry_date が未設定なので含まれる
    expect(result.some(s => s.seller_number === 'AA10001')).toBe(true);
    expect(result.some(s => s.seller_number === 'AA10002')).toBe(false);
    expect(result.some(s => s.seller_number === 'AA10003')).toBe(false);
  });
});

// ============================================================
// テストケース3: exclusive カテゴリの動作確認
// ============================================================
describe('Preservation Test - exclusive カテゴリの動作保持', () => {
  it('専任媒介 + 次電日が今日以外 + 専任他決打合せが完了以外 → isExclusive が true', () => {
    const seller = makeExclusiveSeller();
    expect(isExclusive(seller)).toBe(true);
  });

  it('他決→専任 → isExclusive が true', () => {
    const seller = makeExclusiveSeller({ status: '他決→専任' });
    expect(isExclusive(seller)).toBe(true);
  });

  it('リースバック（専任） → isExclusive が true', () => {
    const seller = makeExclusiveSeller({ status: 'リースバック（専任）' });
    expect(isExclusive(seller)).toBe(true);
  });

  it('専任他決打合せが「完了」の場合は isExclusive が false', () => {
    const seller = makeExclusiveSeller({ exclusive_other_decision_meeting: '完了' });
    expect(isExclusive(seller)).toBe(false);
  });

  it('次電日が今日の場合は isExclusive が false', () => {
    const seller = makeExclusiveSeller({ next_call_date: getTodayStr() });
    expect(isExclusive(seller)).toBe(false);
  });

  it('一般媒介は isExclusive が false', () => {
    const seller = makeExclusiveSeller({ status: '一般媒介' });
    expect(isExclusive(seller)).toBe(false);
  });

  it('filterSellersByCategory(sellers, "exclusive") が専任カテゴリの売主のみを返す', () => {
    const exclusiveSeller = makeExclusiveSeller({ seller_number: 'AA20001' });
    const generalSeller = makeGeneralSeller({ seller_number: 'AA20002' });
    const todayCallSeller = makeTodayCallSeller({ seller_number: 'AA20003' });

    const sellers = [exclusiveSeller, generalSeller, todayCallSeller];
    const result = filterSellersByCategory(sellers, 'exclusive');

    expect(result).toHaveLength(1);
    expect(result[0].seller_number).toBe('AA20001');
  });
});

// ============================================================
// テストケース4: general カテゴリの動作確認
// ============================================================
describe('Preservation Test - general カテゴリの動作保持', () => {
  it('一般媒介 + 次電日が今日以外 + 専任他決打合せが完了以外 + 契約年月が2025/6/23以降 → isGeneral が true', () => {
    const seller = makeGeneralSeller();
    expect(isGeneral(seller)).toBe(true);
  });

  it('一般媒介 + 契約年月が2025/6/23より前 → isGeneral が false', () => {
    const seller = makeGeneralSeller({ contract_year_month: '2025-06-22' });
    expect(isGeneral(seller)).toBe(false);
  });

  it('一般媒介 + 契約年月が2025/6/23 → isGeneral が true', () => {
    const seller = makeGeneralSeller({ contract_year_month: '2025-06-23' });
    expect(isGeneral(seller)).toBe(true);
  });

  it('専任媒介は isGeneral が false', () => {
    const seller = makeGeneralSeller({ status: '専任媒介' });
    expect(isGeneral(seller)).toBe(false);
  });

  it('専任他決打合せが「完了」の場合は isGeneral が false', () => {
    const seller = makeGeneralSeller({ exclusive_other_decision_meeting: '完了' });
    expect(isGeneral(seller)).toBe(false);
  });

  it('次電日が今日の場合は isGeneral が false', () => {
    const seller = makeGeneralSeller({ next_call_date: getTodayStr() });
    expect(isGeneral(seller)).toBe(false);
  });

  it('filterSellersByCategory(sellers, "general") が一般カテゴリの売主のみを返す', () => {
    const generalSeller = makeGeneralSeller({ seller_number: 'AA30001' });
    const exclusiveSeller = makeExclusiveSeller({ seller_number: 'AA30002' });
    const todayCallSeller = makeTodayCallSeller({ seller_number: 'AA30003' });

    const sellers = [generalSeller, exclusiveSeller, todayCallSeller];
    const result = filterSellersByCategory(sellers, 'general');

    expect(result).toHaveLength(1);
    expect(result[0].seller_number).toBe('AA30001');
  });
});

// ============================================================
// テストケース5: getCategoryCounts の動作確認
// ============================================================
describe('Preservation Test - getCategoryCounts の動作保持', () => {
  it('getCategoryCounts が既存カテゴリのカウントを正しく返す', () => {
    const sellers = [
      makeTodayCallSeller({ seller_number: 'AA40001', pinrich_status: '' }),
      makeTodayCallSeller({ seller_number: 'AA40002', pinrich_status: '配信中' }),
      makeExclusiveSeller({ seller_number: 'AA40003' }),
      makeGeneralSeller({ seller_number: 'AA40004' }),
    ];

    const counts = getCategoryCounts(sellers);

    // 全件
    expect(counts.all).toBe(4);
    // pinrichEmpty: 当日TEL分かつpinrich_statusが空欄 → AA40001のみ
    expect(counts.pinrichEmpty).toBe(1);
    // exclusive: AA40003のみ
    expect(counts.exclusive).toBe(1);
    // general: AA40004のみ
    expect(counts.general).toBe(1);
  });
});

// ============================================================
// テストケース6: PBT - pinrichChangeRequired 条件に関係しない売主の保持
// ============================================================
describe('Preservation Property Test - pinrichChangeRequired 条件に関係しない売主の保持', () => {
  /**
   * Property 2: Preservation
   *
   * pinrichChangeRequired 条件に関係しない売主（当日TEL分 + pinrich_status 空欄）に対して、
   * filterSellersByCategory(sellers, 'pinrichEmpty') が常に正しい結果を返すことを検証する。
   *
   * **Validates: Requirements 3.1, 3.5**
   */
  it('PBT: pinrich_status が空欄の当日TEL分売主は常に pinrichEmpty カテゴリに含まれる', () => {
    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    fc.assert(
      fc.property(
        // 当日TEL分の条件を満たす売主データを生成
        fc.record({
          seller_number: fc.string({ minLength: 1, maxLength: 10 }),
          // 次電日は今日または昨日（今日以前）
          next_call_date: fc.constantFrom(todayStr, yesterdayStr),
          // コミュニケーション情報は全て空
          contact_method: fc.constant(''),
          preferred_contact_time: fc.constant(''),
          phone_contact_person: fc.constant(''),
          // 営担は空（「外す」も含む）
          visit_assignee: fc.constantFrom('', '外す'),
          // pinrich_status は空欄
          pinrich_status: fc.constant(''),
          // 追客中系のステータス
          status: fc.constantFrom('追客中', '除外後追客中', '他決→追客'),
        }),
        (seller) => {
          const result = filterSellersByCategory([seller], 'pinrichEmpty');
          // pinrich_status が空欄の当日TEL分売主は必ず pinrichEmpty に含まれる
          return result.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Preservation
   *
   * pinrich_status に値がある売主は pinrichEmpty カテゴリに含まれないことを検証する。
   *
   * **Validates: Requirements 3.1**
   */
  it('PBT: pinrich_status に値がある売主は pinrichEmpty カテゴリに含まれない', () => {
    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    // pinrich_status の有効な値リスト
    const pinrichValues = ['配信中', 'クローズ', '登録不要', 'アドレスエラー', '配信不要（他決後、訪問後、担当付）', '△配信停止'];

    fc.assert(
      fc.property(
        fc.record({
          seller_number: fc.string({ minLength: 1, maxLength: 10 }),
          next_call_date: fc.constantFrom(todayStr, yesterdayStr),
          contact_method: fc.constant(''),
          preferred_contact_time: fc.constant(''),
          phone_contact_person: fc.constant(''),
          visit_assignee: fc.constantFrom('', '外す'),
          // pinrich_status は空欄以外
          pinrich_status: fc.constantFrom(...pinrichValues),
          status: fc.constantFrom('追客中', '除外後追客中', '他決→追客'),
        }),
        (seller) => {
          const result = filterSellersByCategory([seller], 'pinrichEmpty');
          // pinrich_status に値がある売主は pinrichEmpty に含まれない
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Preservation
   *
   * 専任媒介の売主は exclusive カテゴリに含まれ続けることを検証する。
   *
   * **Validates: Requirements 3.4**
   */
  it('PBT: 専任媒介の売主は exclusive カテゴリに含まれ続ける', () => {
    const tomorrowStr = getTomorrowStr();

    fc.assert(
      fc.property(
        fc.record({
          seller_number: fc.string({ minLength: 1, maxLength: 10 }),
          // 専任媒介系のステータス
          status: fc.constantFrom('専任媒介', '他決→専任', 'リースバック（専任）'),
          // 次電日は今日以外（明日）
          next_call_date: fc.constant(tomorrowStr),
          // 専任他決打合せは「完了」以外
          exclusive_other_decision_meeting: fc.constantFrom('', '未完了', null),
          contact_method: fc.constant(''),
          preferred_contact_time: fc.constant(''),
          phone_contact_person: fc.constant(''),
          visit_assignee: fc.constant(''),
          pinrich_status: fc.constant(''),
          confidence_level: fc.constant(''),
          visit_date: fc.constant(null),
          contract_year_month: fc.constant(null),
        }),
        (seller) => {
          const result = filterSellersByCategory([seller], 'exclusive');
          // 専任媒介の売主は exclusive カテゴリに含まれる
          return result.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Preservation
   *
   * 一般媒介の売主（2025/6/23以降の契約）は general カテゴリに含まれ続けることを検証する。
   *
   * **Validates: Requirements 3.4**
   */
  it('PBT: 一般媒介の売主（2025/6/23以降の契約）は general カテゴリに含まれ続ける', () => {
    const tomorrowStr = getTomorrowStr();

    // 2025/6/23以降の日付リスト
    const validContractDates = [
      '2025-06-23',
      '2025-07-01',
      '2025-08-15',
      '2025-12-31',
      '2026-01-01',
      '2026-06-01',
    ];

    fc.assert(
      fc.property(
        fc.record({
          seller_number: fc.string({ minLength: 1, maxLength: 10 }),
          status: fc.constant('一般媒介'),
          next_call_date: fc.constant(tomorrowStr),
          exclusive_other_decision_meeting: fc.constantFrom('', '未完了', null),
          contract_year_month: fc.constantFrom(...validContractDates),
          contact_method: fc.constant(''),
          preferred_contact_time: fc.constant(''),
          phone_contact_person: fc.constant(''),
          visit_assignee: fc.constant(''),
          pinrich_status: fc.constant(''),
          confidence_level: fc.constant(''),
          visit_date: fc.constant(null),
        }),
        (seller) => {
          const result = filterSellersByCategory([seller], 'general');
          // 一般媒介の売主は general カテゴリに含まれる
          return result.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Preservation
   *
   * pinrichEmpty カテゴリのフィルタリング結果は、
   * pinrichChangeRequired 条件の有無に関わらず同じ結果を返すことを検証する。
   *
   * 具体的には、pinrichChangeRequired 条件（条件A〜D）を満たさない売主リストに対して、
   * filterSellersByCategory(sellers, 'pinrichEmpty') が正しく動作することを検証する。
   *
   * **Validates: Requirements 3.1, 3.5**
   */
  it('PBT: pinrichEmpty フィルタリングは pinrichChangeRequired 条件に影響されない', () => {
    const todayStr = getTodayStr();

    fc.assert(
      fc.property(
        // pinrichEmpty 対象の売主リストを生成（0〜5件）
        fc.array(
          fc.record({
            seller_number: fc.string({ minLength: 1, maxLength: 10 }),
            status: fc.constantFrom('追客中', '除外後追客中'),
            next_call_date: fc.constant(todayStr),
            contact_method: fc.constant(''),
            preferred_contact_time: fc.constant(''),
            phone_contact_person: fc.constant(''),
            visit_assignee: fc.constantFrom('', '外す'),
            pinrich_status: fc.constant(''), // 空欄 → pinrichEmpty 対象
            confidence_level: fc.constant(''),
            visit_date: fc.constant(null),
            contract_year_month: fc.constant(null),
            exclusive_other_decision_meeting: fc.constant(''),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (sellers) => {
          // pinrichEmpty フィルタリングの結果
          const pinrichEmptyResult = filterSellersByCategory(sellers, 'pinrichEmpty');

          // 全ての売主が pinrichEmpty 条件を満たすはず（pinrich_status が空欄 + 当日TEL分）
          const expectedCount = sellers.filter(s => {
            // 当日TEL分の条件: 追客中 + 次電日が今日以前 + コミュニケーション情報なし + 営担なし
            const isTodayCallBase =
              (s.status === '追客中' || s.status === '除外後追客中') &&
              s.next_call_date <= todayStr &&
              !s.contact_method && !s.preferred_contact_time && !s.phone_contact_person &&
              (!s.visit_assignee || s.visit_assignee === '外す');
            // pinrich_status が空欄
            return isTodayCallBase && !s.pinrich_status;
          }).length;

          return pinrichEmptyResult.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });
});
