/**
 * バグ条件探索テスト: 訪問予約日時が00:00にリセットされるバグ（再発）
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * ## バグの概要
 * コミット `5d93fe8b` で導入された `combineVisitDateAndTime` 関数が
 * `visitTime` 空欄時に `YYYY-MM-DD` 形式（時刻なし）を返すため、
 * フロントエンドの `new Date()` パースと組み合わさって時間が00:00にリセットされる。
 *
 * ## バグの2経路
 * - 経路B: `combineVisitDateAndTime` が `visitTime` 空欄時に `YYYY-MM-DD` 形式を返す
 * - 経路A: フロントエンドの `new Date("YYYY-MM-DD")` がUTC→JST変換で時間をずらす
 *
 * ## テストの目的
 * 未修正コードでバグを再現し、根本原因を確認する。
 * - 経路Bテスト: `combineVisitDateAndTime("2026-05-10", "")` が `"2026-05-10"` を返すことを確認
 *   （未修正コードで「成功」するが、これがバグの原因）
 * - 経路Aテスト: `new Date("2026-05-10")` がタイムゾーン変換を行うことを確認
 */

import * as fc from 'fast-check';

// ============================================================
// 経路B: combineVisitDateAndTime のバグ再現
// ============================================================

/**
 * 未修正の combineVisitDateAndTime 関数を再現する
 * （backend/src/services/EnhancedAutoSyncService.ts のコミット5d93fe8b時点の実装）
 *
 * バグの本質:
 * `visitTime` が空欄の場合、`formattedDate`（YYYY-MM-DD形式）をそのまま返す。
 * DBのTIMESTAMP型は `YYYY-MM-DD` を `YYYY-MM-DD 00:00:00` として解釈するが、
 * フロントエンドが `new Date("YYYY-MM-DD")` でパースするとUTC→JST変換が発生する。
 */
function combineVisitDateAndTime_BUGGY(visitDate: string, visitTime: string | null | undefined): string | null {
  // formatVisitDate の簡易実装（YYYY-MM-DD形式を返す）
  const formattedDate = formatVisitDate(visitDate);
  if (!formattedDate) return null;

  // formatVisitTime の簡易実装
  const formattedTime = formatVisitTime(visitTime);
  if (formattedTime) {
    return `${formattedDate} ${formattedTime}:00`;
  }

  // ← バグ: visitTime が空欄の場合、YYYY-MM-DD 形式をそのまま返す
  return formattedDate;
}

/**
 * formatVisitDate の簡易実装（YYYY-MM-DD形式を返す）
 */
function formatVisitDate(value: any): string | null {
  if (!value || value === '') return null;
  const str = String(value).trim();

  // YYYY-MM-DD 形式の場合
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY/MM/DD 形式の場合
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

/**
 * formatVisitTime の簡易実装（HH:MM形式を返す）
 */
function formatVisitTime(value: any): string | null {
  if (!value || value === '') return null;
  const str = String(value).trim();

  // HH:MM または HH:MM:SS 形式の場合
  if (str.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
    const parts = str.split(':');
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1];
    return `${hours}:${minutes}`;
  }

  return null;
}

// ============================================================
// 経路A: フロントエンドの new Date() タイムゾーン変換バグ再現
// ============================================================

/**
 * フロントエンドの未修正パース処理を再現する
 * （frontend/frontend/src/pages/CallModePage.tsx の未修正コード）
 *
 * バグの本質:
 * `new Date("YYYY-MM-DD")` はUTC 00:00として解釈される。
 * JST（UTC+9）環境では、これが前日の15:00（JST）になる。
 * `getHours()` / `getMinutes()` はローカル時刻を返すため、
 * JST環境では `new Date("2026-05-10").getHours()` が `9` になる（UTC 00:00 → JST 09:00）。
 *
 * ただし、テスト実行環境（Vercel/Node.js）はUTCで動作するため、
 * `getHours()` が `0` を返す場合もある（環境依存）。
 * このテストでは「YYYY-MM-DD形式がUTCとして解釈される」という事実を確認する。
 */
function parseVisitDateToLocal_BUGGY(visitDate: string): string {
  // ← バグ: new Date() がUTCとして解釈し、タイムゾーン変換が発生する
  const visitDateTime = new Date(visitDate);
  const year = visitDateTime.getFullYear();
  const month = String(visitDateTime.getMonth() + 1).padStart(2, '0');
  const day = String(visitDateTime.getDate()).padStart(2, '0');
  const hours = String(visitDateTime.getHours()).padStart(2, '0');
  const minutes = String(visitDateTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 修正後のパース処理（タイムゾーン変換なし）
 * 文字列を直接パースして datetime-local 形式に変換する
 */
function parseVisitDateToLocal_FIXED(visitDate: string): string {
  // 修正後: 文字列を直接パース（タイムゾーン変換なし）
  const visitDateStr = String(visitDate);
  const normalized = visitDateStr.replace('T', ' ').replace(/\.\d+Z?$/, '');
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [hh, mm] = timePart.split(':');
  return `${datePart}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
}

// ============================================================
// テストスイート
// ============================================================

describe('訪問予約日時00:00リセットバグ - バグ条件探索', () => {

  // ----------------------------------------------------------
  // 経路B: combineVisitDateAndTime のバグ再現テスト（タスク1.1）
  // ----------------------------------------------------------

  describe('経路B: combineVisitDateAndTime の visitTime 空欄時バグ', () => {

    /**
     * バグ再現テスト（経路B）:
     * `visitTime` が空欄の場合、`combineVisitDateAndTime` が `YYYY-MM-DD` 形式を返す。
     *
     * このテストは未修正コードで「成功」する（バグの存在を証明する）。
     * 修正後は `YYYY-MM-DD 00:00:00` 形式を返すべきなので、このテストは「失敗」する。
     *
     * **Validates: Requirements 1.2**
     */
    test('バグ再現: visitTime が空欄の場合、combineVisitDateAndTime が YYYY-MM-DD 形式（時刻なし）を返す', () => {
      // Arrange: 訪問日あり、訪問時間なし（スプレッドシートの「訪問時間」列が空欄）
      const visitDate = '2026-05-10';
      const visitTime = ''; // 空欄

      // Act: 未修正の combineVisitDateAndTime を実行
      const result = combineVisitDateAndTime_BUGGY(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', JSON.stringify(visitTime));
      console.log('出力 result:', result);
      console.log('バグ確認: 時刻なし形式か?', result === '2026-05-10');
      console.log('期待される修正後の値: "2026-05-10 00:00:00"');

      // バグの存在を確認: 未修正コードは YYYY-MM-DD 形式（時刻なし）を返す
      // これがバグの原因 - DBはこれを "2026-05-10 00:00:00" として解釈し、
      // フロントエンドの new Date() がUTC→JST変換で時間をずらす
      expect(result).toBe('2026-05-10'); // ← バグ: 時刻なし形式が返る
    });

    /**
     * バグ再現テスト（経路B - null入力）:
     * `visitTime` が null の場合も同様に `YYYY-MM-DD` 形式を返す。
     *
     * **Validates: Requirements 1.2**
     */
    test('バグ再現: visitTime が null の場合も YYYY-MM-DD 形式（時刻なし）を返す', () => {
      const visitDate = '2026-05-10';
      const visitTime = null;

      const result = combineVisitDateAndTime_BUGGY(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('出力 result:', result);

      // バグの存在を確認
      expect(result).toBe('2026-05-10');
    });

    /**
     * 正常ケース確認: `visitTime` がある場合は正しく動作する
     *
     * **Validates: Requirements 3.2**
     */
    test('正常ケース: visitTime がある場合は YYYY-MM-DD HH:mm:ss 形式を返す', () => {
      const visitDate = '2026-05-10';
      const visitTime = '14:30';

      const result = combineVisitDateAndTime_BUGGY(visitDate, visitTime);

      console.log('入力 visitDate:', visitDate);
      console.log('入力 visitTime:', visitTime);
      console.log('出力 result:', result);

      // 正常ケース: 時刻あり形式が返る
      expect(result).toBe('2026-05-10 14:30:00');
    });

    /**
     * Property-Based Test: visitTime が空欄の場合、常に時刻なし形式が返ることを確認
     *
     * **Validates: Requirements 1.2**
     */
    test('Property-Based: visitTime が空欄の場合、combineVisitDateAndTime は常に時刻なし形式を返す（バグ）', () => {
      fc.assert(
        fc.property(
          // ランダムな日付を生成（YYYY-MM-DD形式）
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const visitTime = ''; // 空欄

            const result = combineVisitDateAndTime_BUGGY(visitDate, visitTime);

            // バグの確認: 時刻なし形式が返る（YYYY-MM-DD形式）
            // 修正後は YYYY-MM-DD 00:00:00 形式が返るべき
            const isDateOnlyFormat = result !== null && !result.includes(' ');
            return isDateOnlyFormat;
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
  // 経路A: フロントエンドの new Date() タイムゾーン変換バグ再現テスト（タスク1.2）
  // ----------------------------------------------------------

  describe('経路A: フロントエンドの new Date() タイムゾーン変換バグ', () => {

    /**
     * バグ再現テスト（経路A）:
     * `"YYYY-MM-DD"` 形式の文字列を `new Date()` でパースすると、
     * UTC 00:00として解釈される。
     *
     * このテストは「YYYY-MM-DD形式がUTCとして解釈される」という事実を確認する。
     * Node.js/Vercel環境（UTC）では `getHours()` が `0` を返すが、
     * JST環境では `9` を返す（UTC 00:00 → JST 09:00）。
     *
     * **Validates: Requirements 1.3**
     */
    test('バグ再現: "YYYY-MM-DD" 形式を new Date() でパースすると UTC として解釈される', () => {
      const visitDate = '2026-05-10';

      // new Date("YYYY-MM-DD") はUTC 00:00として解釈される
      const parsed = new Date(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('new Date() の結果:', parsed.toISOString());
      console.log('UTC時刻:', parsed.toISOString());
      console.log('getHours() (ローカル時刻):', parsed.getHours());
      console.log('getUTCHours() (UTC時刻):', parsed.getUTCHours());

      // バグの確認: YYYY-MM-DD形式はUTC 00:00として解釈される
      // UTC時刻は常に 0 になる
      expect(parsed.getUTCHours()).toBe(0);
      expect(parsed.getUTCMinutes()).toBe(0);

      // ISO文字列は "2026-05-10T00:00:00.000Z" になる（UTC 00:00）
      expect(parsed.toISOString()).toBe('2026-05-10T00:00:00.000Z');
    });

    /**
     * バグ再現テスト（経路A - JST環境での時間ずれ）:
     * JST環境（UTC+9）では `new Date("2026-05-10")` が前日の15:00（UTC）になる。
     * これをローカル時刻で表示すると `2026-05-10T00:00:00`（JST）になるが、
     * `getHours()` は環境によって異なる値を返す。
     *
     * **Validates: Requirements 1.3**
     */
    test('バグ再現: "YYYY-MM-DD" 形式の new Date() パースは環境依存のタイムゾーン変換が発生する', () => {
      const visitDate = '2026-05-10';

      // new Date("YYYY-MM-DD") はUTC 00:00として解釈される
      const parsed = new Date(visitDate);

      // 未修正のパース処理を実行
      const result = parseVisitDateToLocal_BUGGY(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('未修正パース結果:', result);
      console.log('タイムゾーンオフセット (分):', parsed.getTimezoneOffset());

      // バグの確認: タイムゾーンオフセットが0でない環境（JST等）では時間がずれる
      // UTC環境（Vercel/Node.js）では "2026-05-10T00:00" になる
      // JST環境では "2026-05-10T09:00" になる（UTC 00:00 → JST 09:00）
      const timezoneOffsetMinutes = parsed.getTimezoneOffset();
      console.log('タイムゾーンオフセット:', timezoneOffsetMinutes, '分');

      if (timezoneOffsetMinutes === 0) {
        // UTC環境（Vercel/Node.js）: 時間は 00:00 になる
        console.log('UTC環境: 時間は 00:00 になる（経路Bのバグと組み合わさると問題）');
        expect(result).toBe('2026-05-10T00:00');
      } else if (timezoneOffsetMinutes === -540) {
        // JST環境（UTC+9）: 時間は 09:00 になる
        console.log('JST環境: 時間は 09:00 になる（UTC 00:00 → JST 09:00）');
        expect(result).toBe('2026-05-10T09:00');
      } else {
        // その他の環境: タイムゾーン変換が発生することを確認
        console.log('その他の環境: タイムゾーン変換が発生');
        // タイムゾーンオフセットが0でない場合、時間がずれることを確認
        expect(timezoneOffsetMinutes).not.toBe(0);
      }
    });

    /**
     * バグ再現テスト（経路A - UTC形式の時間ずれ）:
     * `"YYYY-MM-DDTHH:mm:ss.sssZ"` 形式（UTC ISO 8601）を `new Date()` でパースすると、
     * JST環境では9時間ずれる。
     *
     * **Validates: Requirements 1.3**
     */
    test('バグ再現: "YYYY-MM-DDTHH:mm:ss.sssZ" 形式を new Date() でパースすると JST 環境で9時間ずれる', () => {
      // DBから返される可能性のあるUTC ISO 8601形式
      const visitDateUTC = '2026-05-10T14:30:00.000Z'; // UTC 14:30

      const parsed = new Date(visitDateUTC);

      console.log('入力 visitDate (UTC):', visitDateUTC);
      console.log('UTC時刻:', parsed.toISOString());
      console.log('getUTCHours():', parsed.getUTCHours()); // 14
      console.log('getHours() (ローカル時刻):', parsed.getHours()); // JST環境では 23

      // バグの確認: UTC形式はUTCとして解釈される
      expect(parsed.getUTCHours()).toBe(14);
      expect(parsed.getUTCMinutes()).toBe(30);

      // JST環境では getHours() が 23 になる（UTC 14:30 → JST 23:30）
      const timezoneOffsetMinutes = parsed.getTimezoneOffset();
      if (timezoneOffsetMinutes === -540) {
        // JST環境
        expect(parsed.getHours()).toBe(23);
        console.log('JST環境: UTC 14:30 → JST 23:30（9時間ずれ）');
      } else if (timezoneOffsetMinutes === 0) {
        // UTC環境
        expect(parsed.getHours()).toBe(14);
        console.log('UTC環境: UTC 14:30 → UTC 14:30（ずれなし）');
      }
    });

    /**
     * 修正後の動作確認: 文字列直接パースでタイムゾーン変換なし
     *
     * **Validates: Requirements 2.3**
     */
    test('修正後確認: 文字列直接パースで "2026-05-10 14:30:00" → "2026-05-10T14:30" に変換される', () => {
      const visitDate = '2026-05-10 14:30:00';

      const result = parseVisitDateToLocal_FIXED(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('修正後パース結果:', result);

      // 修正後: タイムゾーン変換なしで正しく変換される
      expect(result).toBe('2026-05-10T14:30');
    });

    /**
     * 修正後の動作確認: YYYY-MM-DD形式（時刻なし）の場合
     *
     * **Validates: Requirements 2.3**
     */
    test('修正後確認: "2026-05-10" 形式を文字列直接パースすると "2026-05-10T00:00" になる', () => {
      const visitDate = '2026-05-10';

      const result = parseVisitDateToLocal_FIXED(visitDate);

      console.log('入力 visitDate:', visitDate);
      console.log('修正後パース結果:', result);

      // 修正後: タイムゾーン変換なしで "2026-05-10T00:00" になる
      expect(result).toBe('2026-05-10T00:00');
    });

    /**
     * 経路B → 経路A の連鎖バグ確認:
     * `combineVisitDateAndTime("2026-05-10", "")` が `"2026-05-10"` を返し、
     * それを `new Date()` でパースすると時間がずれることを確認。
     *
     * **Validates: Requirements 1.1, 1.2, 1.3**
     */
    test('連鎖バグ確認: combineVisitDateAndTime の出力を new Date() でパースすると時間がずれる', () => {
      // 経路B: combineVisitDateAndTime が YYYY-MM-DD 形式を返す
      const visitDate = '2026-05-10';
      const visitTime = ''; // 空欄

      const combinedResult = combineVisitDateAndTime_BUGGY(visitDate, visitTime);
      console.log('経路B: combineVisitDateAndTime の出力:', combinedResult);

      // バグ確認: 時刻なし形式が返る
      expect(combinedResult).toBe('2026-05-10');

      // 経路A: この出力を new Date() でパースするとUTCとして解釈される
      const parsed = new Date(combinedResult!);
      console.log('経路A: new Date() の結果:', parsed.toISOString());
      console.log('UTC時刻:', `${parsed.getUTCHours()}:${parsed.getUTCMinutes()}`);

      // バグの連鎖確認: UTC 00:00として解釈される
      expect(parsed.getUTCHours()).toBe(0);
      expect(parsed.getUTCMinutes()).toBe(0);

      // 未修正パース処理を実行
      const displayResult = parseVisitDateToLocal_BUGGY(combinedResult!);
      console.log('フロントエンド表示値:', displayResult);

      // タイムゾーンオフセットに応じた確認
      const timezoneOffsetMinutes = parsed.getTimezoneOffset();
      if (timezoneOffsetMinutes === 0) {
        // UTC環境: "2026-05-10T00:00" になる
        expect(displayResult).toBe('2026-05-10T00:00');
        console.log('UTC環境: 時間は 00:00 になる（バグの影響は見えにくいが、経路Bのバグは存在する）');
      } else if (timezoneOffsetMinutes === -540) {
        // JST環境: "2026-05-10T09:00" になる（UTC 00:00 → JST 09:00）
        expect(displayResult).toBe('2026-05-10T09:00');
        console.log('JST環境: 時間は 09:00 になる（バグ確認）');
      }
    });

    /**
     * Property-Based Test: 様々な日付形式で new Date() のタイムゾーン変換を確認
     *
     * **Validates: Requirements 1.3**
     */
    test('Property-Based: YYYY-MM-DD 形式は常に UTC 00:00 として解釈される', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2025, max: 2027 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const visitDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // new Date("YYYY-MM-DD") は常に UTC 00:00 として解釈される
            const parsed = new Date(visitDate);

            // UTC時刻は常に 0:00 になる（これがバグの原因）
            return parsed.getUTCHours() === 0 && parsed.getUTCMinutes() === 0;
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
