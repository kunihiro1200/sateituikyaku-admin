#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.bug.test.tsx の @jest/globals インポートを vitest 用に修正する
"""

file_path = 'frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.bug.test.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# @jest/globals を vitest に変更
old_import = "import { describe, test, expect } from '@jest/globals';"
new_import = "import { describe, test, expect } from 'vitest';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ @jest/globals を vitest に変更しました')
else:
    print('❌ 対象のインポートが見つかりませんでした')
    print('現在のインポート行:')
    for line in text.split('\n')[:10]:
        print(repr(line))
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました:', file_path)
