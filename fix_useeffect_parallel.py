#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx の useEffect を Promise.allSettled による並列実行に変更する
"""

file_path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のuseEffect
old_code = """  useEffect(() => {
    if (propertyNumber) {
      fetchPropertyData();
      fetchBuyers();
      fetchWorkTaskData();
    }
    getActiveEmployees().then(setActiveEmployees).catch(() => {});
  }, [propertyNumber]);"""

# 修正後のuseEffect（Promise.allSettledによる並列実行）
new_code = """  useEffect(() => {
    if (propertyNumber) {
      Promise.allSettled([
        fetchPropertyData(),
        fetchBuyers(),
        fetchWorkTaskData(),
        getActiveEmployees().then(setActiveEmployees).catch(() => {}),
      ]);
    }
  }, [propertyNumber]);"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ useEffect を並列実行に変更しました')
else:
    print('❌ 対象のuseEffectが見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('useEffect(() => {')
    if idx >= 0:
        print('useEffect found at index:', idx)
        print(repr(text[idx:idx+300]))
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました:', file_path)

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print('BOM check:', repr(first_bytes[:3]))
if first_bytes[:3] == b'\xef\xbb\xbf':
    print('⚠️ BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です')
