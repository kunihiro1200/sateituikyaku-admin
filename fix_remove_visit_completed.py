#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerStatusSidebar.tsx から visitCompleted ボタンを削除する
"""

with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# visitCompleted ボタンの行を削除
old_str = "      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}\n      {renderCategoryButton('visitCompleted', '②訪問済み', '#1565c0')}\n      {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}"
new_str = "      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}\n      {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}"

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ visitCompleted ボタンを削除しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find('visitDayBefore')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-10:idx+300]))

with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
