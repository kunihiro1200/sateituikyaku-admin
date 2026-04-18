/**
 * 保存チェックテスト: suumo_url非更新時のsidebar_status動作不変
 *
 * Property 2: Preservation
 * - suumo_url を含まないリクエストの場合、sidebar_status の計算結果が変わらないことを確認する
 *
 * 重要: このテストは未修正コードで PASS することが期待される
 * PASS = ベースライン動作の確認
 *
 * 観察優先メソドロジー:
 * - 未修正コードで各シナリオの動作を観察し、その動作をテストとして記述する
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PropertyListingService } from '../services/PropertyListingService';
import { PropertyListingSyncService } from '../services/PropertyListingSyncService';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

// テスト用の物件番号（実際のDBを使用）
const TEST_PROPERTY_NUMBER = 'AA13600';

// ============================================================
// ヘルパー: DB形式 → calculateSidebarStatus()用スプレッドシート行形式に変換
// ============================================================
function mapDbToSpreadsheetRow(dbRecord: any, overrides: Record<string, any> = {}): any {
  // DB列名 → スプレッドシート列名のマッピング（calculateSidebarStatusが参照するフィールドのみ）
  return {
    '物件番号': overrides.property_number ?? dbRecord.property_number ?? '',
    'atbb成約済み/非公開': overrides.atbb_status ?? dbRecord.atbb_status ?? '',
    '報告日': overrides.report_date ?? dbRecord.report_date ?? null,
    '報告担当_override': overrides.report_assignee ?? dbRecord.report_assignee ?? null,
    '報告担当': overrides.report_assignee ?? dbRecord.report_assignee ?? null,
    '確認': overrides.confirmation ?? dbRecord.confirmation ?? null,
    '一般媒介非公開（仮）': overrides.general_mediation_private ?? dbRecord.general_mediation_private ?? null,
    '１社掲載': overrides.single_listing ?? dbRecord.single_listing ?? null,
    'Suumo URL': overrides.suumo_url !== undefined ? overrides.suumo_url : (dbRecord.suumo_url ?? null),
    'Suumo登録': overrides.suumo_registered ?? dbRecord.suumo_registered ?? null,
    '買付': overrides.offer_status ?? dbRecord.offer_status ?? null,
    '担当名（営業）': overrides.sales_assignee ?? dbRecord.sales_assignee ?? null,
  };
}

describe('保存チェックテスト: suumo_url非更新時のsidebar_status動作不変', () => {
  let service: PropertyListingService;
  let syncService: PropertyListingSyncService;
  let originalRecord: any = null;

  beforeAll(async () => {
    service = new PropertyListingService();
    syncService = new PropertyListingSyncService();
  });

  afterAll(async () => {
    // テスト後に元の状態に戻す（ロールバック）
    if (originalRecord !== null) {
      try {
        await service.update(TEST_PROPERTY_NUMBER, {
          sidebar_status: originalRecord.sidebar_status,
          suumo_url: originalRecord.suumo_url,
          report_date: originalRecord.report_date,
          special_notes: originalRecord.special_notes,
        });
        console.log(`[ロールバック] ${TEST_PROPERTY_NUMBER} を元の状態に戻しました`);
      } catch (e) {
        console.warn(`[ロールバック失敗] ${TEST_PROPERTY_NUMBER}:`, e);
      }
    }
  });

  // ============================================================
  // テスト1: calculateSidebarStatus()の単体テスト（DBアクセスなし）
  // suumo_url が空の物件は「レインズ登録＋SUUMO URL 要登録」になること
  // ============================================================
  describe('calculateSidebarStatus() 単体テスト（Preservation確認）', () => {
    /**
     * 観察1: suumo_url が空の物件は「レインズ登録＋SUUMO URL 要登録」になる
     * Requirements 3.1
     */
    test(
      'suumo_urlが空の専任・公開中物件は「レインズ登録＋SUUMO URL 要登録」になること（Requirement 3.1）',
      () => {
        // 公開予定日が確実に昨日以前になるよう7日前を使用
        // （タイムゾーン差異を避けるため余裕を持たせる）
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_001',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': null, // 空
          'Suumo登録': '要',
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_001', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察1: suumo_url空の専任・公開中 ---`);
        console.log(`  sidebar_status: ${status}`);
        console.log(`  公開予定日: ${pastDateStr}`);

        // 観察した動作: suumo_url が空の場合は「レインズ登録＋SUUMO URL 要登録」になる
        expect(status).toBe('レインズ登録＋SUUMO URL 要登録');
      }
    );

    /**
     * 観察2: suumo_url が空文字列の場合も「レインズ登録＋SUUMO URL 要登録」になる
     * Requirements 3.1
     */
    test(
      'suumo_urlが空文字列の専任・公開中物件は「レインズ登録＋SUUMO URL 要登録」になること（Requirement 3.1）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_002',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': '', // 空文字列
          'Suumo登録': '要',
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_002', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察2: suumo_url空文字列の専任・公開中 ---`);
        console.log(`  sidebar_status: ${status}`);

        // 観察した動作: suumo_url が空文字列の場合も「レインズ登録＋SUUMO URL 要登録」になる
        expect(status).toBe('レインズ登録＋SUUMO URL 要登録');
      }
    );

    /**
     * 観察3: suumo_url が空文字列（スペースのみ）の場合も「レインズ登録＋SUUMO URL 要登録」になる
     * Requirements 3.1
     */
    test(
      'suumo_urlがスペースのみの専任・公開中物件は「レインズ登録＋SUUMO URL 要登録」になること（Requirement 3.1）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_003',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': '   ', // スペースのみ
          'Suumo登録': '要',
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_003', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察3: suumo_urlスペースのみの専任・公開中 ---`);
        console.log(`  sidebar_status: ${status}`);

        // 観察した動作: suumo_url がスペースのみの場合も「レインズ登録＋SUUMO URL 要登録」になる
        expect(status).toBe('レインズ登録＋SUUMO URL 要登録');
      }
    );

    /**
     * 観察4: suumo_url が空の一般・公開中物件は「SUUMO URL　要登録」になる
     * Requirements 3.2
     */
    test(
      'suumo_urlが空の一般・公開中物件は「SUUMO URL　要登録」になること（Requirement 3.2）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_004',
          'atbb成約済み/非公開': '一般・公開中',
          'Suumo URL': null, // 空
          'Suumo登録': '要',
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_004', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察4: suumo_url空の一般・公開中 ---`);
        console.log(`  sidebar_status: ${status}`);

        // 観察した動作: 一般・公開中の場合は「SUUMO URL　要登録」になる
        expect(status).toBe('SUUMO URL　要登録');
      }
    );

    /**
     * 観察5: suumo_registered = 'S不要' の物件は「レインズ登録＋SUUMO URL 要登録」にならない
     * Requirements 3.4
     */
    test(
      'suumo_registered=S不要の物件は「レインズ登録＋SUUMO URL 要登録」にならないこと（Requirement 3.4）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_005',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': null, // 空
          'Suumo登録': 'S不要', // S不要
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_005', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察5: suumo_registered=S不要 ---`);
        console.log(`  sidebar_status: ${status}`);

        // 観察した動作: S不要の場合は「レインズ登録＋SUUMO URL 要登録」にならない
        expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
      }
    );

    /**
     * 観察6: report_date が今日以前の場合は「未報告」になる
     * Requirements 3.3, 3.5
     */
    test(
      'report_dateが今日以前の場合は「未報告」になること（Requirement 3.3, 3.5）',
      () => {
        // タイムゾーン差異を避けるため7日前を使用
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_006',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': null, // 空
          'Suumo登録': '要',
          '確認': '済',
          '報告日': pastDateStr, // 7日前
          '報告担当': null,
        };

        const gyomuListData: any[] = [];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察6: report_date=7日前 ---`);
        console.log(`  sidebar_status: ${status}`);
        console.log(`  報告日: ${pastDateStr}`);

        // 観察した動作: report_date が今日以前の場合は「未報告」になる（条件①が最優先）
        expect(status).toBe('未報告');
      }
    );

    /**
     * 観察7: suumo_registered = 'S不要' の物件に suumo_url を登録しても
     * 「レインズ登録＋SUUMO URL 要登録」に表示されないこと
     * Requirements 3.4
     */
    test(
      'suumo_registered=S不要の物件にsuumo_urlを登録しても「レインズ登録＋SUUMO URL 要登録」にならないこと（Requirement 3.4）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const row = {
          '物件番号': 'TEST_PRESERVATION_007',
          'atbb成約済み/非公開': '専任・公開中',
          'Suumo URL': 'https://suumo.jp/test/12345/', // suumo_url登録済み
          'Suumo登録': 'S不要', // S不要
          '確認': '済',
          '報告日': null,
        };

        const gyomuListData = [
          { '物件番号': 'TEST_PRESERVATION_007', '公開予定日': pastDateStr },
        ];

        const status = syncService.calculateSidebarStatus(row, gyomuListData);

        console.log(`\n--- 観察7: suumo_registered=S不要 + suumo_url登録済み ---`);
        console.log(`  sidebar_status: ${status}`);

        // 観察した動作: S不要の場合は suumo_url があっても「レインズ登録＋SUUMO URL 要登録」にならない
        expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
      }
    );
  });

  // ============================================================
  // テスト2: PropertyListingService.update() の統合テスト
  // suumo_url を含まないリクエストの動作を観察する
  // ============================================================
  describe('PropertyListingService.update() 統合テスト（suumo_url非更新時）', () => {
    /**
     * 観察8: special_notes のみ更新 → sidebar_status が変わらないことを観察
     * Requirements 3.3
     */
    test(
      'special_notesのみ更新した場合、sidebar_statusが変わらないこと（Requirement 3.3）',
      async () => {
        // テスト対象物件の現在の状態を取得
        const current = await service.getByPropertyNumber(TEST_PROPERTY_NUMBER);

        if (!current) {
          console.warn(`[スキップ] ${TEST_PROPERTY_NUMBER} が見つかりません`);
          return;
        }

        // 元の状態を保存（ロールバック用）
        if (originalRecord === null) {
          originalRecord = { ...current };
        }

        const beforeStatus = current.sidebar_status;

        console.log(`\n--- 観察8: special_notesのみ更新 ---`);
        console.log(`  更新前 sidebar_status: ${beforeStatus}`);

        // special_notes のみ更新（suumo_url は含まない）
        const testNote = `テスト特記事項_${Date.now()}`;
        const result = await service.update(TEST_PROPERTY_NUMBER, {
          special_notes: testNote,
        });

        console.log(`  更新後 sidebar_status: ${result?.sidebar_status}`);
        console.log(`  更新後 special_notes: ${result?.special_notes}`);

        // 観察した動作: special_notes のみ更新した場合、sidebar_status は変わらない
        // （suumo_url を含まないリクエストは sidebar_status 再計算をトリガーしない）
        expect(result?.sidebar_status).toBe(beforeStatus);
      },
      30000
    );

    /**
     * 観察9: suumo_url = '' （空文字）で更新 → sidebar_status が「レインズ登録＋SUUMO URL 要登録」のままであることを観察
     * Requirements 3.1
     */
    test(
      'suumo_url=空文字で更新した場合、sidebar_statusが「レインズ登録＋SUUMO URL 要登録」のままであること（Requirement 3.1）',
      async () => {
        // テスト対象物件の現在の状態を取得
        const current = await service.getByPropertyNumber(TEST_PROPERTY_NUMBER);

        if (!current) {
          console.warn(`[スキップ] ${TEST_PROPERTY_NUMBER} が見つかりません`);
          return;
        }

        // 元の状態を保存（ロールバック用）
        if (originalRecord === null) {
          originalRecord = { ...current };
        }

        // まず「レインズ登録＋SUUMO URL 要登録」状態にセットアップ
        await service.update(TEST_PROPERTY_NUMBER, {
          sidebar_status: 'レインズ登録＋SUUMO URL 要登録',
          suumo_url: '',
        });

        const setupState = await service.getByPropertyNumber(TEST_PROPERTY_NUMBER);
        console.log(`\n--- 観察9: suumo_url=空文字で更新 ---`);
        console.log(`  セットアップ後 sidebar_status: ${setupState?.sidebar_status}`);

        // suumo_url = '' で更新
        const result = await service.update(TEST_PROPERTY_NUMBER, {
          suumo_url: '',
        });

        console.log(`  更新後 sidebar_status: ${result?.sidebar_status}`);
        console.log(`  更新後 suumo_url: ${result?.suumo_url || '(空)'}`);

        // 観察した動作: suumo_url = '' で更新した場合、sidebar_status は「レインズ登録＋SUUMO URL 要登録」のまま
        // （空文字はバグ条件に該当しないため、再計算されない）
        expect(result?.sidebar_status).toBe('レインズ登録＋SUUMO URL 要登録');
      },
      30000
    );
  });

  // ============================================================
  // テスト3: プロパティベーステスト
  // suumo_url を含まない多様なフィールド更新で sidebar_status が変わらないことを確認
  // ============================================================
  describe('プロパティベーステスト: suumo_url非更新時のsidebar_status不変', () => {
    /**
     * Property 2: Preservation
     *
     * FOR ALL X WHERE NOT isBugCondition(X) DO
     *   ASSERT PropertyListingService_original.update(X) = PropertyListingService_fixed.update(X)
     * END FOR
     *
     * 未修正コードでは: suumo_url を含まないリクエストは sidebar_status を変更しない
     * これがベースライン動作
     *
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
     */
    test(
      'calculateSidebarStatus()はsuumo_urlが空の場合に「レインズ登録＋SUUMO URL 要登録」を返すこと（プロパティテスト）',
      () => {
        // suumo_url が空のパターンを複数生成してテスト
        const emptyUrlPatterns = [null, '', '   ', undefined];
        const atbbStatuses = ['専任・公開中', '一般・公開中'];

        // タイムゾーン差異を避けるため7日前を使用
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        let passCount = 0;
        let totalCount = 0;

        for (const suumoUrl of emptyUrlPatterns) {
          for (const atbbStatus of atbbStatuses) {
            totalCount++;

            const row = {
              '物件番号': `TEST_PBT_${totalCount}`,
              'atbb成約済み/非公開': atbbStatus,
              'Suumo URL': suumoUrl,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
            };

            const gyomuListData = [
              { '物件番号': `TEST_PBT_${totalCount}`, '公開予定日': pastDateStr },
            ];

            const status = syncService.calculateSidebarStatus(row, gyomuListData);

            // 観察した動作: suumo_url が空の場合は「レインズ登録＋SUUMO URL 要登録」または「SUUMO URL　要登録」になる
            const expectedStatuses =
              atbbStatus === '専任・公開中'
                ? ['レインズ登録＋SUUMO URL 要登録']
                : ['SUUMO URL　要登録'];

            const isExpected = expectedStatuses.includes(status);

            console.log(
              `  [${totalCount}] atbb=${atbbStatus}, suumo_url=${JSON.stringify(suumoUrl)} → ${status} (${isExpected ? '✅' : '❌'})`
            );

            if (isExpected) passCount++;

            expect(isExpected).toBe(true);
          }
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );

    /**
     * プロパティテスト: suumo_registered = 'S不要' の物件は
     * suumo_url の値に関わらず「レインズ登録＋SUUMO URL 要登録」にならない
     * Validates: Requirements 3.4
     */
    test(
      'suumo_registered=S不要の物件はsuumo_urlの値に関わらず「レインズ登録＋SUUMO URL 要登録」にならないこと（プロパティテスト）',
      () => {
        const suumoUrlPatterns = [
          null,
          '',
          'https://suumo.jp/test/12345/',
          'https://suumo.jp/another/67890/',
        ];

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 7); // タイムゾーン差異を避けるため7日前を使用
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let passCount = 0;
        const totalCount = suumoUrlPatterns.length;

        for (const suumoUrl of suumoUrlPatterns) {
          const row = {
            '物件番号': 'TEST_S_UNNECESSARY',
            'atbb成約済み/非公開': '専任・公開中',
            'Suumo URL': suumoUrl,
            'Suumo登録': 'S不要',
            '確認': '済',
            '報告日': null,
          };

          const gyomuListData = [
            { '物件番号': 'TEST_S_UNNECESSARY', '公開予定日': yesterdayStr },
          ];

          const status = syncService.calculateSidebarStatus(row, gyomuListData);

          const isNotReinsCategory = status !== 'レインズ登録＋SUUMO URL 要登録';

          console.log(
            `  suumo_url=${JSON.stringify(suumoUrl)}, suumo_registered=S不要 → ${status} (${isNotReinsCategory ? '✅' : '❌'})`
          );

          if (isNotReinsCategory) passCount++;

          // 観察した動作: S不要の場合は「レインズ登録＋SUUMO URL 要登録」にならない
          expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );

    /**
     * プロパティテスト: 他のステータス（未報告、未完了など）が正しく計算されること
     * Validates: Requirements 3.5
     */
    test(
      'calculateSidebarStatus()が他のステータスを正しく計算すること（プロパティテスト）',
      () => {
        // タイムゾーン差異を避けるため7日前を使用
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        // 各ステータスのテストケース
        const testCases = [
          {
            description: '未報告（報告日=7日前）',
            row: {
              '物件番号': 'TEST_STATUS_001',
              'atbb成約済み/非公開': '専任・公開中',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': pastDateStr,
              '報告担当': null,
            },
            gyomuListData: [],
            expectedStatus: '未報告',
          },
          {
            description: '未完了（確認=未）',
            row: {
              '物件番号': 'TEST_STATUS_002',
              'atbb成約済み/非公開': '専任・公開中',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '未',
              '報告日': null,
            },
            gyomuListData: [],
            expectedStatus: '未完了',
          },
          {
            description: '公開前情報（専任・公開前）',
            row: {
              '物件番号': 'TEST_STATUS_003',
              'atbb成約済み/非公開': '専任・公開前',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
            },
            gyomuListData: [],
            expectedStatus: '公開前情報',
          },
        ];

        let passCount = 0;

        for (const testCase of testCases) {
          const status = syncService.calculateSidebarStatus(
            testCase.row,
            testCase.gyomuListData
          );

          const isExpected = status === testCase.expectedStatus;

          console.log(
            `  ${testCase.description}: ${status} (期待: ${testCase.expectedStatus}) ${isExpected ? '✅' : '❌'}`
          );

          if (isExpected) passCount++;

          expect(status).toBe(testCase.expectedStatus);
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${testCases.length} PASS`);
      }
    );
  });
});
