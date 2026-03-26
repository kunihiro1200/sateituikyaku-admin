/**
 * PropertyListingDetailPage 保持確認テスト
 *
 * このテストは「修正後も既存の動作が壊れていないこと」を確認するためのものです。
 * ソースコードを静的解析（テキスト解析）する形式で実装しています。
 *
 * - テスト4.1: データ表示保持テスト（並列化後も各APIが正しく呼ばれること）
 * - テスト4.2: 編集機能保持テスト（物件概要バーの編集ボタンが機能すること）
 * - テスト4.3: エラーハンドリング保持テスト（一部APIが失敗しても他が表示されること）
 * - テスト4.4: ナビゲーションバー保持テスト（position: sticky が正常に機能すること）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
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
// タスク4.1: データ表示保持テスト
// 並列化後も物件情報・買主リスト・業務タスクデータが正しく表示されることを確認
// -----------------------------------------------------------------------
describe('保持確認テスト4.1: データ表示保持（並列化後も各APIが正しく呼ばれること）', () => {
  test('fetchPropertyData が useEffect 内に存在すること', () => {
    const source = readTargetFile();

    // useEffect ブロックを抽出する
    const useEffectMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[propertyNumber\]\)/
    );
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // fetchPropertyData が useEffect 内に存在すること
    expect(useEffectBody).toContain('fetchPropertyData()');
  });

  test('fetchBuyers が useEffect 内に存在すること', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[propertyNumber\]\)/
    );
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // fetchBuyers が useEffect 内に存在すること
    expect(useEffectBody).toContain('fetchBuyers()');
  });

  test('fetchWorkTaskData が useEffect 内に存在すること', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[propertyNumber\]\)/
    );
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // fetchWorkTaskData が useEffect 内に存在すること
    expect(useEffectBody).toContain('fetchWorkTaskData()');
  });

  test('Promise.allSettled で並列化されていること（修正後の正しい状態）', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[propertyNumber\]\)/
    );
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // 修正後は Promise.allSettled で並列化されていること
    expect(useEffectBody).toContain('Promise.allSettled');
  });

  test('Promise.allSettled に4つのAPI呼び出しが含まれていること', () => {
    const source = readTargetFile();

    // Promise.allSettled([...]) の形式で呼ばれていることを確認
    const parallelMatch = source.match(
      /Promise\.allSettled\(\s*\[([\s\S]*?)\]\s*\)/
    );
    expect(parallelMatch).not.toBeNull();

    const parallelBody = parallelMatch![1];

    // 4つのAPI呼び出しが含まれていること
    expect(parallelBody).toContain('fetchPropertyData()');
    expect(parallelBody).toContain('fetchBuyers()');
    expect(parallelBody).toContain('fetchWorkTaskData()');
    expect(parallelBody).toContain('getActiveEmployees()');
  });
});

// -----------------------------------------------------------------------
// タスク4.2: 編集機能保持テスト
// 「物件概要」バーの編集ボタンが引き続き機能することを確認
// -----------------------------------------------------------------------
describe('保持確認テスト4.2: 編集機能保持（物件概要バーの編集ボタンが機能すること）', () => {
  test('isHeaderEditMode 状態変数が存在すること', () => {
    const source = readTargetFile();

    // isHeaderEditMode の useState 宣言が存在すること
    expect(source).toContain('isHeaderEditMode');
    expect(source).toMatch(/useState\(false\)/);
  });

  test('handleSaveHeader 関数が存在すること', () => {
    const source = readTargetFile();

    // handleSaveHeader 関数の定義が存在すること
    expect(source).toContain('handleSaveHeader');
    expect(source).toMatch(/const handleSaveHeader\s*=/);
  });

  test('物件概要バーに編集ボタンが存在すること', () => {
    const source = readTargetFile();

    // 物件概要バーの編集ボタンが存在すること
    // isHeaderEditMode が false の場合に「編集」ボタンが表示される
    expect(source).toContain('setIsHeaderEditMode(true)');
  });

  test('物件概要バーに保存ボタンが存在すること', () => {
    const source = readTargetFile();

    // 編集モード時に handleSaveHeader が呼ばれる保存ボタンが存在すること
    expect(source).toContain('onClick={handleSaveHeader}');
  });

  test('isHeaderEditMode が true の場合に保存・キャンセルボタンが表示されること', () => {
    const source = readTargetFile();

    // isHeaderEditMode の条件分岐が存在すること
    expect(source).toMatch(/\{isHeaderEditMode\s*\?/);
  });
});

// -----------------------------------------------------------------------
// タスク4.3: エラーハンドリング保持テスト
// APIの一部が失敗した場合に他のデータが表示されることを確認
// -----------------------------------------------------------------------
describe('保持確認テスト4.3: エラーハンドリング保持（一部APIが失敗しても他が表示されること）', () => {
  test('Promise.allSettled を使用していること（一部失敗でも他は継続）', () => {
    const source = readTargetFile();

    // Promise.allSettled は一部が失敗しても他の結果を取得できる
    // Promise.all ではなく Promise.allSettled を使用していること
    expect(source).toContain('Promise.allSettled');
    expect(source).not.toMatch(/Promise\.all\s*\(/);
  });

  test('catch(() => {}) が存在すること（エラーを握りつぶして継続）', () => {
    const source = readTargetFile();

    // getActiveEmployees のエラーハンドリングが存在すること
    expect(source).toContain('.catch(() => {})');
  });

  test('fetchPropertyData にエラーハンドリングが存在すること', () => {
    const source = readTargetFile();

    // fetchPropertyData 関数内に catch ブロックが存在すること
    const fetchPropertyDataMatch = source.match(
      /const fetchPropertyData\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)^\s*\};/m
    );

    // 関数が存在すること
    expect(source).toContain('const fetchPropertyData = async ()');

    // catch ブロックが存在すること（関数全体で確認）
    const fetchSection = source.substring(
      source.indexOf('const fetchPropertyData = async ()'),
      source.indexOf('const fetchBuyers = async ()')
    );
    expect(fetchSection).toContain('catch');
  });

  test('fetchBuyers にエラーハンドリングが存在すること', () => {
    const source = readTargetFile();

    // fetchBuyers 関数が存在すること
    expect(source).toContain('const fetchBuyers = async ()');

    // fetchBuyers セクションに catch ブロックが存在すること
    const fetchBuyersStart = source.indexOf('const fetchBuyers = async ()');
    const fetchWorkTaskStart = source.indexOf('const fetchWorkTaskData = async ()');
    const fetchBuyersSection = source.substring(fetchBuyersStart, fetchWorkTaskStart);
    expect(fetchBuyersSection).toContain('catch');
  });

  test('fetchWorkTaskData にエラーハンドリングが存在すること', () => {
    const source = readTargetFile();

    // fetchWorkTaskData 関数が存在すること
    expect(source).toContain('const fetchWorkTaskData = async ()');

    // fetchWorkTaskData セクションに catch ブロックが存在すること
    const fetchWorkTaskStart = source.indexOf('const fetchWorkTaskData = async ()');
    const nextFunctionStart = source.indexOf('const handle', fetchWorkTaskStart);
    const fetchWorkTaskSection = source.substring(fetchWorkTaskStart, nextFunctionStart);
    expect(fetchWorkTaskSection).toContain('catch');
  });
});

// -----------------------------------------------------------------------
// タスク4.4: ナビゲーションバー保持テスト
// 既存の上部ナビゲーションバーの position: sticky が引き続き正常に機能することを確認
// -----------------------------------------------------------------------
describe('保持確認テスト4.4: ナビゲーションバー保持（position: sticky が正常に機能すること）', () => {
  test('上部ナビゲーションバーに position: sticky が設定されていること', () => {
    const source = readTargetFile();

    // ナビゲーションバーのコメントを探す
    const navBarMatch = source.match(
      /\/\*\s*ナビゲーションバー\s*\*\/[\s\S]*?<Box\s+sx=\{\{([^}]*)\}\}/
    );
    expect(navBarMatch).not.toBeNull();

    const sxContent = navBarMatch![1];

    // position: 'sticky' が設定されていること
    expect(sxContent).toContain("'sticky'");
    expect(sxContent).toContain('position');
  });

  test('上部ナビゲーションバーに zIndex: 200 が設定されていること', () => {
    const source = readTargetFile();

    const navBarMatch = source.match(
      /\/\*\s*ナビゲーションバー\s*\*\/[\s\S]*?<Box\s+sx=\{\{([^}]*)\}\}/
    );
    expect(navBarMatch).not.toBeNull();

    const sxContent = navBarMatch![1];

    // zIndex: 200 が設定されていること
    expect(sxContent).toContain('zIndex');
    expect(sxContent).toContain('200');
  });

  test('上部ナビゲーションバーに top: 0 が設定されていること', () => {
    const source = readTargetFile();

    const navBarMatch = source.match(
      /\/\*\s*ナビゲーションバー\s*\*\/[\s\S]*?<Box\s+sx=\{\{([^}]*)\}\}/
    );
    expect(navBarMatch).not.toBeNull();

    const sxContent = navBarMatch![1];

    // top: 0 が設定されていること
    expect(sxContent).toContain('top');
    expect(sxContent).toContain('0');
  });

  test('物件概要バーに position: sticky が設定されていること', () => {
    const source = readTargetFile();

    // 物件概要 Paper コンポーネントを探す
    const paperMatch = source.match(
      /\/\*\s*Property Header - Key Information\s*\*\/[\s\S]*?<Paper\s+sx=\{\{([^}]*)\}\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // position: 'sticky' が設定されていること（修正後の正しい状態）
    expect(sxContent).toContain("'sticky'");
    expect(sxContent).toContain('position');
  });

  test('物件概要バーに top プロパティが設定されていること', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\/\*\s*Property Header - Key Information\s*\*\/[\s\S]*?<Paper\s+sx=\{\{([^}]*)\}\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // top プロパティが設定されていること（ナビゲーションバーの高さ分）
    expect(sxContent).toContain('top');
  });

  test('物件概要バーに zIndex が設定されていること', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\/\*\s*Property Header - Key Information\s*\*\/[\s\S]*?<Paper\s+sx=\{\{([^}]*)\}\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // zIndex が設定されていること
    expect(sxContent).toContain('zIndex');
  });

  test('物件概要バーの zIndex がナビゲーションバーより低いこと（zIndex: 100 付近）', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\/\*\s*Property Header - Key Information\s*\*\/[\s\S]*?<Paper\s+sx=\{\{([^}]*)\}\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // zIndex が 200 未満であること（ナビゲーションバーの zIndex: 200 より低い）
    const zIndexMatch = sxContent.match(/zIndex\s*:\s*(\d+)/);
    expect(zIndexMatch).not.toBeNull();

    const zIndexValue = parseInt(zIndexMatch![1], 10);
    expect(zIndexValue).toBeLessThan(200);
  });
});
