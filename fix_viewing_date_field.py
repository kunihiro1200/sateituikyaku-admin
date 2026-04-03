#!/usr/bin/env python3
"""
BuyerViewingResultPage.tsxのlatest_viewing_dateをviewing_dateに修正
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# latest_viewing_dateをviewing_dateに置換
text = text.replace('buyer.latest_viewing_date', 'buyer.viewing_date')
text = text.replace("'latest_viewing_date'", "'viewing_date'")
text = text.replace('"latest_viewing_date"', '"viewing_date"')
text = text.replace('latest_viewing_date:', 'viewing_date:')
text = text.replace('latest_viewing_date?:', 'viewing_date?:')
text = text.replace('latestViewingDate', 'viewingDate')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ BuyerViewingResultPage.tsxを修正しました')
print('   latest_viewing_date → viewing_date')
