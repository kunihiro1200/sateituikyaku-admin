#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RichTextCommentEditor.tsx の insertAtCursor を修正するスクリプト
- editor.focus() を先に呼ぶ
- savedRangeRef.current.cloneRange() で新しい Range を作成してから操作する
"""

file_path = 'frontend/frontend/src/components/RichTextCommentEditor.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前の insertAtCursor 実装を検索（実際のファイル内容に合わせる）
old_impl = '''    useImperativeHandle(ref, () => ({
      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        try {
          if (savedRangeRef.current) {
            // \\u4fdd\\u5b58\\u6e08\\u307f\\u306e\\u30ab\\u30fc\\u30bd\\u30eb\\u4f4d\\u7f6e\\u306b\\u633f\\u5165
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(savedRangeRef.current);

            const range = savedRangeRef.current;
            range.deleteContents();

            // HTML\\u6587\\u5b57\\u5217\\u3092DocumentFragment\\u306b\\u5909\\u63db\\u3057\\u3066\\u633f\\u5165
            const fragment = range.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            range.insertNode(fragment);

            // \\u30ab\\u30fc\\u30bd\\u30eb\\u3092\\u633f\\u5165\\u30c6\\u30ad\\u30b9\\u30c8\\u306e\\u76f4\\u5f8c\\u306b\\u79fb\\u52d5
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              savedRangeRef.current = range.cloneRange();
            }
          } else {
            // \\u30d5\\u30a9\\u30fc\\u30eb\\u30d0\\u30c3\\u30af: \\u30ab\\u30fc\\u30bd\\u30eb\\u4f4d\\u7f6e\\u304c\\u672a\\u8a2d\\u5b9a\\u306e\\u5834\\u5408\\u306f\\u5148\\u982d\\u306b\\u633f\\u5165
            editor.innerHTML = html + (editor.innerHTML ? '<br>' + editor.innerHTML : '');
          }
        } catch (e) {
          // \\u30a8\\u30e9\\u30fc\\u6642\\u306f\\u30d5\\u30a9\\u30fc\\u30eb\\u30d0\\u30c3\\u30af\\u3068\\u3057\\u3066\\u5148\\u982d\\u633f\\u5165
          editor.innerHTML = html + (editor.innerHTML ? '<br>' + editor.innerHTML : '');
        }

        handleInput();
      },
    }));'''

# 修正後の insertAtCursor 実装
new_impl = '''    // ref 経由で insertAtCursor を公開する
    useImperativeHandle(ref, () => ({
      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        try {
          if (savedRangeRef.current) {
            // エディタにフォーカスを戻す（ボタンクリックでフォーカスが外れているため）
            editor.focus();

            // savedRangeRef.current を cloneRange() してから操作する
            // （直接操作すると savedRangeRef 自体が変更されてしまうため）
            const range = savedRangeRef.current.cloneRange();

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
      },
    }));'''

if old_impl in text:
    text = text.replace(old_impl, new_impl)
    print('✅ insertAtCursor を修正しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用
    idx = text.find('useImperativeHandle(ref')
    if idx >= 0:
        print('実際の内容:')
        print(repr(text[idx:idx+800]))

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
