/**
 * Preservation Checking テスト: 訪問予約日時バグ修正による既存動作の保全確認
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * ## テストの目的
 * バグ条件が成立しない全ての入力に対して、修正後の処理が修正前と同じ結果を返すことを検証する。
 *
 * ## Preservation Checking Property（設計書より）
 * FOR ALL X WHERE NOT isBugCondition(X) DO
 *   ASSERT originalProcess(X) = fixedProcess(X)
 * END FOR
 *
 * ## 変更してはいけない動作
 * - 訪問時間あり同期（visitTime が空でない場合）の動作は変わらない
 * - フロントエンドからの保存・表示の動作は変わらない
 * - 訪問日時の削除（null クリア）は変わらない
 * - 営担（visitAssignee）の保存動作は変わらない
 */

import * as fc from 'fast-check';

// ============================================================
// combineVisitDateAndTime の修正前・修正後の実装（再実装）
// ============================================================

/**
 * formatVisitDate の実装（共通）
 */
function formatVisitDate(value: any): string | null {
  if (!value || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.includes(' ')) {
      const firstDate = trimmed.split(' ')[0];
      return formatVisitDate(firstDate);
    }
  }

  const str = String(value).trim();

  // YYYY/MM/DD 形式
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD 形式
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * formatVisitTime の実装（共通）
 */
function formatVisitTime(value: any): string | null {
  if (!value || value === '') return null;

  const str = String(value).trim();

  // 日付形式が含まれる場合は無視
  if (str.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)) {
    return null;
  }

  // HH:MM または HH:MM:SS 形式
  if (str.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
    const parts = str.split(':');
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1];
    return `${hours}:${minutes}`;
  }

  return null;
}

/**
 * 修正前の combineVisitDateAndTime 関数
 * （バグあり: visitTime が空欄の場合、YYYY-MM-DD 形式をそのまま返す）
 */
function combineVisitDateAndTime_ORIGINAL(visitDate: any, visitTime: any): string | null {
  const formattedDate = formatVisitDate(visitDate);
  if (!formattedDate) return null;

  const formattedTime = formatVisitTime(visitTime);
  if (formattedTime) {
    return `${formattedDate} ${formattedTime}:00`;
  }

  // バグ: visitTime が空欄の場合、YYYY-MM-DD 形式をそのまま返す
  return formattedDate;
}

/**
 * 修正後の combineVisitDateAndTime 関数
 * （修正済み: visitTime が空欄の場合、YYYY-MM-DD 00:00:00 を返す）
 */
function combineVisitDateAndTime_FIXED(visitDate: any, visitTime: any): string | null {
  const formattedDate = formatVisitDate(visitDate);
  if (!formattedDate) return null;

  const formattedTime = formatVisitTime(visitTime);
  if (formattedTime) {
    return `${formattedDate} ${formattedTime}:00`;
  }

  // 修正後: visitTime が空欄の場合、YYYY-MM-DD 00:00:00 を明示的に返す
  return `${formattedDate} 00:00:00`;
}

// ============================================================
// フロントエンドのパース処理（修正前・修正後）
// ============================================================

/**
 * 修正前の parseVisitDateToLocal 関数
 * （バグあり: new Date() によるタイムゾーン変換が発生する）
 */
function parseVisitDateToLocal_ORIGINAL(visitDate: string): string {
  const visitDateTime = new Date(visitDate);
  const year = visitDateTime.getFullYear();
  const month = String(visitDateTime.getMonth() + 1).padStart(2, '0');
  const day = String(visitDateTime.getDate()).padStart(2, '0');
  const hours = String(visitDateTime.getHours()).padStart(2, '0');
  const minutes = String(visitDateTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 修正後の parseVisitDateToLocal 関数
 * （修正済み: 文字列を直接パース、タイムゾーン変換なし）
 */
function parseVisitDateToLocal_FIXED(visitDate: string): string {
  const visitDateStr = String(visitDate);
  const normalized = visitDateStr.replace('T', ' ').replace(/\.\d+Z?$/, '');
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [hh, mm] = timePart.split(':');
  return `${datePart}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}

// ============================================================
// テストスイート
// ============================================================

describe('訪問予約日時00:00リセットバグ - Preservation Checking（既存動作の保全確認）', () => {

  // ----------------------------------------------------------
  // タスク5.1: 訪問時間あり同期の保持テスト（Property 2）
  // ----------------------------------------------------------

  describe('タスク5.1: 訪問時間あり同期の保持テスト', () => {

    /**
     * Preservation テスト（訪問時間あり同期）:
     * `combineVisitDateAndTime("2026-05-10", "14:30")` が修正前後で同じ結果を返すことを確認する。
     *
     * バグ条件: visitTime が空欄の場合（isBugCondition = true）
     * 保全対象: visitTime がある場合（isBugCondition = false）
     *
     * **Validates: Requirements 3.2**
     */
    test('保全: combineVisitDateAndTime("2026-05-10", "14:30") が修正前後で同じ結果を返す', () => {
      // Arrange: バグ条件に該当しない入力（visitTime がある場合）
      const visitDate = '2026-05-10';
      const visitTime = '14:30';

      // Act: 修正前・修正後の両方を実行
      const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('修正前の結果:', originalResult);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: 修正前後で同じ結果が返ること
      expect(fixedResult).toBe(originalResult);
      // 期待値の確認
      expect(fixedResult).toBe('2026-05-10 14:30:00');
    });

    /**
     * Preservation テスト（様々な時刻形式）:
     * 様々な時刻形式で修正前後が同じ結果を返すことを確認する。
     *
     * **Validates: Requirements 3.2**
     */
    test('保全: 様々な時刻形式で combineVisitDateAndTime が修正前後で同じ結果を返す', () => {
      const testCases = [
        { visitDate: '2026-05-10', visitTime: '09:00' },
        { visitDate: '2026-05-10', visitTime: '14:30' },
        { visitDate: '2026-05-10', visitTime: '00:00' },
        { visitDate: '2026-05-10', visitTime: '23:59' },
        { visitDate: '2026-01-01', visitTime: '10:00' },
        { visitDate: '2026-12-31', visitTime: '18:30' },
      ];

      for (const { visitDate, visitTime } of testCases) {
        const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
        const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

        console.log(`visitDate=${visitDate}, visitTime=${visitTime}`);
        console.log(`  修正前: ${originalResult}`);
        console.log(`  修正後: ${fixedResult}`);

        // Preservation 確認: 修正前後で同じ結果が返ること
        expect(fixedResult).toBe(originalResult);
      }
    });

    /**
     * Preservation テスト（visitDate が null の場合）:
     * visitDate が null の場合、修正前後ともに null が返ることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('保全: visitDate が null の場合、修正前後ともに null が返る', () => {
      const visitDate = null;
      const visitTime = '14:30';

      const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('修正前の結果:', originalResult);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: 修正前後ともに null が返ること
      expect(fixedResult).toBe(originalResult);
      expect(fixedResult).toBeNull();
    });

    /**
     * Preservation テスト（visitDate が空文字の場合）:
     * visitDate が空文字の場合、修正前後ともに null が返ることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('保全: visitDate が空文字の場合、修正前後ともに null が返る', () => {
      const visitDate = '';
      const visitTime = '14:30';

      const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', JSON.stringify(visitDate));
      console.log('入力 visitTime:', visitTime);
      console.log('修正前の結果:', originalResult);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: 修正前後ともに null が返ること
      expect(fixedResult).toBe(originalResult);
      expect(fixedResult).toBeNull();
    });

  });

  // ----------------------------------------------------------
  // タスク5.2: null クリアの保持テスト（Property 2）
  // ----------------------------------------------------------

  describe('タスク5.2: null クリアの保持テスト', () => {

    /**
     * Preservation テスト（visitDate が空欄の場合に null が保存される）:
     * visitDate が空欄の場合に null が保存されることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('保全: visitDate が空欄の場合に null が保存される', () => {
      // Arrange: visitDate が空欄（訪問日を削除）
      const visitDate = '';
      const visitTime = '';

      // Act: 修正後の combineVisitDateAndTime を実行
      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', JSON.stringify(visitDate));
      console.log('入力 visitTime:', JSON.stringify(visitTime));
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: null が返ること（訪問日を削除した場合）
      expect(fixedResult).toBeNull();
    });

    /**
     * Preservation テスト（visitDate が null の場合に null が保存される）:
     * visitDate が null の場合に null が保存されることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('保全: visitDate が null の場合に null が保存される', () => {
      const visitDate = null;
      const visitTime = null;

      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: null が返ること
      expect(fixedResult).toBeNull();
    });

    /**
     * Preservation テスト（visitDate が undefined の場合に null が保存される）:
     * visitDate が undefined の場合に null が保存されることを確認する。
     *
     * **Validates: Requirements 3.3**
     */
    test('保全: visitDate が undefined の場合に null が保存される', () => {
      const visitDate = undefined;
      const visitTime = undefined;

      const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: null が返ること
      expect(fixedResult).toBeNull();
    });

    /**
     * Preservation テスト（フロントエンドのパース処理 - 時刻あり形式）:
     * "YYYY-MM-DD HH:mm:ss" 形式の文字列が修正前後で同じ結果を返すことを確認する。
     *
     * バグ条件: "YYYY-MM-DD" 形式（時刻なし）または UTC 形式（Zサフィックス）
     * 保全対象: "YYYY-MM-DD HH:mm:ss" 形式（ローカル時刻）
     *
     * **Validates: Requirements 3.5**
     */
    test('保全: "YYYY-MM-DD HH:mm:ss" 形式の文字列が修正前後で同じ結果を返す', () => {
      // Arrange: バグ条件に該当しない入力（ローカル時刻形式）
      const visitDate = '2026-05-10 14:30:00';

      // Act: 修正前・修正後の両方を実行
      const originalResult = parseVisitDateToLocal_ORIGINAL(visitDate);
      const fixedResult = parseVisitDateToLocal_FIXED(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('修正前の結果:', originalResult);
      console.log('修正後の結果:', fixedResult);

      // Preservation 確認: 修正前後で同じ結果が返ること
      // 注意: "YYYY-MM-DD HH:mm:ss" 形式はローカル時刻として解釈されるため、
      // UTC環境（テスト環境）では修正前後で同じ結果になる
      expect(fixedResult).toBe(originalResult);
      // 期待値の確認
      expect(fixedResult).toBe('2026-05-10T14:30');
    });

    /**
     * Preservation テスト（フロントエンドのパース処理 - ISO 8601形式）:
     * "YYYY-MM-DDTHH:mm:ss" 形式の文字列が修正後に正しく変換されることを確認する。
     *
     * **Validates: Requirements 3.5**
     */
    test('保全: "YYYY-MM-DDTHH:mm:ss" 形式の文字列が修正後に正しく変換される', () => {
      const visitDate = '2026-05-10T14:30:00';

      const fixedResult = parseVisitDateToLocal_FIXED(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('修正後の結果:', fixedResult);

      // 修正後の確認: タイムゾーン変換なしで正しく変換される
      expect(fixedResult).toBe('2026-05-10T14:30');
    });

  });

  // ----------------------------------------------------------
  // タスク5.3: プロパティベーステスト（Property 2）
  // ----------------------------------------------------------

  describe('タスク5.3: プロパティベーステスト', () => {

    /**
     * Property-Based Test: ランダムな日付・時刻の組み合わせで
     * combineVisitDateAndTime が常に "YYYY-MM-DD HH:mm:ss" 形式を返すことを検証する。
     *
     * **Validates: Requirements 3.2**
     */
    test('Property-Based: ランダムな日付・時刻の組み合わせで combineVisitDateAndTime が常に "YYYY-MM-DD HH:mm:ss" 形式を返す', () => {
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

            // 修正後の combineVisitDateAndTime を実行
            const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            if (result === null) return false;

            // "YYYY-MM-DD HH:mm:ss" 形式であることを確認
            const isValidFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result);

            // 修正前後で同じ結果が返ること（visitTime がある場合はバグ条件に該当しない）
            const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
            const isSameAsOriginal = result === originalResult;

            return isValidFormat && isSameAsOriginal;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: visitTime が空欄の場合でも
     * 修正後の combineVisitDateAndTime が常に "YYYY-MM-DD HH:mm:ss" 形式を返すことを検証する。
     *
     * **Validates: Requirements 2.2**
     */
    test('Property-Based: visitTime が空欄の場合でも修正後は常に "YYYY-MM-DD HH:mm:ss" 形式を返す', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const visitTime = ''; // 空欄（バグ条件）

            // 修正後の combineVisitDateAndTime を実行
            const result = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            if (result === null) return false;

            // "YYYY-MM-DD HH:mm:ss" 形式であることを確認
            const isValidFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result);

            // 期待値: "YYYY-MM-DD 00:00:00" 形式
            const expectedResult = `${visitDate} 00:00:00`;
            const isExpectedValue = result === expectedResult;

            return isValidFormat && isExpectedValue;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: ランダムな "YYYY-MM-DD HH:mm:ss" 形式の visit_date 文字列に対して
     * パース処理が時間部分を保持することを検証する。
     *
     * **Validates: Requirements 3.5**
     */
    test('Property-Based: ランダムな "YYYY-MM-DD HH:mm:ss" 形式の visit_date に対してパース処理が時間部分を保持する', () => {
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

            // 修正後のパース処理を実行
            const result = parseVisitDateToLocal_FIXED(visitDate);

            // 期待値: "YYYY-MM-DDTHH:mm" 形式（時間部分が保持される）
            const expectedResult = `${datePart}T${timePart}`;

            // 時間部分が保持されることを確認
            const isTimePreserved = result === expectedResult;

            return isTimePreserved;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: visitTime がある場合、修正前後で combineVisitDateAndTime の結果が一致する
     * （Preservation Property の核心）
     *
     * **Validates: Requirements 3.2**
     */
    test('Property-Based: visitTime がある場合、修正前後で combineVisitDateAndTime の結果が一致する（Preservation）', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          // ランダムな時刻を生成（空欄でない = バグ条件に該当しない）
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (year, month, day, hour, minute) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const visitTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

            // 修正前・修正後の両方を実行
            const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
            const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            // Preservation 確認: 修正前後で同じ結果が返ること
            return originalResult === fixedResult;
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    /**
     * Property-Based Test: visitDate が null または空文字の場合、
     * 修正前後ともに null が返ること（null クリアの保全）
     *
     * **Validates: Requirements 3.3**
     */
    test('Property-Based: visitDate が null または空文字の場合、修正前後ともに null が返る（null クリアの保全）', () => {
      fc.assert(
        fc.property(
          // visitDate の無効な値を生成
          fc.oneof(
            fc.constant(null),
            fc.constant(''),
            fc.constant(undefined)
          ),
          // visitTime のランダムな値を生成
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant('14:30'),
            fc.constant('09:00')
          ),
          (visitDate, visitTime) => {
            // 修正前・修正後の両方を実行
            const originalResult = combineVisitDateAndTime_ORIGINAL(visitDate, visitTime);
            const fixedResult = combineVisitDateAndTime_FIXED(visitDate, visitTime);

            // Preservation 確認: 修正前後ともに null が返ること
            return originalResult === null && fixedResult === null;
          }
        ),
        {
          numRuns: 50,
          verbose: true,
        }
      );
    });

  });

});
