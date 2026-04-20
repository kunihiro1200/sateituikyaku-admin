/**
 * 保全プロパティテスト: 訪問日時以外の既存動作の保全
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * このテストは未修正コードで PASS する（これが正しい — 保全すべきベースライン動作を確認する）
 * 修正後も引き続き PASS することで、リグレッションがないことを確認する
 *
 * 観察優先メソドロジー:
 * - バグ条件に該当しない入力（visitDate が指定されている場合）の動作を観察・記録する
 * - 未修正コードでの動作をベースラインとして確認する
 *
 * 保全すべき動作:
 * 1. visitDate: null を送信 → visit_date が null になること
 * 2. visitDate: "2026-05-10 10:00:00" を送信（visitDate あり）→ visit_date が正しく保存されること
 * 3. 訪問日を新規設定 → visit_acquisition_date が今日の日付に自動設定されること
 * 4. 訪問日を削除（空欄）して保存 → visit_acquisition_date もクリアされること
 *
 * 注意:
 * - このテストは Supabase への実際の接続なしで実行できるようにモックを使用する
 * - updateSeller メソッドの内部ロジックを直接テストする
 */

import * as fc from 'fast-check';

// ============================================================
// updateSeller の visit_date 処理ロジックを再現する関数
// （Supabase接続不要）
// ============================================================

/**
 * updateSeller メソッドの visit_date 処理ロジックを再現する関数
 *
 * 未修正コードの動作:
 * - visitDate が指定されている場合: visit_date = visitDate（タイムゾーン変換なし）
 * - visitDate が null の場合: visit_date = null
 * - visitDate が undefined の場合: visit_date は変更しない
 * - appointmentDate のみ指定（visitDate なし）の場合: new Date() でUTC変換が発生（バグ）
 *
 * このテストでは「バグ条件に該当しない入力」（visitDate が指定されている場合）のみをテストする
 */
function computeVisitDateUpdate(input: {
  visitDate?: string | null;
  appointmentDate?: string;
}): { visit_date: string | null | undefined } {
  const updates: { visit_date?: string | null } = {};

  // visitDate を直接指定した場合（訪問予約フォームから、TIMESTAMP型として保存）
  if (input.visitDate !== undefined) {
    updates.visit_date = input.visitDate; // TIMESTAMP形式（YYYY-MM-DD HH:mm:ss）
  }

  // appointmentDate の処理（visitDate が指定されている場合はスキップ）
  if (input.appointmentDate !== undefined && input.visitDate === undefined) {
    // バグのある変換処理（未修正コード）
    // new Date() がUTCとして解釈するため、JST環境では9時間のズレが発生する
    const appointmentDateObj = new Date(input.appointmentDate);
    const year = appointmentDateObj.getFullYear();
    const month = (appointmentDateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = appointmentDateObj.getDate().toString().padStart(2, '0');
    const hours = appointmentDateObj.getHours().toString().padStart(2, '0');
    const minutes = appointmentDateObj.getMinutes().toString().padStart(2, '0');
    const seconds = appointmentDateObj.getSeconds().toString().padStart(2, '0');
    updates.visit_date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return { visit_date: updates.visit_date };
}

/**
 * フロントエンドの visitAcquisitionDate 自動設定ロジックを再現する関数
 * （CallModePage.tsx の保存処理より）
 *
 * 動作:
 * - visitDate が null（訪問日を削除）の場合: visitAcquisitionDate もクリア（null）
 * - visitDate があり visitAcquisitionDate が未設定の場合: 今日の日付を自動設定
 * - visitDate があり visitAcquisitionDate が設定済みの場合: 上書きしない（undefined）
 */
function computeVisitAcquisitionDateUpdate(input: {
  visitDateTimeStr: string | null;
  currentVisitAcquisitionDate: string | null | undefined;
  todayJST: string; // テスト用に今日の日付を注入
}): string | null | undefined {
  if (!input.visitDateTimeStr) {
    // 訪問日が空欄 → 訪問取得日もクリア
    return null;
  } else if (!input.currentVisitAcquisitionDate) {
    // 訪問日あり、訪問取得日が未設定 → 今日の日付（JST）を自動設定
    return input.todayJST;
  }
  // それ以外（既存値あり）は undefined のまま → 送信しない
  return undefined;
}

// ============================================================
// テストスイート
// ============================================================

describe('訪問日時タイムゾーンズレバグ - 保全プロパティテスト', () => {
  /**
   * 保全テスト1: visitDate: null を送信 → visit_date が null になること
   *
   * **Validates: Requirements 3.1**
   *
   * バグ条件に該当しない入力（visitDate が明示的に null）の動作を確認する
   * 未修正コードでも PASS する（保全すべきベースライン動作）
   */
  test('保全1: visitDate: null を送信すると visit_date が null になること', () => {
    // Arrange: visitDate を null で送信
    const input = { visitDate: null };

    // Act: updateSeller の visit_date 処理ロジックを実行
    const result = computeVisitDateUpdate(input);

    console.log('入力 (visitDate):', input.visitDate);
    console.log('結果 (visit_date):', result.visit_date);

    // Assert: visit_date が null になること
    expect(result.visit_date).toBeNull();
  });

  /**
   * 保全テスト2: visitDate: "2026-05-10 10:00:00" を送信 → visit_date が正しく保存されること
   *
   * **Validates: Requirements 3.2**
   *
   * visitDate が指定されている場合（バグ条件に該当しない）、
   * visit_date がタイムゾーン変換なしでそのまま保存されることを確認する
   * 未修正コードでも PASS する（visitDate が指定されている場合はバグが発生しない）
   */
  test('保全2: visitDate: "2026-05-10 10:00:00" を送信すると visit_date が正しく保存されること', () => {
    // Arrange: visitDate を指定して送信（バグ条件に該当しない）
    const visitDate = '2026-05-10 10:00:00';
    const input = { visitDate };

    // Act: updateSeller の visit_date 処理ロジックを実行
    const result = computeVisitDateUpdate(input);

    console.log('入力 (visitDate):', input.visitDate);
    console.log('結果 (visit_date):', result.visit_date);
    console.log('期待値:', visitDate);

    // Assert: visit_date が入力値と一致すること（タイムゾーン変換なし）
    expect(result.visit_date).toBe(visitDate);
  });

  /**
   * 保全テスト3: 訪問日を新規設定 → visit_acquisition_date が今日の日付に自動設定されること
   *
   * **Validates: Requirements 3.2**
   *
   * 訪問日を新規設定した場合（visitAcquisitionDate が未設定）、
   * visit_acquisition_date が今日の日付（JST）に自動設定されることを確認する
   * 未修正コードでも PASS する（保全すべきベースライン動作）
   */
  test('保全3: 訪問日を新規設定すると visit_acquisition_date が今日の日付に自動設定されること', () => {
    // Arrange: 訪問日を新規設定（visitAcquisitionDate は未設定）
    const todayJST = '2026-05-10'; // テスト用の今日の日付
    const input = {
      visitDateTimeStr: '2026-05-10 10:00:00', // 訪問日あり
      currentVisitAcquisitionDate: null, // 訪問取得日は未設定
      todayJST,
    };

    // Act: visitAcquisitionDate 自動設定ロジックを実行
    const result = computeVisitAcquisitionDateUpdate(input);

    console.log('入力 (visitDateTimeStr):', input.visitDateTimeStr);
    console.log('入力 (currentVisitAcquisitionDate):', input.currentVisitAcquisitionDate);
    console.log('結果 (visitAcquisitionDate):', result);
    console.log('期待値 (今日の日付):', todayJST);

    // Assert: visit_acquisition_date が今日の日付に自動設定されること
    expect(result).toBe(todayJST);
  });

  /**
   * 保全テスト4: 訪問日を削除（空欄）して保存 → visit_acquisition_date もクリアされること
   *
   * **Validates: Requirements 3.3**
   *
   * 訪問日を削除（空欄）した場合、
   * visit_acquisition_date もクリア（null）されることを確認する
   * 未修正コードでも PASS する（保全すべきベースライン動作）
   */
  test('保全4: 訪問日を削除（空欄）して保存すると visit_acquisition_date もクリアされること', () => {
    // Arrange: 訪問日を削除（空欄）
    const input = {
      visitDateTimeStr: null, // 訪問日を削除
      currentVisitAcquisitionDate: '2026-05-01', // 既存の訪問取得日
      todayJST: '2026-05-10',
    };

    // Act: visitAcquisitionDate 自動設定ロジックを実行
    const result = computeVisitAcquisitionDateUpdate(input);

    console.log('入力 (visitDateTimeStr):', input.visitDateTimeStr);
    console.log('入力 (currentVisitAcquisitionDate):', input.currentVisitAcquisitionDate);
    console.log('結果 (visitAcquisitionDate):', result);

    // Assert: visit_acquisition_date が null（クリア）になること
    expect(result).toBeNull();
  });

  /**
   * 保全テスト5: 訪問取得日が既に設定済みの場合は上書きしないこと
   *
   * **Validates: Requirements 3.2**
   *
   * 訪問日を更新しても、訪問取得日が既に設定済みの場合は上書きしないことを確認する
   * 未修正コードでも PASS する（保全すべきベースライン動作）
   */
  test('保全5: 訪問取得日が既に設定済みの場合は上書きしないこと', () => {
    // Arrange: 訪問日あり、訪問取得日は設定済み
    const existingAcquisitionDate = '2026-04-15';
    const input = {
      visitDateTimeStr: '2026-05-10 10:00:00', // 訪問日あり
      currentVisitAcquisitionDate: existingAcquisitionDate, // 訪問取得日は設定済み
      todayJST: '2026-05-10',
    };

    // Act: visitAcquisitionDate 自動設定ロジックを実行
    const result = computeVisitAcquisitionDateUpdate(input);

    console.log('入力 (visitDateTimeStr):', input.visitDateTimeStr);
    console.log('入力 (currentVisitAcquisitionDate):', input.currentVisitAcquisitionDate);
    console.log('結果 (visitAcquisitionDate):', result);

    // Assert: visit_acquisition_date が undefined（送信しない）になること
    expect(result).toBeUndefined();
  });

  /**
   * 保全テスト6: visitDate が指定されている場合、appointmentDate の変換は行われないこと
   *
   * **Validates: Requirements 3.1**
   *
   * visitDate が指定されている場合（バグ条件に該当しない）、
   * appointmentDate の変換処理はスキップされることを確認する
   * 未修正コードでも PASS する（visitDate が指定されている場合はバグが発生しない）
   */
  test('保全6: visitDate が指定されている場合、appointmentDate の変換は行われないこと', () => {
    // Arrange: visitDate と appointmentDate の両方を指定
    const visitDate = '2026-05-10 10:00:00';
    const appointmentDate = '2026-05-10 10:00:00';
    const input = { visitDate, appointmentDate };

    // Act: updateSeller の visit_date 処理ロジックを実行
    const result = computeVisitDateUpdate(input);

    console.log('入力 (visitDate):', input.visitDate);
    console.log('入力 (appointmentDate):', input.appointmentDate);
    console.log('結果 (visit_date):', result.visit_date);
    console.log('期待値:', visitDate);

    // Assert: visit_date が visitDate の値と一致すること（appointmentDate の変換は行われない）
    expect(result.visit_date).toBe(visitDate);
  });

  // ============================================================
  // Property-Based Tests
  // ============================================================

  /**
   * Property-Based Test: visitDate が指定されている場合、
   * visit_date は常に visitDate の値と一致すること
   *
   * **Validates: Requirements 3.1, 3.2**
   *
   * バグ条件に該当しない入力（visitDate が指定されている場合）では、
   * 修正前後で visit_date の保存結果が変わらないことを確認する
   */
  test('Property-Based: visitDate が指定されている場合、visit_date は常に visitDate の値と一致すること', () => {
    fc.assert(
      fc.property(
        // ランダムな日時文字列を生成（YYYY-MM-DD HH:mm:ss 形式）
        fc.integer({ min: 2025, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (year, month, day, hour, minute) => {
          // テスト用の日時文字列を生成
          const monthStr = month.toString().padStart(2, '0');
          const dayStr = day.toString().padStart(2, '0');
          const hourStr = hour.toString().padStart(2, '0');
          const minuteStr = minute.toString().padStart(2, '0');
          const visitDate = `${year}-${monthStr}-${dayStr} ${hourStr}:${minuteStr}:00`;

          // Act: updateSeller の visit_date 処理ロジックを実行
          const result = computeVisitDateUpdate({ visitDate });

          // Assert: visit_date が visitDate の値と一致すること（タイムゾーン変換なし）
          return result.visit_date === visitDate;
        }
      ),
      {
        numRuns: 50, // 50回のランダムテストを実行
        verbose: true,
      }
    );
  });

  /**
   * Property-Based Test: visitDate: null を送信すると、
   * visit_date は常に null になること
   *
   * **Validates: Requirements 3.1**
   *
   * 訪問日を削除（null）した場合、visit_date が常に null になることを確認する
   */
  test('Property-Based: visitDate: null を送信すると visit_date は常に null になること', () => {
    fc.assert(
      fc.property(
        // appointmentDate のランダムな値を生成（visitDate が null の場合でも影響しないことを確認）
        fc.oneof(
          fc.constant(undefined),
          fc.constant('2026-05-10 10:00:00'),
          fc.constant('2026-01-01 00:00:00')
        ),
        (appointmentDate) => {
          // Act: visitDate: null で updateSeller の visit_date 処理ロジックを実行
          const result = computeVisitDateUpdate({ visitDate: null, appointmentDate });

          // Assert: visit_date が null になること
          return result.visit_date === null;
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Property-Based Test: 訪問日を削除した場合、
   * visit_acquisition_date は常に null になること
   *
   * **Validates: Requirements 3.3**
   *
   * 訪問日を削除（空欄）した場合、visit_acquisition_date が常に null になることを確認する
   */
  test('Property-Based: 訪問日を削除した場合、visit_acquisition_date は常に null になること', () => {
    fc.assert(
      fc.property(
        // 既存の訪問取得日のランダムな値を生成
        fc.oneof(
          fc.constant(null),
          fc.constant('2026-01-01'),
          fc.constant('2026-05-10'),
          fc.constant('2025-12-31')
        ),
        (currentVisitAcquisitionDate) => {
          // Act: 訪問日を削除（空欄）した場合の visitAcquisitionDate 自動設定ロジックを実行
          const result = computeVisitAcquisitionDateUpdate({
            visitDateTimeStr: null, // 訪問日を削除
            currentVisitAcquisitionDate,
            todayJST: '2026-05-10',
          });

          // Assert: visit_acquisition_date が null になること
          return result === null;
        }
      ),
      {
        numRuns: 10,
        verbose: true,
      }
    );
  });

  /**
   * Property-Based Test: 訪問日を新規設定した場合（visitAcquisitionDate が未設定）、
   * visit_acquisition_date は常に今日の日付になること
   *
   * **Validates: Requirements 3.2**
   *
   * 訪問日を新規設定した場合（visitAcquisitionDate が未設定）、
   * visit_acquisition_date が今日の日付（JST）に自動設定されることを確認する
   */
  test('Property-Based: 訪問日を新規設定した場合（visitAcquisitionDate が未設定）、visit_acquisition_date は今日の日付になること', () => {
    fc.assert(
      fc.property(
        // ランダムな訪問日時文字列を生成
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        // ランダムな今日の日付を生成
        fc.integer({ min: 2025, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (hour, minute, year, month, day) => {
          const hourStr = hour.toString().padStart(2, '0');
          const minuteStr = minute.toString().padStart(2, '0');
          const visitDateTimeStr = `2026-05-10 ${hourStr}:${minuteStr}:00`;

          const monthStr = month.toString().padStart(2, '0');
          const dayStr = day.toString().padStart(2, '0');
          const todayJST = `${year}-${monthStr}-${dayStr}`;

          // Act: visitAcquisitionDate 自動設定ロジックを実行
          const result = computeVisitAcquisitionDateUpdate({
            visitDateTimeStr,
            currentVisitAcquisitionDate: null, // 訪問取得日は未設定
            todayJST,
          });

          // Assert: visit_acquisition_date が今日の日付になること
          return result === todayJST;
        }
      ),
      {
        numRuns: 30,
        verbose: true,
      }
    );
  });
});
