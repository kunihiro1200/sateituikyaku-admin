#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ブルー系カラーをグリーン系に変換するスクリプト
対象: 社内管理システムのフロントエンドファイル
"""

import os

def fix_file(filepath, replacements):
    with open(filepath, 'rb') as f:
        content = f.read()
    text = content.decode('utf-8')
    
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    
    if text != original:
        with open(filepath, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'✅ Fixed: {filepath}')
    else:
        print(f'⏭️  No changes: {filepath}')

# CallModePage.tsx - リンク色とSMSアクティビティ色
fix_file(
    'frontend/frontend/src/pages/CallModePage.tsx',
    [
        ("color: '#1976d2', textDecoration: 'underline'", "color: '#2e7d32', textDecoration: 'underline'"),
        ("bgcolor = '#e3f2fd';\n                    borderColor = '4px solid #2196f3';",
         "bgcolor = '#e8f5e9';\n                    borderColor = '4px solid #2e7d32';"),
    ]
)

# InquiryHistoryTable.tsx - 「今回」チップの色
fix_file(
    'frontend/frontend/src/components/InquiryHistoryTable.tsx',
    [
        ("backgroundColor: item.status === 'current' ? '#2196f3' : '#9e9e9e'",
         "backgroundColor: item.status === 'current' ? '#2e7d32' : '#9e9e9e'"),
    ]
)

# NewBuyerPage.tsx - 内覧前伝達事項ボックス
fix_file(
    'frontend/frontend/src/pages/NewBuyerPage.tsx',
    [
        ("bgcolor: '#e3f2fd', borderRadius: 1, border: '2px solid #2196f3'",
         "bgcolor: '#e8f5e9', borderRadius: 1, border: '2px solid #2e7d32'"),
    ]
)

# PropertyListingDetailPage.tsx - 内覧伝達事項ボックス
fix_file(
    'frontend/frontend/src/pages/PropertyListingDetailPage.tsx',
    [
        ("bgcolor: '#e3f2fd', p: 2, borderRadius: 1, border: '2px solid #2196f3'",
         "bgcolor: '#e8f5e9', p: 2, borderRadius: 1, border: '2px solid #2e7d32'"),
    ]
)

# EmailService.ts - メールテンプレートのヘッダー色
fix_file(
    'frontend/frontend/src/backend/services/EmailService.ts',
    [
        (".header { background-color: #1976d2;", ".header { background-color: #2e7d32;"),
        (".price { font-size: 24px; font-weight: bold; color: #1976d2;",
         ".price { font-size: 24px; font-weight: bold; color: #2e7d32;"),
    ]
)

print('\n完了！')
