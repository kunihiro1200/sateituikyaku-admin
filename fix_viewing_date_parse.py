#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の latest_viewing_date パース修正
"2025/3/14" → "2025-03-14" のようにゼロパディングして new Date() に渡す
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前（前回の修正）
old_str = """      // 内覧日時を取得（スラッシュ区切り "2025/3/14" をハイフン区切りに変換）
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

# 修正後：スラッシュ区切りをパースして ISO 形式（YYYY-MM-DD）に変換
new_str = """      // 内覧日時を取得（"2025/3/14" や "2025-3-14" を YYYY-MM-DD 形式に正規化）
      const rawViewingDate = buyer.latest_viewing_date || '';
      const dateParts = rawViewingDate.split(/[\\/\\-]/);
      if (dateParts.length !== 3) {
        setSnackbar({
          open: true,
          message: '内覧日が正しい形式ではありません',
          severity: 'error',
        });
        return;
      }
      const year = dateParts[0].padStart(4, '0');
      const month = dateParts[1].padStart(2, '0');
      const day = dateParts[2].padStart(2, '0');
      const viewingDate = new Date(`${year}-${month}-${day}T00:00:00`);
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
    idx = text.find('rawViewingDate')
    if idx >= 0:
        print(f'  前後: {repr(text[idx-20:idx+200])}')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
