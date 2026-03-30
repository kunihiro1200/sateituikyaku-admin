/**
 * Bug Condition Exploration Test: PropertyListingDetailPage isMobile未定義エラー
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * このテストは未修正コードで実行し、失敗することを確認します。
 * 失敗は正しい動作です（バグが存在することを証明します）。
 * 
 * Property 1: Bug Condition - isMobile未定義エラーの確認
 * 
 * 期待される動作:
 * - 未修正コード: テストが失敗する（isMobileのインポートが存在しない）
 * - 修正後コード: テストがパスする（isMobileが正しくインポートされている）
 * 
 * **注意**: このテストはファイルの静的解析を行い、インポート文の存在を確認します。
 * PropertyListingDetailPageコンポーネントは`import.meta.env`を使用しているため、
 * Jestでの直接的なレンダリングテストは困難です。
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 1: Bug Condition - isMobile未定義エラーの確認', () => {
  const componentPath = path.join(__dirname, '../pages/PropertyListingDetailPage.tsx');
  let componentContent: string;

  beforeAll(() => {
    // コンポーネントファイルの内容を読み込む
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  /**
   * テスト: PropertyListingDetailPage.tsxにisMobileのインポート文が存在することを確認
   * 
   * 未修正コードでの期待される動作:
   * - `import { isMobile } from 'react-device-detect';` が存在しない
   * - このテストは失敗する（これが正しい動作）
   * 
   * 修正後コードでの期待される動作:
   * - `import { isMobile } from 'react-device-detect';` が存在する
   * - このテストはパスする
   * 
   * **CRITICAL**: このテストは未修正コードで実行し、失敗することを確認する
   * **DO NOT attempt to fix the test or the code when it fails**
   * 
   * カウンターサンプル（未修正コードで発生）:
   * - インポート文が存在しない
   * - 行921, 935, 936, 937, 945, 949などでisMobileが使用されているが、インポートされていない
   */
  test('PropertyListingDetailPage.tsxにisMobileのインポート文が存在する', () => {
    // react-device-detectからisMobileをインポートしているか確認
    const importPattern = /import\s+{[^}]*isMobile[^}]*}\s+from\s+['"]react-device-detect['"]/;
    
    // 未修正コードでは、このアサーションは失敗する
    // 修正後コードでは、このアサーションはパスする
    expect(componentContent).toMatch(importPattern);
  });

  /**
   * テスト: PropertyListingDetailPage.tsxでisMobileが使用されていることを確認
   * 
   * このテストは、isMobileが実際にコンポーネント内で使用されていることを確認します。
   * これにより、インポートが必要であることを証明します。
   */
  test('PropertyListingDetailPage.tsxでisMobileが使用されている', () => {
    // isMobileが使用されている箇所を確認
    const usagePattern = /isMobile/g;
    const matches = componentContent.match(usagePattern);
    
    // isMobileが複数箇所で使用されていることを確認
    // （行921, 935, 936, 937, 945, 949など）
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(5);
  });

  /**
   * テスト: isMobileが使用されているが、インポートされていないことを確認（未修正コードのみ）
   * 
   * 未修正コードでの期待される動作:
   * - isMobileが使用されている
   * - しかし、インポート文が存在しない
   * - このテストはパスする（バグが存在することを証明）
   * 
   * 修正後コードでの期待される動作:
   * - isMobileが使用されている
   * - インポート文も存在する
   * - このテストは失敗する（バグが修正されたことを証明）
   */
  test('isMobileが使用されているが、インポートされていない（バグ条件）', () => {
    // isMobileが使用されているか確認
    const usagePattern = /isMobile/g;
    const hasUsage = usagePattern.test(componentContent);
    
    // インポート文が存在するか確認
    const importPattern = /import\s+{[^}]*isMobile[^}]*}\s+from\s+['"]react-device-detect['"]/;
    const hasImport = importPattern.test(componentContent);
    
    // 未修正コードでは: hasUsage = true, hasImport = false
    // 修正後コードでは: hasUsage = true, hasImport = true
    
    // このテストは未修正コードでパスし、修正後コードで失敗する
    // （バグの存在を証明するため）
    if (hasUsage && !hasImport) {
      // バグが存在する（未修正コード）
      expect(true).toBe(true);
    } else if (hasUsage && hasImport) {
      // バグが修正された（修正後コード）
      // このテストは失敗するが、それは正しい動作
      expect(false).toBe(true); // 意図的に失敗させる
    } else {
      // 予期しない状態
      fail('Unexpected state: isMobile usage or import pattern not found');
    }
  });

  /**
   * テスト: isMobileが使用されている具体的な行を確認
   * 
   * このテストは、isMobileが使用されている具体的な箇所を文書化します。
   */
  test('isMobileが使用されている具体的な箇所を確認', () => {
    const lines = componentContent.split('\n');
    const usageLines: number[] = [];
    
    lines.forEach((line, index) => {
      if (line.includes('isMobile')) {
        usageLines.push(index + 1); // 1-indexed
      }
    });
    
    // isMobileが使用されている行番号を確認
    expect(usageLines.length).toBeGreaterThan(0);
    
    // カウンターサンプルとして、使用箇所を文書化
    console.log('isMobileが使用されている行:', usageLines);
    
    // 期待される使用箇所（デザインドキュメントより）:
    // 行921, 935, 936, 937, 945, 949など
    expect(usageLines.length).toBeGreaterThanOrEqual(6);
  });
});
