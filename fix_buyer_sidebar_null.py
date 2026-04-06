# -*- coding: utf-8 -*-
"""
買主リストのGASコードで label: '' と assignee: '' を null に変更
"""

with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# label: '' を label: null に変更
text = text.replace("label: '',", "label: null,")
text = text.replace("label: ''", "label: null")

# assignee: '' を assignee: null に変更
text = text.replace("assignee: '',", "assignee: null,")
text = text.replace("assignee: ''", "assignee: null")

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了: label と assignee を空文字列からnullに変更しました')
