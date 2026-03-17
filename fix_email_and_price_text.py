#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1. gmailDistributionTemplates.ts の price-reduction テンプレートに {buyerName}様 を追加
2. GmailDistributionButton.tsx の generatePriceChangeText() を修正
"""

import re

# ===== 1. gmailDistributionTemplates.ts の修正 =====
templates_path = 'frontend/frontend/src/utils/gmailDistributionTemplates.ts'

with open(templates_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# price-reduction テンプレートの body 冒頭に {buyerName}様 を追加
old_body = """`お世話になっております。

{address}の物件価格が変更となりました。"""

new_body = """`{buyerName}様
お世話になっております。

{address}の物件価格が変更となりました。"""

text = text.replace(old_body, new_body)

# price-reduction の placeholders に buyerName を追加
old_placeholders = "placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText', 'signature']"
new_placeholders = "placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText', 'buyerName', 'signature']"

text = text.replace(old_placeholders, new_placeholders)

with open(templates_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ gmailDistributionTemplates.ts を修正しました')

# ===== 2. GmailDistributionButton.tsx の修正 =====
button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(button_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# generatePriceChangeText() を修正
old_func = """  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    if (previousSalesPrice && salesPrice && previousSalesPrice !== salesPrice) {
      const oldMan = Math.floor(previousSalesPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円から${newMan}万円に${diffMan}万円値下げしました！問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！`;
      }
    }
    return '現状の価格→変更後の価格';
  };"""

new_func = """  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    if (previousSalesPrice && salesPrice) {
      const oldMan = Math.floor(previousSalesPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円 → ${newMan}万円（${diffMan}万円値下げ）`;
      } else if (diffMan < 0) {
        return `${oldMan}万円 → ${newMan}万円（${Math.abs(diffMan)}万円値上げ）`;
      } else {
        return `${oldMan}万円（価格変更なし）`;
      }
    }
    if (salesPrice) {
      return `${Math.floor(salesPrice / 10000)}万円`;
    }
    if (previousSalesPrice) {
      return `${Math.floor(previousSalesPrice / 10000)}万円`;
    }
    return '';
  };"""

text = text.replace(old_func, new_func)

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ GmailDistributionButton.tsx を修正しました')

# ===== 確認 =====
with open(templates_path, 'rb') as f:
    check = f.read().decode('utf-8')

if '{buyerName}様' in check and "placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText', 'buyerName', 'signature']" in check:
    print('✅ テンプレート修正確認OK')
else:
    print('❌ テンプレート修正に問題があります')

with open(button_path, 'rb') as f:
    check2 = f.read().decode('utf-8')

if '万円 → ' in check2 and '価格変更なし' in check2:
    print('✅ generatePriceChangeText 修正確認OK')
else:
    print('❌ generatePriceChangeText 修正に問題があります')
