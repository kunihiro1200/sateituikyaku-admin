#!/usr/bin/env python3
# SMS送信ドロップダウンのMenuItemを物件種別（土地かどうか）で出し分ける

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_items = """                <MenuItem value="">テンプレート選択</MenuItem>
                <MenuItem value="land_no_permission">資料請求（土）許可不要</MenuItem>
                <MenuItem value="minpaku">民泊問合せ</MenuItem>
                <MenuItem value="land_need_permission">資料請求（土）売主要許可</MenuItem>
                <MenuItem value="offer_no_viewing">買付あり内覧NG</MenuItem>
                <MenuItem value="offer_ok_viewing">買付あり内覧OK</MenuItem>
                <MenuItem value="no_response">前回問合せ後反応なし</MenuItem>
                <MenuItem value="no_response_offer">反応なし（買付あり不適合）</MenuItem>
                <MenuItem value="pinrich">物件指定なし（Pinrich）</MenuItem>
                <MenuItem value="house_mansion">資料請求（戸・マ）</MenuItem>"""

new_items = """                <MenuItem value="">テンプレート選択</MenuItem>
                {/* 種別が土地の場合のみ土地用テンプレートを表示 */}
                {linkedProperties[0]?.property_type === '土' ? [
                  <MenuItem key="land_no_permission" value="land_no_permission">資料請求（土）許可不要</MenuItem>,
                  <MenuItem key="minpaku" value="minpaku">民泊問合せ</MenuItem>,
                  <MenuItem key="land_need_permission" value="land_need_permission">資料請求（土）売主要許可</MenuItem>,
                ] : [
                  <MenuItem key="house_mansion" value="house_mansion">資料請求（戸・マ）</MenuItem>,
                ]}
                <MenuItem value="offer_no_viewing">買付あり内覧NG</MenuItem>
                <MenuItem value="offer_ok_viewing">買付あり内覧OK</MenuItem>
                <MenuItem value="no_response">前回問合せ後反応なし</MenuItem>
                <MenuItem value="no_response_offer">反応なし（買付あり不適合）</MenuItem>
                <MenuItem value="pinrich">物件指定なし（Pinrich）</MenuItem>"""

if old_items in text:
    text = text.replace(old_items, new_items)
    print('✅ MenuItemを種別で出し分けるように更新しました')
else:
    print('❌ 対象文字列が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
