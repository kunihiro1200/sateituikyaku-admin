#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の latest_viewing_date パース修正
スラッシュ区切り（2025/3/14）をハイフン区切り（2025-03-14）に変換してから new Date() に渡す
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前
old_str = "      // 内覧日時を取得\n      const viewingDate = new Date(buyer.latest_viewing_date);"

# 修正後：スラッシュ区切りをハイフン区切りに変換してから Date に渡す
new_str = """      // 内覧日時を取得（スラッシュ区切り "2025/3/14" をハイフン区切りに変換）
      const rawViewingDate = buyer.latest_viewing_date?.replace(/\\//g, '-') || '';
      const viewingDate = new Date(rawViewingDate);
      if (isNaN(viewingDate.getTime())) {
        setSnackbar({
          open: true,
          message: '内覧日が正しい形式ではありません',
          severity: 'error',
        });
        return;
      }"""

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ 修正成功')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ用：前後の文字列を表示
    idx = text.find('const viewingDate = new Date(buyer.latest_viewing_date)')
    if idx >= 0:
        print(f'  前後: {repr(text[idx-50:idx+100])}')
    else:
        print('  "const viewingDate = new Date(buyer.latest_viewing_date)" も見つかりません')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
