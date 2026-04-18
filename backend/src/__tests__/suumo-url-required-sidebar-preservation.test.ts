/**
 * 保全プロパティテスト: SUUMO URL 要登録サイドバー表示バグ修正前のベースライン確認
 *
 * Property 2: Preservation
 * - バグ条件に該当しない物件の動作が修正前後で変わらないことを確認する
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

import { PropertyListingSyncService } from '../services/PropertyListingSyncService';

describe('SUUMO URL 要登録サイドバー表示バグ - 保全プロパティテスト', () => {
  let service: PropertyListingSyncService;

  beforeAll(() => {
    service = new PropertyListingSyncService();
  });

  // ============================================================
  // 保全1: suumo_url が入力済みの場合、SUUMO URL 要登録系カテゴリーは返されない
  // Validates: Requirements 3.1
  // ============================================================
  describe('保全1: suumo_url 入力済みの場合は SUUMO URL 要登録系カテゴリーに含まれない', () => {
    /**
     * Property 2: Preservation - suumo_url 入力済みパターン
     *
     * FOR ALL suumo_url WHERE suumo_url IS NOT EMPTY DO
     *   ASSERT calculateSidebarStatus() NOT IN ['SUUMO URL\u3000要登録', 'レインズ登録＋SUUMO URL 要登録']
     * END FOR
     *
     * 未修正コードでも PASS する（バグ条件に該当しないため）
     */
    test(
      'ランダムなsuumo_url（入力済み）を持つ専任・公開中物件はSUUMO URL要登録系カテゴリーに含まれないこと（プロパティテスト）',
      () => {
        // タイムゾーン差異を避けるため7日前を使用
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        // 様々なsuumo_urlパターン（null・空文字以外の値）
        const nonEmptyUrlPatterns = [
          'https://suumo.jp/test/12345/',
          'https://suumo.jp/another/67890/',
          'https://suumo.jp/ms/chuko/tokyo/sc_shinjuku/nc_12345678/',
          'http://suumo.jp/test/',
          'suumo.jp/test',
          ' https://suumo.jp/test/ ', // 前後スペースあり
          'https://suumo.jp/test/?id=1',
        ];

        let passCount = 0;
        const totalCount = nonEmptyUrlPatterns.length;

        for (const suumoUrl of nonEmptyUrlPatterns) {
          const row = {
            '物件番号': 'TEST_PRESERVATION_SUUMO_URL',
            'atbb成約済み/非公開': '専任・公開中',
            'Suumo URL': suumoUrl,
            'Suumo登録': '要',
            '確認': '済',
            '報告日': null,
          };

          const gyomuListData = [
            { '物件番号': 'TEST_PRESERVATION_SUUMO_URL', '公開予定日': pastDateStr },
          ];

          const status = service.calculateSidebarStatus(row, gyomuListData);

          // バグ条件に該当しない（suumo_url が入力済み）ため、SUUMO URL 要登録系カテゴリーに含まれない
          const isNotSuumoRequired =
            status !== 'SUUMO URL\u3000要登録' && status !== 'レインズ登録＋SUUMO URL 要登録';

          console.log(
            `  suumo_url=${JSON.stringify(suumoUrl)} → ${status} (${isNotSuumoRequired ? '✅' : '❌'})`
          );

          if (isNotSuumoRequired) passCount++;

          expect(status).not.toBe('SUUMO URL\u3000要登録');
          expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );

    test(
      'ランダムなsuumo_url（入力済み）を持つ一般・公開中物件はSUUMO URL要登録系カテゴリーに含まれないこと（プロパティテスト）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        const nonEmptyUrlPatterns = [
          'https://suumo.jp/test/12345/',
          'https://suumo.jp/another/67890/',
          'https://suumo.jp/ms/chuko/tokyo/sc_shinjuku/nc_12345678/',
        ];

        for (const suumoUrl of nonEmptyUrlPatterns) {
          const row = {
            '物件番号': 'TEST_PRESERVATION_SUUMO_URL_GENERAL',
            'atbb成約済み/非公開': '一般・公開中',
            'Suumo URL': suumoUrl,
            'Suumo登録': '要',
            '確認': '済',
            '報告日': null,
          };

          const gyomuListData = [
            { '物件番号': 'TEST_PRESERVATION_SUUMO_URL_GENERAL', '公開予定日': pastDateStr },
          ];

          const status = service.calculateSidebarStatus(row, gyomuListData);

          console.log(
            `  一般・公開中, suumo_url=${JSON.stringify(suumoUrl)} → ${status}`
          );

          expect(status).not.toBe('SUUMO URL\u3000要登録');
          expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
        }
      }
    );
  });

  // ============================================================
  // 保全2: suumo_registered = 'S不要' の場合、どちらのカテゴリーも返されない
  // Validates: Requirements 3.2
  // ============================================================
  describe('保全2: suumo_registered=S不要 の場合はどちらのカテゴリーも返されない', () => {
    /**
     * Property 2: Preservation - S不要パターン
     *
     * FOR ALL suumo_url WHERE suumo_registered = 'S不要' DO
     *   ASSERT calculateSidebarStatus() NOT IN ['SUUMO URL\u3000要登録', 'レインズ登録＋SUUMO URL 要登録']
     * END FOR
     */
    test(
      'suumo_registered=S不要の物件はsuumo_urlの値に関わらずSUUMO URL要登録系カテゴリーに含まれないこと（プロパティテスト）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        // suumo_url の様々なパターン（空・入力済み両方）
        const suumoUrlPatterns = [
          null,
          '',
          '   ',
          'https://suumo.jp/test/12345/',
          'https://suumo.jp/another/67890/',
        ];

        const atbbStatuses = ['専任・公開中', '一般・公開中'];

        let passCount = 0;
        let totalCount = 0;

        for (const suumoUrl of suumoUrlPatterns) {
          for (const atbbStatus of atbbStatuses) {
            totalCount++;

            const row = {
              '物件番号': `TEST_S_UNNECESSARY_${totalCount}`,
              'atbb成約済み/非公開': atbbStatus,
              'Suumo URL': suumoUrl,
              'Suumo登録': 'S不要', // S不要
              '確認': '済',
              '報告日': null,
            };

            const gyomuListData = [
              { '物件番号': `TEST_S_UNNECESSARY_${totalCount}`, '公開予定日': pastDateStr },
            ];

            const status = service.calculateSidebarStatus(row, gyomuListData);

            const isNotSuumoRequired =
              status !== 'SUUMO URL\u3000要登録' && status !== 'レインズ登録＋SUUMO URL 要登録';

            console.log(
              `  atbb=${atbbStatus}, suumo_url=${JSON.stringify(suumoUrl)}, S不要 → ${status} (${isNotSuumoRequired ? '✅' : '❌'})`
            );

            if (isNotSuumoRequired) passCount++;

            expect(status).not.toBe('SUUMO URL\u3000要登録');
            expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
          }
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );
  });

  // ============================================================
  // 保全3: atbb_status が「一般・公開中」でも「専任・公開中」でもない場合、条件⑥は発動しない
  // Validates: Requirements 3.3
  // ============================================================
  describe('保全3: 公開中以外のatbb_statusでは条件⑥は発動しない', () => {
    /**
     * Property 2: Preservation - 公開中以外のatbb_statusパターン
     *
     * FOR ALL atbb_status WHERE atbb_status NOT IN ['一般・公開中', '専任・公開中'] DO
     *   ASSERT calculateSidebarStatus() NOT IN ['SUUMO URL\u3000要登録', 'レインズ登録＋SUUMO URL 要登録']
     * END FOR
     */
    test(
      'ランダムなatbb_status（一般・公開中・専任・公開中以外）では条件⑥が発動しないこと（プロパティテスト）',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        // 「一般・公開中」「専任・公開中」以外のatbb_statusパターン
        const nonPublicStatuses = [
          '一般・公開前',
          '専任・公開前',
          '非公開（配信メールのみ）',
          '成約済み',
          '非公開',
          '取り下げ',
          '',
          '一般・売止',
          '専任・売止',
          '一般・成約済み',
          '専任・成約済み',
        ];

        let passCount = 0;
        const totalCount = nonPublicStatuses.length;

        for (const atbbStatus of nonPublicStatuses) {
          const row = {
            '物件番号': 'TEST_NON_PUBLIC_STATUS',
            'atbb成約済み/非公開': atbbStatus,
            'Suumo URL': null, // 空（バグ条件の一部を満たす）
            'Suumo登録': '要', // S不要ではない（バグ条件の一部を満たす）
            '確認': '済',
            '報告日': null,
          };

          const gyomuListData = [
            { '物件番号': 'TEST_NON_PUBLIC_STATUS', '公開予定日': pastDateStr },
          ];

          const status = service.calculateSidebarStatus(row, gyomuListData);

          const isNotSuumoRequired =
            status !== 'SUUMO URL\u3000要登録' && status !== 'レインズ登録＋SUUMO URL 要登録';

          console.log(
            `  atbb_status='${atbbStatus}' → ${status} (${isNotSuumoRequired ? '✅' : '❌'})`
          );

          if (isNotSuumoRequired) passCount++;

          expect(status).not.toBe('SUUMO URL\u3000要登録');
          expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );
  });

  // ============================================================
  // 保全4: 公開予定日が今日以降の場合、条件⑥は発動しない
  // Validates: Requirements 3.4
  // ============================================================
  describe('保全4: 公開予定日が今日以降の場合は条件⑥が発動しない', () => {
    /**
     * Property 2: Preservation - 公開予定日が今日以降のパターン
     *
     * FOR ALL publishDate WHERE publishDate >= TODAY() DO
     *   ASSERT calculateSidebarStatus() NOT IN ['SUUMO URL\u3000要登録', 'レインズ登録＋SUUMO URL 要登録']
     * END FOR
     */
    test(
      'ランダムな公開予定日（TODAY()以降）では条件⑥が発動しないこと（プロパティテスト）',
      () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 今日以降の日付パターン
        const futureDates: string[] = [];

        // 今日
        futureDates.push(todayStr);

        // 明日から30日後まで（5日刻み）
        for (let i = 1; i <= 30; i += 5) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + i);
          futureDates.push(futureDate.toISOString().split('T')[0]);
        }

        // 1年後
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        futureDates.push(oneYearLater.toISOString().split('T')[0]);

        const atbbStatuses = ['専任・公開中', '一般・公開中'];

        let passCount = 0;
        let totalCount = 0;

        for (const publishDate of futureDates) {
          for (const atbbStatus of atbbStatuses) {
            totalCount++;

            const row = {
              '物件番号': `TEST_FUTURE_DATE_${totalCount}`,
              'atbb成約済み/非公開': atbbStatus,
              'Suumo URL': null, // 空（バグ条件の一部を満たす）
              'Suumo登録': '要', // S不要ではない（バグ条件の一部を満たす）
              '確認': '済',
              '報告日': null,
            };

            const gyomuListData = [
              { '物件番号': `TEST_FUTURE_DATE_${totalCount}`, '公開予定日': publishDate },
            ];

            const status = service.calculateSidebarStatus(row, gyomuListData);

            const isNotSuumoRequired =
              status !== 'SUUMO URL\u3000要登録' && status !== 'レインズ登録＋SUUMO URL 要登録';

            console.log(
              `  atbb=${atbbStatus}, 公開予定日=${publishDate} → ${status} (${isNotSuumoRequired ? '✅' : '❌'})`
            );

            if (isNotSuumoRequired) passCount++;

            expect(status).not.toBe('SUUMO URL\u3000要登録');
            expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
          }
        }

        console.log(`\n  プロパティテスト結果: ${passCount}/${totalCount} PASS`);
      }
    );

    test(
      '公開予定日がnull（業務依頼データなし）の場合は条件⑥が発動しないこと',
      () => {
        const atbbStatuses = ['専任・公開中', '一般・公開中'];

        for (const atbbStatus of atbbStatuses) {
          const row = {
            '物件番号': 'TEST_NO_PUBLISH_DATE',
            'atbb成約済み/非公開': atbbStatus,
            'Suumo URL': null, // 空
            'Suumo登録': '要',
            '確認': '済',
            '報告日': null,
          };

          // gyomuListData が空（公開予定日なし）
          const gyomuListData: any[] = [];

          const status = service.calculateSidebarStatus(row, gyomuListData);

          console.log(
            `  atbb=${atbbStatus}, 公開予定日=null（業務依頼なし） → ${status}`
          );

          expect(status).not.toBe('SUUMO URL\u3000要登録');
          expect(status).not.toBe('レインズ登録＋SUUMO URL 要登録');
        }
      }
    );
  });

  // ============================================================
  // 保全5: 他のカテゴリー（未報告、未完了、本日公開予定など）の計算結果は変わらない
  // Validates: Requirements 3.5
  // ============================================================
  describe('保全5: 他のカテゴリーの計算結果は変わらない', () => {
    test(
      'calculateSidebarStatus()の優先度順（①未報告→②未完了→...→⑥SUUMO/レインズ）が変わらないこと',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const pastDateStr = sevenDaysAgo.toISOString().split('T')[0];

        // 各優先度のテストケース
        const testCases = [
          {
            description: '①未報告（報告日=7日前）',
            row: {
              '物件番号': 'TEST_PRIORITY_001',
              'atbb成約済み/非公開': '専任・公開中',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': pastDateStr, // 7日前
              '報告担当': null,
            },
            gyomuListData: [
              { '物件番号': 'TEST_PRIORITY_001', '公開予定日': pastDateStr },
            ],
            expectedStatus: '未報告',
          },
          {
            description: '②未完了（確認=未）',
            row: {
              '物件番号': 'TEST_PRIORITY_002',
              'atbb成約済み/非公開': '専任・公開中',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '未',
              '報告日': null,
            },
            gyomuListData: [
              { '物件番号': 'TEST_PRIORITY_002', '公開予定日': pastDateStr },
            ],
            expectedStatus: '未完了',
          },
          {
            description: '③非公開予定（確認後）',
            row: {
              '物件番号': 'TEST_PRIORITY_003',
              'atbb成約済み/非公開': '専任・公開中',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
              '一般媒介非公開（仮）': '非公開予定',
            },
            gyomuListData: [
              { '物件番号': 'TEST_PRIORITY_003', '公開予定日': pastDateStr },
            ],
            expectedStatus: '非公開予定（確認後）',
          },
          {
            description: '⑧公開前情報（専任・公開前）',
            row: {
              '物件番号': 'TEST_PRIORITY_008',
              'atbb成約済み/非公開': '専任・公開前',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
            },
            gyomuListData: [],
            expectedStatus: '公開前情報',
          },
          {
            description: '⑧公開前情報（一般・公開前）',
            row: {
              '物件番号': 'TEST_PRIORITY_008B',
              'atbb成約済み/非公開': '一般・公開前',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
            },
            gyomuListData: [],
            expectedStatus: '公開前情報',
          },
          {
            description: '⑨非公開（配信メールのみ）',
            row: {
              '物件番号': 'TEST_PRIORITY_009',
              'atbb成約済み/非公開': '非公開（配信メールのみ）',
              'Suumo URL': null,
              'Suumo登録': '要',
              '確認': '済',
              '報告日': null,
            },
            gyomuListData: [],
            expectedStatus: '非公開（配信メールのみ）',
          },
        ];

        let passCount = 0;

        for (const testCase of testCases) {
          const status = service.calculateSidebarStatus(
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
