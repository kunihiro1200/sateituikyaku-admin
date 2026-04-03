#!/usr/bin/env python3
"""
全てのTypeScriptファイルのlatest_viewing_dateをviewing_dateに修正
"""
import os

files_to_fix = [
    'frontend/frontend/src/services/ValidationService.ts',
    'frontend/frontend/src/services/__tests__/ValidationService.test.ts',
    'frontend/frontend/src/services/__tests__/CalendarLinkGenerator.test.ts',
    'frontend/frontend/src/services/CalendarLinkGenerator.ts',
    'frontend/frontend/src/utils/__tests__/vendorSurveySync.bugCondition.test.ts',
    'frontend/frontend/src/utils/__tests__/vendorSurveySync.preservation.test.ts',
    'frontend/frontend/src/types/index.ts',
    'frontend/frontend/src/backend/routes/__tests__/propertyListings.buyers.test.ts',
    'frontend/frontend/src/backend/services/BuyerLinkageService.ts',
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

print('\n✅ 全てのTypeScriptファイルを修正しました')
