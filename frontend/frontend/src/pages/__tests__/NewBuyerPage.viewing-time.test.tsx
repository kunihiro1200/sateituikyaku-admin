/**
 * NewBuyerPage 内覧時間フィールド バグ確認テスト（探索的バグ再現）
 *
 * このテストは「未修正コードでバグを再現する」ためのものです。
 * - テスト1: 「内覧時間」フィールドの input 要素の type 属性が "time" であることを確認
 *   （未修正コードでは type が指定されていないため "text" として動作 → 失敗する）
 * - テスト2: 「内覧時間」フィールドに InputLabelProps={{ shrink: true }} が適用されていることを確認
 *   （未修正コードでは未指定 → 失敗する）
 * - テスト3: 隣の「内覧日」フィールドが type="date" を持つことを確認（参照実装として）
 *   （未修正コードでも成功する）
 *
 * **重要**: テスト1・2は未修正コードで失敗することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(__dirname, '../NewBuyerPage.tsx');

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// 「内覧時間」フィールドのソースコードを抽出するヘルパー
// -----------------------------------------------------------------------
function extractViewingTimeTextField(source: string): string | null {
  // 「内覧時間」ラベルを持つ TextField ブロックを抽出する
  // label="内覧時間" を含む TextField の開始から /> までを取得
  const match = source.match(/<TextField[\s\S]*?label="内覧時間"[\s\S]*?\/>/);
  return match ? match[0] : null;
}

// 「内覧日」フィールドのソースコードを抽出するヘルパー
function extractViewingDateTextField(source: string): string | null {
  const match = source.match(/<TextField[\s\S]*?label="内覧日"[\s\S]*?\/>/);
  return match ? match[0] : null;
}

// -----------------------------------------------------------------------
// バグ確認テスト1: 「内覧時間」フィールドが type="time" を持つこと
// 未修正コードでは type が指定されていないため失敗する（バグの存在を証明）
// -----------------------------------------------------------------------
describe('バグ確認テスト1: 「内覧時間」フィールドが type="time" を持つこと（未修正コードで失敗する）', () => {
  test('「内覧時間」TextField が type="time" プロパティを持つこと', () => {
    const source = readTargetFile();
    const viewingTimeField = extractViewingTimeTextField(source);

    // 「内覧時間」フィールドが存在することを確認
    expect(viewingTimeField).not.toBeNull();

    // type="time" が指定されていることをアサート
    // 未修正コードでは type が指定されていないため、このアサートは失敗する
    // → 失敗がバグの存在を証明する
    expect(viewingTimeField).toContain('type="time"');
  });

  test('「内覧時間」TextField に InputLabelProps={{ shrink: true }} が適用されていること', () => {
    const source = readTargetFile();
    const viewingTimeField = extractViewingTimeTextField(source);

    expect(viewingTimeField).not.toBeNull();

    // InputLabelProps={{ shrink: true }} が指定されていることをアサート
    // 未修正コードでは未指定のため、このアサートは失敗する
    expect(viewingTimeField).toContain('InputLabelProps');
    expect(viewingTimeField).toContain('shrink: true');
  });
});

// -----------------------------------------------------------------------
// 参照実装テスト: 「内覧日」フィールドが type="date" を持つこと
// 未修正コードでも成功する（参照実装として確認）
// -----------------------------------------------------------------------
describe('参照実装テスト: 「内覧日」フィールドが type="date" を持つこと（未修正コードでも成功する）', () => {
  test('「内覧日」TextField が type="date" プロパティを持つこと', () => {
    const source = readTargetFile();
    const viewingDateField = extractViewingDateTextField(source);

    // 「内覧日」フィールドが存在することを確認
    expect(viewingDateField).not.toBeNull();

    // type="date" が指定されていることをアサート（参照実装として）
    expect(viewingDateField).toContain('type="date"');
  });

  test('「内覧日」TextField に InputLabelProps={{ shrink: true }} が適用されていること', () => {
    const source = readTargetFile();
    const viewingDateField = extractViewingDateTextField(source);

    expect(viewingDateField).not.toBeNull();

    // InputLabelProps={{ shrink: true }} が指定されていることをアサート
    expect(viewingDateField).toContain('InputLabelProps');
    expect(viewingDateField).toContain('shrink: true');
  });
});
