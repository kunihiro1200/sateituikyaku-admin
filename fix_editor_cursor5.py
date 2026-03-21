#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
問題の根本原因:
- editor.focus() を呼ぶと selectionchange が発火する
- その時点でブラウザはエディタ先頭にカーソルを置く
- selectionchange ハンドラが先頭の Range で savedRangeRef を上書きする
- その後 savedRange（退避済み）を使って復元しようとするが、
  selection.addRange(range) の後に insertNode を呼ぶと
  DOM変更で range が無効になる場合がある

解決策:
1. isInsertingRef フラグで selectionchange 中の上書きを防ぐ
2. editor.focus() の後に setTimeout(0) で非同期に処理する
   （focus による selectionchange が完了してから Range を復元する）
"""

file_path = 'frontend/frontend/src/components/RichTextCommentEditor.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. savedRangeRef の後に isInsertingRef を追加
old_ref = '    const savedRangeRef = useRef<Range | null>(null);'
new_ref = '''    const savedRangeRef = useRef<Range | null>(null);
    // insertAtCursor 実行中は selectionchange による savedRangeRef の上書きを防ぐ
    const isInsertingRef = useRef<boolean>(false);'''

if old_ref in text:
    text = text.replace(old_ref, new_ref)
    print('✅ isInsertingRef を追加')
else:
    print('❌ savedRangeRef が見つからない')

# 2. selectionchange ハンドラに isInsertingRef チェックを追加
old_handler = '''      const handleSelectionChange = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
          }
        }
      };'''

new_handler = '''      const handleSelectionChange = () => {
        // insertAtCursor 実行中は上書きしない
        if (isInsertingRef.current) return;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
          }
        }
      };'''

if old_handler in text:
    text = text.replace(old_handler, new_handler)
    print('✅ selectionchange ハンドラに isInsertingRef チェックを追加')
else:
    print('❌ selectionchange ハンドラが見つからない')

# 3. insertAtCursor 全体を書き直す
# 現在の insertAtCursor を新しい実装に置き換える
old_insert = '''      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        try {
          if (savedRangeRef.current) {
            // focus() 前に savedRangeRef を退避する
            // （focus() 後に selectionchange が発火して savedRangeRef が上書きされるのを防ぐ）
            const savedRange = savedRangeRef.current.cloneRange();

            // エディタにフォーカスを戻す（ボタンクリックでフォーカスが外れているため）
            editor.focus();

            // 退避した Range を使って操作する
            const range = savedRange;

            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            range.deleteContents();

            // HTML 文字列を DocumentFragment に変換して挿入
            const fragment = range.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            range.insertNode(fragment);

            // カーソルを挿入テキストの直後に移動
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              savedRangeRef.current = range.cloneRange();
            }
          } else {
            // フォールバック: カーソル位置が未設定の場合は末尾に追加
            editor.focus();
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              range.deleteContents();
              const fragment = range.createContextualFragment(html);
              const lastNode = fragment.lastChild;
              range.insertNode(fragment);
              if (lastNode) {
                range.setStartAfter(lastNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                savedRangeRef.current = range.cloneRange();
              }
            } else {
              editor.innerHTML = editor.innerHTML + html;
            }
          }
        } catch (e) {
          // エラー時は末尾に追加
          editor.innerHTML = editor.innerHTML + html;
        }

        handleInput();
      },'''

new_insert = '''      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        // selectionchange による savedRangeRef の上書きを防ぐ
        isInsertingRef.current = true;

        try {
          // カーソル位置を退避（focus() 前に必ず退避する）
          const savedRange = savedRangeRef.current ? savedRangeRef.current.cloneRange() : null;

          // エディタにフォーカスを戻す
          editor.focus();

          if (savedRange) {
            // 退避した Range を Selection に復元
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }

            // HTML を DocumentFragment に変換して挿入
            const fragment = savedRange.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            savedRange.insertNode(fragment);

            // カーソルを挿入テキストの直後に移動
            if (lastNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(lastNode);
              newRange.collapse(true);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
              savedRangeRef.current = newRange.cloneRange();
            }
          } else {
            // フォールバック: カーソル位置が未設定の場合は末尾に追加
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              const fragment = range.createContextualFragment(html);
              const lastNode = fragment.lastChild;
              range.insertNode(fragment);
              if (lastNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(lastNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                savedRangeRef.current = newRange.cloneRange();
              }
            } else {
              editor.innerHTML = editor.innerHTML + html;
            }
          }
        } catch (e) {
          // エラー時は末尾に追加
          editor.innerHTML = editor.innerHTML + html;
        } finally {
          isInsertingRef.current = false;
        }

        handleInput();
      },'''

if old_insert in text:
    text = text.replace(old_insert, new_insert)
    print('✅ insertAtCursor を書き直し')
else:
    print('❌ insertAtCursor が見つからない')
    # デバッグ: 実際の内容を確認
    idx = text.find('insertAtCursor: (html: string)')
    if idx >= 0:
        print('実際の内容:')
        print(repr(text[idx:idx+200]))

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
