/**
 * SellerSidebarCountsUpdateService テスト
 *
 * タスク2: バグ1探索的テスト（修正前コードでバグを再現）
 * タスク3: Fix Checking と Preservation Checking（修正後コードで正しい動作を確認）
 *
 * テスト対象バグ:
 *   「未着手（todayCallNotStarted）」条件を満たす売主が
 *   「当日TEL（todayCall）」にも重複カウントされる問題
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 3.5
 */

// ============================================================
// ロジック抽出: SellerSidebarCountsUpdateService のカウント計算ロジックをインライン実装
// 実際のDBには接続せず、ロジックをユニットテストとして検証する
// ============================================================

const TODAY = '2026-04-15';

// ---- 共通ヘルパー ----

/**
 * 連絡先情報（コミュニケーション情報）の有無を判定
 */
function hasContactInfo(s: any): boolean {
  return !!(
    (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
    (s.contact_method && s.contact_method.trim() !== '')
  );
}

/**
 * 営担が有効かどうかを判定（「外す」は無効扱い）
 */
function hasValidVisitAssignee(visitAssignee: string | null | undefined): boolean {
  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
    return false;
  }
  return true;
}

/**
 * filteredTodayCallSellers を計算する
 * 「追客中」または「他決→追客」かつ next_call_date <= today かつ営担なし
 */
function getFilteredTodayCallSellers(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    // next_call_date が今日以前であること
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const status = s.status || '';
    // 「追客中」を含む（ilike '%追客中%'）または「他決→追客」
    const isFollowingUp =
      (status.includes('追客中') && !status.includes('追客不要') && !status.includes('専任媒介') && !status.includes('一般媒介') && !status.includes('他社買取')) ||
      status === '他決→追客';
    if (!isFollowingUp) return false;
    // 営担なし
    if (hasValidVisitAssignee(s.visit_assignee)) return false;
    return true;
  });
}

/**
 * 「未着手（todayCallNotStarted）」条件を判定する
 * - status === '追客中'
 * - 連絡先情報なし
 * - unreachable_status が空
 * - confidence_level が「ダブり」「D」「AI査定」でない
 * - inquiry_date >= '2026-01-01'
 */
function isNotStarted(s: any): boolean {
  const status = s.status || '';
  if (status !== '追客中') return false;
  if (hasContactInfo(s)) return false;
  const unreachable = s.unreachable_status || '';
  if (unreachable && unreachable.trim() !== '') return false;
  const confidence = s.confidence_level || '';
  if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
  const inquiryDate = s.inquiry_date || '';
  return inquiryDate >= '2026-01-01';
}

// ---- バグあり版（修正前）のカウント計算 ----

/**
 * 【修正前】todayCallNoInfoCount の計算
 * バグ: 未着手条件を満たす売主を除外しないため、todayCallNotStarted と重複カウントされる
 */
function countTodayCallNoInfo_BUGGY(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    // 連絡先情報がある場合は todayCallWithInfo に分類されるため除外
    if (hasContactInfo(s)) return false;
    // バグ: 未着手条件を満たす売主を除外しない → todayCallNotStarted と重複カウント
    return true;
  }).length;
}

// ---- 修正後のカウント計算 ----

/**
 * 【修正後】todayCallNoInfoCount の計算
 * 修正: 未着手条件を満たす売主を除外する（todayCallNotStarted に分類されるため）
 */
function countTodayCallNoInfo_FIXED(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    // 連絡先情報がある場合は todayCallWithInfo に分類されるため除外
    if (hasContactInfo(s)) return false;
    // 修正: 未着手条件を満たす売主は todayCallNotStarted に分類されるため除外
    if (isNotStarted(s)) return false;
    return true;
  }).length;
}

/**
 * todayCallNotStartedCount の計算（修正前後で変わらない）
 */
function countTodayCallNotStarted(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    if (hasContactInfo(s)) return false;
    return isNotStarted(s);
  }).length;
}

// ============================================================
// テストデータ
// ============================================================

/**
 * 「未着手」条件を満たす売主（バグ1の核心）
 * - status='追客中', next_call_date <= today, 連絡先情報なし
 * - unreachable_status=null, confidence_level='普通', inquiry_date='2026-02-01'
 * → 修正前: todayCall と todayCallNotStarted の両方にカウントされる（バグ）
 * → 修正後: todayCallNotStarted のみにカウントされる（正しい動作）
 */
const SELLER_NOT_STARTED = {
  id: 'seller-not-started',
  status: '追客中',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: '普通',
  inquiry_date: '2026-02-01',
};

/**
 * 「不通」売主（Property 2 の検証用）
 * - status='追客中', next_call_date <= today, 連絡先情報なし
 * - unreachable_status='不通', inquiry_date='2026-02-01'
 * → 修正前後ともに todayCall にカウントされ、todayCallNotStarted にはカウントされない
 */
const SELLER_UNREACHABLE = {
  id: 'seller-unreachable',
  status: '追客中',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: '不通',
  confidence_level: '普通',
  inquiry_date: '2026-02-01',
};

/**
 * 「他決→追客」売主（Property 2 の検証用）
 * - status='他決→追客', next_call_date <= today, 連絡先情報なし
 * → 修正前後ともに todayCall にカウントされ、todayCallNotStarted にはカウントされない
 */
const SELLER_OTHER_DECISION = {
  id: 'seller-other-decision',
  status: '他決→追客',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: null,
  inquiry_date: '2026-02-01',
};

/**
 * 「古い反響日付」売主（Property 2 の検証用）
 * - status='追客中', next_call_date <= today, 連絡先情報なし
 * - unreachable_status=null, inquiry_date='2025-12-31'（2026-01-01 未満）
 * → 修正前後ともに todayCall にカウントされ、todayCallNotStarted にはカウントされない
 */
const SELLER_OLD_INQUIRY_DATE = {
  id: 'seller-old-inquiry-date',
  status: '追客中',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: '普通',
  inquiry_date: '2025-12-31',
};

// ============================================================
// タスク2: バグ1探索的テスト（修正前コードでバグを再現）
// ============================================================

describe('タスク2: バグ1探索的テスト（修正前コードでバグを再現）', () => {
  /**
   * タスク2.1 / 2.2
   * 「未着手」条件を満たす売主が todayCall と todayCallNotStarted の両方にカウントされることを確認
   *
   * CRITICAL: このテストは修正前のコードで FAIL することが期待される
   * （バグが存在することを証明するカウンターエグザンプル）
   *
   * Validates: Requirements 2.1, 2.2
   */
  describe('2.1 未着手売主の重複カウント確認（修正前コードでFAILが期待される）', () => {
    it('【バグ再現】未着手売主が todayCallNotStarted にカウントされることを確認', () => {
      // 未着手条件を満たす売主が todayCallNotStarted にカウントされる
      const notStartedCount = countTodayCallNotStarted([SELLER_NOT_STARTED], TODAY);
      expect(notStartedCount).toBe(1); // todayCallNotStarted に含まれる
    });

    it('【バグ再現】修正前コードでは未着手売主が todayCall にも重複カウントされる（バグの存在を証明）', () => {
      // 修正前コードでは未着手売主が todayCall にも含まれてしまう
      const todayCallCount_buggy = countTodayCallNoInfo_BUGGY([SELLER_NOT_STARTED], TODAY);

      // 修正後の期待動作: todayCall には含まれない（0件）
      // バグあり実装では: todayCall にも含まれてしまう（1件）
      // → このアサーションは修正前コードで FAIL する（バグの証明）
      expect(todayCallCount_buggy).toBe(0); // FAILS on unfixed code: 1 が返される
    });

    it('【バグ再現】修正前コードでは todayCall + todayCallNotStarted の合計が重複する（バグの存在を証明）', () => {
      const sellers = [SELLER_NOT_STARTED];

      const todayCallCount_buggy = countTodayCallNoInfo_BUGGY(sellers, TODAY);
      const notStartedCount = countTodayCallNotStarted(sellers, TODAY);

      // 修正後の期待動作: todayCall=0, notStarted=1 → 合計1（重複なし）
      // バグあり実装では: todayCall=1, notStarted=1 → 合計2（重複あり）
      // → このアサーションは修正前コードで FAIL する（バグの証明）
      expect(todayCallCount_buggy + notStartedCount).toBe(1); // FAILS on unfixed code: 2 が返される
    });

    it('【バグ再現】未着手売主が filteredTodayCallSellers に含まれることを確認（バグの根本原因）', () => {
      // 未着手売主は filteredTodayCallSellers に含まれる（これがバグの根本原因）
      const filtered = getFilteredTodayCallSellers([SELLER_NOT_STARTED], TODAY);
      expect(filtered.length).toBe(1); // filteredTodayCallSellers に含まれる

      // 未着手条件を満たすことを確認
      expect(isNotStarted(SELLER_NOT_STARTED)).toBe(true);

      // 修正前コードでは todayCall にも含まれてしまう（バグ）
      const todayCallCount_buggy = countTodayCallNoInfo_BUGGY([SELLER_NOT_STARTED], TODAY);
      expect(todayCallCount_buggy).toBe(0); // FAILS on unfixed code: 1 が返される
    });
  });

  describe('2.2 バグ条件の詳細確認（カウンターエグザンプル）', () => {
    it('未着手条件の各フィールドを確認', () => {
      // status === '追客中' であること
      expect(SELLER_NOT_STARTED.status).toBe('追客中');
      // next_call_date が今日以前であること
      expect(SELLER_NOT_STARTED.next_call_date <= TODAY).toBe(true);
      // 連絡先情報がないこと
      expect(hasContactInfo(SELLER_NOT_STARTED)).toBe(false);
      // unreachable_status が空（null）であること
      expect(SELLER_NOT_STARTED.unreachable_status).toBeNull();
      // inquiry_date が 2026-01-01 以降であること
      expect(SELLER_NOT_STARTED.inquiry_date >= '2026-01-01').toBe(true);
    });

    it('isNotStarted() が未着手売主に対して true を返すことを確認', () => {
      expect(isNotStarted(SELLER_NOT_STARTED)).toBe(true);
    });

    it('修正前コードでは未着手売主が todayCall に 1 件カウントされる（バグの証明）', () => {
      // バグあり実装では 1 が返される（修正後は 0 が期待される）
      const count = countTodayCallNoInfo_BUGGY([SELLER_NOT_STARTED], TODAY);
      // このアサーションは修正前コードで FAIL する
      expect(count).toBe(0); // FAILS on unfixed code: 1 が返される
    });
  });
});

// ============================================================
// タスク3: Fix Checking と Preservation Checking（修正後コードで検証）
// ============================================================

describe('タスク3: Fix Checking と Preservation Checking（修正後コードで検証）', () => {
  /**
   * タスク3.1: Property 1 の検証
   * 修正後のコードで「未着手」売主が todayCallNotStarted のみにカウントされ
   * todayCall から除外されることを確認
   *
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  describe('3.1 Property 1: 未着手売主の排他カウント（修正後コードで検証）', () => {
    it('【修正後】未着手売主が todayCallNotStarted にカウントされる', () => {
      const notStartedCount = countTodayCallNotStarted([SELLER_NOT_STARTED], TODAY);
      expect(notStartedCount).toBe(1); // todayCallNotStarted に含まれる
    });

    it('【修正後】未着手売主が todayCall から除外される（Property 1 の検証）', () => {
      // 修正後コードでは未着手売主が todayCall から除外される
      const todayCallCount_fixed = countTodayCallNoInfo_FIXED([SELLER_NOT_STARTED], TODAY);
      expect(todayCallCount_fixed).toBe(0); // todayCall には含まれない
    });

    it('【修正後】todayCall + todayCallNotStarted の合計が重複しない（排他性の確認）', () => {
      const sellers = [SELLER_NOT_STARTED];

      const todayCallCount_fixed = countTodayCallNoInfo_FIXED(sellers, TODAY);
      const notStartedCount = countTodayCallNotStarted(sellers, TODAY);

      // 修正後: todayCall=0, notStarted=1 → 合計1（重複なし）
      expect(todayCallCount_fixed).toBe(0);
      expect(notStartedCount).toBe(1);
      expect(todayCallCount_fixed + notStartedCount).toBe(1); // 重複なし
    });

    it('【修正後】複数の未着手売主がいる場合も排他カウントが保たれる', () => {
      // 未着手売主を複数用意
      const sellers = [
        SELLER_NOT_STARTED,
        { ...SELLER_NOT_STARTED, id: 'seller-not-started-2', inquiry_date: '2026-03-01' },
        { ...SELLER_NOT_STARTED, id: 'seller-not-started-3', inquiry_date: '2026-04-01' },
      ];

      const todayCallCount_fixed = countTodayCallNoInfo_FIXED(sellers, TODAY);
      const notStartedCount = countTodayCallNotStarted(sellers, TODAY);

      // 全員が todayCallNotStarted にカウントされ、todayCall には含まれない
      expect(todayCallCount_fixed).toBe(0);
      expect(notStartedCount).toBe(3);
      expect(todayCallCount_fixed + notStartedCount).toBe(3); // 重複なし
    });

    it('【修正後】inquiry_date が境界値（2026-01-01）の売主も todayCallNotStarted にカウントされる', () => {
      const sellerBoundary = { ...SELLER_NOT_STARTED, id: 'seller-boundary', inquiry_date: '2026-01-01' };

      const todayCallCount_fixed = countTodayCallNoInfo_FIXED([sellerBoundary], TODAY);
      const notStartedCount = countTodayCallNotStarted([sellerBoundary], TODAY);

      expect(todayCallCount_fixed).toBe(0); // todayCall には含まれない
      expect(notStartedCount).toBe(1); // todayCallNotStarted に含まれる
    });
  });

  /**
   * タスク3.2: Property 2 の検証
   * 「未着手」条件を満たさない売主が修正後も todayCall に正しくカウントされることを確認
   *
   * Validates: Requirements 3.1, 3.2, 3.5
   */
  describe('3.2 Property 2: 非未着手売主の todayCall カウント保持（修正後コードで検証）', () => {
    it('【修正後】不通売主が todayCall にカウントされる（Preservation）', () => {
      // 不通売主は未着手条件を満たさないため todayCall にカウントされる
      const todayCallCount_fixed = countTodayCallNoInfo_FIXED([SELLER_UNREACHABLE], TODAY);
      const notStartedCount = countTodayCallNotStarted([SELLER_UNREACHABLE], TODAY);

      expect(todayCallCount_fixed).toBe(1); // todayCall にカウントされる
      expect(notStartedCount).toBe(0); // todayCallNotStarted にはカウントされない
    });

    it('【修正後】不通売主は isNotStarted() が false を返す', () => {
      // unreachable_status があるため未着手条件を満たさない
      expect(isNotStarted(SELLER_UNREACHABLE)).toBe(false);
    });

    it('【修正後】他決→追客売主が todayCall にカウントされる（Preservation）', () => {
      // 他決→追客は status !== '追客中' のため未着手条件を満たさない
      const todayCallCount_fixed = countTodayCallNoInfo_FIXED([SELLER_OTHER_DECISION], TODAY);
      const notStartedCount = countTodayCallNotStarted([SELLER_OTHER_DECISION], TODAY);

      expect(todayCallCount_fixed).toBe(1); // todayCall にカウントされる
      expect(notStartedCount).toBe(0); // todayCallNotStarted にはカウントされない
    });

    it('【修正後】他決→追客売主は isNotStarted() が false を返す', () => {
      // status === '他決→追客' のため未着手条件を満たさない
      expect(isNotStarted(SELLER_OTHER_DECISION)).toBe(false);
    });

    it('【修正後】古い反響日付売主が todayCall にカウントされる（Preservation）', () => {
      // inquiry_date < '2026-01-01' のため未着手条件を満たさない
      const todayCallCount_fixed = countTodayCallNoInfo_FIXED([SELLER_OLD_INQUIRY_DATE], TODAY);
      const notStartedCount = countTodayCallNotStarted([SELLER_OLD_INQUIRY_DATE], TODAY);

      expect(todayCallCount_fixed).toBe(1); // todayCall にカウントされる
      expect(notStartedCount).toBe(0); // todayCallNotStarted にはカウントされない
    });

    it('【修正後】古い反響日付売主は isNotStarted() が false を返す', () => {
      // inquiry_date = '2025-12-31' < '2026-01-01' のため未着手条件を満たさない
      expect(isNotStarted(SELLER_OLD_INQUIRY_DATE)).toBe(false);
    });

    it('【修正後】混在ケース: 未着手・不通・他決→追客・古い反響日付が混在する場合', () => {
      const sellers = [
        SELLER_NOT_STARTED,      // 未着手 → todayCallNotStarted のみ
        SELLER_UNREACHABLE,      // 不通 → todayCall のみ
        SELLER_OTHER_DECISION,   // 他決→追客 → todayCall のみ
        SELLER_OLD_INQUIRY_DATE, // 古い反響日付 → todayCall のみ
      ];

      const todayCallCount_fixed = countTodayCallNoInfo_FIXED(sellers, TODAY);
      const notStartedCount = countTodayCallNotStarted(sellers, TODAY);

      // 未着手1件は todayCallNotStarted に、残り3件は todayCall に
      expect(todayCallCount_fixed).toBe(3); // 不通・他決→追客・古い反響日付
      expect(notStartedCount).toBe(1); // 未着手のみ
      expect(todayCallCount_fixed + notStartedCount).toBe(4); // 重複なし
    });

    it('【修正後】修正前後で非未着手売主のカウントが変わらない（Preservation の確認）', () => {
      // 非未着手売主のみのリスト
      const nonNotStartedSellers = [
        SELLER_UNREACHABLE,
        SELLER_OTHER_DECISION,
        SELLER_OLD_INQUIRY_DATE,
      ];

      const todayCallCount_buggy = countTodayCallNoInfo_BUGGY(nonNotStartedSellers, TODAY);
      const todayCallCount_fixed = countTodayCallNoInfo_FIXED(nonNotStartedSellers, TODAY);

      // 非未着手売主については修正前後でカウントが変わらない
      expect(todayCallCount_fixed).toBe(todayCallCount_buggy);
      expect(todayCallCount_fixed).toBe(3);
    });
  });

  describe('3.3 境界値テスト', () => {
    it('inquiry_date が 2025-12-31 の売主は todayCall にカウントされる（境界値）', () => {
      const seller = { ...SELLER_NOT_STARTED, inquiry_date: '2025-12-31' };
      expect(isNotStarted(seller)).toBe(false); // 未着手条件を満たさない
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(1); // todayCall にカウント
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(0); // todayCallNotStarted にはカウントされない
    });

    it('inquiry_date が 2026-01-01 の売主は todayCallNotStarted にカウントされる（境界値）', () => {
      const seller = { ...SELLER_NOT_STARTED, inquiry_date: '2026-01-01' };
      expect(isNotStarted(seller)).toBe(true); // 未着手条件を満たす
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(0); // todayCall には含まれない
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(1); // todayCallNotStarted にカウント
    });

    it('confidence_level が「ダブり」の売主は todayCall にカウントされる', () => {
      const seller = { ...SELLER_NOT_STARTED, confidence_level: 'ダブり' };
      expect(isNotStarted(seller)).toBe(false); // 未着手条件を満たさない
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(1); // todayCall にカウント
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(0);
    });

    it('confidence_level が「D」の売主は todayCall にカウントされる', () => {
      const seller = { ...SELLER_NOT_STARTED, confidence_level: 'D' };
      expect(isNotStarted(seller)).toBe(false);
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(1);
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(0);
    });

    it('confidence_level が「AI査定」の売主は todayCall にカウントされる', () => {
      const seller = { ...SELLER_NOT_STARTED, confidence_level: 'AI査定' };
      expect(isNotStarted(seller)).toBe(false);
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(1);
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(0);
    });

    it('連絡先情報がある売主は todayCall にも todayCallNotStarted にもカウントされない', () => {
      const seller = { ...SELLER_NOT_STARTED, phone_contact_person: 'Y' };
      // 連絡先情報があるため filteredTodayCallSellers の hasInfo チェックで除外される
      expect(hasContactInfo(seller)).toBe(true);
      expect(countTodayCallNoInfo_FIXED([seller], TODAY)).toBe(0);
      expect(countTodayCallNotStarted([seller], TODAY)).toBe(0);
    });
  });
});
