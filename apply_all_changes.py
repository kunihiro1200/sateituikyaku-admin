# -*- coding: utf-8 -*-
"""
全ての変更を一括で適用するスクリプト
"""
import subprocess
import sys

scripts = [
    'add_pinrich_required_function.py',
    'add_pinrich_to_label_map.py',
    'add_pinrich_check_to_missing_fields.py',
    'add_pinrich_initial_check.py',
    'add_dynamic_validation_useeffect.py',
]

print('=== Pinrich条件付き必須バリデーション実装スクリプト実行 ===\n')

for script in scripts:
    print(f'実行中: {script}')
    result = subprocess.run([sys.executable, script], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f'エラー: {result.stderr}')
        sys.exit(1)
    print()

print('=== 全ての変更を適用しました ===')
print('\n次のステップ:')
print('1. getDiagnostics でエラーがないか確認')
print('2. ブラウザで動作確認')
