/**
 * Preservation Property Test
 *
 * Property 2: Preservation - 既存の担当者別専任公開中カテゴリーの保持
 *
 * 観察優先メソドロジーに従い、未修正コードで非バグ条件の入力の動作を観察する。
 * このテストは未修正コードで PASS すること（ベースラインの動作を確認する）。
 *
 * 保全要件（design.md の Preservation Requirements より）:
 *   - sidebar_status がすでに担当者別形式（'林・専任公開中' など）の物件は引き続き正しく表示される
 *   - 他の担当者（山本→Y専任公開中、生野→生・専任公開中、久→久・専任公開中、
 *     裏→U専任公開中、国広→K専任公開中、木村→R専任公開中、角井→I専任公開中）の
 *     専任公開中カテゴリーは変わらず表示される
 *   - sales_assignee が未設定またはマッピングに存在しない場合は '専任・公開中' としてカウントされ続ける
 *   - '要値下げ'、'未報告' などの他カテゴリーの表示・カウントは変わらない
 *
 * 期待される結果: テスト PASS（ベースラインの動作を確認する）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import * as fc from 'fast-check';
import { calculatePropertyStatus, createWorkTaskMap } from '../utils/propertyListingStatusUtils';

// ASSIGNEE_TO_SENIN_STATUS のマッピング（PropertySidebarStatus.tsx から）
const ASSIGNEE_TO_SENIN_STATUS: Record<string, string> = {
  '山本': 'Y専任公開中',
  '生野': '生・専任公開中',
  '久': '久・専任公開中',
  '裏': 'U専任公開中',
  '林': '林・専任公開中',
  '国広': 'K専任公開中',
  '木村': 'R専任公開中',
  '角井': 'I専任公開中',
};

/**
 * PropertySidebarStatus.tsx の statusCounts useMemo のロジックを再現する関数
 * （テスト用に抽出）
 */
function computeStatusCounts(
  listings: Array<{
    id: string;
    property_number?: string;
    sidebar_status?: string;
    sales_assignee?: string | null;
    confirmation?: string | null;
    [key: string]: any;
  }>,
  workTaskMap?: Map<string, Date | null>
): Record<string, number> {
  const counts: Record<string, number> = { all: listings.length };

  listings.forEach(listing => {
    const status = listing.sidebar_status || '';

    // workTaskMap が存在する場合、calculatePropertyStatus で動的判定
    if (workTaskMap) {
      const computed = calculatePropertyStatus(listing as any, workTaskMap);

      // 「要値下げ」は calculatePropertyStatus で判定
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      // 「未報告」も calculatePropertyStatus で判定
      if (computed.key === 'unreported') {
        const label = computed.label.replace(/\s+/g, '');
        counts[label] = (counts[label] || 0) + 1;
        return;
      }
    }

    // sidebar_status ベースの処理
    const normalizedStatus = status.replace(/\s+/g, '');
    if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
      // 「専任・公開中」は sales_assignee で担当者別に分解
      if (status === '専任・公開中') {
        const assignee = listing.sales_assignee || '';
        const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
        counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
      } else {
        counts[status] = (counts[status] || 0) + 1;
      }
    }
  });

  return counts;
}

// 明日の日付文字列を生成するヘルパー（price_reduction_due を回避するため）
const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 来週の日付文字列を生成するヘルパー（report_date の unreported を回避するため）
const getNextWeekStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 非バグ条件の基本物件データを生成するヘルパー
const makeBaseListing = (overrides: Record<string, any> = {}) => ({
  id: 'test-base',
  property_number: 'AA99000',
  sidebar_status: '林・専任公開中',
  sales_assignee: '林',
  atbb_status: '専任・公開中',
  confirmation: null,
  general_mediation_private: null,
  single_listing: null,
  offer_status: null,
  report_date: null,
  report_assignee: null,
  price_reduction_scheduled_date: null,
  suumo_url: 'https://suumo.jp/test',
  suumo_registered: 'S不要',
  ...overrides,
});

describe('保全プロパティテスト - 既存の担当者別専任公開中カテゴリーの保持（未修正コードで PASS することを確認）', () => {

  // ============================================================
  // テストケース1: sidebar_status がすでに担当者別形式の物件
  // ============================================================
  describe('テストケース1: sidebar_status がすでに担当者別形式の物件', () => {
    test('sidebar_status=林・専任公開中 の物件は 林・専任公開中 としてカウントされる（workTaskMap なし）', () => {
      const listing = makeBaseListing({
        id: 'test-p1-001',
        property_number: 'AA99101',
        sidebar_status: '林・専任公開中',
        sales_assignee: '林',
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['林・専任公開中']).toBe(1);
    });

    test('sidebar_status=林・専任公開中 の物件は workTaskMap があっても 林・専任公開中 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p1-002',
        property_number: 'AA99102',
        sidebar_status: '林・専任公開中',
        sales_assignee: '林',
        // price_reduction_scheduled_date を未来に設定して price_reduction_due を回避
        price_reduction_scheduled_date: getTomorrowStr(),
        // report_date を未来に設定して unreported を回避
        report_date: getNextWeekStr(),
      });

      const workTaskMap = createWorkTaskMap([
        { property_number: 'AA99102', publish_scheduled_date: null },
      ]);

      const counts = computeStatusCounts([listing], workTaskMap);

      // sidebar_status が新形式（'林・専任公開中'）なので、そのままカウントされる
      expect(counts['林・専任公開中']).toBe(1);
    });

    /**
     * Property 2: Preservation - 担当者別形式の sidebar_status は変わらない
     *
     * 全担当者の担当者別形式 sidebar_status が正しくカウントされることを検証する
     * **Validates: Requirements 3.1**
     */
    test('全担当者の担当者別形式 sidebar_status が正しくカウントされる', () => {
      const assigneeStatuses = Object.values(ASSIGNEE_TO_SENIN_STATUS);

      assigneeStatuses.forEach(status => {
        const listing = makeBaseListing({
          id: `test-p1-${status}`,
          property_number: `AA99${status}`,
          sidebar_status: status,
        });

        const counts = computeStatusCounts([listing]);

        expect(counts[status]).toBe(1);
      });
    });
  });

  // ============================================================
  // テストケース2: 他の担当者の専任公開中カテゴリー（workTaskMap なし）
  // ============================================================
  describe('テストケース2: 他の担当者の専任公開中カテゴリー（workTaskMap なし）', () => {
    const assigneeMappings = [
      { assignee: '山本', expected: 'Y専任公開中' },
      { assignee: '生野', expected: '生・専任公開中' },
      { assignee: '久',   expected: '久・専任公開中' },
      { assignee: '裏',   expected: 'U専任公開中' },
      { assignee: '林',   expected: '林・専任公開中' },
      { assignee: '国広', expected: 'K専任公開中' },
      { assignee: '木村', expected: 'R専任公開中' },
      { assignee: '角井', expected: 'I専任公開中' },
    ];

    assigneeMappings.forEach(({ assignee, expected }) => {
      test(`sidebar_status=専任・公開中, sales_assignee=${assignee} → ${expected} としてカウントされる（workTaskMap なし）`, () => {
        const listing = makeBaseListing({
          id: `test-p2-${assignee}`,
          property_number: `AA99200`,
          sidebar_status: '専任・公開中',
          sales_assignee: assignee,
        });

        // workTaskMap なし → バグ条件が発生しない
        const counts = computeStatusCounts([listing]);

        expect(counts[expected]).toBe(1);
        expect(counts['専任・公開中']).toBeFalsy();
      });
    });
  });

  // ============================================================
  // テストケース3: sales_assignee が未設定またはマッピングに存在しない場合
  // ============================================================
  describe('テストケース3: sales_assignee が未設定またはマッピングに存在しない場合', () => {
    test('sidebar_status=専任・公開中, sales_assignee=null → 専任・公開中 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p3-001',
        property_number: 'AA99301',
        sidebar_status: '専任・公開中',
        sales_assignee: null,
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['専任・公開中']).toBe(1);
    });

    test('sidebar_status=専任・公開中, sales_assignee=空文字 → 専任・公開中 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p3-002',
        property_number: 'AA99302',
        sidebar_status: '専任・公開中',
        sales_assignee: '',
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['専任・公開中']).toBe(1);
    });

    test('sidebar_status=専任・公開中, sales_assignee=マッピングに存在しない値 → 専任・公開中 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p3-003',
        property_number: 'AA99303',
        sidebar_status: '専任・公開中',
        sales_assignee: '田中', // マッピングに存在しない
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['専任・公開中']).toBe(1);
    });

    /**
     * Property 2: Preservation - sales_assignee 未設定は '専任・公開中' のまま
     *
     * **Validates: Requirements 3.4**
     */
    test('PBT: sales_assignee がマッピングに存在しない任意の文字列 → 専任・公開中 としてカウントされる', () => {
      // マッピングに存在しないキーの集合
      const knownAssignees = new Set(Object.keys(ASSIGNEE_TO_SENIN_STATUS));
      // Object.prototype のメソッド名（'toString', 'valueOf' など）は
      // ASSIGNEE_TO_SENIN_STATUS[key] が undefined ではなく関数を返すため除外する
      const objectPrototypeKeys = new Set(Object.getOwnPropertyNames(Object.prototype));

      fc.assert(
        fc.property(
          // マッピングに存在しない文字列を生成（Object.prototype のメソッド名も除外）
          fc.string({ minLength: 0, maxLength: 10 }).filter(
            s => !knownAssignees.has(s) && !objectPrototypeKeys.has(s)
          ),
          (unknownAssignee) => {
            const listing = makeBaseListing({
              id: 'test-pbt-p3',
              property_number: 'AA99399',
              sidebar_status: '専任・公開中',
              sales_assignee: unknownAssignee || null,
            });

            const counts = computeStatusCounts([listing]);

            // マッピングに存在しない担当者は '専任・公開中' としてカウントされる
            return counts['専任・公開中'] === 1;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================
  // テストケース4: 他カテゴリーの表示・カウントは変わらない
  // ============================================================
  describe('テストケース4: 他カテゴリーの表示・カウントは変わらない', () => {
    test('sidebar_status=一般公開中物件 の物件は 一般公開中物件 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p4-001',
        property_number: 'AA99401',
        sidebar_status: '一般公開中物件',
        sales_assignee: null,
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['一般公開中物件']).toBe(1);
    });

    test('sidebar_status=公開前情報 の物件は 公開前情報 としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p4-002',
        property_number: 'AA99402',
        sidebar_status: '公開前情報',
        sales_assignee: null,
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['公開前情報']).toBe(1);
    });

    test('sidebar_status=非公開（配信メールのみ） の物件は 非公開（配信メールのみ） としてカウントされる', () => {
      const listing = makeBaseListing({
        id: 'test-p4-003',
        property_number: 'AA99403',
        sidebar_status: '非公開（配信メールのみ）',
        sales_assignee: null,
      });

      const counts = computeStatusCounts([listing]);

      expect(counts['非公開（配信メールのみ）']).toBe(1);
    });

    test('workTaskMap あり: price_reduction_due の物件は 要値下げ としてカウントされる', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const listing = makeBaseListing({
        id: 'test-p4-004',
        property_number: 'AA99404',
        sidebar_status: '一般公開中物件',
        sales_assignee: null,
        price_reduction_scheduled_date: yesterdayStr,
      });

      const workTaskMap = createWorkTaskMap([
        { property_number: 'AA99404', publish_scheduled_date: null },
      ]);

      const counts = computeStatusCounts([listing], workTaskMap);

      expect(counts['要値下げ']).toBe(1);
      expect(counts['一般公開中物件']).toBeFalsy();
    });

    test('workTaskMap あり: unreported の物件は 未報告 としてカウントされる', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const listing = makeBaseListing({
        id: 'test-p4-005',
        property_number: 'AA99405',
        sidebar_status: '一般公開中物件',
        sales_assignee: null,
        report_date: yesterdayStr,
        report_assignee: '林',
        price_reduction_scheduled_date: null,
      });

      const workTaskMap = createWorkTaskMap([
        { property_number: 'AA99405', publish_scheduled_date: null },
      ]);

      const counts = computeStatusCounts([listing], workTaskMap);

      // 未報告林 としてカウントされる（スペース除去後）
      expect(counts['未報告林']).toBe(1);
      expect(counts['一般公開中物件']).toBeFalsy();
    });
  });

  // ============================================================
  // テストケース5: 複数物件の混在（保全確認）
  // ============================================================
  describe('テストケース5: 複数物件の混在（保全確認）', () => {
    test('担当者別形式と専任・公開中が混在しても正しくカウントされる', () => {
      const listings = [
        // 新形式（担当者別）
        makeBaseListing({
          id: 'test-p5-001',
          property_number: 'AA99501',
          sidebar_status: '林・専任公開中',
          sales_assignee: '林',
        }),
        // 旧形式（専任・公開中）+ workTaskMap なし → 担当者別に分解される
        makeBaseListing({
          id: 'test-p5-002',
          property_number: 'AA99502',
          sidebar_status: '専任・公開中',
          sales_assignee: '山本',
        }),
        // 旧形式（専任・公開中）+ sales_assignee なし → 専任・公開中 のまま
        makeBaseListing({
          id: 'test-p5-003',
          property_number: 'AA99503',
          sidebar_status: '専任・公開中',
          sales_assignee: null,
        }),
        // 他カテゴリー
        makeBaseListing({
          id: 'test-p5-004',
          property_number: 'AA99504',
          sidebar_status: '一般公開中物件',
          sales_assignee: null,
        }),
      ];

      const counts = computeStatusCounts(listings);

      expect(counts['林・専任公開中']).toBe(1);
      expect(counts['Y専任公開中']).toBe(1);
      expect(counts['専任・公開中']).toBe(1);
      expect(counts['一般公開中物件']).toBe(1);
      expect(counts.all).toBe(4);
    });
  });

  // ============================================================
  // テストケース6: PBT - 担当者別形式の sidebar_status は常に保持される
  // ============================================================
  describe('テストケース6: PBT - 担当者別形式の sidebar_status は常に保持される', () => {
    /**
     * Property 2: Preservation - 担当者別形式の sidebar_status は変わらない
     *
     * 任意の担当者別形式 sidebar_status を持つ物件が、
     * workTaskMap なしで正しくカウントされることを検証する。
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    test('PBT: 任意の担当者別形式 sidebar_status は workTaskMap なしで正しくカウントされる', () => {
      const assigneeStatuses = Object.values(ASSIGNEE_TO_SENIN_STATUS);

      fc.assert(
        fc.property(
          // 担当者別形式のステータスをランダムに選択
          fc.constantFrom(...assigneeStatuses),
          (assigneeStatus) => {
            const listing = makeBaseListing({
              id: 'test-pbt-p6',
              property_number: 'AA99600',
              sidebar_status: assigneeStatus,
            });

            const counts = computeStatusCounts([listing]);

            // 担当者別形式の sidebar_status はそのままカウントされる
            return counts[assigneeStatus] === 1;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 2: Preservation - workTaskMap があっても担当者別形式は保持される
     *
     * price_reduction_due / unreported を返さない条件下では、
     * 担当者別形式の sidebar_status が workTaskMap ありでも正しくカウントされることを検証する。
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    test('PBT: 担当者別形式 sidebar_status は workTaskMap があっても正しくカウントされる（非バグ条件）', () => {
      const assigneeStatuses = Object.values(ASSIGNEE_TO_SENIN_STATUS);
      const tomorrowStr = getTomorrowStr();
      const nextWeekStr = getNextWeekStr();

      fc.assert(
        fc.property(
          fc.constantFrom(...assigneeStatuses),
          (assigneeStatus) => {
            const listing = makeBaseListing({
              id: 'test-pbt-p6b',
              property_number: 'AA99601',
              sidebar_status: assigneeStatus,
              // price_reduction_due を回避（未来の日付）
              price_reduction_scheduled_date: tomorrowStr,
              // unreported を回避（未来の日付）
              report_date: nextWeekStr,
            });

            const workTaskMap = createWorkTaskMap([
              { property_number: 'AA99601', publish_scheduled_date: null },
            ]);

            const counts = computeStatusCounts([listing], workTaskMap);

            // 担当者別形式の sidebar_status はそのままカウントされる
            return counts[assigneeStatus] === 1;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
