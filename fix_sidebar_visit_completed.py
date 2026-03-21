#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerStatusSidebar.tsx の renderAllCategories に visitCompleted ボタンを追加する
"""

with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# visitDayBefore の後に visitCompleted を追加
old_str = "      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}\n      {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}"
new_str = "      {renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}\n      {renderCategoryButton('visitCompleted', '②訪問済み', '#1565c0')}\n      {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}"

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ visitCompleted ボタンを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用に周辺を表示
    idx = text.find('visitDayBefore')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-50:idx+200]))

with open('frontend/frontend/src/components/SellerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
