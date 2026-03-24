#!/usr/bin/env python3
# broker_inquiry を company_name に関係なく常に表示するよう修正

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = """                    // broker_inquiryフィールドは特別処理（チップ選択）
                    if (field.key === 'broker_inquiry') {
                      // company_name が空の場合は非表示
                      if (!buyer.company_name || !buyer.company_name.trim()) {
                        return null;
                      }
                      const BROKER_OPTIONS = ['業者', '個人'];"""

new = """                    // broker_inquiryフィールドは特別処理（ボックス選択）
                    if (field.key === 'broker_inquiry') {
                      const BROKER_OPTIONS = ['業者', '個人'];"""

if old in text:
    text = text.replace(old, new)
    print('OK: broker_inquiry の company_name 非表示条件を削除')
else:
    print('NG: パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
