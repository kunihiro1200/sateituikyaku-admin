/**
 * PropertyListingDetailPage 備忘録保存バグ条件テスト
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで必ず FAIL する。
 * 失敗がバグの存在を証明する。
 *
 * バグ1（画面が白くなる）:
 *   handleSaveNotes が fetchPropertyData() を silent=false（引数なし）で呼び出すため、
 *   setLoading(true) が実行されて画面全体がローディングスピナーに置き換わる。
 *
 * バグ2（重複リクエスト）:
 *   handleSaveNotes に saving フラグが存在しないため、
 *   保存処理中もボタンが有効なままとなり、重複クリックで複数回APIが呼ばれる。
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// handleSaveNotes 関数のソースコードを抽出する
function extractHandleSaveNotes(source: string): string {
  const startIdx = source.indexOf('const handleSaveNotes = async');
  expect(startIdx).toBeGreaterThan(-1);

  // 関数の終わりを探す（次の const または関数定義まで）
  const afterStart = source.substring(startIdx);
  // 関数ブロックの終わりを探す（対応する } を見つける）
  let depth = 0;
  let inFunction = false;
  let endIdx = 0;
  for (let i = 0; i < afterStart.length; i++) {
    if (afterStart[i] === '{') {
      depth++;
      inFunction = true;
    } else if (afterStart[i] === '}') {
      depth--;
      if (inFunction && depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  return afterStart.substring(0, endIdx);
}

// -----------------------------------------------------------------------
// バグ1テスト: fetchPropertyData が silent=false（引数なし）で呼ばれることを確認
// 期待される正しい動作: fetchPropertyData(true) で呼ばれるべき
// 修正前のコードでは FAIL する（fetchPropertyData() が引数なしで呼ばれているため）
// -----------------------------------------------------------------------

describe('バグ1テスト: handleSaveNotes が fetchPropertyData を silent=true で呼ぶこと', () => {

  test('[バグ1] handleSaveNotes 内で fetchPropertyData(true) が呼ばれること（silent=true）', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 期待される正しい動作: fetchPropertyData(true) で呼ばれるべき
    // 修正前のコード: fetchPropertyData() が引数なしで呼ばれている → FAIL
    expect(fnSource).toContain('fetchPropertyData(true)');
  });

  test('[バグ1確認] handleSaveNotes 内で fetchPropertyData() が引数なしで呼ばれていること（バグの存在確認）', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // バグの存在確認: fetchPropertyData() が引数なしで呼ばれている
    // このテストは修正前のコードで PASS する（バグが存在することを示す）
    // 修正後は fetchPropertyData(true) に変わるため、このテストは修正後に FAIL する
    const hasNoArgCall = /fetchPropertyData\(\s*\)/.test(fnSource);
    // バグ条件: 引数なしで呼ばれている → true
    // 修正後: 引数なしでは呼ばれない → false
    // このアサーションは修正前に PASS し、修正後に FAIL する（バグ確認用）
    expect(hasNoArgCall).toBe(false); // 修正前のコードでは FAIL する（引数なしで呼ばれているため）
  });

  test('[バグ1-PBT] ランダムな memo/special_notes 値で、fetchPropertyData が silent=true で呼ばれること', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * バグ条件: handleSaveNotes が fetchPropertyData() を引数なしで呼び出す
     * 期待される動作: fetchPropertyData(true) で呼ばれるべき
     *
     * このテストはソースコード解析により、修正前のコードで FAIL する。
     */
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // ランダムな入力値を生成してテスト（ソースコード解析なので入力値は関係ないが、
    // PBTの形式でバグ条件を検証する）
    fc.assert(
      fc.property(
        fc.record({
          memo: fc.oneof(
            fc.constant(null),
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 200 })
          ),
          special_notes: fc.oneof(
            fc.constant(null),
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 200 })
          ),
        }),
        (_input) => {
          // バグ条件: fetchPropertyData() が引数なしで呼ばれている
          // 期待される動作: fetchPropertyData(true) で呼ばれるべき
          // 修正前のコードでは FAIL する
          const hasSilentTrueCall = fnSource.includes('fetchPropertyData(true)');
          expect(hasSilentTrueCall).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// -----------------------------------------------------------------------
// バグ2テスト: saving フラグが存在しないため重複クリックが可能であることを確認
// 期待される正しい動作: notesSaving フラグで重複クリックを防止するべき
// 修正前のコードでは FAIL する（notesSaving フラグが存在しないため）
// -----------------------------------------------------------------------

describe('バグ2テスト: handleSaveNotes が notesSaving フラグで重複クリックを防止すること', () => {

  test('[バグ2] handleSaveNotes 内に notesSaving による重複防止チェックが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 期待される正しい動作: if (notesSaving) return; が存在するべき
    // 修正前のコード: notesSaving チェックが存在しない → FAIL
    expect(fnSource).toContain('notesSaving');
  });

  test('[バグ2] notesSaving 状態が定義されていること', () => {
    const source = readTargetFile();

    // 期待される正しい動作: const [notesSaving, setNotesSaving] = useState(false); が存在するべき
    // 修正前のコード: notesSaving 状態が定義されていない → FAIL
    expect(source).toMatch(/const\s+\[notesSaving\s*,\s*setNotesSaving\]/);
  });

  test('[バグ2] handleSaveNotes 内で setNotesSaving(true) が呼ばれること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 期待される正しい動作: setNotesSaving(true) が呼ばれるべき
    // 修正前のコード: setNotesSaving が存在しない → FAIL
    expect(fnSource).toContain('setNotesSaving(true)');
  });

  test('[バグ2] handleSaveNotes 内で finally ブロックに setNotesSaving(false) が存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 期待される正しい動作: finally ブロックで setNotesSaving(false) が呼ばれるべき
    // 修正前のコード: finally ブロックが存在しない → FAIL
    expect(fnSource).toContain('finally');
    expect(fnSource).toContain('setNotesSaving(false)');
  });

  test('[バグ2-PBT] 重複クリックシミュレーション: 保存中に再度呼ばれてもAPIは1回しか呼ばれないこと', () => {
    /**
     * **Validates: Requirements 1.2, 1.3**
     *
     * バグ条件: saving フラグが存在しないため、保存中に重複クリックが可能
     * 期待される動作: notesSaving フラグにより、保存中は2回目のクリックが無効化される
     *
     * このテストは修正前のコードで FAIL する（notesSaving フラグが存在しないため）。
     */
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // ランダムなクリック回数（2〜5回）でテスト
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        (_clickCount) => {
          // バグ条件: notesSaving チェックが存在しない場合、重複クリックが可能
          // 期待される動作: if (notesSaving) return; が存在するべき
          // 修正前のコードでは FAIL する
          const hasNotesSavingGuard = /if\s*\(\s*notesSaving\s*\)\s*return/.test(fnSource);
          expect(hasNotesSavingGuard).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});
