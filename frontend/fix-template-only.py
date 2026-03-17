#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""値下げメールテンプレートの本文を変更"""

with open('frontend/src/utils/gmailDistributionTemplates.ts', 'rb') as f:
    raw = f.read()

# CRLF -> LF に正規化してから処理
content = raw.decode('utf-8').replace('\r\n', '\n')

old_body = """    body: `お世話になっております。

{address}の物件価格が変更となりました。

物件番号: {propertyNumber}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber']"""

new_body = """    body: `お世話になっております。

{address}の物件価格が変更となりました。

現状の価格→変更後の価格

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber', 'publicUrl']"""

if old_body in content:
    content = content.replace(old_body, new_body)
    print("✅ 値下げテンプレート本文を更新しました")
else:
    print("❌ マッチしませんでした")

# CRLF に戻して書き込む
with open('frontend/src/utils/gmailDistributionTemplates.ts', 'wb') as f:
    f.write(content.replace('\n', '\r\n').encode('utf-8'))
