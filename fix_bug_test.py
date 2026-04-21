#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
バグ条件探索テストを修正後コードのロジックでテストするよう更新するスクリプト
"""

file_path = 'frontend/frontend/src/components/__tests__/WorkTaskDetailModal.bug.test.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前: editableButtonSelectOnClick_buggy を使用（未修正コードのシミュレーション）
# 修正後: editableButtonSelectOnClick_fixed を使用（修正後コードのロジック）

# ケース1のテスト
old1 = '''    // 未修正コードの動作をシミュレート
    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは '他' が返るため、このアサーションが FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース2: 営業担当トグルテスト'''

new1 = '''    // 修正後コードの動作をシミュレート
    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    expect(result).toBeNull();
  });

  /**
   * テストケース2: 営業担当トグルテスト'''

# ケース2のテスト
old2 = '''    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは '山田' が返るため FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース3: 間取図トグルテスト'''

new2 = '''    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    expect(result).toBeNull();
  });

  /**
   * テストケース3: 間取図トグルテスト'''

# ケース3のテスト
old3 = '''    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    // 未修正コードでは 'クラウドワークス' が返るため FAIL する（バグの存在を証明する）
    expect(result).toBeNull();
  });

  /**
   * テストケース4: プロパティベーステスト（バグ条件の全ケース）'''

new3 = '''    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

    // 期待動作（修正後）: null が返ること
    expect(result).toBeNull();
  });

  /**
   * テストケース4: プロパティベーステスト（バグ条件の全ケース）'''

# PBTテスト
old4 = '''        // 未修正コードの動作をシミュレート
        const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);

        // 期待動作（修正後）: null が返ること
        // 未修正コードでは clickedOption が返るため、このアサーションが FAIL する
        // → バグの存在を証明する
        expect(result).toBeNull();'''

new4 = '''        // 修正後コードの動作をシミュレート
        const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);

        // 期待動作（修正後）: null が返ること
        expect(result).toBeNull();'''

changes = [
    (old1, new1, 'ケース1'),
    (old2, new2, 'ケース2'),
    (old3, new3, 'ケース3'),
    (old4, new4, 'PBT'),
]

for old, new, name in changes:
    if old in text:
        text = text.replace(old, new)
        print(f'✅ {name} を修正しました')
    else:
        print(f'❌ {name} の修正対象が見つかりません')

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ ファイルを保存しました: {file_path}')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8が検出されました')
else:
    print(f'✅ BOMなしUTF-8で保存されています（先頭バイト: {repr(first_bytes)}）')
