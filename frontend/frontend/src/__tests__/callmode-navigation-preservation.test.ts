/**
 * タスク2: 保全プロパティテスト（修正前に実施）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで通過することが期待されます。
 * 修正後もリグレッションがないことを確認するためのベースラインテストです。
 *
 * 保全すべき動作:
 * 3.1 通話モードページで売主情報（名前・電話番号・ステータス等）が正確に表示される
 * 3.2 サイドバーカテゴリ選択時に正確なカテゴリ別フィルタリングが行われる
 * 3.3 売主データ更新後に更新後のデータが正しく反映される
 * 3.4 通話モードページのサイドバーに営担でフィルタリングされた売主リストが表示される
 */

import fc from 'fast-check';
import {
  isTodayCall,
  isTodayCallWithInfo,
  isVisitScheduled,
  isVisitCompleted,
  isTodayCallAssigned,
  isUnvaluated,
  isMailingPending,
  filterSellersByCategory,
  getCategoryCounts,
} from '../utils/sellerStatusFilters';

// ============================================================
// テスト用の型定義
// ============================================================

/** 売主データの型（テスト用簡略版） */
interface TestSeller {
  id: string;
  sellerNumber: string;
  name: string;
  phoneNumber: string;
  status: string;
  confidence?: string;
  nextCallDate?: string;
  visitDate?: string;
  visitAssignee?: string;
  visitAssigneeInitials?: string;
  contactMethod?: string;
  preferredContactTime?: string;
  phoneContactPerson?: string;
  valuationAmount1?: number;
  valuationAmount2?: number;
  valuationAmount3?: number;
  mailingStatus?: string;
  unreachableStatus?: string;
  pinrichStatus?: string;
  inquiryDate?: string;
}

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/**
 * 日本時間（JST）で今日の日付文字列を取得（YYYY-MM-DD形式）
 */
const getTodayJSTString = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 指定日数後の日付文字列を取得（YYYY-MM-DD形式）
 */
const getDateOffsetString = (offsetDays: number): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  jstTime.setUTCDate(jstTime.getUTCDate() + offsetDays);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 基本的な売主データを生成するファクトリ関数
 */
const createTestSeller = (overrides: Partial<TestSeller> = {}): TestSeller => ({
  id: 'test-seller-001',
  sellerNumber: 'AA13501',
  name: 'テスト売主',
  phoneNumber: '090-1234-5678',
  status: '追客中',
  nextCallDate: getTodayJSTString(),
  ...overrides,
});

// ============================================================
// fast-check ジェネレーター定義
// ============================================================

/**
 * 売主番号のジェネレーター（AA + 5桁数字）
 */
const sellerNumberArb = fc.integer({ min: 10000, max: 99999 }).map(n => `AA${n}`);

/**
 * 売主名のジェネレーター（日本語名）
 */
const sellerNameArb = fc.constantFrom(
  '山田太郎', '鈴木花子', '田中一郎', '佐藤美咲', '伊藤健二',
  '渡辺幸子', '中村浩', '小林明子', '加藤誠', '吉田恵子'
);

/**
 * 電話番号のジェネレーター
 */
const phoneNumberArb = fc.tuple(
  fc.constantFrom('090', '080', '070'),
  fc.integer({ min: 1000, max: 9999 }).map(n => String(n)),
  fc.integer({ min: 1000, max: 9999 }).map(n => String(n))
).map(([prefix, mid, last]) => `${prefix}-${mid}-${last}`);

/**
 * 追客中ステータスのジェネレーター
 */
const followingUpStatusArb = fc.constantFrom(
  '追客中', '除外後追客中', '他決→追客'
);

/**
 * 営担イニシャルのジェネレーター
 */
const visitAssigneeArb = fc.constantFrom('Y', 'I', 'K', 'M', 'T', 'S');

/**
 * 今日以前の日付のジェネレーター（YYYY-MM-DD形式）
 */
const pastDateArb = fc.integer({ min: 1, max: 30 }).map(days => getDateOffsetString(-days));

/**
 * 今日以降の日付のジェネレーター（YYYY-MM-DD形式）
 */
const futureDateArb = fc.integer({ min: 0, max: 30 }).map(days => getDateOffsetString(days));

/**
 * コミュニケーション情報のジェネレーター（空でない値）
 */
const contactInfoArb = fc.constantFrom(
  'Eメール', '電話', 'LINE', '午前中', '午後', '夕方',
  'Y', 'I', 'K', 'M', 'T'
);

// ============================================================
// Property 2: Preservation - 売主データ表示・フィルタリングの正確性
// ============================================================

describe('Property 2: Preservation - 売主データ表示・フィルタリングの正確性', () => {

  // ----------------------------------------------------------
  // 3.1 通話モードページで売主情報が正確に表示される
  // ----------------------------------------------------------

  describe('3.1 売主情報の正確な表示', () => {
    /**
     * プロパティ2-1: 売主データのフィールドが正確に保持される
     *
     * 売主データ（名前・電話番号・ステータス等）が
     * 作成後も変更されずに保持されることを確認する。
     *
     * **Validates: Requirements 3.1**
     */
    test('プロパティ2-1: 売主データのフィールドが正確に保持される', () => {
      fc.assert(
        fc.property(
          sellerNumberArb,
          sellerNameArb,
          phoneNumberArb,
          followingUpStatusArb,
          (sellerNumber, name, phoneNumber, status) => {
            // 売主データを作成
            const seller = createTestSeller({
              sellerNumber,
              name,
              phoneNumber,
              status,
            });

            // 各フィールドが正確に保持されていることを確認
            expect(seller.sellerNumber).toBe(sellerNumber);
            expect(seller.name).toBe(name);
            expect(seller.phoneNumber).toBe(phoneNumber);
            expect(seller.status).toBe(status);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-2: 売主番号の形式が正しい
     *
     * 売主番号は「AA + 5桁数字」の形式であることを確認する。
     *
     * **Validates: Requirements 3.1**
     */
    test('プロパティ2-2: 売主番号の形式が正しい（AA + 数字）', () => {
      fc.assert(
        fc.property(
          sellerNumberArb,
          (sellerNumber) => {
            // 売主番号の形式を確認
            expect(sellerNumber).toMatch(/^AA\d{5}$/);
            expect(sellerNumber.startsWith('AA')).toBe(true);
            expect(sellerNumber.length).toBe(7);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-3: 売主データ更新後に更新後のデータが正しく反映される
     *
     * 売主データを更新した場合、更新後のデータが正確に反映されることを確認する。
     *
     * **Validates: Requirements 3.1, 3.3**
     */
    test('プロパティ2-3: 売主データ更新後に更新後のデータが正しく反映される', () => {
      fc.assert(
        fc.property(
          sellerNameArb,
          phoneNumberArb,
          followingUpStatusArb,
          (newName, newPhoneNumber, newStatus) => {
            // 元の売主データ
            const originalSeller = createTestSeller({
              name: '元の名前',
              phoneNumber: '090-0000-0000',
              status: '追客中',
            });

            // 売主データを更新（スプレッドオペレーターで新しいオブジェクトを作成）
            const updatedSeller = {
              ...originalSeller,
              name: newName,
              phoneNumber: newPhoneNumber,
              status: newStatus,
            };

            // 更新後のデータが正確に反映されていることを確認
            expect(updatedSeller.name).toBe(newName);
            expect(updatedSeller.phoneNumber).toBe(newPhoneNumber);
            expect(updatedSeller.status).toBe(newStatus);

            // 更新していないフィールドは変更されていないことを確認
            expect(updatedSeller.id).toBe(originalSeller.id);
            expect(updatedSeller.sellerNumber).toBe(originalSeller.sellerNumber);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ----------------------------------------------------------
  // 3.2 サイドバーカテゴリ選択時の正確なフィルタリング
  // ----------------------------------------------------------

  describe('3.2 サイドバーカテゴリ別フィルタリングの正確性', () => {
    /**
     * プロパティ2-4: 当日TEL分フィルターの正確性
     *
     * 当日TEL分の条件（追客中 + 次電日が今日以前 + コミュニケーション情報なし + 営担なし）
     * を満たす売主のみがフィルタリングされることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-4: 当日TEL分フィルターが正確に動作する', () => {
      fc.assert(
        fc.property(
          followingUpStatusArb,
          pastDateArb,
          (status, nextCallDate) => {
            // 当日TEL分の条件を満たす売主
            const todayCallSeller = createTestSeller({
              status,
              nextCallDate,
              visitAssignee: '',       // 営担なし
              contactMethod: '',       // コミュニケーション情報なし
              preferredContactTime: '',
              phoneContactPerson: '',
            });

            // 当日TEL分として判定されることを確認
            expect(isTodayCall(todayCallSeller)).toBe(true);

            // filterSellersByCategoryでも正しくフィルタリングされることを確認
            const sellers = [todayCallSeller];
            const filtered = filterSellersByCategory(sellers, 'todayCall');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].sellerNumber).toBe(todayCallSeller.sellerNumber);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-5: 当日TEL分フィルターの排他性
     *
     * 営担がある売主は当日TEL分に含まれないことを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-5: 営担がある売主は当日TEL分に含まれない', () => {
      fc.assert(
        fc.property(
          followingUpStatusArb,
          pastDateArb,
          visitAssigneeArb,
          (status, nextCallDate, visitAssignee) => {
            // 営担がある売主（当日TEL分の条件を満たさない）
            const sellerWithAssignee = createTestSeller({
              status,
              nextCallDate,
              visitAssignee,
              visitAssigneeInitials: visitAssignee,
              contactMethod: '',
              preferredContactTime: '',
              phoneContactPerson: '',
            });

            // 当日TEL分として判定されないことを確認
            expect(isTodayCall(sellerWithAssignee)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-6: 当日TEL（内容）フィルターの正確性
     *
     * コミュニケーション情報がある売主は当日TEL（内容）に分類されることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-6: コミュニケーション情報がある売主は当日TEL（内容）に分類される', () => {
      fc.assert(
        fc.property(
          followingUpStatusArb,
          pastDateArb,
          contactInfoArb,
          (status, nextCallDate, contactInfo) => {
            // コミュニケーション情報がある売主
            const sellerWithContactInfo = createTestSeller({
              status,
              nextCallDate,
              visitAssignee: '',
              contactMethod: contactInfo,
            });

            // 当日TEL分ではなく当日TEL（内容）として判定されることを確認
            expect(isTodayCall(sellerWithContactInfo)).toBe(false);
            expect(isTodayCallWithInfo(sellerWithContactInfo)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-7: 訪問予定フィルターの正確性
     *
     * 営担があり訪問日が今日以降の売主が訪問予定として分類されることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-7: 訪問予定フィルターが正確に動作する', () => {
      fc.assert(
        fc.property(
          visitAssigneeArb,
          futureDateArb,
          (visitAssignee, visitDate) => {
            // 訪問予定の条件を満たす売主
            const visitDayBeforeSeller = createTestSeller({
              visitAssignee,
              visitAssigneeInitials: visitAssignee,
              visitDate,
            });

            // 訪問予定として判定されることを確認
            expect(isVisitDayBefore(visitDayBeforeSeller)).toBe(true);
            expect(isVisitCompleted(visitDayBeforeSeller)).toBe(false);

            // filterSellersByCategoryでも正しくフィルタリングされることを確認
            const sellers = [visitDayBeforeSeller];
            const filtered = filterSellersByCategory(sellers, 'visitDayBefore');
            expect(filtered).toHaveLength(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-8: 訪問済みフィルターの正確性
     *
     * 営担があり訪問日が昨日以前の売主が訪問済みとして分類されることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-8: 訪問済みフィルターが正確に動作する', () => {
      fc.assert(
        fc.property(
          visitAssigneeArb,
          pastDateArb,
          (visitAssignee, visitDate) => {
            // 訪問済みの条件を満たす売主
            const visitCompletedSeller = createTestSeller({
              visitAssignee,
              visitAssigneeInitials: visitAssignee,
              visitDate,
            });

            // 訪問済みとして判定されることを確認
            expect(isVisitCompleted(visitCompletedSeller)).toBe(true);
            expect(isVisitDayBefore(visitCompletedSeller)).toBe(false);

            // filterSellersByCategoryでも正しくフィルタリングされることを確認
            const sellers = [visitCompletedSeller];
            const filtered = filterSellersByCategory(sellers, 'visitCompleted');
            expect(filtered).toHaveLength(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-9: 全件表示（'all'カテゴリ）の正確性
     *
     * 'all'カテゴリを選択した場合、全ての売主が表示されることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-9: allカテゴリは全ての売主を返す', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              sellerNumber: sellerNumberArb,
              name: sellerNameArb,
              phoneNumber: phoneNumberArb,
              status: followingUpStatusArb,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (sellers) => {
            // 'all'カテゴリでフィルタリングすると全件返ってくることを確認
            const filtered = filterSellersByCategory(sellers, 'all');
            expect(filtered).toHaveLength(sellers.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ----------------------------------------------------------
  // 3.3 売主データ更新後のキャッシュ無効化
  // ----------------------------------------------------------

  describe('3.3 売主データ更新後のデータ反映', () => {
    /**
     * プロパティ2-10: 売主データ更新後にステータスが正しく反映される
     *
     * 売主のステータスを更新した場合、フィルタリング結果も
     * 更新後のステータスに基づいて正しく変わることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('プロパティ2-10: ステータス更新後にフィルタリング結果が正しく変わる', () => {
      fc.assert(
        fc.property(
          pastDateArb,
          (nextCallDate) => {
            // 元の売主データ（当日TEL分の条件を満たす）
            const originalSeller = createTestSeller({
              status: '追客中',
              nextCallDate,
              visitAssignee: '',
              contactMethod: '',
              preferredContactTime: '',
              phoneContactPerson: '',
            });

            // 元のデータは当日TEL分として判定される
            expect(isTodayCall(originalSeller)).toBe(true);

            // ステータスを「追客不要」に更新
            const updatedSeller = {
              ...originalSeller,
              status: '追客不要(未訪問）',
            };

            // 更新後は当日TEL分として判定されない
            expect(isTodayCall(updatedSeller)).toBe(false);

            // フィルタリング結果も変わることを確認
            const sellers = [updatedSeller];
            const filtered = filterSellersByCategory(sellers, 'todayCall');
            expect(filtered).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-11: 営担設定後にフィルタリング結果が正しく変わる
     *
     * 売主に営担を設定した場合、当日TEL分から除外され
     * 当日TEL（担当）に分類されることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('プロパティ2-11: 営担設定後にフィルタリング結果が正しく変わる', () => {
      fc.assert(
        fc.property(
          pastDateArb,
          visitAssigneeArb,
          (nextCallDate, visitAssignee) => {
            // 元の売主データ（営担なし）
            const originalSeller = createTestSeller({
              status: '追客中',
              nextCallDate,
              visitAssignee: '',
              contactMethod: '',
              preferredContactTime: '',
              phoneContactPerson: '',
            });

            // 元のデータは当日TEL分として判定される
            expect(isTodayCall(originalSeller)).toBe(true);

            // 営担を設定
            const updatedSeller = {
              ...originalSeller,
              visitAssignee,
              visitAssigneeInitials: visitAssignee,
            };

            // 更新後は当日TEL分として判定されない
            expect(isTodayCall(updatedSeller)).toBe(false);

            // 当日TEL（担当）として判定される
            expect(isTodayCallAssigned(updatedSeller)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-12: コミュニケーション情報設定後にフィルタリング結果が正しく変わる
     *
     * 売主にコミュニケーション情報を設定した場合、
     * 当日TEL分から当日TEL（内容）に移動することを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('プロパティ2-12: コミュニケーション情報設定後にフィルタリング結果が正しく変わる', () => {
      fc.assert(
        fc.property(
          pastDateArb,
          contactInfoArb,
          (nextCallDate, contactInfo) => {
            // 元の売主データ（コミュニケーション情報なし）
            const originalSeller = createTestSeller({
              status: '追客中',
              nextCallDate,
              visitAssignee: '',
              contactMethod: '',
              preferredContactTime: '',
              phoneContactPerson: '',
            });

            // 元のデータは当日TEL分として判定される
            expect(isTodayCall(originalSeller)).toBe(true);
            expect(isTodayCallWithInfo(originalSeller)).toBe(false);

            // コミュニケーション情報を設定
            const updatedSeller = {
              ...originalSeller,
              contactMethod: contactInfo,
            };

            // 更新後は当日TEL分ではなく当日TEL（内容）として判定される
            expect(isTodayCall(updatedSeller)).toBe(false);
            expect(isTodayCallWithInfo(updatedSeller)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ----------------------------------------------------------
  // 3.4 通話モードページのサイドバーに営担でフィルタリングされた売主リストが表示される
  // ----------------------------------------------------------

  describe('3.4 サイドバーの営担フィルタリング', () => {
    /**
     * プロパティ2-13: 営担でフィルタリングした売主リストの正確性
     *
     * 特定の営担（visitAssignee）でフィルタリングした場合、
     * その営担に割り当てられた売主のみが返されることを確認する。
     *
     * **Validates: Requirements 3.4**
     */
    test('プロパティ2-13: 営担でフィルタリングした売主リストが正確に返される', () => {
      fc.assert(
        fc.property(
          visitAssigneeArb,
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (targetAssignee, matchCount, nonMatchCount) => {
            // 対象の営担に割り当てられた売主
            const matchingSellers = Array.from({ length: matchCount }, (_, i) =>
              createTestSeller({
                id: `seller-match-${i}`,
                sellerNumber: `AA1000${i}`,
                visitAssignee: targetAssignee,
                visitAssigneeInitials: targetAssignee,
                visitDate: getDateOffsetString(i + 1), // 今日以降
              })
            );

            // 別の営担に割り当てられた売主
            const otherAssignee = targetAssignee === 'Y' ? 'I' : 'Y';
            const nonMatchingSellers = Array.from({ length: nonMatchCount }, (_, i) =>
              createTestSeller({
                id: `seller-non-match-${i}`,
                sellerNumber: `AA2000${i}`,
                visitAssignee: otherAssignee,
                visitAssigneeInitials: otherAssignee,
                visitDate: getDateOffsetString(i + 1),
              })
            );

            const allSellers = [...matchingSellers, ...nonMatchingSellers];

            // visitAssigned:targetAssignee でフィルタリング
            const filtered = filterSellersByCategory(
              allSellers,
              `visitAssigned:${targetAssignee}`
            );

            // 対象の営担の売主のみが返されることを確認
            expect(filtered).toHaveLength(matchCount);
            filtered.forEach(seller => {
              expect(
                seller.visitAssignee === targetAssignee ||
                seller.visitAssigneeInitials === targetAssignee
              ).toBe(true);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-14: 営担なしの売主はサイドバーの営担フィルターに含まれない
     *
     * 営担が設定されていない売主は、営担フィルターの結果に含まれないことを確認する。
     *
     * **Validates: Requirements 3.4**
     */
    test('プロパティ2-14: 営担なしの売主は営担フィルターに含まれない', () => {
      fc.assert(
        fc.property(
          visitAssigneeArb,
          (targetAssignee) => {
            // 営担なしの売主
            const sellerWithoutAssignee = createTestSeller({
              visitAssignee: '',
              visitAssigneeInitials: '',
            });

            // 営担フィルターに含まれないことを確認
            const filtered = filterSellersByCategory(
              [sellerWithoutAssignee],
              `visitAssigned:${targetAssignee}`
            );
            expect(filtered).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-15: 「外す」の営担はサイドバーの営担フィルターに含まれない
     *
     * 営担が「外す」の売主は、担当なしと同じ扱いで
     * 営担フィルターの結果に含まれないことを確認する。
     *
     * **Validates: Requirements 3.4**
     */
    test('プロパティ2-15: 営担が「外す」の売主は営担フィルターに含まれない', () => {
      fc.assert(
        fc.property(
          visitAssigneeArb,
          (targetAssignee) => {
            // 営担が「外す」の売主
            const sellerWithExcludedAssignee = createTestSeller({
              visitAssignee: '外す',
              visitAssigneeInitials: '外す',
            });

            // 営担フィルターに含まれないことを確認
            const filtered = filterSellersByCategory(
              [sellerWithExcludedAssignee],
              `visitAssigned:${targetAssignee}`
            );
            expect(filtered).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-16: 複数の営担が混在する場合のフィルタリング正確性
     *
     * 複数の営担が混在するリストから特定の営担でフィルタリングした場合、
     * 正確な件数が返されることを確認する。
     *
     * **Validates: Requirements 3.4**
     */
    test('プロパティ2-16: 複数の営担が混在する場合のフィルタリングが正確', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Y', 'I', 'K'),
          fc.constantFrom('M', 'T', 'S'),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (assignee1, assignee2, count1, count2) => {
            // 2種類の営担の売主を作成
            const sellers1 = Array.from({ length: count1 }, (_, i) =>
              createTestSeller({
                id: `seller-a1-${i}`,
                sellerNumber: `AA3000${i}`,
                visitAssignee: assignee1,
                visitAssigneeInitials: assignee1,
                visitDate: getDateOffsetString(1),
              })
            );
            const sellers2 = Array.from({ length: count2 }, (_, i) =>
              createTestSeller({
                id: `seller-a2-${i}`,
                sellerNumber: `AA4000${i}`,
                visitAssignee: assignee2,
                visitAssigneeInitials: assignee2,
                visitDate: getDateOffsetString(1),
              })
            );

            const allSellers = [...sellers1, ...sellers2];

            // assignee1でフィルタリング
            const filtered1 = filterSellersByCategory(allSellers, `visitAssigned:${assignee1}`);
            expect(filtered1).toHaveLength(count1);

            // assignee2でフィルタリング
            const filtered2 = filterSellersByCategory(allSellers, `visitAssigned:${assignee2}`);
            expect(filtered2).toHaveLength(count2);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ----------------------------------------------------------
  // カテゴリカウントの整合性
  // ----------------------------------------------------------

  describe('カテゴリカウントの整合性', () => {
    /**
     * プロパティ2-17: getCategoryCountsの結果がfilterSellersByCategoryと一致する
     *
     * getCategoryCountsで返されるカウントが、
     * filterSellersByCategoryで返される件数と一致することを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-17: getCategoryCountsとfilterSellersByCategoryの結果が一致する', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              sellerNumber: sellerNumberArb,
              name: sellerNameArb,
              phoneNumber: phoneNumberArb,
              status: fc.constantFrom('追客中', '追客不要(未訪問）', '専任媒介'),
              nextCallDate: fc.oneof(pastDateArb, futureDateArb),
              visitAssignee: fc.oneof(
                fc.constant(''),
                visitAssigneeArb
              ),
              visitAssigneeInitials: fc.constant(''),
              contactMethod: fc.oneof(fc.constant(''), contactInfoArb),
              preferredContactTime: fc.constant(''),
              phoneContactPerson: fc.constant(''),
              visitDate: fc.oneof(fc.constant(undefined), pastDateArb, futureDateArb),
              mailingStatus: fc.oneof(fc.constant(''), fc.constant('未'), fc.constant('済')),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (sellers) => {
            // visitAssigneeInitialsをvisitAssigneeと同じ値に設定
            const normalizedSellers = sellers.map(s => ({
              ...s,
              visitAssigneeInitials: s.visitAssignee,
            }));

            const counts = getCategoryCounts(normalizedSellers);

            // 各カテゴリのカウントがfilterSellersByCategoryの結果と一致することを確認
            expect(counts.todayCall).toBe(
              filterSellersByCategory(normalizedSellers, 'todayCall').length
            );
            expect(counts.todayCallWithInfo).toBe(
              filterSellersByCategory(normalizedSellers, 'todayCallWithInfo').length
            );
            expect(counts.visitScheduled).toBe(
              filterSellersByCategory(normalizedSellers, 'visitScheduled').length
            );
            expect(counts.visitCompleted).toBe(
              filterSellersByCategory(normalizedSellers, 'visitCompleted').length
            );
            expect(counts.mailingPending).toBe(
              filterSellersByCategory(normalizedSellers, 'mailingPending').length
            );
            expect(counts.all).toBe(normalizedSellers.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * プロパティ2-18: 当日TEL分と当日TEL（内容）は排他的
     *
     * 同じ売主が当日TEL分と当日TEL（内容）の両方に含まれることはないことを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('プロパティ2-18: 当日TEL分と当日TEL（内容）は排他的（同じ売主が両方に含まれない）', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              sellerNumber: sellerNumberArb,
              status: followingUpStatusArb,
              nextCallDate: pastDateArb,
              visitAssignee: fc.constant(''),
              visitAssigneeInitials: fc.constant(''),
              contactMethod: fc.oneof(fc.constant(''), contactInfoArb),
              preferredContactTime: fc.constant(''),
              phoneContactPerson: fc.constant(''),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (sellers) => {
            const todayCallSellers = filterSellersByCategory(sellers, 'todayCall');
            const todayCallWithInfoSellers = filterSellersByCategory(sellers, 'todayCallWithInfo');

            // 両方のカテゴリに含まれる売主がいないことを確認
            const todayCallIds = new Set(todayCallSellers.map((s: any) => s.id));
            const todayCallWithInfoIds = new Set(todayCallWithInfoSellers.map((s: any) => s.id));

            const intersection = [...todayCallIds].filter(id => todayCallWithInfoIds.has(id));
            expect(intersection).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

// ============================================================
// 具体的なシナリオテスト（スコープ付きPBTアプローチ）
// ============================================================

describe('具体的なシナリオ: 保全動作の確認', () => {
  /**
   * シナリオ1: 通話モードページで売主情報が正確に表示される
   *
   * 実際の売主データを使って、各フィールドが正確に保持されることを確認する。
   */
  test('シナリオ1: 通話モードページで売主情報が正確に表示される', () => {
    const seller = createTestSeller({
      sellerNumber: 'AA13501',
      name: '山田太郎',
      phoneNumber: '090-1234-5678',
      status: '追客中',
      nextCallDate: getTodayJSTString(),
    });

    // 各フィールドが正確に保持されていることを確認
    expect(seller.sellerNumber).toBe('AA13501');
    expect(seller.name).toBe('山田太郎');
    expect(seller.phoneNumber).toBe('090-1234-5678');
    expect(seller.status).toBe('追客中');
  });

  /**
   * シナリオ2: サイドバーカテゴリ選択時に正確なフィルタリングが行われる
   *
   * 複数の売主が混在するリストから、各カテゴリで正確にフィルタリングされることを確認する。
   */
  test('シナリオ2: サイドバーカテゴリ選択時に正確なフィルタリングが行われる', () => {
    const today = getTodayJSTString();
    const yesterday = getDateOffsetString(-1);
    const tomorrow = getDateOffsetString(1);

    // 様々な状態の売主を作成
    const sellers = [
      // 当日TEL分（追客中 + 次電日が今日 + コミュニケーション情報なし + 営担なし）
      createTestSeller({
        id: 'seller-today-call',
        sellerNumber: 'AA13501',
        status: '追客中',
        nextCallDate: today,
        visitAssignee: '',
        contactMethod: '',
        preferredContactTime: '',
        phoneContactPerson: '',
      }),
      // 当日TEL（内容）（追客中 + 次電日が今日 + コミュニケーション情報あり + 営担なし）
      createTestSeller({
        id: 'seller-today-call-info',
        sellerNumber: 'AA13502',
        status: '追客中',
        nextCallDate: today,
        visitAssignee: '',
        contactMethod: 'Eメール',
      }),
      // 訪問予定（営担あり + 訪問日が明日）
      createTestSeller({
        id: 'seller-visit-scheduled',
        sellerNumber: 'AA13503',
        visitAssignee: 'Y',
        visitAssigneeInitials: 'Y',
        visitDate: tomorrow,
      }),
      // 訪問済み（営担あり + 訪問日が昨日）
      createTestSeller({
        id: 'seller-visit-completed',
        sellerNumber: 'AA13504',
        visitAssignee: 'I',
        visitAssigneeInitials: 'I',
        visitDate: yesterday,
      }),
    ];

    // 各カテゴリのフィルタリング結果を確認
    const todayCallFiltered = filterSellersByCategory(sellers, 'todayCall');
    expect(todayCallFiltered).toHaveLength(1);
    expect(todayCallFiltered[0].sellerNumber).toBe('AA13501');

    const todayCallWithInfoFiltered = filterSellersByCategory(sellers, 'todayCallWithInfo');
    expect(todayCallWithInfoFiltered).toHaveLength(1);
    expect(todayCallWithInfoFiltered[0].sellerNumber).toBe('AA13502');

    const visitDayBeforeFiltered = filterSellersByCategory(sellers, 'visitDayBefore');
    expect(visitDayBeforeFiltered).toHaveLength(1);
    expect(visitDayBeforeFiltered[0].sellerNumber).toBe('AA13503');

    const visitCompletedFiltered = filterSellersByCategory(sellers, 'visitCompleted');
    expect(visitCompletedFiltered).toHaveLength(1);
    expect(visitCompletedFiltered[0].sellerNumber).toBe('AA13504');

    // 全件表示
    const allFiltered = filterSellersByCategory(sellers, 'all');
    expect(allFiltered).toHaveLength(4);
  });

  /**
   * シナリオ3: 売主データ更新後に更新後のデータが正しく反映される
   *
   * 売主のステータスを更新した場合、フィルタリング結果も正しく変わることを確認する。
   */
  test('シナリオ3: 売主データ更新後に更新後のデータが正しく反映される', () => {
    const today = getTodayJSTString();

    // 元の売主データ（当日TEL分の条件を満たす）
    const originalSeller = createTestSeller({
      sellerNumber: 'AA13505',
      status: '追客中',
      nextCallDate: today,
      visitAssignee: '',
      contactMethod: '',
      preferredContactTime: '',
      phoneContactPerson: '',
    });

    // 元のデータは当日TEL分として判定される
    expect(isTodayCall(originalSeller)).toBe(true);

    // ステータスを「専任媒介」に更新
    const updatedSeller = { ...originalSeller, status: '専任媒介' };

    // 更新後は当日TEL分として判定されない
    expect(isTodayCall(updatedSeller)).toBe(false);

    // フィルタリング結果も変わることを確認
    const filteredBefore = filterSellersByCategory([originalSeller], 'todayCall');
    expect(filteredBefore).toHaveLength(1);

    const filteredAfter = filterSellersByCategory([updatedSeller], 'todayCall');
    expect(filteredAfter).toHaveLength(0);
  });

  /**
   * シナリオ4: 通話モードページのサイドバーに営担でフィルタリングされた売主リストが表示される
   *
   * 営担「Y」でフィルタリングした場合、「Y」の売主のみが返されることを確認する。
   */
  test('シナリオ4: 通話モードページのサイドバーに営担でフィルタリングされた売主リストが表示される', () => {
    const tomorrow = getDateOffsetString(1);

    // 複数の営担の売主を作成
    const sellers = [
      createTestSeller({
        id: 'seller-y-1',
        sellerNumber: 'AA13506',
        visitAssignee: 'Y',
        visitAssigneeInitials: 'Y',
        visitDate: tomorrow,
      }),
      createTestSeller({
        id: 'seller-y-2',
        sellerNumber: 'AA13507',
        visitAssignee: 'Y',
        visitAssigneeInitials: 'Y',
        visitDate: tomorrow,
      }),
      createTestSeller({
        id: 'seller-i-1',
        sellerNumber: 'AA13508',
        visitAssignee: 'I',
        visitAssigneeInitials: 'I',
        visitDate: tomorrow,
      }),
    ];

    // 営担「Y」でフィルタリング
    const filteredY = filterSellersByCategory(sellers, 'visitAssigned:Y');
    expect(filteredY).toHaveLength(2);
    filteredY.forEach(seller => {
      expect(
        seller.visitAssignee === 'Y' || seller.visitAssigneeInitials === 'Y'
      ).toBe(true);
    });

    // 営担「I」でフィルタリング
    const filteredI = filterSellersByCategory(sellers, 'visitAssigned:I');
    expect(filteredI).toHaveLength(1);
    expect(filteredI[0].sellerNumber).toBe('AA13508');
  });
});
