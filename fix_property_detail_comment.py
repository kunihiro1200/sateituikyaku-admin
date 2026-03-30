# -*- coding: utf-8 -*-
"""
物件詳細画面のコメント修正スクリプト
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 問題のコメントを修正
old_comment = """      </Box> {/* サイドバー + メインコンテンツ */}"""
new_comment = """      </Box> {/* サイドバーとメインコンテンツ */}"""

text = text.replace(old_comment, new_comment)

# UTF-8で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
