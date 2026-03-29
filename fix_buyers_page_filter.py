#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPageのフィルタリングを前方一致に変更
「当日TEL」で「当日TEL(林)」等も拾えるようにする
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "            ? allBuyersWithStatusRef.current.filter(b => b.calculated_status === selectedCalculatedStatus)"
new = "            ? allBuyersWithStatusRef.current.filter(b => b.calculated_status === selectedCalculatedStatus || (b.calculated_status || '').startsWith(selectedCalculatedStatus + '('))"

if old in text:
    text = text.replace(old, new)
    print('✅ フィルター変更成功')
else:
    print('❌ 対象箇所が見つかりません')

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
