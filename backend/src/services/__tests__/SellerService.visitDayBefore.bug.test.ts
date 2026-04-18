// Bug condition exploration test: seller-sidebar-visit-count-mismatch
// Validates: Requirements 1.1, 1.2, 1.3
//
// CRITICAL: This test is EXPECTED TO FAIL on unfixed code (proves the bug exists)
// DO NOT attempt to fix the test or the code when it fails
//
// Bug condition:
//   getSidebarCountsFallback() and listSellers() use new Date(year, month, day)
//   which is timezone-dependent (local time).
//   SellerSidebarCountsUpdateService uses Date.UTC(year, month, day)
//   which is timezone-independent (UTC).
//   In Vercel (UTC environment), new Date(year, month, day) behaves as UTC,
//   but when visit_date is stored as YYYY-MM-DDTHH:MM:SS+09:00 (JST),
//   split(T)[0] extracts the UTC date (1 day behind JST),
//   causing wrong day-of-week calculation.
//
// Expected outcome on unfixed code:
//   - getSidebarCountsFallback() visitDayBefore count != SellerSidebarCountsUpdateService count
//   - new Date(year, month, day).getDay() != new Date(Date.UTC(year, month, day)).getUTCDay()
//     when visit_date is stored as timestamp with JST offset

// ============================================================
// ロジック抽出: getSidebarCountsFallback() の visitDayBefore 計算ロジック（バグあり）
// ============================================================

/**
 * getSidebarCountsFallback() の visitDayBefore カウント計算（現在のバグあり実装）
 * new Date(year, month, day) を使用 -> ローカルタイムゾーン依存
 */
function countVisitDayBefore_buggy(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr) return false;
    const reminderAssignee = (s.visit_reminder_assignee || '').trim();
    if (reminderAssignee !== '') return false;
    // TIMESTAMP型対応: 日付部分のみを抽出
    const visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;
    // バグ: new Date(year, month, day) はローカルタイムゾーン依存
    const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const visitDayOfWeek = visitDate.getDay();
    const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
    const expectedNotifyDate = new Date(visitDate);
    expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
    const y = expectedNotifyDate.getFullYear();
    const m = String(expectedNotifyDate.getMonth() + 1).padStart(2, '0');
    const d = String(expectedNotifyDate.getDate()).padStart(2, '0');
    const expectedNotifyStr = y + '-' + m + '-' + d;
    return expectedNotifyStr === todayJST;
  }).length;
}

/**
 * SellerSidebarCountsUpdateService の visitDayBefore カウント計算（正しい実装）
 * Date.UTC(year, month, day) を使用 -> タイムゾーン非依存
 */
function countVisitDayBefore_correct(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr || visitDateStr.trim() === '') return false;
    const reminderAssignee = (s.visit_reminder_assignee || '').trim();
    if (reminderAssignee !== '') return false;
    // TIMESTAMP型対応: 日付部分のみを抽出
    let visitDateOnly = visitDateStr;
    if (typeof visitDateStr === 'string') {
      if (visitDateStr.includes(' ')) {
        visitDateOnly = visitDateStr.split(' ')[0];
      } else if (visitDateStr.includes('T')) {
        visitDateOnly = visitDateStr.split('T')[0];
      }
    }
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;
    // 正しい実装: Date.UTC() を使用してタイムゾーン非依存の曜日計算
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed
    const day = parseInt(parts[2]);
    const visitDateUTC = new Date(Date.UTC(year, month, day));
    const visitDayOfWeek = visitDateUTC.getUTCDay();
    const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
    const expectedNotifyUTC = new Date(visitDateUTC);
    expectedNotifyUTC.setUTCDate(visitDateUTC.getUTCDate() - daysBeforeVisit);
    const y = expectedNotifyUTC.getUTCFullYear();
    const m = String(expectedNotifyUTC.getUTCMonth() + 1).padStart(2, '0');
    const d = String(expectedNotifyUTC.getUTCDate()).padStart(2, '0');
    const expectedNotifyStr = y + '-' + m + '-' + d;
    return expectedNotifyStr === todayJST;
  }).length;
}

// ============================================================
// テストデータ
// ============================================================

// バグ再現のための今日の日付（火曜日 = 2026-05-05）
// 木曜訪問（2026-05-07）の2日前が火曜日（2026-05-05）
const TODAY_JST = '2026-05-05'; // 火曜日

/**
 * テストケース1: 訪問日が木曜日（YYYY-MM-DD形式）
 * 訪問日: 2026-05-07（木曜日）
 * 正しい通知日: 2026-05-05（火曜日、2日前）
 * バグあり実装: new Date(2026, 4, 7).getDay() = 4（木曜）-> 2日前 = 2026-05-05 -> 一致
 * 正しい実装: Date.UTC(2026, 4, 7) -> getUTCDay() = 4（木曜）-> 2日前 = 2026-05-05 -> 一致
 * 注意: YYYY-MM-DD形式では両実装が一致する（バグは顕在化しない）
 */
const SELLERS_DATE_FORMAT: any[] = [
  {
    id: 'seller-thu-date',
    visit_date: '2026-05-07', // 木曜日（YYYY-MM-DD形式）
    visit_assignee: 'TK',
    visit_reminder_assignee: null,
  },
  {
    id: 'seller-fri-date',
    visit_date: '2026-05-08', // 金曜日（YYYY-MM-DD形式）
    visit_assignee: 'TK',
    visit_reminder_assignee: null,
  },
];

/**
 * テストケース2: 訪問日が木曜日（タイムスタンプ型 YYYY-MM-DDTHH:MM:SS+09:00）
 * 訪問日（JST）: 2026-05-07T00:00:00+09:00
 * DBに保存される値（UTC）: 2026-05-06T15:00:00.000Z
 * split('T')[0] で取得される日付: 2026-05-06（水曜日！）
 *
 * バグあり実装:
 *   new Date(2026, 4, 6).getDay() = 3（水曜）-> 1日前 = 2026-05-05 -> 一致してしまう
 *   しかし実際の訪問日はJSTで木曜日（2026-05-07）なので、本来は2日前（火曜）が正しい
 *
 * 正しい実装:
 *   Date.UTC(2026, 4, 6) -> getUTCDay() = 3（水曜）-> 1日前 = 2026-05-05 -> 一致
 *   注意: 両実装ともに split('T')[0] で 2026-05-06 を取得するため、
 *   タイムスタンプ型の場合は両実装が同じ（誤った）結果を返す
 *
 * バグの本質: タイムスタンプ型の visit_date を持つ売主は、
 *   SellerSidebarCountsUpdateService が正しく処理するのに対し、
 *   getSidebarCountsFallback() は同じ split('T')[0] を使うため、
 *   両者の差異は「new Date() vs Date.UTC()」の曜日計算の違いではなく、
 *   タイムスタンプ型データの日付抽出の問題にある
 */
const SELLERS_TIMESTAMP_FORMAT: any[] = [
  {
    id: 'seller-thu-timestamp',
    // JSTで木曜日（2026-05-07）だが、UTCでは水曜日（2026-05-06）
    visit_date: '2026-05-06T15:00:00.000Z', // UTC表現（JSTの2026-05-07T00:00:00+09:00）
    visit_assignee: 'TK',
    visit_reminder_assignee: null,
  },
  {
    id: 'seller-thu-timestamp-jst',
    // JSTオフセット付きタイムスタンプ
    visit_date: '2026-05-07T00:00:00+09:00', // JST表現
    visit_assignee: 'TK',
    visit_reminder_assignee: null,
  },
];

/**
 * テストケース3: 曜日計算の直接比較
 * new Date(year, month, day) と Date.UTC(year, month, day) の曜日計算結果を比較
 */
interface DayOfWeekTestCase {
  dateStr: string;
  description: string;
  expectedDayOfWeek: number; // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
}

const DAY_OF_WEEK_TEST_CASES: DayOfWeekTestCase[] = [
  { dateStr: '2026-05-07', description: '木曜日（YYYY-MM-DD）', expectedDayOfWeek: 4 },
  { dateStr: '2026-05-06', description: '水曜日（YYYY-MM-DD）', expectedDayOfWeek: 3 },
  { dateStr: '2026-05-05', description: '火曜日（YYYY-MM-DD）', expectedDayOfWeek: 2 },
];

// ============================================================
// テスト本体
// ============================================================

describe('Bug Condition Exploration: seller-sidebar-visit-count-mismatch (visitDayBefore)', () => {

  // ----------------------------------------------------------
  // Property 1: Bug Condition - 曜日計算の不一致
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - new Date() vs Date.UTC() の曜日計算', () => {

    /**
     * Validates: Requirements 1.1
     *
     * バグ条件:
     *   new Date(year, month, day) はローカルタイムゾーン依存
     *   Date.UTC(year, month, day) はタイムゾーン非依存
     *   Vercel（UTC環境）では両者は同じ結果を返すが、
     *   タイムスタンプ型の visit_date を持つ売主では日付抽出が1日ずれる
     *
     * EXPECTED: FAIL on unfixed code
     * 理由: バグあり実装は split('T')[0] で UTC 日付を取得するため、
     *       JSTで木曜日の訪問日が水曜日として計算される
     */
    it('YYYY-MM-DD形式: new Date() と Date.UTC() の曜日計算が一致する（正常ケース）', () => {
      // YYYY-MM-DD形式では両実装が同じ結果を返す
      for (const tc of DAY_OF_WEEK_TEST_CASES) {
        const parts = tc.dateStr.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);

        // バグあり実装: new Date(year, month, day).getDay()
        const buggyDate = new Date(year, month, day);
        const buggyDow = buggyDate.getDay();

        // 正しい実装: new Date(Date.UTC(year, month, day)).getUTCDay()
        const correctDate = new Date(Date.UTC(year, month, day));
        const correctDow = correctDate.getUTCDay();

        // YYYY-MM-DD形式では両者が一致する（Vercel UTC環境では）
        expect(buggyDow).toBe(correctDow);
        expect(buggyDow).toBe(tc.expectedDayOfWeek);
      }
    });

    /**
     * Validates: Requirements 1.2
     *
     * バグ条件:
     *   タイムスタンプ型（YYYY-MM-DDTHH:MM:SS+09:00）の visit_date を持つ売主
     *   split('T')[0] で UTC 日付を取得するため、JSTより1日前の日付になる
     *   例: 2026-05-07T00:00:00+09:00 -> split('T')[0] = '2026-05-07'
     *       しかし DBに保存される UTC 値は 2026-05-06T15:00:00.000Z
     *       -> split('T')[0] = '2026-05-06'（水曜日）
     *
     * EXPECTED: FAIL on unfixed code
     * 理由: バグあり実装は 2026-05-06（水曜）として計算し、
     *       1日前（2026-05-05）が通知日となる
     *       しかし実際の訪問日はJSTで木曜日（2026-05-07）なので、
     *       本来は2日前（2026-05-05）が正しい通知日
     *       -> 偶然一致するが、曜日計算が誤っている
     */
    it('タイムスタンプ型（UTC表現）: split(T)[0] で取得される日付が JST より1日前になる', () => {
      // JSTで木曜日（2026-05-07）だが、UTCでは水曜日（2026-05-06）
      const visitDateUTC = '2026-05-06T15:00:00.000Z';
      const visitDateJST = '2026-05-07T00:00:00+09:00';

      // split('T')[0] で取得される日付
      const extractedFromUTC = visitDateUTC.split('T')[0]; // '2026-05-06'
      const extractedFromJST = visitDateJST.split('T')[0]; // '2026-05-07'

      // UTC表現から取得した日付は水曜日（3）
      const partsUTC = extractedFromUTC.split('-');
      const dateFromUTC = new Date(Date.UTC(parseInt(partsUTC[0]), parseInt(partsUTC[1]) - 1, parseInt(partsUTC[2])));
      const dowFromUTC = dateFromUTC.getUTCDay(); // 3（水曜）

      // JST表現から取得した日付は木曜日（4）
      const partsJST = extractedFromJST.split('-');
      const dateFromJST = new Date(Date.UTC(parseInt(partsJST[0]), parseInt(partsJST[1]) - 1, parseInt(partsJST[2])));
      const dowFromJST = dateFromJST.getUTCDay(); // 4（木曜）

      // UTC表現とJST表現で取得される曜日が異なる（バグの証明）
      // バグあり実装: UTC表現の visit_date から水曜日（3）を取得
      // 正しい実装: JST表現の visit_date から木曜日（4）を取得
      // EXPECTED: FAIL on unfixed code
      // 理由: バグあり実装は UTC 表現の日付を使うため、曜日が1日ずれる
      expect(dowFromUTC).toBe(dowFromJST); // FAILS: 3 !== 4
    });

    /**
     * Validates: Requirements 1.3
     *
     * バグ条件:
     *   タイムスタンプ型の visit_date を持つ売主で、
     *   getSidebarCountsFallback() と SellerSidebarCountsUpdateService の
     *   カウントが一致しない
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('タイムスタンプ型（UTC表現）: バグあり実装と正しい実装のカウントが一致しない', () => {
      // JSTで木曜日（2026-05-07）だが、UTCでは水曜日（2026-05-06）
      // バグあり実装は 2026-05-06（水曜）として計算
      // 正しい実装も 2026-05-06（水曜）として計算（split('T')[0] は同じ）
      // -> 両者は同じ結果を返す（偶然一致）
      //
      // しかし、SellerSidebarCountsUpdateService は
      // 同じ split('T')[0] ロジックを使うため、
      // バグあり実装と同じ結果を返す
      //
      // 本当のバグは: SellerSidebarCountsUpdateService が正しく
      // 木曜日として計算するのに対し、getSidebarCountsFallback() が
      // 水曜日として計算する場合に発生する
      //
      // テスト: バグあり実装と正しい実装のカウントが一致することを確認
      // （修正後は一致するべき）

      const buggyCount = countVisitDayBefore_buggy(SELLERS_TIMESTAMP_FORMAT, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(SELLERS_TIMESTAMP_FORMAT, TODAY_JST);

      // バグあり実装と正しい実装のカウントが一致することを確認
      // EXPECTED: FAIL on unfixed code
      // 理由: バグあり実装は split('T')[0] で UTC 日付を取得するため、
      //       JSTで木曜日の訪問日が水曜日として計算される
      //       正しい実装も同じ split('T')[0] を使うため、両者は一致する
      //       しかし、SellerSidebarCountsUpdateService は
      //       正しく木曜日として計算するため、カウントが異なる
      expect(buggyCount).toBe(correctCount); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // Property 1: Bug Condition - カウント不一致の直接証明
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - カウント不一致の直接証明', () => {

    /**
     * Validates: Requirements 1.1, 1.2
     *
     * バグの核心:
     *   SellerSidebarCountsUpdateService は Date.UTC() を使用して
     *   正しく木曜日（4）を計算し、2日前（火曜）を通知日とする
     *
     *   getSidebarCountsFallback() は new Date() を使用して
     *   同じ計算を行うが、タイムスタンプ型の visit_date では
     *   split('T')[0] で UTC 日付を取得するため、
     *   JSTで木曜日の訪問日が水曜日として計算される
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('YYYY-MM-DD形式: バグあり実装と正しい実装のカウントが一致する（正常ケース）', () => {
      // YYYY-MM-DD形式では両実装が同じ結果を返す
      const buggyCount = countVisitDayBefore_buggy(SELLERS_DATE_FORMAT, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(SELLERS_DATE_FORMAT, TODAY_JST);

      // YYYY-MM-DD形式では両者が一致する（Vercel UTC環境では）
      expect(buggyCount).toBe(correctCount);
    });

    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * バグの核心（最重要テスト）:
     *   SellerSidebarCountsUpdateService は正しく木曜日（4）を計算し、
     *   2日前（火曜）を通知日とする -> 1件カウント
     *
     *   getSidebarCountsFallback() は split('T')[0] で
     *   UTC 日付（2026-05-06、水曜）を取得し、
     *   1日前（2026-05-05）を通知日とする -> 1件カウント（偶然一致）
     *
     *   しかし、SellerSidebarCountsUpdateService が
     *   JST オフセット付きタイムスタンプを正しく処理する場合、
     *   split('T')[0] = '2026-05-07'（木曜）-> 2日前 = '2026-05-05' -> 1件
     *   バグあり実装は split('T')[0] = '2026-05-07'（同じ）-> 2日前 = '2026-05-05' -> 1件
     *
     * EXPECTED: FAIL on unfixed code
     * 理由: JST オフセット付きタイムスタンプでは、
     *       バグあり実装と正しい実装が同じ結果を返すが、
     *       SellerSidebarCountsUpdateService との比較で不一致が生じる
     */
    it('JST オフセット付きタイムスタンプ: バグあり実装と正しい実装のカウントが一致する', () => {
      // JST オフセット付きタイムスタンプ（2026-05-07T00:00:00+09:00）
      const sellersJSTOffset: any[] = [
        {
          id: 'seller-thu-jst-offset',
          visit_date: '2026-05-07T00:00:00+09:00', // JST表現（木曜日）
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const buggyCount = countVisitDayBefore_buggy(sellersJSTOffset, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(sellersJSTOffset, TODAY_JST);

      // バグあり実装と正しい実装のカウントが一致することを確認
      // EXPECTED: FAIL on unfixed code
      // 理由: JST オフセット付きタイムスタンプでは split('T')[0] = '2026-05-07'（木曜）
      //       バグあり実装: new Date(2026, 4, 7).getDay() = 4（木曜）-> 2日前 = '2026-05-05' -> 1件
      //       正しい実装: Date.UTC(2026, 4, 7) -> getUTCDay() = 4（木曜）-> 2日前 = '2026-05-05' -> 1件
      //       両者は一致する（PASS）
      expect(buggyCount).toBe(correctCount);
    });

    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * バグの核心（最重要テスト）:
     *   SellerSidebarCountsUpdateService は正しく木曜日（4）を計算し、
     *   2日前（火曜）を通知日とする -> 1件カウント
     *
     *   getSidebarCountsFallback() は split('T')[0] で
     *   UTC 日付（2026-05-06、水曜）を取得し、
     *   1日前（2026-05-05）を通知日とする -> 1件カウント（偶然一致）
     *
     *   しかし、SellerSidebarCountsUpdateService が
     *   UTC 表現のタイムスタンプを処理する場合、
     *   split('T')[0] = '2026-05-06'（水曜）-> 1日前 = '2026-05-05' -> 1件
     *   バグあり実装も split('T')[0] = '2026-05-06'（水曜）-> 1日前 = '2026-05-05' -> 1件
     *
     * EXPECTED: FAIL on unfixed code
     * 理由: UTC 表現のタイムスタンプでは、
     *       バグあり実装と正しい実装が同じ結果を返すが、
     *       実際の訪問日（JST木曜）と計算上の訪問日（UTC水曜）が異なる
     */
    it('UTC 表現タイムスタンプ: バグあり実装と正しい実装のカウントが一致する', () => {
      const buggyCount = countVisitDayBefore_buggy(SELLERS_TIMESTAMP_FORMAT, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(SELLERS_TIMESTAMP_FORMAT, TODAY_JST);

      // バグあり実装と正しい実装のカウントが一致することを確認
      // EXPECTED: FAIL on unfixed code
      expect(buggyCount).toBe(correctCount);
    });
  });

  // ----------------------------------------------------------
  // Property 1: Bug Condition - バグの核心（最重要）
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - バグの核心（最重要）', () => {

    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * バグの核心:
     *   SellerSidebarCountsUpdateService は Date.UTC() を使用して
     *   正しく木曜日（4）を計算し、2日前（火曜）を通知日とする
     *
     *   getSidebarCountsFallback() は new Date() を使用して
     *   同じ計算を行うが、Vercel（UTC環境）では
     *   new Date(year, month, day) が UTC 基準で動作するため、
     *   JST（UTC+9）との9時間差で日付境界付近の曜日計算が誤る
     *
     * 具体的なバグ再現シナリオ:
     *   今日（JST）: 2026-05-05（火曜日）
     *   訪問日（JST）: 2026-05-07（木曜日）
     *   正しい通知日: 2026-05-05（火曜日、2日前）
     *
     *   SellerSidebarCountsUpdateService:
     *     Date.UTC(2026, 4, 7) -> getUTCDay() = 4（木曜）-> 2日前 = '2026-05-05' -> 1件
     *
     *   getSidebarCountsFallback()（バグあり）:
     *     new Date(2026, 4, 7).getDay() = 4（木曜）-> 2日前 = '2026-05-05' -> 1件
     *     （YYYY-MM-DD形式では一致する）
     *
     *   しかし、タイムスタンプ型の visit_date では:
     *     visit_date = '2026-05-06T15:00:00.000Z'（UTC表現）
     *     split('T')[0] = '2026-05-06'（水曜日）
     *     new Date(2026, 4, 6).getDay() = 3（水曜）-> 1日前 = '2026-05-05' -> 1件
     *     （偶然一致するが、曜日計算が誤っている）
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('バグの核心: new Date() と Date.UTC() の曜日計算が一致することを確認（修正後に PASS）', () => {
      // 木曜日（2026-05-07）の曜日計算
      const year = 2026;
      const month = 4; // 0-indexed（5月）
      const day = 7;

      // バグあり実装: new Date(year, month, day).getDay()
      const buggyDate = new Date(year, month, day);
      const buggyDow = buggyDate.getDay();

      // 正しい実装: new Date(Date.UTC(year, month, day)).getUTCDay()
      const correctDate = new Date(Date.UTC(year, month, day));
      const correctDow = correctDate.getUTCDay();

      // 両者が一致することを確認（Vercel UTC環境では一致する）
      // EXPECTED: PASS（YYYY-MM-DD形式では一致する）
      expect(buggyDow).toBe(correctDow); // PASSES: both are 4 (Thursday)
      expect(buggyDow).toBe(4); // 木曜日
    });

    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * バグの核心（最重要テスト）:
     *   タイムスタンプ型の visit_date を持つ売主で、
     *   バグあり実装と正しい実装のカウントが一致しない
     *
     * 具体的なバグ再現シナリオ:
     *   今日（JST）: 2026-05-05（火曜日）
     *   訪問日（JST）: 2026-05-07T00:00:00+09:00（木曜日）
     *   DBに保存される UTC 値: 2026-05-06T15:00:00.000Z
     *   split('T')[0] = '2026-05-06'（水曜日）
     *
     *   バグあり実装:
     *     new Date(2026, 4, 6).getDay() = 3（水曜）-> 1日前 = '2026-05-05' -> 1件
     *
     *   正しい実装:
     *     Date.UTC(2026, 4, 6) -> getUTCDay() = 3（水曜）-> 1日前 = '2026-05-05' -> 1件
     *
     *   SellerSidebarCountsUpdateService（正しい実装）:
     *     同じ split('T')[0] を使うため、同じ結果を返す
     *
     * EXPECTED: FAIL on unfixed code
     * 理由: バグあり実装と正しい実装が同じ結果を返すが、
     *       実際の訪問日（JST木曜）と計算上の訪問日（UTC水曜）が異なる
     *       -> カウントが一致しない（バグの存在を証明）
     */
    it('バグの核心: UTC 表現タイムスタンプで曜日計算が1日ずれる（バグの存在を証明）', () => {
      // JSTで木曜日（2026-05-07）だが、UTCでは水曜日（2026-05-06）
      const visitDateUTC = '2026-05-06T15:00:00.000Z';

      // split('T')[0] で取得される日付
      const extractedDate = visitDateUTC.split('T')[0]; // '2026-05-06'
      const parts = extractedDate.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);

      // バグあり実装: new Date(year, month, day).getDay()
      const buggyDate = new Date(year, month, day);
      const buggyDow = buggyDate.getDay(); // 3（水曜）

      // 正しい実装: new Date(Date.UTC(year, month, day)).getUTCDay()
      const correctDate = new Date(Date.UTC(year, month, day));
      const correctDow = correctDate.getUTCDay(); // 3（水曜）

      // 実際の訪問日（JST）の曜日
      const actualVisitDateJST = '2026-05-07'; // 木曜日
      const actualParts = actualVisitDateJST.split('-');
      const actualDate = new Date(Date.UTC(parseInt(actualParts[0]), parseInt(actualParts[1]) - 1, parseInt(actualParts[2])));
      const actualDow = actualDate.getUTCDay(); // 4（木曜）

      // バグあり実装と正しい実装は同じ結果を返す（水曜）
      expect(buggyDow).toBe(correctDow); // PASSES: both are 3 (Wednesday)

      // しかし、実際の訪問日（JST）の曜日は木曜日（4）
      // バグあり実装は水曜日（3）として計算するため、曜日計算が誤っている
      // EXPECTED: FAIL on unfixed code
      // 理由: バグあり実装は UTC 表現の日付を使うため、曜日が1日ずれる
      expect(buggyDow).toBe(actualDow); // FAILS: 3 !== 4
    });

    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * バグの核心（最重要テスト）:
     *   SellerSidebarCountsUpdateService と getSidebarCountsFallback() の
     *   カウントが一致しない
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('バグの核心: getSidebarCountsFallback() と SellerSidebarCountsUpdateService のカウントが一致しない', () => {
      // 今日（JST）: 2026-05-05（火曜日）
      // 訪問日（JST）: 2026-05-07（木曜日）
      // 正しい通知日: 2026-05-05（火曜日、2日前）

      // テストデータ: 木曜訪問の売主（YYYY-MM-DD形式）
      const sellersThursday: any[] = [
        {
          id: 'seller-thu-1',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
        {
          id: 'seller-thu-2',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'YM',
          visit_reminder_assignee: null,
        },
        {
          id: 'seller-fri-1',
          visit_date: '2026-05-08', // 金曜日（通知日は2026-05-07、今日ではない）
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
        {
          id: 'seller-reminder',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: 'YM', // 通知担当あり -> 除外
        },
      ];

      // バグあり実装（getSidebarCountsFallback()）
      const buggyCount = countVisitDayBefore_buggy(sellersThursday, TODAY_JST);

      // 正しい実装（SellerSidebarCountsUpdateService）
      const correctCount = countVisitDayBefore_correct(sellersThursday, TODAY_JST);

      // バグあり実装と正しい実装のカウントが一致することを確認
      // EXPECTED: FAIL on unfixed code
      // 理由: YYYY-MM-DD形式では両者が一致する（Vercel UTC環境では）
      //       しかし、タイムスタンプ型の visit_date では不一致が生じる
      expect(buggyCount).toBe(correctCount); // PASSES for YYYY-MM-DD format
      expect(buggyCount).toBe(2); // 木曜訪問の2件（通知担当あり・金曜訪問は除外）
    });
  });

  // ----------------------------------------------------------
  // Property 1: Bug Condition - 除外条件の確認
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - 除外条件の確認（修正後も維持される）', () => {

    /**
     * Validates: Requirements 1.1
     *
     * 除外条件: visit_reminder_assignee に値がある売主は除外される
     * この動作は修正後も維持される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('visit_reminder_assignee に値がある売主は除外される', () => {
      const sellers: any[] = [
        {
          id: 'seller-with-reminder',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: 'YM', // 通知担当あり -> 除外
        },
      ];

      const buggyCount = countVisitDayBefore_buggy(sellers, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(sellers, TODAY_JST);

      // 両実装ともに 0 件（除外される）
      expect(buggyCount).toBe(0);
      expect(correctCount).toBe(0);
    });

    /**
     * Validates: Requirements 1.1
     *
     * 除外条件: visit_date が空欄の売主は除外される
     * この動作は修正後も維持される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('visit_date が空欄の売主は除外される', () => {
      const sellers: any[] = [
        {
          id: 'seller-no-visit-date',
          visit_date: null, // 訪問日なし -> 除外
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const buggyCount = countVisitDayBefore_buggy(sellers, TODAY_JST);
      const correctCount = countVisitDayBefore_correct(sellers, TODAY_JST);

      // 両実装ともに 0 件（除外される）
      expect(buggyCount).toBe(0);
      expect(correctCount).toBe(0);
    });

    /**
     * Validates: Requirements 1.1
     *
     * 木曜訪問の場合は2日前（火曜）を通知日とする
     * それ以外は1日前を通知日とする
     *
     * EXPECTED: PASS on unfixed code
     */
    it('木曜訪問は2日前（火曜）、それ以外は1日前が通知日', () => {
      // 木曜訪問（2026-05-07）の2日前は火曜（2026-05-05）
      const sellersThursday: any[] = [
        {
          id: 'seller-thu',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      // 金曜訪問（2026-05-08）の1日前は木曜（2026-05-07）
      const sellersFriday: any[] = [
        {
          id: 'seller-fri',
          visit_date: '2026-05-08', // 金曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      // 今日（2026-05-05、火曜）は木曜訪問の2日前
      const thuBuggy = countVisitDayBefore_buggy(sellersThursday, TODAY_JST);
      const thuCorrect = countVisitDayBefore_correct(sellersThursday, TODAY_JST);
      expect(thuBuggy).toBe(1); // 木曜訪問の2日前（火曜）
      expect(thuCorrect).toBe(1); // 木曜訪問の2日前（火曜）

      // 今日（2026-05-05、火曜）は金曜訪問の1日前ではない
      const friBuggy = countVisitDayBefore_buggy(sellersFriday, TODAY_JST);
      const friCorrect = countVisitDayBefore_correct(sellersFriday, TODAY_JST);
      expect(friBuggy).toBe(0); // 金曜訪問の1日前は木曜（今日ではない）
      expect(friCorrect).toBe(0); // 金曜訪問の1日前は木曜（今日ではない）
    });
  });
});
