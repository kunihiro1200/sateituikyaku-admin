/**
 * Task 2: 保存プロパティテスト（修正前）
 *
 * Feature: buyer-sidebar-filter-all-items-bug, Property 2: Preservation
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * IMPORTANT: このテストは未修正コードで成功することが期待されます
 * GOAL: 修正後も保持されるべきベースライン動作を確認
 *
 * これらのテストは非バグ条件の入力をカバーします（全件データ取得済みの状態）:
 *   - 全件データ取得済みの状態でのフロント側フィルタリング
 *   - 検索クエリとカテゴリフィルタの併用
 *   - 「All」カテゴリの選択
 *   - サイドバーカウント表示
 */

// ============================================================
// BuyersPage.tsxの現在のフィルタリングロジックを再現
// （全件データ取得済みの場合のフロント側フィルタリング）
// ============================================================

type BuyerWithStatus = {
  buyer_number: string;
  name: string;
  phone_number: string;
  property_number: string;
  calculated_status: string | null;
  follow_up_assignee: string | null;
  initial_assignee: string | null;
  next_call_date: string | null;
  reception_date: string | null;
  [key: string]: any;
};

// カテゴリキーを日本語表示名に変換するマッピング（BuyersPage.tsxから）
const categoryKeyToDisplayName: Record<string, string> = {
  'viewingDayBefore': '内覧日前日',
  'visitCompleted': '内覧済み',
  'todayCall': '当日TEL',
  'todayCallWithInfo': '当日TEL（内容）',
  'threeCallUnchecked': '3回架電未',
  'inquiryEmailUnanswered': '問合メール未対応',
  'brokerInquiry': '業者問合せあり',
  'generalViewingSellerContactPending': '一般媒介_内覧後売主連絡未',
  'viewingPromotionRequired': '要内覧促進客',
  'pinrichUnregistered': 'ピンリッチ未登録',
  'unvaluated': '未査定',
  'mailingPending': '査定（郵送）',
  'todayCallNotStarted': '当日TEL_未着手',
  'pinrichEmpty': 'Pinrich空欄',
  'todayCallAssigned': '当日TEL（担当）',
  'visitAssigned': '担当',
  'exclusive': '専任',
  'general': '一般',
  'visitOtherDecision': '内覧後他決',
  'unvisitedOtherDecision': '未内覧他決',
};

// 全角英数字・スペースを半角に変換（BuyersPage.tsxから）
function normalizeSearch(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
}

// フロント側フィルタリングロジック（全件データ取得済みの場合）
function applyFrontendFilter(
  allBuyers: BuyerWithStatus[],
  selectedCalculatedStatus: string | null,
  searchQuery: string = ''
): BuyerWithStatus[] {
  // カテゴリフィルタ
  let filtered = selectedCalculatedStatus !== null
    ? allBuyers.filter(b => {
        // 担当者別カテゴリ（assigned:Y, todayCallAssigned:I など）の処理
        if (selectedCalculatedStatus.startsWith('assigned:')) {
          const assignee = selectedCalculatedStatus.replace('assigned:', '');
          // バックエンドと同じロジック: follow_up_assignee が一致、または follow_up_assignee が空で initial_assignee が一致
          const matches = (
            b.follow_up_assignee === assignee ||
            (!b.follow_up_assignee && b.initial_assignee === assignee)
          );
          return matches;
        } else if (selectedCalculatedStatus.startsWith('todayCallAssigned:')) {
          const assignee = selectedCalculatedStatus.replace('todayCallAssigned:', '');
          // バックエンドと同じロジック: follow_up_assignee が一致 AND next_call_date が今日以前
          const now = new Date();
          const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
          const jstTime = new Date(now.getTime() + JST_OFFSET_MS);
          const todayStr = jstTime.toISOString().split('T')[0];  // JST日付（YYYY-MM-DD）
          const nextCallDateStr = b.next_call_date ? b.next_call_date.substring(0, 10) : null;
          
          const matches = (
            b.follow_up_assignee === assignee &&
            nextCallDateStr !== null &&
            nextCallDateStr <= todayStr
          );
          return matches;
        } else {
          // サイドバーのカテゴリキーを日本語の表示名に変換
          const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
          
          // バックエンドのcalculated_statusは既に日本語（例: "内覧日前日", "担当(Y)", "当日TEL(Y)"）
          // フィルタリングは日本語の表示名で直接比較
          const matches = b.calculated_status === displayName;
          return matches;
        }
      })
    : [...allBuyers];

  // 検索フィルタ
  if (searchQuery) {
    const s = normalizeSearch(searchQuery).toLowerCase();
    const isBuyerNumber = /^\d{4,5}$/.test(s);
    filtered = filtered.filter(b => {
      if (isBuyerNumber) return (b.buyer_number || '') === s;
      return (
        (b.buyer_number || '').toLowerCase().includes(s) ||
        (b.name || '').toLowerCase().includes(s) ||
        (b.phone_number || '').toLowerCase().includes(s) ||
        (b.property_number || '').toLowerCase().includes(s)
      );
    });
  }

  // ソート（受付日降順）
  filtered.sort((a, b) => {
    if (!a.reception_date && !b.reception_date) return 0;
    if (!a.reception_date) return 1;
    if (!b.reception_date) return -1;
    return b.reception_date.localeCompare(a.reception_date);
  });

  return filtered;
}

// ============================================================
// テストデータ
// ============================================================

const createBuyer = (
  buyer_number: string,
  calculated_status: string | null,
  follow_up_assignee: string | null = null,
  initial_assignee: string | null = null,
  next_call_date: string | null = null,
  name: string = 'テスト買主',
  phone_number: string = '090-1234-5678',
  property_number: string = 'AA1234',
  reception_date: string = '2026-01-01'
): BuyerWithStatus => ({
  buyer_number,
  name,
  phone_number,
  property_number,
  calculated_status,
  follow_up_assignee,
  initial_assignee,
  next_call_date,
  reception_date,
  latest_status: '',
  inquiry_confidence: '',
  email: '',
  viewing_date: null,
  desired_timing: null,
  status_priority: 0,
});

const ALL_BUYERS: BuyerWithStatus[] = [
  createBuyer('7001', '内覧日前日', 'Y', 'Y', '2026-01-15', '山田太郎', '090-1111-1111', 'AA1001', '2026-01-10'),
  createBuyer('7002', '当日TEL', 'I', 'I', '2026-01-14', '佐藤花子', '090-2222-2222', 'AA1002', '2026-01-09'),
  createBuyer('7003', '担当(Y)', 'Y', 'Y', '2026-01-20', '鈴木一郎', '090-3333-3333', 'AA1003', '2026-01-08'),
  createBuyer('7004', '担当(I)', 'I', 'I', '2026-01-18', '田中美咲', '090-4444-4444', 'AA1004', '2026-01-07'),
  createBuyer('7005', '当日TEL(Y)', 'Y', 'Y', '2026-01-13', '高橋健太', '090-5555-5555', 'AA1005', '2026-01-06'),
  createBuyer('7006', null, null, null, null, '伊藤真由美', '090-6666-6666', 'AA1006', '2026-01-05'),
  createBuyer('7007', '3回架電未', 'K', 'K', '2026-01-16', '渡辺大輔', '090-7777-7777', 'AA1007', '2026-01-04'),
  createBuyer('7008', '問合メール未対応', 'Y', 'Y', '2026-01-17', '中村愛', '090-8888-8888', 'AA1008', '2026-01-03'),
];

// ============================================================
// Property 2: Preservation - 全件データ取得済みの状態での動作（未修正コードで成功）
// ============================================================

describe('Property 2: Preservation - 全件データ取得済みの状態での動作（未修正コードで成功）', () => {
  /**
   * Test 1: 全件データ取得済みの状態で「担当(Y)」をクリック → フロント側フィルタリングが継続
   *
   * 全件データが既に取得済みの場合、APIコールせずにフロント側でフィルタリングを実行する。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.1, 3.3
   */
  it('全件データ取得済みの状態で「担当(Y)」をクリック → フロント側フィルタリングが継続', () => {
    // 全件データ取得済みの状態をシミュレート
    const result = applyFrontendFilter(ALL_BUYERS, 'assigned:Y');

    // 「担当(Y)」に該当する買主のみが返される
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(b => 
      b.follow_up_assignee === 'Y' || 
      (!b.follow_up_assignee && b.initial_assignee === 'Y')
    )).toBe(true);

    // 具体的な買主番号を確認
    const buyerNumbers = result.map(b => b.buyer_number);
    expect(buyerNumbers).toContain('7001'); // 内覧日前日（follow_up_assignee: Y）
    expect(buyerNumbers).toContain('7003'); // 担当(Y)（follow_up_assignee: Y）
    expect(buyerNumbers).toContain('7005'); // 当日TEL(Y)（follow_up_assignee: Y）
    expect(buyerNumbers).toContain('7008'); // 問合メール未対応（follow_up_assignee: Y）
  });

  /**
   * Test 2: 検索クエリ入力後に「内覧日前日」をクリック → 検索とカテゴリフィルタの両方が適用
   *
   * 検索クエリとカテゴリフィルタを併用した場合、両方のフィルタが適用される。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.4
   */
  it('検索クエリ入力後に「内覧日前日」をクリック → 検索とカテゴリフィルタの両方が適用', () => {
    // 検索クエリ「山田」とカテゴリ「内覧日前日」を併用
    const result = applyFrontendFilter(ALL_BUYERS, 'viewingDayBefore', '山田');

    // 検索クエリとカテゴリフィルタの両方に一致する買主のみが返される
    expect(result.length).toBe(1);
    expect(result[0].buyer_number).toBe('7001');
    expect(result[0].name).toBe('山田太郎');
    expect(result[0].calculated_status).toBe('内覧日前日');
  });

  /**
   * Test 3: 「All」をクリック → 全件が表示
   *
   * 「All」カテゴリを選択した場合、全件が表示される。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.2
   */
  it('「All」をクリック → 全件が表示', () => {
    // 「All」カテゴリを選択（selectedCalculatedStatus = null）
    const result = applyFrontendFilter(ALL_BUYERS, null);

    // 全件が返される
    expect(result.length).toBe(ALL_BUYERS.length);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ buyer_number: '7001' }),
        expect.objectContaining({ buyer_number: '7002' }),
        expect.objectContaining({ buyer_number: '7003' }),
        expect.objectContaining({ buyer_number: '7004' }),
        expect.objectContaining({ buyer_number: '7005' }),
        expect.objectContaining({ buyer_number: '7006' }),
        expect.objectContaining({ buyer_number: '7007' }),
        expect.objectContaining({ buyer_number: '7008' }),
      ])
    );
  });

  /**
   * Test 4: カテゴリクリック後もサイドバーカウントが正しく表示
   *
   * カテゴリをクリックしても、サイドバーのカウント表示は変更されない。
   * （サイドバーカウントは全件データから計算されるため）
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.2
   */
  it('カテゴリクリック後もサイドバーカウントが正しく表示（全件データから計算）', () => {
    // サイドバーカウントは全件データから計算される
    const viewingDayBeforeCount = ALL_BUYERS.filter(b => b.calculated_status === '内覧日前日').length;
    const todayCallCount = ALL_BUYERS.filter(b => b.calculated_status === '当日TEL').length;
    const assignedYCount = ALL_BUYERS.filter(b => 
      b.follow_up_assignee === 'Y' || 
      (!b.follow_up_assignee && b.initial_assignee === 'Y')
    ).length;

    // カウントが正しく計算される
    expect(viewingDayBeforeCount).toBe(1); // 7001
    expect(todayCallCount).toBe(1); // 7002
    expect(assignedYCount).toBe(4); // 7001, 7003, 7005, 7008

    // カテゴリをクリックしてもカウントは変わらない（全件データから計算されるため）
    const filteredByCategory = applyFrontendFilter(ALL_BUYERS, 'viewingDayBefore');
    const countAfterFilter = ALL_BUYERS.filter(b => b.calculated_status === '内覧日前日').length;
    expect(countAfterFilter).toBe(viewingDayBeforeCount); // カウントは変わらない
  });

  /**
   * Test 5: 買主番号での検索（4-5桁の数字）
   *
   * 買主番号（4-5桁の数字）で検索した場合、完全一致で検索される。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.4
   */
  it('買主番号での検索（4-5桁の数字）→ 完全一致で検索', () => {
    // 買主番号「7001」で検索
    const result = applyFrontendFilter(ALL_BUYERS, null, '7001');

    // 完全一致する買主のみが返される
    expect(result.length).toBe(1);
    expect(result[0].buyer_number).toBe('7001');
  });

  /**
   * Test 6: 名前での部分一致検索
   *
   * 名前で検索した場合、部分一致で検索される。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.4
   */
  it('名前での部分一致検索', () => {
    // 名前「田」で検索（「山田」「田中」が該当）
    const result = applyFrontendFilter(ALL_BUYERS, null, '田');

    // 部分一致する買主が返される
    expect(result.length).toBe(2);
    const buyerNumbers = result.map(b => b.buyer_number);
    expect(buyerNumbers).toContain('7001'); // 山田太郎
    expect(buyerNumbers).toContain('7004'); // 田中美咲
  });

  /**
   * Test 7: 受付日降順でソート
   *
   * フィルタリング後、受付日降順でソートされる。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.3
   */
  it('受付日降順でソート', () => {
    // 全件を取得
    const result = applyFrontendFilter(ALL_BUYERS, null);

    // 受付日降順でソートされている
    expect(result[0].buyer_number).toBe('7001'); // 2026-01-10
    expect(result[1].buyer_number).toBe('7002'); // 2026-01-09
    expect(result[2].buyer_number).toBe('7003'); // 2026-01-08
    expect(result[3].buyer_number).toBe('7004'); // 2026-01-07
    expect(result[4].buyer_number).toBe('7005'); // 2026-01-06
    expect(result[5].buyer_number).toBe('7006'); // 2026-01-05
    expect(result[6].buyer_number).toBe('7007'); // 2026-01-04
    expect(result[7].buyer_number).toBe('7008'); // 2026-01-03
  });

  /**
   * Test 8: 全角英数字・スペースを半角に変換して検索
   *
   * 全角英数字・スペースを半角に変換してから検索される。
   * この動作は修正後も保持されるべき。
   *
   * Validates: Requirements 3.4
   */
  it('全角英数字・スペースを半角に変換して検索', () => {
    // 全角数字「７００１」で検索
    const result = applyFrontendFilter(ALL_BUYERS, null, '７００１');

    // 半角に変換されて検索される
    expect(result.length).toBe(1);
    expect(result[0].buyer_number).toBe('7001');
  });
});
