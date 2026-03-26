/**
 * PropertyListingDetailPage 特記・備忘録保存機能テスト
 *
 * このテストはソースコードを静的解析（テキスト解析）して、
 * 特記・備忘録保存機能が正しく実装されていることを確認します。
 *
 * - テスト3.1: handleSaveNotes 関数が存在すること
 * - テスト3.2: 特記・備忘録セクションに保存ボタンが存在すること（onClick={handleSaveNotes}）
 * - テスト3.3: 保存ボタンに disabled 条件が設定されていること
 * - テスト3.4: api.put('/api/property-listings/') の呼び出しが handleSaveNotes 内に存在すること
 * - テスト3.5: 他セクションの保存ハンドラー（handleSavePrice, handleSaveBasicInfo など）が引き続き存在すること
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// テスト3.1: handleSaveNotes 関数が存在すること
// -----------------------------------------------------------------------
describe('テスト3.1: handleSaveNotes 関数が存在すること', () => {
  test('handleSaveNotes 関数の定義が存在すること', () => {
    const source = readTargetFile();
    // const handleSaveNotes = async () => { ... } の形式で定義されていること
    expect(source).toMatch(/const handleSaveNotes\s*=\s*async/);
  });

  test('handleSaveNotes が async 関数であること', () => {
    const source = readTargetFile();
    // async キーワードが含まれていること
    const match = source.match(/const handleSaveNotes\s*=\s*async\s*\(\)/);
    expect(match).not.toBeNull();
  });

  test('handleSaveNotes 内で propertyNumber のガード処理が存在すること', () => {
    const source = readTargetFile();
    // handleSaveNotes 関数のセクションを抽出
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    // 次の const handle... まで抽出
    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(startIdx, nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 500);

    // propertyNumber のガード処理が存在すること
    expect(fnSection).toContain('propertyNumber');
    expect(fnSection).toContain('return');
  });
});

// -----------------------------------------------------------------------
// テスト3.2: 特記・備忘録セクションに保存ボタンが存在すること（onClick={handleSaveNotes}）
// -----------------------------------------------------------------------
describe('テスト3.2: 特記・備忘録セクションに保存ボタンが存在すること', () => {
  test('onClick={handleSaveNotes} が存在すること', () => {
    const source = readTargetFile();
    // 保存ボタンに onClick={handleSaveNotes} が設定されていること
    expect(source).toContain('onClick={handleSaveNotes}');
  });

  test('特記・備忘録セクション内に保存ボタンが存在すること', () => {
    const source = readTargetFile();
    // 特記・備忘録セクションのコメントを探す
    const sectionIdx = source.indexOf('特記・備忘録');
    expect(sectionIdx).toBeGreaterThan(-1);

    // セクション以降に onClick={handleSaveNotes} が存在すること
    const sectionOnward = source.substring(sectionIdx);
    expect(sectionOnward).toContain('onClick={handleSaveNotes}');
  });

  test('保存ボタンが Button コンポーネントであること', () => {
    const source = readTargetFile();
    // onClick={handleSaveNotes} の前後に Button タグが存在すること
    const buttonMatch = source.match(/<Button[^>]*onClick=\{handleSaveNotes\}/);
    expect(buttonMatch).not.toBeNull();
  });
});

// -----------------------------------------------------------------------
// テスト3.3: 保存ボタンに disabled 条件が設定されていること
// -----------------------------------------------------------------------
describe('テスト3.3: 保存ボタンに disabled 条件が設定されていること', () => {
  test('disabled 属性が存在すること', () => {
    const source = readTargetFile();
    // handleSaveNotes ボタンに disabled が設定されていること
    // onClick={handleSaveNotes} の近くに disabled が存在すること
    const saveNotesIdx = source.indexOf('onClick={handleSaveNotes}');
    expect(saveNotesIdx).toBeGreaterThan(-1);

    // 前後200文字以内に disabled が存在すること
    const context = source.substring(
      Math.max(0, saveNotesIdx - 200),
      saveNotesIdx + 200
    );
    expect(context).toContain('disabled');
  });

  test('disabled 条件が special_notes と memo の両方を参照していること', () => {
    const source = readTargetFile();
    // disabled={editedData.special_notes === undefined && editedData.memo === undefined}
    // の形式で設定されていること
    expect(source).toContain('editedData.special_notes === undefined');
    expect(source).toContain('editedData.memo === undefined');
  });

  test('disabled 条件が AND 条件であること（両方 undefined の場合のみ disabled）', () => {
    const source = readTargetFile();
    // special_notes と memo の両方が undefined の場合のみ disabled になること
    // && 演算子で結合されていること
    const disabledMatch = source.match(
      /disabled=\{editedData\.special_notes\s*===\s*undefined\s*&&\s*editedData\.memo\s*===\s*undefined\}/
    );
    expect(disabledMatch).not.toBeNull();
  });
});

// -----------------------------------------------------------------------
// テスト3.4: api.put('/api/property-listings/') の呼び出しが handleSaveNotes 内に存在すること
// -----------------------------------------------------------------------
describe('テスト3.4: api.put の呼び出しが handleSaveNotes 内に存在すること', () => {
  test('handleSaveNotes 内に api.put の呼び出しが存在すること', () => {
    const source = readTargetFile();
    // handleSaveNotes 関数のセクションを抽出
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    // 次の const handle... まで抽出
    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(
      startIdx,
      nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
    );

    // api.put の呼び出しが存在すること
    expect(fnSection).toContain('api.put');
  });

  test('api.put の URL に /api/property-listings/ が含まれること', () => {
    const source = readTargetFile();
    // handleSaveNotes 関数のセクションを抽出
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(
      startIdx,
      nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
    );

    // /api/property-listings/ が含まれること
    expect(fnSection).toContain('/api/property-listings/');
  });

  test('handleSaveNotes 内に成功時のスナックバーメッセージが存在すること', () => {
    const source = readTargetFile();
    // handleSaveNotes 関数のセクションを抽出
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(
      startIdx,
      nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
    );

    // 成功時のスナックバーメッセージが存在すること
    expect(fnSection).toContain('特記・備忘録を保存しました');
  });

  test('handleSaveNotes 内に fetchPropertyData の呼び出しが存在すること', () => {
    const source = readTargetFile();
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(
      startIdx,
      nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
    );

    // fetchPropertyData の呼び出しが存在すること
    expect(fnSection).toContain('fetchPropertyData()');
  });

  test('handleSaveNotes 内に setEditedData({}) の呼び出しが存在すること', () => {
    const source = readTargetFile();
    const startIdx = source.indexOf('const handleSaveNotes = async');
    expect(startIdx).toBeGreaterThan(-1);

    const nextHandlerIdx = source.indexOf('const handle', startIdx + 1);
    const fnSection = source.substring(
      startIdx,
      nextHandlerIdx > -1 ? nextHandlerIdx : startIdx + 1000
    );

    // setEditedData({}) の呼び出しが存在すること
    expect(fnSection).toContain('setEditedData({})');
  });
});

// -----------------------------------------------------------------------
// テスト3.5: 他セクションの保存ハンドラーが引き続き存在すること
// -----------------------------------------------------------------------
describe('テスト3.5: 他セクションの保存ハンドラーが引き続き存在すること', () => {
  test('handleSavePrice 関数が存在すること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleSavePrice\s*=\s*async/);
  });

  test('handleSaveBasicInfo 関数が存在すること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleSaveBasicInfo\s*=\s*async/);
  });

  test('handleSaveViewingInfo 関数が存在すること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleSaveViewingInfo\s*=\s*async/);
  });

  test('handleSaveSellerBuyer 関数が存在すること', () => {
    const source = readTargetFile();
    expect(source).toMatch(/const handleSaveSellerBuyer\s*=\s*async/);
  });

  test('handleSavePrice が onSave に設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onSave={handleSavePrice}');
  });

  test('handleSaveBasicInfo が onSave に設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onSave={handleSaveBasicInfo}');
  });

  test('handleSaveViewingInfo が onSave に設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onSave={handleSaveViewingInfo}');
  });

  test('handleSaveSellerBuyer が onSave に設定されていること', () => {
    const source = readTargetFile();
    expect(source).toContain('onSave={handleSaveSellerBuyer}');
  });
});
