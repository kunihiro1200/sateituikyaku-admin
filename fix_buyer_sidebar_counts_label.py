# -*- coding: utf-8 -*-
"""
gas_buyer_complete_code.jsのupdateBuyerSidebarCounts関数を修正
label: null → label: '' に変更
"""

# 既存のファイルを読み込む
with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# label: null を label: '' に置換（updateBuyerSidebarCounts関数内のみ）
text = text.replace("label: null,", "label: '',")
text = text.replace('label: null,', "label: '',")

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ label: null → label: "" に修正しました')
