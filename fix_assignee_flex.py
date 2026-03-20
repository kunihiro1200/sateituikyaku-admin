#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AssigneeSection.tsx のボタンコンテナを grid から flex に変更"""

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# grid レイアウトを flex に変更
old = """              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                  gap: 0.5,
                }}
              >"""

new = """              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  width: '100%',
                }}
              >"""

if old in text:
    text = text.replace(old, new)
    print('✅ ボタンコンテナを flex に変更しました')
else:
    print('❌ 対象文字列が見つかりません')
    import sys
    sys.exit(1)

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 書き込み完了')
