#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage バグ確認テストファイルを作成するスクリプト
file-encoding-protection.md のルールに従い、UTF-8で書き込む
"""

content = '''/**
 * PropertyListingDetailPage バグ確認テスト（探索的バグ再現）
 *
 * このテストは「未修正コードでバグを再現する」ためのものです。
 * - テスト1.1: useEffectでAPIが逐次実行されていることを確認（並列化されていないことを確認）
 * - テスト1.2: 物件概要PaperにpositionがstickyでないことをAST解析で確認
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from \'@jest/globals\';
import * as fs from \'fs\';
import * as path from \'path\';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  \'../PropertyListingDetailPage.tsx\'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, \'utf-8\');
}

// -----------------------------------------------------------------------
// タスク1.1: useEffect の逐次API呼び出しを確認するテスト
// 未修正コードでは Promise.all / Promise.allSettled が使われていないことを確認
// -----------------------------------------------------------------------
describe(\'バグ確認テスト1.1: useEffect の逐次API呼び出し（未修正コードでバグを再現）\', () => {
  test(\'useEffect 内で Promise.allSettled が使われていないこと（逐次実行のバグ確認）\', () => {
    const source = readTargetFile();

    // useEffect ブロックを抽出する
    // "useEffect(() => {" から始まるブロックを探す
    const useEffectMatch = source.match(/useEffect\\(\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*\\[propertyNumber\\]\\)/);
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // 未修正コードでは Promise.allSettled が使われていないことを確認
    // （これが失敗すれば修正済みを意味する）
    expect(useEffectBody).not.toContain(\'Promise.allSettled\');
    expect(useEffectBody).not.toContain(\'Promise.all\');
  });

  test(\'useEffect 内で fetchPropertyData が個別に呼ばれていること（逐次実行の証拠）\', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(/useEffect\\(\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*\\[propertyNumber\\]\\)/);
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // 未修正コードでは各APIが個別に呼ばれている
    expect(useEffectBody).toContain(\'fetchPropertyData()\');
    expect(useEffectBody).toContain(\'fetchBuyers()\');
    expect(useEffectBody).toContain(\'fetchWorkTaskData()\');
  });

  test(\'useEffect 内で getActiveEmployees が .then() チェーンで呼ばれていること（逐次実行の証拠）\', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(/useEffect\\(\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*\\[propertyNumber\\]\\)/);
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // 未修正コードでは getActiveEmployees が .then() チェーンで呼ばれている
    expect(useEffectBody).toContain(\'getActiveEmployees().then(setActiveEmployees)\');
  });

  test(\'4つのAPI呼び出しが Promise.allSettled でまとめられていないこと（バグ条件C1の確認）\', () => {
    const source = readTargetFile();

    const useEffectMatch = source.match(/useEffect\\(\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*\\[propertyNumber\\]\\)/);
    expect(useEffectMatch).not.toBeNull();

    const useEffectBody = useEffectMatch![1];

    // バグ条件C1: 4つのAPIが並列化されていない
    // Promise.allSettled([...]) の形式で呼ばれていないことを確認
    const hasParallelExecution = /Promise\\.allSettled\\s*\\(\\s*\\[/.test(useEffectBody);
    expect(hasParallelExecution).toBe(false);
  });
});

// -----------------------------------------------------------------------
// タスク1.2: 物件概要 Paper に position: sticky がないことを確認するテスト
// 未修正コードでは position: sticky が設定されていないことを確認
// -----------------------------------------------------------------------
describe(\'バグ確認テスト1.2: 物件概要 Paper の position: sticky 未設定（未修正コードでバグを再現）\', () => {
  test(\'物件概要 Paper の sx に position: sticky が設定されていないこと（バグ条件C2の確認）\', () => {
    const source = readTargetFile();

    // 物件概要 Paper コンポーネントを探す
    // "Property Header - Key Information" コメントの直後にある Paper を探す
    const paperMatch = source.match(
      /\\/\\*\\s*Property Header - Key Information\\s*\\*\\/[\\s\\S]*?<Paper\\s+sx=\\{\\{([^}]*)\\}\\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // 未修正コードでは position: \'sticky\' が設定されていないことを確認
    // （これが失敗すれば修正済みを意味する）
    expect(sxContent).not.toContain(\'sticky\');
    expect(sxContent).not.toContain(\'position\');
  });

  test(\'物件概要 Paper の sx に top プロパティが設定されていないこと（バグ条件C2の確認）\', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\\/\\*\\s*Property Header - Key Information\\s*\\*\\/[\\s\\S]*?<Paper\\s+sx=\\{\\{([^}]*)\\}\\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // 未修正コードでは top プロパティが設定されていないことを確認
    expect(sxContent).not.toContain(\'top:\');
    expect(sxContent).not.toContain(\'top :\');
  });

  test(\'物件概要 Paper の sx に zIndex が設定されていないこと（バグ条件C2の確認）\', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\\/\\*\\s*Property Header - Key Information\\s*\\*\\/[\\s\\S]*?<Paper\\s+sx=\\{\\{([^}]*)\\}\\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // 未修正コードでは zIndex が設定されていないことを確認
    expect(sxContent).not.toContain(\'zIndex\');
  });

  test(\'物件概要 Paper の sx が基本スタイルのみであること（p, mb, bgcolor のみ）\', () => {
    const source = readTargetFile();

    const paperMatch = source.match(
      /\\/\\*\\s*Property Header - Key Information\\s*\\*\\/[\\s\\S]*?<Paper\\s+sx=\\{\\{([^}]*)\\}\\}/
    );
    expect(paperMatch).not.toBeNull();

    const sxContent = paperMatch![1];

    // 未修正コードでは p, mb, bgcolor のみが設定されている
    expect(sxContent).toContain(\'p:\');
    expect(sxContent).toContain(\'mb:\');
    expect(sxContent).toContain(\'bgcolor\');
  });
});
'''

output_path = 'frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.bug.test.tsx'

with open(output_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'テストファイルを作成しました: {output_path}')

# BOMチェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])}')
if first_bytes[:3] == b'\xef\xbb\xbf':
    print('警告: BOM付きUTF-8です')
else:
    print('OK: BOMなしUTF-8です')
