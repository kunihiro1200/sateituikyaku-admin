# fix_buyer_detail_post_viewing.py
# BuyerDetailPage.tsx の BUYER_FIELD_SECTIONS に post_viewing_seller_contact フィールドを追加する
# viewing_mobile フィールドの直後に追加

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# viewing_mobile フィールドの直後に post_viewing_seller_contact を追加
old_field = "      { key: 'viewing_mobile', label: '内覧形態', inlineEditable: true },"
new_field = """      { key: 'viewing_mobile', label: '内覧形態', inlineEditable: true },
      { key: 'post_viewing_seller_contact', label: '内覧後売主連絡', inlineEditable: true, fieldType: 'buttonSelect' },"""

text = text.replace(old_field, new_field)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('viewing_mobile の直後に post_viewing_seller_contact フィールドを追加しました')
