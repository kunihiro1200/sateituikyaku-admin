#!/usr/bin/env python3
# EmailTemplateService.ts の mergePropertyTemplate を修正
# 1. <<住居表示（ATBB登録住所）>> → address / display_address にマッピング
# 2. seller_name の末尾「様」重複を防ぐ（emailTemplates.ts 側で除去）

import re

# ===== EmailTemplateService.ts の修正 =====
with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# mergePropertyTemplate の汎用置換の前に <<住居表示（ATBB登録住所）>> を明示的にマッピング
old = '''    // <<担当名（営業）名前>> → sales_assignee
    result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');'''

new = '''    // <<住居表示（ATBB登録住所）>> → address または display_address
    const propertyAddress = property['address'] || property['display_address'] || '';
    result = result.replace(/<<住居表示（ATBB登録住所）>>/g, propertyAddress);

    // <<担当名（営業）名前>> → sales_assignee
    result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');'''

if old in text:
    text = text.replace(old, new)
    print('✅ EmailTemplateService.ts: <<住居表示（ATBB登録住所）>> マッピング追加')
else:
    print('❌ EmailTemplateService.ts: 対象箇所が見つかりません')
    # 現在の mergePropertyTemplate の内容を確認
    idx = text.find('mergePropertyTemplate')
    print(text[idx:idx+500])

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('EmailTemplateService.ts 書き込み完了')

# ===== emailTemplates.ts の修正 =====
# sellerName から末尾の「様」を除去してから mergePropertyTemplate に渡す
with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

old2 = '''    // プレースホルダー置換
    const mergedSubject = templateService.mergePropertyTemplate(
      template.subject,
      property,
      sellerName,
      staffInfo
    );
    const mergedBody = templateService.mergePropertyTemplate(
      template.body,
      property,
      sellerName,
      staffInfo
    );'''

new2 = '''    // sellerName の末尾「様」を除去（mergePropertyTemplate 内で「様」を付けるため）
    const sellerNameClean = sellerName.endsWith('様') ? sellerName.slice(0, -1) : sellerName;

    // プレースホルダー置換
    const mergedSubject = templateService.mergePropertyTemplate(
      template.subject,
      property,
      sellerNameClean,
      staffInfo
    );
    const mergedBody = templateService.mergePropertyTemplate(
      template.body,
      property,
      sellerNameClean,
      staffInfo
    );'''

if old2 in text2:
    text2 = text2.replace(old2, new2)
    print('✅ emailTemplates.ts: sellerName 末尾「様」除去を追加')
else:
    print('❌ emailTemplates.ts: 対象箇所が見つかりません')

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('emailTemplates.ts 書き込み完了')
