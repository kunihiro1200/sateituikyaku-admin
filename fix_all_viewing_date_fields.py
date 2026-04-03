#!/usr/bin/env python3
"""
全てのフロントエンドファイルのlatest_viewing_dateをviewing_dateに修正
"""
import os
import glob

files_to_fix = [
    'frontend/frontend/src/pages/PropertyListingDetailPage.tsx',
    'frontend/frontend/src/pages/NewBuyerPage.tsx',
    'frontend/frontend/src/pages/BuyerDetailPage.tsx',
    'frontend/frontend/src/components/PreDayEmailButton.tsx',
    'frontend/frontend/src/components/BuyerIndicator.tsx',
    'frontend/frontend/src/components/SyncConflictDialog.tsx',
    'frontend/frontend/src/components/NearbyBuyersList.tsx',
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        print(f'⚠️  {filepath} が見つかりません')
        continue
    
    with open(filepath, 'rb') as f:
        content = f.read()
    
    text = content.decode('utf-8')
    
    # latest_viewing_dateをviewing_dateに置換
    original_text = text
    text = text.replace('buyer.latest_viewing_date', 'buyer.viewing_date')
    text = text.replace("'latest_viewing_date'", "'viewing_date'")
    text = text.replace('"latest_viewing_date"', '"viewing_date"')
    text = text.replace('latest_viewing_date:', 'viewing_date:')
    text = text.replace('latest_viewing_date?:', 'viewing_date?:')
    text = text.replace('latestViewingDate', 'viewingDate')
    
    if text != original_text:
        # UTF-8で書き込む（BOMなし）
        with open(filepath, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'✅ {filepath} を修正しました')
    else:
        print(f'   {filepath} は変更不要でした')

print('\n✅ 全てのファイルを修正しました')
