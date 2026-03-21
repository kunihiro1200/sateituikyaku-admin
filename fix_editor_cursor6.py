#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
根本的なアプローチ変更:
selectionchange ではなく、エディタの blur イベントで Range を保存する。

blur は「エディタからフォーカスが外れた瞬間」に発火するため、
その時点の Selection は確実にエディタ内のカーソル位置を指している。

クイックボタンをクリックすると:
1. エディタで mousedown（まだフォーカスあり）
2. エディタで blur（フォーカスが外れる）← ここで Range を保存
3. ボタンで click → insertAtCursor が呼ばれる
4. savedRangeRef に正しいカーソル位置が入っている

selectionchange アプローチの問題:
- ブラウザによって発火タイミングが異なる
- focus() 呼び出し時にも発火する
- isInsertingRef フラグで防いでも、focus() 後のブラウザの
  カーソル配置（先頭）で上書きされる可能性がある
"""

file_path = 'frontend/frontend/src/components/RichTextCommentEditor.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# selectionchange の useEffect を blur ベースに完全置き換え
old_effect = '''    // selectionchange \u30a4\u30d9\u30f3\u30c8\u3067\u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\u3092\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u4fdd\u5b58
    // blur \u3088\u308a\u5148\u306b\u767a\u706b\u3059\u308b\u305f\u3081\u3001\u30af\u30a4\u30c3\u30af\u30dc\u30bf\u30f3\u30af\u30ea\u30c3\u30af\u6642\u3082\u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\u304c\u4fdd\u6301\u3055\u308c\u308b
    useEffect(() => {
      const handleSelectionChange = () => {
        // insertAtCursor 実行中は上書きしない
        if (isInsertingRef.current) return;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
          }
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, []);'''

new_effect = '''    // blur イベントでカーソル位置を保存する
    // blur は「エディタからフォーカスが外れた瞬間」に発火するため、
    // その時点の Selection は確実にエディタ内のカーソル位置を指している
    const handleBlur = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
    };'''

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print('✅ selectionchange useEffect を blur ハンドラに置き換え')
else:
    print('❌ selectionchange useEffect が見つからない')
    # デバッグ
    idx = text.find('selectionchange')
    if idx >= 0:
        print(repr(text[max(0,idx-50):idx+300]))

# ContentEditable に onBlur を追加
old_editable = '''          <ContentEditable
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            data-placeholder={placeholder}
            suppressContentEditableWarning
          />'''

new_editable = '''          <ContentEditable
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onBlur={handleBlur}
            data-placeholder={placeholder}
            suppressContentEditableWarning
          />'''

if old_editable in text:
    text = text.replace(old_editable, new_editable)
    print('✅ ContentEditable に onBlur を追加')
else:
    print('❌ ContentEditable が見つからない')

# isInsertingRef は不要になるので削除
old_inserting = '''    // insertAtCursor 実行中は selectionchange による savedRangeRef の上書きを防ぐ
    const isInsertingRef = useRef<boolean>(false);'''

new_inserting = ''

if old_inserting in text:
    text = text.replace(old_inserting, new_inserting)
    print('✅ isInsertingRef を削除')
else:
    print('❌ isInsertingRef が見つからない')

# insertAtCursor から isInsertingRef 関連コードを削除
old_insert_flag_start = '''        // selectionchange による savedRangeRef の上書きを防ぐ
        isInsertingRef.current = true;

        try {'''

new_insert_flag_start = '''        try {'''

if old_insert_flag_start in text:
    text = text.replace(old_insert_flag_start, new_insert_flag_start)
    print('✅ isInsertingRef.current = true を削除')
else:
    print('❌ isInsertingRef.current = true が見つからない')

old_finally = '''        } catch (e) {
          // エラー時は末尾に追加
          editor.innerHTML = editor.innerHTML + html;
        } finally {
          isInsertingRef.current = false;
        }'''

new_finally = '''        } catch (e) {
          // エラー時は末尾に追加
          editor.innerHTML = editor.innerHTML + html;
        }'''

if old_finally in text:
    text = text.replace(old_finally, new_finally)
    print('✅ finally の isInsertingRef.current = false を削除')
else:
    print('❌ finally ブロックが見つからない')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
