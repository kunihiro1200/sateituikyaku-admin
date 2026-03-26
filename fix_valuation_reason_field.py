#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
査定理由フィールドをコメントフィールドと保存ボタンの間に挿入するスクリプト
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入対象: コメントフィールドの </Box> と 保存ボタンの {(() => { の間
old_str = '''            </Box>

            {/* 保存ボタン（未変更時はグレー、変更あり時はオレンジで目立つ） */}
            {(() => {
              const isDirty = editableComments !== savedComments;'''

new_str = '''            </Box>

            {/* 査定理由フィールド（読み取り専用・常時表示） */}
            <TextField
              label="査定理由（査定サイトから転記）"
              value={seller.valuationReason || '未入力'}
              fullWidth
              multiline
              minRows={2}
              InputProps={{ readOnly: true }}
              sx={{ mb: 2 }}
            />

            {/* 保存ボタン（未変更時はグレー、変更あり時はオレンジで目立つ） */}
            {(() => {
              const isDirty = editableComments !== savedComments;'''

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    print('✅ 査定理由フィールドを挿入しました')
else:
    print('❌ 挿入対象が見つかりませんでした')
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
