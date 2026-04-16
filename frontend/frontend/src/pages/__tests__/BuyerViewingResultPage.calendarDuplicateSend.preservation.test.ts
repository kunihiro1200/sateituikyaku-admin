/**
 * BuyerViewingResultPage カレンダー重複送信バグ - 保持プロパティテスト（Property 2: Preservation）
 *
 * このテストは修正前のコードで PASS することで、保持すべきベースライン動作を確認する。
 * 修正後もこのテストが PASS することで、リグレッションがないことを確認する。
 *
 * **観察優先メソドロジー**: 修正前のコードで、バグ条件が成立しない入力の動作を観察し、
 * その動作をテストとして記録する。
 *
 * **観察結果**:
 * - 観察1: 有効なイニシャルで従業員が1件見つかる場合、src= パラメータにそのメールアドレスが使用される
 * - 観察2: 同じイニシャルを持つ従業員が複数いる場合、エラーメッセージが表示されてカレンダーが開かれない
 * - 観察3: 後続担当が従業員マスタに存在しない場合、エラーメッセージが表示されてカレンダーが開かれない
 * - 観察4: 正常にカレンダーが開かれた場合、calendarOpened が true になる
 * - 観察5: カレンダーボタンクリック時に /api/buyer-appointments へのメール通知送信が試みられる
 *
 * **EXPECTED OUTCOME**: テストが PASS する（これが保持すべきベースライン動作を確認する）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../BuyerViewingResultPage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// handleCalendarButtonClick 関数のロジックを純粋関数として抽出
// （修正前のコードをそのまま再現）
// -----------------------------------------------------------------------

/**
 * 従業員マスタ検索ロジック（修正前のコードを再現）
 * handleCalendarButtonClick 内の従業員検索部分を純粋関数として抽出
 */
interface Employee {
  name: string;
  initials: string;
  email: string;
}

interface CalendarEmailResult {
  /** 取得されたメールアドレス（エラー時は空文字） */
  assignedEmail: string;
  /** エラーが発生したか */
  hasError: boolean;
  /** エラーメッセージ（エラー時のみ） */
  errorMessage?: string;
  /** カレンダーが開かれるか（エラー時は false） */
  calendarWillOpen: boolean;
}

/**
 * 修正前のコードの従業員メールアドレス解決ロジック
 * handleCalendarButtonClick から抽出した純粋関数
 */
function resolveAssignedEmail_original(
  followUpAssignee: string | null | undefined,
  employees: Employee[]
): CalendarEmailResult {
  let assignedEmail = '';

  if (!followUpAssignee) {
    // 後続担当が未設定の場合はそのまま続行（エラーなし）
    return { assignedEmail: '', hasError: false, calendarWillOpen: true };
  }

  // 「業者」の場合は tenant@ifoo-oita.com をセット（修正前のバグ動作）
  if (followUpAssignee === '業者') {
    assignedEmail = 'tenant@ifoo-oita.com';
    return { assignedEmail, hasError: false, calendarWillOpen: true };
  }

  // イニシャルまたは名前で従業員マスタを検索
  const matchedEmployees = employees.filter(e => {
    const initialsMatch = e.initials === followUpAssignee;
    const nameMatch = e.name === followUpAssignee;
    return initialsMatch || nameMatch;
  });

  if (matchedEmployees.length > 1) {
    // 重複イニシャルの場合、エラーメッセージを表示してカレンダーを開かない
    const names = matchedEmployees.map(e => e.name).join(', ');
    return {
      assignedEmail: '',
      hasError: true,
      errorMessage: `後続担当（${followUpAssignee}）が複数の社員に一致します: ${names}`,
      calendarWillOpen: false,
    };
  }

  const assignedEmployee = matchedEmployees[0];

  if (!assignedEmployee) {
    // 従業員マスタに存在しない場合、エラーメッセージを表示してカレンダーを開かない
    return {
      assignedEmail: '',
      hasError: true,
      errorMessage: `後続担当（${followUpAssignee}）が従業員マスタに見つかりません`,
      calendarWillOpen: false,
    };
  }

  if (assignedEmployee.email) {
    assignedEmail = assignedEmployee.email;
    return { assignedEmail, hasError: false, calendarWillOpen: true };
  } else {
    // メールアドレスが未設定の場合、エラーメッセージを表示してカレンダーを開かない
    return {
      assignedEmail: '',
      hasError: true,
      errorMessage: `後続担当（${followUpAssignee}）が従業員マスタに見つかりません`,
      calendarWillOpen: false,
    };
  }
}

/**
 * Google カレンダー URL を生成する（修正前のコードを再現）
 * src= と add= の両方を付与するバグ動作を含む
 */
function buildCalendarUrl_original(assignedEmail: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'テスト内覧',
    details: 'テスト説明',
    location: 'テスト住所',
  });

  // 修正前のバグ: add= パラメータを付与
  if (assignedEmail) {
    params.append('add', assignedEmail);
  }

  // src= パラメータを付与
  const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';

  return `https://calendar.google.com/calendar/render?${params.toString()}${srcParam}`;
}

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードで PASS することで、保持すべきベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 既存の正常動作の保持', () => {

  // -----------------------------------------------------------------------
  // 観察1: 有効なイニシャルで従業員が1件見つかる場合、src= パラメータにそのメールアドレスが使用される
  // -----------------------------------------------------------------------

  describe('観察1: 有効なイニシャルで従業員が1件見つかる場合、src= パラメータにメールアドレスが使用される', () => {
    /**
     * 具体的なテストケース: 田中（TN）のイニシャルで検索
     *
     * **Validates: Requirements 3.1**
     */
    test('有効なイニシャル TN → tanaka@example.com が src= パラメータに使用されること', () => {
      const employees: Employee[] = [
        { name: '田中太郎', initials: 'TN', email: 'tanaka@example.com' },
        { name: '鈴木花子', initials: 'SK', email: 'suzuki@example.com' },
      ];

      const result = resolveAssignedEmail_original('TN', employees);

      // エラーなし
      expect(result.hasError).toBe(false);
      // メールアドレスが正しく取得される
      expect(result.assignedEmail).toBe('tanaka@example.com');
      // カレンダーが開かれる
      expect(result.calendarWillOpen).toBe(true);

      // src= パラメータにメールアドレスが使用されること
      const url = buildCalendarUrl_original(result.assignedEmail);
      expect(url).toContain(`src=${encodeURIComponent('tanaka@example.com')}`);
    });

    /**
     * プロパティベーステスト: ランダムな有効な従業員データに対して
     * src= パラメータにメールアドレスが使用されること
     *
     * **Validates: Requirements 3.1**
     */
    test('[PBT] 任意の有効なイニシャルで従業員が1件見つかる場合、src= パラメータにメールアドレスが使用されること', () => {
      fc.assert(
        fc.property(
          // ランダムな従業員データを生成
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
            initials: fc.stringMatching(/^[A-Z]{1,4}$/),
            email: fc.emailAddress(),
          }),
          (employee) => {
            const employees: Employee[] = [employee];

            const result = resolveAssignedEmail_original(employee.initials, employees);

            // エラーなし
            expect(result.hasError).toBe(false);
            // メールアドレスが正しく取得される
            expect(result.assignedEmail).toBe(employee.email);
            // カレンダーが開かれる
            expect(result.calendarWillOpen).toBe(true);

            // src= パラメータにメールアドレスが使用されること
            const url = buildCalendarUrl_original(result.assignedEmail);
            expect(url).toContain(`src=${encodeURIComponent(employee.email)}`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察2: 同じイニシャルを持つ従業員が複数いる場合、エラーメッセージが表示されてカレンダーが開かれない
  // -----------------------------------------------------------------------

  describe('観察2: 同じイニシャルを持つ従業員が複数いる場合、エラーメッセージが表示されてカレンダーが開かれない', () => {
    /**
     * 具体的なテストケース: TN イニシャルが2人に一致する場合
     *
     * **Validates: Requirements 3.3**
     */
    test('重複イニシャル TN（2人）→ エラーメッセージが表示されてカレンダーが開かれないこと', () => {
      const employees: Employee[] = [
        { name: '田中太郎', initials: 'TN', email: 'tanaka@example.com' },
        { name: '中野次郎', initials: 'TN', email: 'nakano@example.com' },
      ];

      const result = resolveAssignedEmail_original('TN', employees);

      // エラーが発生する
      expect(result.hasError).toBe(true);
      // エラーメッセージに「複数の社員に一致します」が含まれる
      expect(result.errorMessage).toContain('複数の社員に一致します');
      // カレンダーが開かれない
      expect(result.calendarWillOpen).toBe(false);
    });

    /**
     * プロパティベーステスト: 重複イニシャルに対して常にエラーが発生すること
     *
     * **Validates: Requirements 3.3**
     */
    test('[PBT] 同じイニシャルを持つ従業員が複数いる場合、常にエラーが発生してカレンダーが開かれないこと', () => {
      fc.assert(
        fc.property(
          // 重複イニシャルを持つ従業員データを生成
          fc.stringMatching(/^[A-Z]{1,4}$/).chain(initials =>
            fc.tuple(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
                initials: fc.constant(initials),
                email: fc.emailAddress(),
              }),
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
                initials: fc.constant(initials),
                email: fc.emailAddress(),
              })
            ).map(([emp1, emp2]) => ({ initials, employees: [emp1, emp2] }))
          ),
          ({ initials, employees }) => {
            const result = resolveAssignedEmail_original(initials, employees);

            // エラーが発生する
            expect(result.hasError).toBe(true);
            // エラーメッセージに「複数の社員に一致します」が含まれる
            expect(result.errorMessage).toContain('複数の社員に一致します');
            // カレンダーが開かれない
            expect(result.calendarWillOpen).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察3: 後続担当が従業員マスタに存在しない場合、エラーメッセージが表示されてカレンダーが開かれない
  // -----------------------------------------------------------------------

  describe('観察3: 後続担当が従業員マスタに存在しない場合、エラーメッセージが表示されてカレンダーが開かれない', () => {
    /**
     * 具体的なテストケース: 存在しないイニシャル XX
     *
     * **Validates: Requirements 3.2**
     */
    test('存在しないイニシャル XX → エラーメッセージが表示されてカレンダーが開かれないこと', () => {
      const employees: Employee[] = [
        { name: '田中太郎', initials: 'TN', email: 'tanaka@example.com' },
      ];

      const result = resolveAssignedEmail_original('XX', employees);

      // エラーが発生する
      expect(result.hasError).toBe(true);
      // エラーメッセージに「従業員マスタに見つかりません」が含まれる
      expect(result.errorMessage).toContain('従業員マスタに見つかりません');
      // カレンダーが開かれない
      expect(result.calendarWillOpen).toBe(false);
    });

    /**
     * プロパティベーステスト: 存在しないイニシャルに対して常にエラーが発生すること
     *
     * **Validates: Requirements 3.2**
     */
    test('[PBT] 後続担当が従業員マスタに存在しない場合、常にエラーが発生してカレンダーが開かれないこと', () => {
      fc.assert(
        fc.property(
          // 存在しないイニシャルを生成（従業員マスタには TN のみ）
          fc.stringMatching(/^[A-Z]{1,4}$/).filter(s => s !== 'TN'),
          (unknownInitials) => {
            const employees: Employee[] = [
              { name: '田中太郎', initials: 'TN', email: 'tanaka@example.com' },
            ];

            const result = resolveAssignedEmail_original(unknownInitials, employees);

            // エラーが発生する
            expect(result.hasError).toBe(true);
            // エラーメッセージに「従業員マスタに見つかりません」が含まれる
            expect(result.errorMessage).toContain('従業員マスタに見つかりません');
            // カレンダーが開かれない
            expect(result.calendarWillOpen).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察4: 正常にカレンダーが開かれた場合、calendarOpened が true になる
  // -----------------------------------------------------------------------

  describe('観察4: 正常にカレンダーが開かれた場合、calendarOpened が true になる', () => {
    /**
     * ソースコード静的解析: setCalendarOpened(true) が window.open の直後に呼ばれること
     *
     * **Validates: Requirements 3.5**
     */
    test('ソースコードに setCalendarOpened(true) が window.open の直後に存在すること', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?handleCalendarConfirm/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // window.open の後に setCalendarOpened(true) が呼ばれること
      const windowOpenIndex = funcBody.indexOf('window.open(');
      const calendarOpenedIndex = funcBody.indexOf('setCalendarOpened(true)');

      expect(windowOpenIndex).toBeGreaterThan(-1);
      expect(calendarOpenedIndex).toBeGreaterThan(-1);
      // setCalendarOpened(true) が window.open の後に呼ばれること
      expect(calendarOpenedIndex).toBeGreaterThan(windowOpenIndex);
    });

    /**
     * 純粋関数テスト: 有効なメールアドレスがある場合、calendarWillOpen が true になること
     *
     * **Validates: Requirements 3.5**
     */
    test('有効な従業員が見つかった場合、calendarWillOpen が true になること', () => {
      const employees: Employee[] = [
        { name: '田中太郎', initials: 'TN', email: 'tanaka@example.com' },
      ];

      const result = resolveAssignedEmail_original('TN', employees);

      expect(result.calendarWillOpen).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 観察5: カレンダーボタンクリック時に /api/buyer-appointments へのメール通知送信が試みられる
  // -----------------------------------------------------------------------

  describe('観察5: カレンダーボタンクリック時に /api/buyer-appointments へのメール通知送信が試みられる', () => {
    /**
     * ソースコード静的解析: /api/buyer-appointments への POST が存在すること
     *
     * **Validates: Requirements 3.6**
     */
    test('ソースコードに /api/buyer-appointments への POST が存在すること', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?handleCalendarConfirm/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // /api/buyer-appointments への POST が存在すること
      expect(funcBody).toContain('/api/buyer-appointments');
    });

    /**
     * ソースコード静的解析: メール通知送信が try-catch で囲まれていること（失敗しても無視）
     *
     * **Validates: Requirements 3.6**
     */
    test('メール通知送信が try-catch で囲まれていること（失敗しても無視）', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?handleCalendarConfirm/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // /api/buyer-appointments の前後に try-catch が存在すること
      const apiCallIndex = funcBody.indexOf('/api/buyer-appointments');
      const tryBeforeApi = funcBody.lastIndexOf('try {', apiCallIndex);
      const catchAfterApi = funcBody.indexOf('} catch', apiCallIndex);

      expect(tryBeforeApi).toBeGreaterThan(-1);
      expect(catchAfterApi).toBeGreaterThan(-1);
      // try が api 呼び出しより前にあること
      expect(tryBeforeApi).toBeLessThan(apiCallIndex);
      // catch が api 呼び出しより後にあること
      expect(catchAfterApi).toBeGreaterThan(apiCallIndex);
    });
  });

  // -----------------------------------------------------------------------
  // 追加: ソースコード静的解析による保持動作の確認
  // -----------------------------------------------------------------------

  describe('ソースコード静的解析: 保持すべき動作がコードに存在すること', () => {
    /**
     * src= パラメータが使用されていること（修正前後で保持される動作）
     *
     * **Validates: Requirements 3.1, 3.4**
     */
    test('ソースコードに src= パラメータの生成コードが存在すること', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // src= パラメータが使用されていること
      expect(funcBody).toContain('src=');
      expect(funcBody).toContain('encodeURIComponent(assignedEmail)');
    });

    /**
     * window.open が使用されていること（新しいタブでカレンダーを開く）
     *
     * **Validates: Requirements 3.4**
     */
    test('ソースコードに window.open が存在すること（新しいタブでカレンダーを開く）', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出（_blank まで含める）
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?window\.open\([\s\S]*?'_blank'\)/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // window.open が使用されていること
      expect(funcBody).toContain('window.open(');
      // _blank で新しいタブで開くこと
      expect(funcBody).toContain("'_blank'");
    });

    /**
     * 従業員マスタ検索ロジックが存在すること
     *
     * **Validates: Requirements 3.1**
     */
    test('ソースコードに従業員マスタ検索ロジックが存在すること', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // 従業員マスタ検索ロジックが存在すること
      expect(funcBody).toContain('employees.filter');
      expect(funcBody).toContain('initialsMatch');
    });

    /**
     * 複数マッチエラーハンドリングが存在すること
     *
     * **Validates: Requirements 3.3**
     */
    test('ソースコードに複数マッチエラーハンドリングが存在すること', () => {
      const source = readTargetFile();

      // handleCalendarButtonClick 関数のブロックを抽出
      const funcMatch = source.match(
        /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
      );
      expect(funcMatch).not.toBeNull();

      const funcBody = funcMatch![0];

      // 複数マッチエラーハンドリングが存在すること
      expect(funcBody).toContain('matchedEmployees.length > 1');
      expect(funcBody).toContain('複数の社員に一致します');
    });
  });
});
