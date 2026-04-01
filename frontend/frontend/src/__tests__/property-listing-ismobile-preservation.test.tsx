/**
 * Preservation Property Test: PropertyListingDetailPage isMobile未定義エラー修正
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * このテストは未修正コードで実行し、パスすることを確認します。
 * パスは正しい動作です（既存機能が保持されていることを証明します）。
 * 
 * Property 2: Preservation - 既存機能の保持
 * 
 * 期待される動作:
 * - 未修正コード: テストがパスする（ベースライン動作を保持）
 * - 修正後コード: テストがパスする（既存機能が変更されていない）
 * 
 * **IMPORTANT**: observation-first methodologyに従う
 * 未修正コードで非バグ条件入力（他のインポート文、isMobile使用箇所、レイアウトロジック）の動作を観察
 * 
 * **注意**: このテストはファイルの静的解析を行い、既存のコード構造を確認します。
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 2: Preservation - 既存機能の保持', () => {
  const componentPath = path.join(__dirname, '../pages/PropertyListingDetailPage.tsx');
  let componentContent: string;
  let componentLines: string[];

  beforeAll(() => {
    // コンポーネントファイルの内容を読み込む
    componentContent = fs.readFileSync(componentPath, 'utf-8');
    componentLines = componentContent.split('\n');
  });

  /**
   * テスト: 既存のインポート文が保持されていることを確認
   * 
   * Preservation Requirement 3.3: 既存のインポート文（React, MUI, その他のライブラリ）は変更されない
   * 
   * このテストは、修正前後で既存のインポート文が変更されていないことを確認します。
   */
  test('既存のインポート文が保持されている', () => {
    // 主要なインポート文のパターンを確認
    const expectedImports = [
      /import\s+{[^}]*useState[^}]*}\s+from\s+['"]react['"]/,
      /import\s+.*PageNavigation.*from\s+['"]\.\.\/components\/PageNavigation['"]/,
      /import\s+{[^}]*useParams[^}]*}\s+from\s+['"]react-router-dom['"]/,
      /import\s+{[^}]*Box[^}]*}\s+from\s+['"]@mui\/material['"]/,
      /import\s+.*api.*from\s+['"]\.\.\/services\/api['"]/,
    ];

    expectedImports.forEach((pattern, index) => {
      expect(componentContent).toMatch(pattern);
    });

    // インポートセクションが先頭にあることを確認（最初の50行以内）
