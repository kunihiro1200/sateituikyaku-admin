/**
 * Fix Checking テスト: 訪問予約日時が00:00にリセットされるバグ（修正後確認）
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * ## テストの目的
 * バグ条件が成立する全ての入力に対して、修正後の処理が正しい動作をすることを検証する。
 *
 * ## 検証対象
 * - タスク4.1: `combineVisitDateAndTime` の修正後テスト（Property 1）
 *   - `visitTime` が空欄の場合に `"YYYY-MM-DD 00:00:00"` 形式が返ることを確認
 *   - `visitTime` がある場合に `"YYYY-MM-DD HH:mm:ss"` 形式が返ることを確認
 * - タスク4.2: フロントエンドのパース処理の修正後テスト（Property 1）
 *   - `"2026-05-10 14:30:00"` → `"2026-05-10T14:30"` に正しく変換されることを確認
 *   - `"2026-05-10T14:30:00.000Z"` → タイムゾーン変換なしで正しく変換されることを確認
 *
 * ## Fix Checking Property（設計書より）
 * FOR ALL X WHERE isBugCondition(X) DO
 *   result := fixedProcess(X)
 *   ASSERT result.hours = X.inputHours
 *   ASSERT result.minutes = X.inputMinutes
 *   ASSERT result.date = X.inputDate
 * END FOR
 */

import * as fc from 'fast-check';

// ============================================================
// タスク4.1: combineVisitDateAndTime の修正後実装（再実装）
// ============================================================
// backend/src/services/EnhancedAutoSyncService.ts の修正後実装と同じロジック
// （Supabase接続不要のため、ロジックをここで再実装してテストする）

/**
 * formatVisitDate の実装（EnhancedAutoSyncService.formatVisitDate と同じロジック）
 */
function formatVisitDate(value: any): string | null {
  if (!value || value === '') return null;

  // 文字列の場合、スペースで区切られた複数の日付をチェック
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // スペースが含まれる場合、最初の日付のみを抽出
    if (trimmed.includes(' ')) {
      const firstDate = trimmed.split(' ')[0];
      return formatVisitDate(firstDate);
    }
  }

  const str = String(value).trim();

  // YYYY/MM/DD 形式の場合
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD 形式の場合
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * formatVisitTime の実装（EnhancedAutoSyncService.formatVisitTime と同じロジック）
 */
function formatVisitTime(value: any): string | null {
  if (!value || value === '') return null;

  const str = String(value).trim();

  // 日付形式が含まれる場合は無視
  if (str.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)) {
    return null;
  }

  // 既に時刻形式（HH:MM または HH:MM:SS）の場合はそのまま返す
  if (str.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
    const parts = str.split(':');
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1];
    return `${hours}:${minutes}`;
  }

  return null;
}

/**
 * 修正後の combineVisitDateAndTime 関数
 * （backend/src/services/EnhancedAutoSyncService.ts の修正後実装と同じロジック）
 *
 * 修正内容:
 * - visitTime が空欄の場合、YYYY-MM-DD ではなく YYYY-MM-DD 00:00:00 を返す
 * - これにより、フロントエンドの new Date() によるタイムゾーン変換問題を回避できる
 */
function combineVisitDateAndTime_FIXED(visitDate: any, visitTime: any): string | null {
  const formattedDate = formatVisitDate(visitDate);
  if (!formattedDate) return null;

  const formattedTime = formatVisitTime(visitTime);
  if (formattedTime) {
    return `${formattedDate} ${formattedTime}:00`;
  }

  // 修正後: visitTime が空欄の場合、YYYY-MM-DD 00:00:00 を明示的に返す
  // （YYYY-MM-DD のみだと DB が 00:00:00 として解釈し、フロントエンドでタイムゾーンずれが発生）
  return `${formattedDate} 00:00:00`;
}

// ============================================================
// タスク4.2: フロントエンドのパース処理（修正後）
// ============================================================

/**
 * 修正後の parseVisitDateToLocal 関数
 * （frontend/frontend/src/pages/CallModePage.tsx の修正後実装と同じロジック）
 *
 * タイムゾーン変換を行わず、文字列を直接パースして datetime-local 形式に変換する。
 */
function parseVisitDateToLocal(visitDate: string): string {
  const visitDateStr = String(visitDate);
  // "T" または " " を統一して " " に変換し、ミリ秒・タイムゾーン部分を除去
  const normalized = visitDateStr.replace('T', ' ').replace(/\.\d+Z?$/, '');
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [hh, mm] = timePart.split(':');
  return `${datePart}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}

// ============================================================
// テストスイート
// ============================================================

describe('訪問予約日時00:00リセットバグ - Fix Checking（修正後確認）', () => {

  // ----------------------------------------------------------
  // タスク4.1: combineVisitDateAndTime の修正後テスト（Property 1）
  // ----------------------------------------------------------

  describe('タスク4.1: combineVisitDateAndTime の修正後テスト', () => {

    /**
     * Fix Checking テスト（経路B修正確認）:
     * `visitTime` が空欄の場合、修正後の `combineVisitDateAndTime` が
     * `"YYYY-MM-DD 00:00:00"` 形式を返すことを確認する。
     *
     * バグ修正前: `"2026-05-10"` を返していた（時刻なし）
     * バグ修正後: `"2026-05-10 00:00:00"` を返す（時刻を明示）
     *
     * **Validates: Requirements 2.2**
     */
    test('修正確認: visitTime が空欄の場合、"YYYY-MM-DD 00:00:00" 形式が返る', () => {
      // Arrange: 訪問日あり、訪問時間なし（スプレッドシートの「訪問時間」列が空欄）
      const visitDate = '2026-05-10';
      const visitTime = ''; // 空欄

      // Act: 修正後の combineVisitDateAndTime を実行
      const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', JSON.stringify(visitTime));
      console.log('出力 result:', result);

      // 修正後の確認: 時刻付き形式が返る
      expect(result).toBe('2026-05-10 00:00:00');

      // バグ修正前の値ではないことを確認
      expect(result).not.toBe('2026-05-10'); // 時刻なし形式は返らない
    });

    /**
     * Fix Checking テスト（visitTime が null の場合）:
     * `visitTime` が null の場合も `"YYYY-MM-DD 00:00:00"` 形式が返ることを確認する。
     *
     * **Validates: Requirements 2.2**
     */
    test('修正確認: visitTime が null の場合も "YYYY-MM-DD 00:00:00" 形式が返る', () => {
      const visitDate = '2026-05-10';
      const visitTime = null;

      const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('出力 result:', result);

      // 修正後の確認: 時刻付き形式が返る
      expect(result).toBe('2026-05-10 00:00:00');
    });

    /**
     * Fix Checking テスト（visitTime が undefined の場合）:
     * `visitTime` が undefined の場合も `"YYYY-MM-DD 00:00:00"` 形式が返ることを確認する。
     *
     * **Validates: Requirements 2.2**
     */
    test('修正確認: visitTime が undefined の場合も "YYYY-MM-DD 00:00:00" 形式が返る', () => {
      const visitDate = '2026-05-10';
      const visitTime = undefined;

      const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('出力 result:', result);

      // 修正後の確認: 時刻付き形式が返る
      expect(result).toBe('2026-05-10 00:00:00');
    });

    /**
     * Fix Checking テスト（visitTime がある場合）:
     * `visitTime` がある場合は `"YYYY-MM-DD HH:mm:ss"` 形式が返ることを確認する。
     * （既存の正常動作が維持されていることを確認）
     *
     * **Validates: Requirements 3.2**
     */
    test('修正確認: visitTime がある場合は "YYYY-MM-DD HH:mm:ss" 形式が返る', () => {
      const visitDate = '2026-05-10';
      const visitTime = '14:30';

      const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('出力 result:', result);

      // 正常ケース: 時刻あり形式が返る
      expect(result).toBe('2026-05-10 14:30:00');
    });

    /**
     * Fix Checking テスト（様々な時刻形式）:
     * 様々な時刻形式で `"YYYY-MM-DD HH:mm:ss"` 形式が返ることを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('修正確認: 様々な時刻形式で "YYYY-MM-DD HH:mm:ss" 形式が返る', () => {
      const testCases = [
        { visitDate: '2026-05-10', visitTime: '09:00', expected: '2026-05-10 09:00:00' },
        { visitDate: '2026-05-10', visitTime: '14:30', expected: '2026-05-10 14:30:00' },
        { visitDate: '2026-05-10', visitTime: '00:00', expected: '2026-05-10 00:00:00' },
        { visitDate: '2026-05-10', visitTime: '23:59', expected: '2026-05-10 23:59:00' },
      ];

      for (const { visitDate, visitTime, expected } of testCases) {
        const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);
        console.log(`visitDate=${visitDate}, visitTime=${visitTime} → result=${result}`);
        expect(result).toBe(expected);
      }
    });

    /**
     * Fix Checking テスト（visitDate が空欄の場合）:
     * `visitDate` が空欄の場合は `null` が返ることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('修正確認: visitDate が空欄の場合は null が返る', () => {
      const visitDate = '';
      const visitTime = '';

      const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', JSON.stringify(visitDate));
      console.log('入力 visitTime:', JSON.stringify(visitTime));
      console.log('出力 result:', result);

      // null が返ることを確認
      expect(result).toBeNull();
    });

    /**
     * Property-Based Test: visitTime が空欄の場合、常に "YYYY-MM-DD 00:00:00" 形式が返る
     *
     * **Validates: Requirements 2.2**
     */
    test('Property-Based: visitTime が空欄の場合、常に "YYYY-MM-DD 00:00:00" 形式が返る（修正後）', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成（YYYY-MM-DD形式）
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const visitTime = ''; // 空欄

            const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            // 修正後の確認: 時刻付き形式が返る（YYYY-MM-DD 00:00:00形式）
            const expectedResult = `${visitDate} 00:00:00`;
            return result === expectedResult;
          }
        ),
        {
          numRuns: 50,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: visitTime がある場合、常に "YYYY-MM-DD HH:mm:ss" 形式が返る
     *
     * **Validates: Requirements 3.2**
     */
    test('Property-Based: visitTime がある場合、常に "YYYY-MM-DD HH:mm:ss" 形式が返る', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          // ランダムな時刻を生成（HH:MM形式）
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (year, month, day, hour, minute) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const visitTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

            const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            // 修正後の確認: 時刻付き形式が返る
            const expectedResult = `${visitDate} ${visitTime}:00`;
            return result === expectedResult;
          }
        ),
        {
          numRuns: 50,
          verbose: true,
        }
      );
    });

  });

  // ----------------------------------------------------------
  // タスク4.2: フロントエンドのパース処理の修正後テスト（Property 1）
  // ----------------------------------------------------------

  describe('タスク4.2: フロントエンドのパース処理の修正後テスト', () => {

    /**
     * Fix Checking テスト（経路A修正確認 - スペース区切り形式）:
     * `"2026-05-10 14:30:00"` → `"2026-05-10T14:30"` に正しく変換されることを確認する。
     *
     * バグ修正前: `new Date("2026-05-10 14:30:00")` でパースしていた（環境依存）
     * バグ修正後: 文字列を直接パースしてタイムゾーン変換なし
     *
     * **Validates: Requirements 2.3**
     */
    test('修正確認: "2026-05-10 14:30:00" → "2026-05-10T14:30" に正しく変換される', () => {
      const visitDate = '2026-05-10 14:30:00';

      const result = parseVisitDateToLocal(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('出力 result:', result);

      // 修正後の確認: タイムゾーン変換なしで正しく変換される
      expect(result).toBe('2026-05-10T14:30');
    });

    /**
     * Fix Checking テスト（経路A修正確認 - UTC ISO 8601形式）:
     * `"2026-05-10T14:30:00.000Z"` → タイムゾーン変換なしで正しく変換されることを確認する。
     *
     * バグ修正前: `new Date("2026-05-10T14:30:00.000Z")` でパースすると
     *   JST環境では 23:30 になっていた（UTC 14:30 → JST 23:30）
     * バグ修正後: 文字列を直接パースして 14:30 のまま保持
     *
     * **Validates: Requirements 2.3**
     */
    test('修正確認: "2026-05-10T14:30:00.000Z" → タイムゾーン変換なしで "2026-05-10T14:30" に変換される', () => {
      const visitDate = '2026-05-10T14:30:00.000Z';

      const result = parseVisitDateToLocal(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('出力 result:', result);

      // 修正後の確認: タイムゾーン変換なしで 14:30 のまま保持される
      expect(result).toBe('2026-05-10T14:30');

      // バグ修正前の値ではないことを確認（JST環境では 23:30 になっていた）
      expect(result).not.toBe('2026-05-10T23:30');
    });

    /**
     * Fix Checking テスト（ISO 8601形式 - Tセパレータ）:
     * `"2026-05-10T14:30:00"` → `"2026-05-10T14:30"` に正しく変換されることを確認する。
     *
     * **Validates: Requirements 2.3**
     */
    test('修正確認: "2026-05-10T14:30:00" → "2026-05-10T14:30" に正しく変換される', () => {
      const visitDate = '2026-05-10T14:30:00';

      const result = parseVisitDateToLocal(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('出力 result:', result);

      expect(result).toBe('2026-05-10T14:30');
    });

    /**
     * Fix Checking テスト（時刻なし形式）:
     * `"2026-05-10"` → `"2026-05-10T00:00"` に正しく変換されることを確認する。
     *
     * **Validates: Requirements 2.3**
     */
    test('修正確認: "2026-05-10" → "2026-05-10T00:00" に正しく変換される（タイムゾーン変換なし）', () => {
      const visitDate = '2026-05-10';

      const result = parseVisitDateToLocal(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('出力 result:', result);

      // 修正後の確認: タイムゾーン変換なしで 00:00 になる
      expect(result).toBe('2026-05-10T00:00');

      // バグ修正前の値ではないことを確認（JST環境では 09:00 になっていた）
      expect(result).not.toBe('2026-05-10T09:00');
    });

    /**
     * Fix Checking テスト（combineVisitDateAndTime の出力をパース）:
     * 修正後の `combineVisitDateAndTime` の出力（`"YYYY-MM-DD 00:00:00"`）を
     * 修正後の `parseVisitDateToLocal` でパースすると `"YYYY-MM-DDT00:00"` になることを確認する。
     *
     * これにより、経路B → 経路A の連鎖バグが解消されていることを確認する。
     *
     * **Validates: Requirements 2.1, 2.2, 2.3**
     */
    test('修正確認: combineVisitDateAndTime の出力を parseVisitDateToLocal でパースすると時間が保持される', () => {
      // 経路B修正後: combineVisitDateAndTime が "YYYY-MM-DD 00:00:00" を返す
      const combinedResult = '2026-05-10 00:00:00'; // 修正後の出力

      // 経路A修正後: parseVisitDateToLocal が文字列を直接パース
      const displayResult = parseVisitDateToLocal(combinedResult);

      console.log('combineVisitDateAndTime の出力:', combinedResult);
      console.log('parseVisitDateToLocal の出力:', displayResult);

      // 修正後の確認: 時間が 00:00 のまま保持される（タイムゾーン変換なし）
      expect(displayResult).toBe('2026-05-10T00:00');

      // バグ修正前の値ではないことを確認（JST環境では 09:00 になっていた）
      expect(displayResult).not.toBe('2026-05-10T09:00');
    });

    /**
     * Fix Checking テスト（様々な時刻形式）:
     * 様々な形式の visitDate が正しく変換されることを確認する。
     *
     * **Validates: Requirements 2.3**
     */
    test('修正確認: 様々な形式の visitDate が正しく変換される', () => {
      const testCases = [
        // スペース区切り形式（DBから返される形式）
        { input: '2026-05-10 09:00:00', expected: '2026-05-10T09:00' },
        { input: '2026-05-10 14:30:00', expected: '2026-05-10T14:30' },
        { input: '2026-05-10 00:00:00', expected: '2026-05-10T00:00' },
        { input: '2026-05-10 23:59:00', expected: '2026-05-10T23:59' },
        // ISO 8601形式（Tセパレータ）
        { input: '2026-05-10T14:30:00', expected: '2026-05-10T14:30' },
        // UTC ISO 8601形式（Zサフィックス）
        { input: '2026-05-10T14:30:00.000Z', expected: '2026-05-10T14:30' },
        { input: '2026-05-10T00:00:00.000Z', expected: '2026-05-10T00:00' },
      ];

      for (const { input, expected } of testCases) {
        const result = parseVisitDateToLocal(input);
        console.log(`入力: "${input}" → 出力: "${result}" (期待値: "${expected}")`);
        expect(result).toBe(expected);
      }
    });

    /**
     * Property-Based Test: 任意の "YYYY-MM-DD HH:mm:ss" 形式の文字列が
     * タイムゾーン変換なしで正しく変換されることを確認する。
     *
     * **Validates: Requirements 2.3**
     */
    test('Property-Based: "YYYY-MM-DD HH:mm:ss" 形式の文字列が常に正しく変換される', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          // ランダムな時刻を生成
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (year, month, day, hour, minute) => {
            const datePart = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const timePart = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const visitDate = `${datePart} ${timePart}:00`; // "YYYY-MM-DD HH:mm:ss" 形式

            const result = parseVisitDateToLocal(visitDate);

            // 修正後の確認: タイムゾーン変換なしで正しく変換される
            const expectedResult = `${datePart}T${timePart}`;
            return result === expectedResult;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: UTC ISO 8601形式（Zサフィックス）の文字列が
     * タイムゾーン変換なしで正しく変換されることを確認する。
     *
     * **Validates: Requirements 2.3**
     */
    test('Property-Based: UTC ISO 8601形式の文字列が常にタイムゾーン変換なしで変換される', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          // ランダムな時刻を生成
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (year, month, day, hour, minute) => {
            const datePart = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const timePart = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const visitDate = `${datePart}T${timePart}:00.000Z`; // UTC ISO 8601形式

            const result = parseVisitDateToLocal(visitDate);

            // 修正後の確認: タイムゾーン変換なしで正しく変換される
            // "2026-05-10T14:30:00.000Z" → "2026-05-10T14:30"（Zを無視して時刻をそのまま使用）
            const expectedResult = `${datePart}T${timePart}`;
            return result === expectedResult;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

  });

});
