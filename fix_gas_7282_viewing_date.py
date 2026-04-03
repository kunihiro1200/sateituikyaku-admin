#!/usr/bin/env python3
"""
gas_sync_buyer_7282_only.jsのlatest_viewing_dateをviewing_dateに修正
"""

filepath = 'gas_sync_buyer_7282_only.js'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# latest_viewing_dateをviewing_dateに置換
text = text.replace('latest_viewing_date', 'viewing_date')
text = text.replace('LatestViewingDate', 'ViewingDate')

# UTF-8で書き込む（BOMなし）
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {filepath} を修正しました')
