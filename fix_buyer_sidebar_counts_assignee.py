# -*- coding: utf-8 -*-
"""
gas_buyer_complete_code.jsのupdateBuyerSidebarCounts関数を修正
assignee: null → assignee: '' に変更
"""

# 既存のファイルを読み込む
with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# assignee: null を assignee: '' に置換
text = text.replace("assignee: null,", "assignee: '',")
text = text.replace('assignee: null,', "assignee: '',")

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ assignee: null → assignee: "" に修正しました')
