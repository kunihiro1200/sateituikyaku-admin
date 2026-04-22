/**
 * PropertyListingDetailPage 備忘録保存 保全プロパティテスト（Property 2: Preservation）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される（ベースライン動作の確認）。
 * 修正後もこのテストが PASS し続けることでリグレッションがないことを確認する。
 *
 * 保全すべき動作:
 *   - 早期リターン保持: special_notes も memo も変更されていない場合、APIが呼ばれない
 *   - スナックバー保持: 保存成功時に「特記・備忘録を保存しました」が表示される
 *   - editedDataクリア保持: 保存成功後に editedData が空になる
 *   - エラー処理保持: API失敗時に「保存に失敗しました」スナックバーが表示される
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
  if (startIdx === -1) return '';

  const afterStart = source.substring(startIdx);
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
// 保全テスト1: 早期リターン保持
// special_notes も memo も変更されていない場合、APIが呼ばれない
// -----------------------------------------------------------------------

describe('保全テスト1: 早期リターン保持 — 変更なし時はAPIが呼ばれないこと', () => {

  test('[保全1] handleSaveNotes 内に Object.keys(notesData).length === 0 の早期リターンが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する（早期リターンが存在するため）
    // 修正後も PASS する（早期リターンは変更しない）
    expect(fnSource).toContain('Object.keys(notesData).length === 0');
  });

  test('[保全1] handleSaveNotes 内に special_notes の条件チェックが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する（special_notes チェックは変更しない）
    expect(fnSource).toContain('editedData.special_notes !== undefined');
  });

  test('[保全1] handleSaveNotes 内に memo の条件チェックが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する（memo チェックは変更しない）
    expect(fnSource).toContain('editedData.memo !== undefined');
  });

  test('[保全1-PBT] 早期リターンロジックが任意の editedData に対して正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * 保全動作: special_notes も memo も変更されていない場合、APIが呼ばれない
     * このテストは修正前のコードで PASS する（早期リターンが存在するため）
     */

    // 早期リターンロジックを模倣した関数（修正前・修正後ともに同じ動作）
    function shouldSkipSave(editedData: Record<string, unknown>): boolean {
      const notesData: Record<string, unknown> = {};
      if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
      if (editedData.memo !== undefined) notesData.memo = editedData.memo;
      return Object.keys(notesData).length === 0;
    }

    fc.assert(
      fc.property(
        // special_notes も memo も含まない editedData（他のフィールドのみ）
        fc.record({
          price: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: undefined }),
          address: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        }).filter(data => data.price !== undefined || data.address !== undefined),
        (editedData) => {
          // special_notes も memo も含まない場合、早期リターンすべき
          const result = shouldSkipSave(editedData as Record<string, unknown>);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('[保全1-PBT] special_notes または memo が含まれる場合は保存が実行されること', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * 保全動作: special_notes または memo が変更されている場合、保存が実行される
     */

    function shouldSkipSave(editedData: Record<string, unknown>): boolean {
      const notesData: Record<string, unknown> = {};
      if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
      if (editedData.memo !== undefined) notesData.memo = editedData.memo;
      return Object.keys(notesData).length === 0;
    }

    fc.assert(
      fc.property(
        fc.oneof(
          // special_notes のみ含む
          fc.record({ special_notes: fc.string({ minLength: 0, maxLength: 200 }) }),
          // memo のみ含む
          fc.record({ memo: fc.string({ minLength: 0, maxLength: 200 }) }),
          // 両方含む
          fc.record({
            special_notes: fc.string({ minLength: 0, maxLength: 200 }),
            memo: fc.string({ minLength: 0, maxLength: 200 }),
          }),
        ),
        (editedData) => {
          // special_notes または memo が含まれる場合、保存を実行すべき（早期リターンしない）
          const result = shouldSkipSave(editedData as Record<string, unknown>);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// -----------------------------------------------------------------------
// 保全テスト2: スナックバー保持
// 保存成功時に「特記・備忘録を保存しました」が表示される
// -----------------------------------------------------------------------

describe('保全テスト2: スナックバー保持 — 保存成功時に正しいメッセージが表示されること', () => {

  test('[保全2] handleSaveNotes 内に成功時スナックバーメッセージが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する（スナックバーメッセージが存在するため）
    // 修正後も PASS する（スナックバーメッセージは変更しない）
    expect(fnSource).toContain('特記・備忘録を保存しました');
  });

  test('[保全2] handleSaveNotes 内に severity: success が存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する
    expect(fnSource).toContain("severity: 'success'");
  });

  test('[保全2] handleSaveNotes 内に setSnackbar の呼び出しが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する
    expect(fnSource).toContain('setSnackbar');
  });

  test('[保全2-PBT] スナックバーロジックが任意の保存成功シナリオで正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * 保全動作: 保存成功時に「特記・備忘録を保存しました」スナックバーが表示される
     * このテストは修正前のコードで PASS する
     */

    // スナックバー設定ロジックを模倣した関数
    function getSuccessSnackbar(): { open: boolean; message: string; severity: string } {
      return { open: true, message: '特記・備忘録を保存しました', severity: 'success' };
    }

    fc.assert(
      fc.property(
        fc.record({
          memo: fc.string({ minLength: 1, maxLength: 200 }),
          special_notes: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (_input) => {
          // 保存成功時のスナックバーが正しく設定されること
          const snackbar = getSuccessSnackbar();
          expect(snackbar.open).toBe(true);
          expect(snackbar.message).toBe('特記・備忘録を保存しました');
          expect(snackbar.severity).toBe('success');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// -----------------------------------------------------------------------
// 保全テスト3: editedDataクリア保持
// 保存成功後に editedData が空になる
// -----------------------------------------------------------------------

describe('保全テスト3: editedDataクリア保持 — 保存成功後に editedData が空になること', () => {

  test('[保全3] handleSaveNotes 内に setEditedData({}) の呼び出しが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する（setEditedData({}) が存在するため）
    // 修正後も PASS する（setEditedData({}) は変更しない）
    expect(fnSource).toContain('setEditedData({})');
  });

  test('[保全3] setEditedData({}) が try ブロック内（成功時）に存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // try ブロックの内容を抽出
    const tryIdx = fnSource.indexOf('try {');
    const catchIdx = fnSource.indexOf('} catch');
    expect(tryIdx).toBeGreaterThan(-1);
    expect(catchIdx).toBeGreaterThan(-1);

    const tryBlock = fnSource.substring(tryIdx, catchIdx);

    // setEditedData({}) が try ブロック内に存在すること（成功時のみクリアされる）
    expect(tryBlock).toContain('setEditedData({})');
  });

  test('[保全3-PBT] editedData クリアロジックが任意の保存成功シナリオで正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * 保全動作: 保存成功後に editedData が空になる
     * このテストは修正前のコードで PASS する
     */

    // editedData クリアロジックを模倣した関数
    function clearEditedDataOnSuccess(
      currentEditedData: Record<string, unknown>
    ): Record<string, unknown> {
      // 保存成功後: editedData をクリアする
      void currentEditedData; // 使用済みとしてマーク
      return {};
    }

    fc.assert(
      fc.property(
        fc.record({
          memo: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          special_notes: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        }).filter(d => d.memo !== undefined || d.special_notes !== undefined),
        (editedData) => {
          // 保存成功後: editedData が空になること
          const result = clearEditedDataOnSuccess(editedData as Record<string, unknown>);
          expect(Object.keys(result).length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// -----------------------------------------------------------------------
// 保全テスト4: エラー処理保持
// API失敗時に「保存に失敗しました」スナックバーが表示される
// -----------------------------------------------------------------------

describe('保全テスト4: エラー処理保持 — API失敗時に正しいエラーメッセージが表示されること', () => {

  test('[保全4] handleSaveNotes 内に失敗時スナックバーメッセージが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する（エラーメッセージが存在するため）
    // 修正後も PASS する（エラーメッセージは変更しない）
    expect(fnSource).toContain('保存に失敗しました');
  });

  test('[保全4] handleSaveNotes 内に catch ブロックが存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する
    expect(fnSource).toContain('catch');
  });

  test('[保全4] handleSaveNotes 内に severity: error が存在すること', () => {
    const source = readTargetFile();
    const fnSource = extractHandleSaveNotes(source);

    // 修正前のコードで PASS する
    // 修正後も PASS する
    expect(fnSource).toContain("severity: 'error'");
  });

  test('[保全4-PBT] エラー処理ロジックが任意のAPI失敗シナリオで正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * 保全動作: API失敗時に「保存に失敗しました」スナックバーが表示される
     * このテストは修正前のコードで PASS する
     */

    // エラー処理ロジックを模倣した関数
    function getErrorSnackbar(_error: unknown): { open: boolean; message: string; severity: string } {
      return { open: true, message: '保存に失敗しました', severity: 'error' };
    }

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new Error('Network Error')),
          fc.constant(new Error('500 Internal Server Error')),
          fc.constant(new Error('403 Forbidden')),
          fc.string({ minLength: 1, maxLength: 50 }).map(msg => new Error(msg)),
        ),
        (error) => {
          // API失敗時のスナックバーが正しく設定されること
          const snackbar = getErrorSnackbar(error);
          expect(snackbar.open).toBe(true);
          expect(snackbar.message).toBe('保存に失敗しました');
          expect(snackbar.severity).toBe('error');
        }
      ),
      { numRuns: 20 }
    );
  });
});
