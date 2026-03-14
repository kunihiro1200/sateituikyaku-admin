#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellersPage.tsx のタイトルスタイルを買主リストに統一:
1. SECTION_COLORS インポートを追加
2. variant="h4" → variant="h5" + fontWeight="bold" + color: SECTION_COLORS.seller.main
"""

with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. SECTION_COLORS インポートを追加（SellerStatusSidebar インポートの後に追加）
old_import = "import SellerStatusSidebar from '../components/SellerStatusSidebar';"
new_import = "import SellerStatusSidebar from '../components/SellerStatusSidebar';\nimport { SECTION_COLORS } from '../theme/sectionColors';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ SECTION_COLORS インポートを追加')
else:
    print('❌ インポート追加対象が見つかりません')

# 2. タイトルスタイルを変更
old_title = '''          <Typography variant="h4" component="h1">
            売主リスト
          </Typography>'''

new_title = '''          <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>
            売主リスト
          </Typography>'''

if old_title in text:
    text = text.replace(old_title, new_title)
    print('✅ タイトルスタイルを変更')
else:
    print('❌ タイトル変更対象が見つかりません')

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイル書き込み完了')
