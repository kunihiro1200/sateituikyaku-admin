#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EmailService.tsのURLリンク化バグを修正するスクリプト
問題: HTMLが含まれている場合、URLをリンク化する処理がスキップされる
修正: HTMLが含まれていても、<a>タグで囲まれていないURLをリンク化する
"""

with open('backend/src/services/EmailService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード
old_code = """      // HTMLタグが既に含まれているかチェック
      const containsHtml = /<img|<a|<br|<div|<p|<span/i.test(params.body);
      
      let htmlBody: string;
      if (containsHtml) {
        // 既にHTMLが含まれている場合はそのまま使用
        htmlBody = params.body;
      } else {
        // プレーンテキストの場合はHTMLに変換
        const urlToLink = (text: string): string =>
          text.replace(/(https?:\\/\\/[^\\s\\u3000\\u3001\\u3002\\uff01\\uff09\\u300d\\u300f\\u3011\\u3015\\u3017\\u3019\\u301b\\u301f\\uff3d\\uff5d\\u300b\\u300f]+)/g,
            (url) => `<a href="${url}">${url}</a>`);
        htmlBody = urlToLink(params.body).replace(/\\n/g, '<br>');
      }"""

# 修正後のコード
# HTMLが含まれていても、<a>タグで囲まれていないURLをリンク化する
new_code = """      // URLをリンク化する関数（<a>タグで囲まれていないURLのみ対象）
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
          });

      // HTMLタグが既に含まれているかチェック
      const containsHtml = /<img|<a|<br|<div|<p|<span/i.test(params.body);

      let htmlBody: string;
      if (containsHtml) {
        // 既にHTMLが含まれている場合でも、<a>タグで囲まれていないURLをリンク化する
        htmlBody = urlToLink(params.body);
      } else {
        // プレーンテキストの場合はHTMLに変換（URLリンク化 + 改行を<br>に変換）
        htmlBody = urlToLink(params.body).replace(/\\n/g, '<br>');
      }"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 修正箇所が見つかりました。置換します。')
else:
    print('❌ 修正箇所が見つかりませんでした。手動で確認してください。')
    # デバッグ用に前後のコードを表示
    idx = text.find('containsHtml')
    if idx >= 0:
        print('containsHtml が見つかった位置:')
        print(repr(text[idx-100:idx+300]))
    exit(1)

# UTF-8（BOMなし）で書き込む
with open('backend/src/services/EmailService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ EmailService.ts を修正しました。')

# BOMチェック
with open('backend/src/services/EmailService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はOK)')
