#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EmailService.tsのURLリンク化コールバック引数バグを修正するスクリプト
問題: replace()コールバックの引数順序が間違っており fullText.indexOf is not a function エラーが発生
修正: offsetを使ってシンプルに実装し直す
"""

with open('backend/src/services/EmailService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード（引数順序が間違っている）
old_code = """      // URLをリンク化する関数（<a>タグで囲まれていないURLのみ対象）
      const urlToLink = (text: string): string =>
        text.replace(/(https?:\\/\\/[^\\s\\u3000\\u3001\\u3002\\uff01\\uff09\\u300d\\u300f\\u3011\\u3015\\u3017\\u3019\\u301b\\u301f\\uff3d\\uff5d\\u300b\\u300f]+)/g,
          (url, _offset, fullText) => {
            // 既に<a href="...">の中にあるURLはスキップ
            const before = fullText.slice(0, fullText.indexOf(url));
            const lastAnchorOpen = before.lastIndexOf('<a ');
            const lastAnchorClose = before.lastIndexOf('</a>');
            if (lastAnchorOpen > lastAnchorClose) {
              return url; // <a>タグの中にあるのでそのまま返す
            }
            return `<a href="${url}">${url}</a>`;
          });"""

# 修正後のコード（offsetを使ってシンプルに実装）
# replace()コールバックの正しい引数順序: (match, group1, ..., offset, fullString)
new_code = """      // URLをリンク化する関数（<a>タグで囲まれていないURLのみ対象）
      const urlToLink = (inputText: string): string =>
        inputText.replace(/(https?:\\/\\/[^\\s\\u3000\\u3001\\u3002\\uff01\\uff09\\u300d\\u300f\\u3011\\u3015\\u3017\\u3019\\u301b\\u301f\\uff3d\\uff5d\\u300b\\u300f]+)/g,
          (url, _group1, offset) => {
            // 既に<a href="...">の中にあるURLはスキップ
            const before = inputText.slice(0, offset);
            const lastAnchorOpen = before.lastIndexOf('<a ');
            const lastAnchorClose = before.lastIndexOf('</a>');
            if (lastAnchorOpen > lastAnchorClose) {
              return url; // <a>タグの中にあるのでそのまま返す
            }
            return `<a href="${url}">${url}</a>`;
          });"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 修正箇所が見つかりました。置換します。')
else:
    print('❌ 修正箇所が見つかりませんでした。手動で確認してください。')
    idx = text.find('urlToLink')
    if idx >= 0:
        print('urlToLink が見つかった位置:')
        print(repr(text[idx:idx+500]))
    exit(1)

# UTF-8（BOMなし）で書き込む
with open('backend/src/services/EmailService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ EmailService.ts を修正しました。')

# BOMチェック
with open('backend/src/services/EmailService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はOK)')
