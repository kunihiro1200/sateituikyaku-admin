# -*- coding: utf-8 -*-
"""
BuyerDetailPageの全InlineEditableFieldでenableConflictDetection=falseに変更。
conflict-check APIの呼び出しをなくして即座に反応するようにする。
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# enableConflictDetection={true} を false に変更
text = text.replace('enableConflictDetection={true}', 'enableConflictDetection={false}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# 変更件数を確認
count = content.decode('utf-8').count('enableConflictDetection={true}')
print(f'Done! {count}箇所を変更しました')
