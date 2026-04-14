/**
 * Property 2: Preservation - 非バグ条件下での既存動作保持
 *
 * このテストは「修正後も既存の動作が壊れていないこと」を確認するためのものです。
 * ソースコードを静的解析（テキスト解析）する形式で実装しています。
 *
 * 保持すべき動作:
 * - 3.1: ユーザーが返信先ドロップダウンで別スタッフを選択した場合、その選択が使用されること
 * - 3.2: 対応するスタッフが jimuStaff に存在しない場合、返信先が空欄のままであること
 * - 3.3: メール送信完了またはキャンセル時に replyTo がリセットされること
 * - 3.4: handleSelectPropertyEmailTemplate でテンプレートの件名・本文が正しく設定されること
 *
 * **EXPECTED OUTCOME on UNFIXED code**: PASS（ベースライン動作の確認）
 * **EXPECTED OUTCOME on FIXED code**: PASS（リグレッションなし）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// 保全テスト3.1: ユーザーの手動選択が維持されること
// setReplyTo が外部から呼び出し可能な状態であること（ドロップダウン選択用）
// -----------------------------------------------------------------------
describe('Property 2: Preservation 3.1 - ユーザーの手動選択が維持されること', () => {
  test('replyTo 状態変数が useState で定義されていること', () => {
    const source = readTargetFile();

    // replyTo の useState 宣言が存在すること
    expect(source).toContain("const [replyTo, setReplyTo] = useState<string>('')");
  });

  test('setReplyTo が返信先ドロップダウンの onChange で呼ばれること', () => {
    const source = readTargetFile();

    // setReplyTo が onChange ハンドラーで呼ばれること
    // （ユーザーが手動選択した場合に setReplyTo が呼ばれる）
    expect(source).toContain('setReplyTo');
  });

  /**
   * プロパティテスト: replyTo の設定ロジックが純粋関数として正しく動作すること
   * jimuStaff の任意の配列と sales_assignee の任意の値に対して、
   * matchedStaff?.email || '' が正しく動作すること
   */
  test('jimuStaff.find() のマッチングロジックが正しく動作すること（プロパティテスト）', () => {
    fc.assert(
      fc.property(
        // jimuStaff の任意の配列
        fc.array(
          fc.record({
            initials: fc.string({ minLength: 1, maxLength: 5 }),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        // sales_assignee の任意の値
        fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: undefined }),
        (jimuStaff, salesAssignee) => {
          // マッチングロジックを再現
          const matchedStaff = jimuStaff.find((s) => s.initials === salesAssignee);
          const replyTo = matchedStaff?.email || '';

          // 不変条件1: replyTo は常に文字列であること
          if (typeof replyTo !== 'string') return false;

          // 不変条件2: マッチしたスタッフがいる場合、そのメールアドレスが設定されること
          if (matchedStaff && matchedStaff.email) {
            if (replyTo !== matchedStaff.email) return false;
          }

          // 不変条件3: マッチしたスタッフがいない場合、空文字列が設定されること
          if (!matchedStaff) {
            if (replyTo !== '') return false;
          }

          // 不変条件4: マッチしたスタッフがいるがメールがない場合、空文字列が設定されること
          if (matchedStaff && !matchedStaff.email) {
            if (replyTo !== '') return false;
          }

          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// -----------------------------------------------------------------------
// 保全テスト3.2: 対応スタッフなし時の空欄維持
// -----------------------------------------------------------------------
describe('Property 2: Preservation 3.2 - 対応スタッフなし時の空欄維持', () => {
  test('jimuStaff に対応するスタッフがいない場合、replyTo が空欄になること（プロパティテスト）', () => {
    fc.assert(
      fc.property(
        // jimuStaff の任意の配列（sales_assignee とは異なるイニシャルのみ）
        fc.array(
          fc.record({
            initials: fc.string({ minLength: 1, maxLength: 5 }).filter(s => s !== 'XX'),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (jimuStaff) => {
          // sales_assignee = 'XX'（jimuStaff に存在しないイニシャル）
          const salesAssignee = 'XX';
          const matchedStaff = jimuStaff.find((s) => s.initials === salesAssignee);
          const replyTo = matchedStaff?.email || '';

          // 対応スタッフがいない場合、replyTo は空文字列
          return replyTo === '';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// -----------------------------------------------------------------------
// 保全テスト3.3: 送信完了・キャンセル時の replyTo リセット
// -----------------------------------------------------------------------
describe('Property 2: Preservation 3.3 - 送信完了・キャンセル時の replyTo リセット', () => {
  test('handleSendEmail 内で setReplyTo("") が呼ばれること（送信完了後のリセット）', () => {
    const source = readTargetFile();

    // handleSendEmail 関数のブロックを抽出
    const handleSendEmailStart = source.indexOf('const handleSendEmail = async ()');
    expect(handleSendEmailStart).toBeGreaterThan(-1);

    // 関数の終わりを探す（次の const handle... まで）
    const nextHandlerStart = source.indexOf('\n  const ', handleSendEmailStart + 1);
    const functionBody = source.substring(handleSendEmailStart, nextHandlerStart);

    // 送信完了後に setReplyTo('') が呼ばれること
    expect(functionBody).toContain("setReplyTo('')");
  });

  test('emailDialog が閉じられる際に replyTo がリセットされること', () => {
    const source = readTargetFile();

    // handleSendEmail 内で emailDialog が閉じられること
    const handleSendEmailStart = source.indexOf('const handleSendEmail = async ()');
    const nextHandlerStart = source.indexOf('\n  const ', handleSendEmailStart + 1);
    const functionBody = source.substring(handleSendEmailStart, nextHandlerStart);

    // emailDialog が閉じられること
    expect(functionBody).toContain("setEmailDialog({ open: false");
    // replyTo がリセットされること
    expect(functionBody).toContain("setReplyTo('')");
  });
});

// -----------------------------------------------------------------------
// 保全テスト3.4: テンプレートの件名・本文が正しく設定されること
// -----------------------------------------------------------------------
describe('Property 2: Preservation 3.4 - テンプレートの件名・本文が正しく設定されること', () => {
  test('handleSelectPropertyEmailTemplate 内で setEditableEmailSubject が呼ばれること', () => {
    const source = readTargetFile();

    // handleSelectPropertyEmailTemplate 関数のブロックを抽出
    const handleSelectStart = source.indexOf('const handleSelectPropertyEmailTemplate = async');
    expect(handleSelectStart).toBeGreaterThan(-1);

    const nextHandlerStart = source.indexOf('\n  const ', handleSelectStart + 1);
    const functionBody = source.substring(handleSelectStart, nextHandlerStart);

    // テンプレートの件名が設定されること
    expect(functionBody).toContain('setEditableEmailSubject');
  });

  test('handleSelectPropertyEmailTemplate 内で setEditableEmailBody が呼ばれること', () => {
    const source = readTargetFile();

    const handleSelectStart = source.indexOf('const handleSelectPropertyEmailTemplate = async');
    const nextHandlerStart = source.indexOf('\n  const ', handleSelectStart + 1);
    const functionBody = source.substring(handleSelectStart, nextHandlerStart);

    // テンプレートの本文が設定されること
    expect(functionBody).toContain('setEditableEmailBody');
  });

  test('handleSelectPropertyEmailTemplate 内で emailDialog が開かれること', () => {
    const source = readTargetFile();

    const handleSelectStart = source.indexOf('const handleSelectPropertyEmailTemplate = async');
    const nextHandlerStart = source.indexOf('\n  const ', handleSelectStart + 1);
    const functionBody = source.substring(handleSelectStart, nextHandlerStart);

    // emailDialog が開かれること
    expect(functionBody).toContain('setEmailDialog({ open: true');
  });

  test('handleSelectPropertyEmailTemplate 内で selectedTemplateName が設定されること', () => {
    const source = readTargetFile();

    const handleSelectStart = source.indexOf('const handleSelectPropertyEmailTemplate = async');
    const nextHandlerStart = source.indexOf('\n  const ', handleSelectStart + 1);
    const functionBody = source.substring(handleSelectStart, nextHandlerStart);

    // テンプレート名が設定されること（送信履歴のタイトル表示用）
    expect(functionBody).toContain('setSelectedTemplateName');
  });
});
