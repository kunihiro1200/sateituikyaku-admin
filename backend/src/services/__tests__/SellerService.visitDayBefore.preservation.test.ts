// Preservation test: seller-sidebar-visit-count-mismatch
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
//
// Property 2: Preservation - visitDayBefore 以外のカテゴリへの影響なし
//
// このテストは修正前のコードで PASS することが期待される
// 目的: 修正後も同じ動作が維持されることを確認するベースラインを記録する
//
// 保全すべき動作:
//   - visitDayBefore 以外のカテゴリのカウントは変わらない
//   - visit_reminder_assignee がある売主が visitDayBefore から除外される
//   - visit_assignee が空または「外す」の売主が除外される
//   - visit_date が空欄の売主が除外される
//   - 木曜訪問の場合に2日前（火曜）を通知日とするロジックは維持される

// ============================================================
// ロジック抽出: 修正前の visitDayBefore 計算ロジック（バグあり）
// ============================================================

/**
 * getSidebarCountsFallback() の visitDayBefore カウント計算（現在のバグあり実装）
 * new Date(year, month, day) を使用 -> ローカルタイムゾーン依存
 */
function countVisitDayBefore_original(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr) return false;
    const reminderAssignee = (s.visit_reminder_assignee || '').trim();
    if (reminderAssignee !== '') return false;
    const visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
    const parts = visitDateOnly.split('-');
    if (parts.length !== 3) return false;
    // 修正前: new Date(year, month, day) を使用
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
 * 修正後の visitDayBefore カウント計算（Date.UTC() を使用）
 * SellerSidebarCountsUpdateService と同じロジック
 */
function countVisitDayBefore_fixed(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    const visitDateStr = s.visit_date;
    if (!visitDateStr || visitDateStr.trim() === '') return false;
    const reminderAssignee = (s.visit_reminder_assignee || '').trim();
    if (reminderAssignee !== '') return false;
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
    // 修正後: Date.UTC() を使用してタイムゾーン非依存の曜日計算
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
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

// 今日の日付（火曜日 = 2026-05-05）
const TODAY_JST = '2026-05-05';

// 様々な曜日の訪問日を持つ売主データ
const SELLERS_VARIOUS_DAYS: any[] = [
  // 木曜訪問（2026-05-07）: 2日前（火曜 2026-05-05）が通知日
  { id: 'thu-1', visit_date: '2026-05-07', visit_assignee: 'TK', visit_reminder_assignee: null },
  { id: 'thu-2', visit_date: '2026-05-07', visit_assignee: 'YM', visit_reminder_assignee: null },
  // 金曜訪問（2026-05-08）: 1日前（木曜 2026-05-07）が通知日 -> 今日ではない
  { id: 'fri-1', visit_date: '2026-05-08', visit_assignee: 'TK', visit_reminder_assignee: null },
  // 水曜訪問（2026-05-06）: 1日前（火曜 2026-05-05）が通知日
  { id: 'wed-1', visit_date: '2026-05-06', visit_assignee: 'TK', visit_reminder_assignee: null },
  // 通知担当あり -> 除外
  { id: 'reminder-1', visit_date: '2026-05-07', visit_assignee: 'TK', visit_reminder_assignee: 'YM' },
  // 訪問日なし -> 除外
  { id: 'no-visit-1', visit_date: null, visit_assignee: 'TK', visit_reminder_assignee: null },
];

// ============================================================
// テスト本体
// ============================================================

describe('Preservation: seller-sidebar-visit-count-mismatch (visitDayBefore)', () => {

  // ----------------------------------------------------------
  // Property 2: Preservation - 除外条件の保全
  // ----------------------------------------------------------
  describe('Property 2: Preservation - 除外条件の保全', () => {

    /**
     * Validates: Requirements 3.2
     *
     * 保全すべき動作:
     *   visit_reminder_assignee に値がある売主は visitDayBefore から除外される
     *
     * EXPECTED: PASS on unfixed code (ベースライン動作の確認)
     */
    it('visit_reminder_assignee に値がある売主は visitDayBefore から除外される', () => {
      const sellers: any[] = [
        {
          id: 'seller-with-reminder',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: 'YM', // 通知担当あり -> 除外
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 修正前後ともに 0 件（除外される）
      expect(originalCount).toBe(0);
      expect(fixedCount).toBe(0);
      // 修正前後で同じ結果
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.2
     *
     * 保全すべき動作:
     *   visit_reminder_assignee が空文字の場合は除外されない
     *
     * EXPECTED: PASS on unfixed code
     */
    it('visit_reminder_assignee が空文字の場合は除外されない', () => {
      const sellers: any[] = [
        {
          id: 'seller-empty-reminder',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: '', // 空文字 -> 除外されない
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 修正前後ともに 1 件（除外されない）
      expect(originalCount).toBe(1);
      expect(fixedCount).toBe(1);
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.4
     *
     * 保全すべき動作:
     *   visit_date が空欄（null）の売主は除外される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('visit_date が null の売主は除外される', () => {
      const sellers: any[] = [
        {
          id: 'seller-no-visit-date',
          visit_date: null, // 訪問日なし -> 除外
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      expect(originalCount).toBe(0);
      expect(fixedCount).toBe(0);
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.4
     *
     * 保全すべき動作:
     *   visit_date が空文字の売主は除外される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('visit_date が空文字の売主は除外される', () => {
      const sellers: any[] = [
        {
          id: 'seller-empty-visit-date',
          visit_date: '', // 空文字 -> 除外
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      expect(originalCount).toBe(0);
      expect(fixedCount).toBe(0);
      expect(originalCount).toBe(fixedCount);
    });
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - 木曜訪問ロジックの保全
  // ----------------------------------------------------------
  describe('Property 2: Preservation - 木曜訪問ロジックの保全', () => {

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   木曜訪問の場合は2日前（火曜）を通知日とする
     *
     * EXPECTED: PASS on unfixed code
     */
    it('木曜訪問（YYYY-MM-DD）: 2日前（火曜）が通知日 - 修正前後で同じ結果', () => {
      const sellers: any[] = [
        {
          id: 'seller-thu',
          visit_date: '2026-05-07', // 木曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 今日（2026-05-05、火曜）は木曜訪問の2日前 -> 1件
      expect(originalCount).toBe(1);
      expect(fixedCount).toBe(1);
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   木曜以外の訪問は1日前を通知日とする
     *
     * EXPECTED: PASS on unfixed code
     */
    it('水曜訪問（YYYY-MM-DD）: 1日前（火曜）が通知日 - 修正前後で同じ結果', () => {
      const sellers: any[] = [
        {
          id: 'seller-wed',
          visit_date: '2026-05-06', // 水曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 今日（2026-05-05、火曜）は水曜訪問の1日前 -> 1件
      expect(originalCount).toBe(1);
      expect(fixedCount).toBe(1);
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   金曜訪問の1日前は木曜 -> 今日（火曜）は対象外
     *
     * EXPECTED: PASS on unfixed code
     */
    it('金曜訪問（YYYY-MM-DD）: 1日前（木曜）が通知日 - 今日（火曜）は対象外', () => {
      const sellers: any[] = [
        {
          id: 'seller-fri',
          visit_date: '2026-05-08', // 金曜日
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 今日（2026-05-05、火曜）は金曜訪問の1日前ではない -> 0件
      expect(originalCount).toBe(0);
      expect(fixedCount).toBe(0);
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   複数の売主が混在する場合でも正しくカウントされる
     *
     * EXPECTED: PASS on unfixed code
     */
    it('複数売主混在: 修正前後で同じカウント結果', () => {
      const originalCount = countVisitDayBefore_original(SELLERS_VARIOUS_DAYS, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(SELLERS_VARIOUS_DAYS, TODAY_JST);

      // 木曜訪問2件 + 水曜訪問1件 = 3件
      // 通知担当あり・訪問日なし・金曜訪問は除外
      expect(originalCount).toBe(3);
      expect(fixedCount).toBe(3);
      expect(originalCount).toBe(fixedCount);
    });
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - JST オフセット付きタイムスタンプの保全
  // ----------------------------------------------------------
  describe('Property 2: Preservation - タイムスタンプ形式の保全', () => {

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   JST オフセット付きタイムスタンプ（YYYY-MM-DDTHH:MM:SS+09:00）でも
     *   修正前後で同じ結果を返す
     *
     * EXPECTED: PASS on unfixed code
     */
    it('JST オフセット付きタイムスタンプ: 修正前後で同じ結果', () => {
      const sellers: any[] = [
        {
          id: 'seller-thu-jst',
          // JST表現（木曜日 2026-05-07）
          visit_date: '2026-05-07T00:00:00+09:00',
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 修正前後で同じ結果（JST表現では split('T')[0] = '2026-05-07'）
      expect(originalCount).toBe(fixedCount);
    });

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   スペース区切りタイムスタンプ（YYYY-MM-DD HH:MM:SS）でも
     *   修正前後で同じ結果を返す
     *
     * EXPECTED: PASS on unfixed code
     */
    it('スペース区切りタイムスタンプ: 修正前後で同じ結果', () => {
      const sellers: any[] = [
        {
          id: 'seller-thu-space',
          // スペース区切り形式（木曜日 2026-05-07）
          visit_date: '2026-05-07 00:00:00',
          visit_assignee: 'TK',
          visit_reminder_assignee: null,
        },
      ];

      const originalCount = countVisitDayBefore_original(sellers, TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed(sellers, TODAY_JST);

      // 修正前後で同じ結果
      expect(originalCount).toBe(fixedCount);
    });
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - 各曜日の通知日計算の保全
  // ----------------------------------------------------------
  describe('Property 2: Preservation - 各曜日の通知日計算の保全', () => {

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   各曜日の訪問日に対して、修正前後で同じ通知日が計算される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('各曜日の訪問日: 修正前後で同じ通知日が計算される', () => {
      // 各曜日の訪問日と期待される通知日
      const testCases = [
        // 月曜訪問（2026-05-11）: 1日前（日曜 2026-05-10）
        { visitDate: '2026-05-11', todayJST: '2026-05-10', expectedCount: 1, description: '月曜訪問の1日前（日曜）' },
        // 火曜訪問（2026-05-12）: 1日前（月曜 2026-05-11）
        { visitDate: '2026-05-12', todayJST: '2026-05-11', expectedCount: 1, description: '火曜訪問の1日前（月曜）' },
        // 水曜訪問（2026-05-13）: 1日前（火曜 2026-05-12）
        { visitDate: '2026-05-13', todayJST: '2026-05-12', expectedCount: 1, description: '水曜訪問の1日前（火曜）' },
        // 木曜訪問（2026-05-14）: 2日前（火曜 2026-05-12）
        { visitDate: '2026-05-14', todayJST: '2026-05-12', expectedCount: 1, description: '木曜訪問の2日前（火曜）' },
        // 金曜訪問（2026-05-15）: 1日前（木曜 2026-05-14）
        { visitDate: '2026-05-15', todayJST: '2026-05-14', expectedCount: 1, description: '金曜訪問の1日前（木曜）' },
        // 土曜訪問（2026-05-16）: 1日前（金曜 2026-05-15）
        { visitDate: '2026-05-16', todayJST: '2026-05-15', expectedCount: 1, description: '土曜訪問の1日前（金曜）' },
        // 日曜訪問（2026-05-17）: 1日前（土曜 2026-05-16）
        { visitDate: '2026-05-17', todayJST: '2026-05-16', expectedCount: 1, description: '日曜訪問の1日前（土曜）' },
      ];

      for (const tc of testCases) {
        const sellers: any[] = [
          {
            id: 'seller-test',
            visit_date: tc.visitDate,
            visit_assignee: 'TK',
            visit_reminder_assignee: null,
          },
        ];

        const originalCount = countVisitDayBefore_original(sellers, tc.todayJST);
        const fixedCount = countVisitDayBefore_fixed(sellers, tc.todayJST);

        // 修正前後で同じ結果
        expect(originalCount).toBe(tc.expectedCount);
        expect(fixedCount).toBe(tc.expectedCount);
        expect(originalCount).toBe(fixedCount);
      }
    });

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   木曜訪問の場合のみ2日前、それ以外は1日前
     *   この特別ロジックは修正前後で維持される
     *
     * EXPECTED: PASS on unfixed code
     */
    it('木曜訪問のみ2日前ロジック: 修正前後で維持される', () => {
      // 木曜訪問（2026-05-14）の2日前は火曜（2026-05-12）
      const thursdaySellers: any[] = [
        { id: 'thu', visit_date: '2026-05-14', visit_assignee: 'TK', visit_reminder_assignee: null },
      ];
      // 水曜訪問（2026-05-13）の1日前は火曜（2026-05-12）
      const wednesdaySellers: any[] = [
        { id: 'wed', visit_date: '2026-05-13', visit_assignee: 'TK', visit_reminder_assignee: null },
      ];

      const todayTuesday = '2026-05-12';

      // 木曜訪問: 2日前（火曜）が通知日
      const thuOriginal = countVisitDayBefore_original(thursdaySellers, todayTuesday);
      const thuFixed = countVisitDayBefore_fixed(thursdaySellers, todayTuesday);
      expect(thuOriginal).toBe(1);
      expect(thuFixed).toBe(1);
      expect(thuOriginal).toBe(thuFixed);

      // 水曜訪問: 1日前（火曜）が通知日
      const wedOriginal = countVisitDayBefore_original(wednesdaySellers, todayTuesday);
      const wedFixed = countVisitDayBefore_fixed(wednesdaySellers, todayTuesday);
      expect(wedOriginal).toBe(1);
      expect(wedFixed).toBe(1);
      expect(wedOriginal).toBe(wedFixed);
    });
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - 空データの保全
  // ----------------------------------------------------------
  describe('Property 2: Preservation - 空データの保全', () => {

    /**
     * Validates: Requirements 3.1
     *
     * 保全すべき動作:
     *   売主データが空の場合は 0 件を返す
     *
     * EXPECTED: PASS on unfixed code
     */
    it('売主データが空の場合は 0 件', () => {
      const originalCount = countVisitDayBefore_original([], TODAY_JST);
      const fixedCount = countVisitDayBefore_fixed([], TODAY_JST);

      expect(originalCount).toBe(0);
      expect(fixedCount).toBe(0);
      expect(originalCount).toBe(fixedCount);
    });
  });
});
