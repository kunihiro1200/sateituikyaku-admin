#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EmailService.tsのURLリンク化を根本的に修正するスクリプト
問題: containsHtmlの判定が不安定で、URLリンク化がスキップされることがある
修正: 常にURLリンク化を行い、改行変換はHTMLタグがない場合のみ行う
"""

with open('backend/src/services/EmailService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード
old_code = """      // URLをリンク化する関数（<a>タグで囲まれていないURLのみ対象）
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

# 修正後のコード
# シンプルに: 常にURLリンク化 → HTMLタグがなければ改行を<br>に変換
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
          });

      // 常にURLをリンク化する
      const linkedBody = urlToLink(params.body);

      // HTMLタグ（<br>以外）が含まれているかチェック
      const containsStructuralHtml = /<img|<div|<p|<span|<table|<td|<!DOCTYPE/i.test(linkedBody);

      let htmlBody: string;
      if (containsStructuralHtml) {
        // 構造的なHTMLが含まれている場合はそのまま使用（改行変換しない）
        htmlBody = linkedBody;
      } else {
        // プレーンテキスト（または<br>のみ）の場合は改行を<br>に変換
        htmlBody = linkedBody.replace(/\\n/g, '<br>');
      }"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 修正箇所が見つかりました。置換します。')
else:
    print('❌ 修正箇所が見つかりませんでした。手動で確認してください。')
    idx = text.find('urlToLink')
    if idx >= 0:
        print('urlToLink が見つかった位置:')
        print(repr(text[idx:idx+600]))
    exit(1)

# UTF-8（BOMなし）で書き込む
with open('backend/src/services/EmailService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ EmailService.ts を修正しました。')

# BOMチェック
with open('backend/src/services/EmailService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はOK)')
