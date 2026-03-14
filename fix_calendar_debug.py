#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
handleCalendarButtonClick のエラーメッセージにデバッグ情報を追加
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前
old_str = """      // 内覧日時を取得（"2025/3/14" や "2025-3-14" を YYYY-MM-DD 形式に正規化）
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

# 修正後：より柔軟なパース + デバッグログ
new_str = """      // 内覧日時を取得（様々な形式に対応）
      const rawViewingDate = buyer.latest_viewing_date || '';
      console.log('[Calendar] rawViewingDate:', JSON.stringify(rawViewingDate));
      
      // 数字のみ抽出して年月日を取得（"2026/3/14", "2026-3-14", "2026年3月14日" など全対応）
      const numParts = rawViewingDate.match(/\\d+/g);
      console.log('[Calendar] numParts:', numParts);
      
      if (!numParts || numParts.length < 3) {
        setSnackbar({
          open: true,
          message: `内覧日の形式が不正です（値: "${rawViewingDate}"）`,
          severity: 'error',
        });
        return;
      }
      const year = numParts[0].padStart(4, '0');
      const month = numParts[1].padStart(2, '0');
      const day = numParts[2].padStart(2, '0');
      const viewingDate = new Date(`${year}-${month}-${day}T00:00:00`);
      console.log('[Calendar] viewingDate:', viewingDate, 'isValid:', !isNaN(viewingDate.getTime()));
      if (isNaN(viewingDate.getTime())) {
        setSnackbar({
          open: true,
          message: `内覧日のパースに失敗しました（値: "${rawViewingDate}"）`,
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
        print(f'  前後: {repr(text[idx-20:idx+300])}')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
