# -*- coding: utf-8 -*-
"""
通話モードページのヘッダーカテゴリーラベルを日本語化するスクリプト（小文字版も追加）
UTF-8エンコーディングを保持したまま変更を適用
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 大文字の後に小文字版も追加
old_header_labels = """            else if (selectedCategory === 'todayCallAssigned') label = '当日TEL（担当）';
            else if (selectedCategory === 'VISITOTHERDECISION') label = '訪問後他決';
            else if (selectedCategory === 'UNVISITEDOTHERDECISION') label = '未訪問他決';
            else if (selectedCategory === 'EXCLUSIVE') label = '専任';
            else if (selectedCategory === 'GENERAL') label = '一般';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;"""

new_header_labels = """            else if (selectedCategory === 'todayCallAssigned') label = '当日TEL（担当）';
            else if (selectedCategory === 'VISITOTHERDECISION') label = '訪問後他決';
            else if (selectedCategory === 'UNVISITEDOTHERDECISION') label = '未訪問他決';
            else if (selectedCategory === 'EXCLUSIVE') label = '専任';
            else if (selectedCategory === 'GENERAL') label = '一般';
            else if (selectedCategory === 'visitOtherDecision') label = '訪問後他決';
            else if (selectedCategory === 'unvisitedOtherDecision') label = '未訪問他決';
            else if (selectedCategory === 'exclusive') label = '専任';
            else if (selectedCategory === 'general') label = '一般';
            else if (typeof selectedCategory === 'string' && selectedCategory.startsWith('visitAssigned:')) label = `担当（${selectedCategory.replace('visitAssigned:', '')}）`;"""

text = text.replace(old_header_labels, new_header_labels)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 変更完了（小文字版も追加）')
print('✅ UTF-8エンコーディングを保持')
