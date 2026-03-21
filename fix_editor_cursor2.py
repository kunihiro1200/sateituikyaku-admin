#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RichTextCommentEditor.tsx の insertAtCursor をさらに修正するスクリプト
- editor.focus() を呼ぶ前に savedRangeRef の値を一時変数に退避する
  （focus() 後に selectionchange が発火して savedRangeRef が上書きされるのを防ぐ）
"""

file_path = 'frontend/frontend/src/components/RichTextCommentEditor.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_block = '''          if (savedRangeRef.current) {
            // エディタにフォーカスを戻す（ボタンクリックでフォーカスが外れているため）
            editor.focus();

            // savedRangeRef.current を cloneRange() してから操作する
            // （直接操作すると savedRangeRef 自体が変更されてしまうため）
            const range = savedRangeRef.current.cloneRange();'''

new_block = '''          if (savedRangeRef.current) {
            // focus() 前に savedRangeRef を退避する
            // （focus() 後に selectionchange が発火して savedRangeRef が上書きされるのを防ぐ）
            const savedRange = savedRangeRef.current.cloneRange();

            // エディタにフォーカスを戻す（ボタンクリックでフォーカスが外れているため）
            editor.focus();

            // 退避した Range を使って操作する
            const range = savedRange;'''

if old_block in text:
    text = text.replace(old_block, new_block)
    print('✅ focus() 前の退避処理を追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find('if (savedRangeRef.current)')
    if idx >= 0:
        print(repr(text[idx:idx+300]))

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
