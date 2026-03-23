#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物件詳細ページのレイアウト調整
- 物件概要: 文字サイズを大きく、1行に収まるよう調整
- サイドバー: 「カテゴリー」に変更、文字を大きく
- 全体的な余白・文字サイズのバランス調整
"""

import re

# ===== PropertyListingDetailPage.tsx の修正 =====
filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 物件概要セクションのラベル文字サイズを body2 → body1 に
# 「所在地」「売主氏名」「ATBB状況」「種別」「現況」「担当」のラベル
# <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>
# → <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>所在地</Typography>
# 値の表示: variant="body1" → variant="body1" sx={{ fontSize: '0.95rem' }}

# 物件概要セクション内のGrid spacing を 1 → 0.5 に（余白を減らす）
# Paper の p: 1.5 → p: 1 に
text = text.replace(
    '<Paper sx={{ p: 1.5, mb: 2, bgcolor: \'#f5f5f5\' }}>',
    '<Paper sx={{ p: 1, mb: 2, bgcolor: \'#f5f5f5\' }}>'
)

# Grid spacing={1} → spacing={0.5}（物件概要内）
# 物件概要のGridのみ対象（最初のGrid container spacing={1}）
text = text.replace(
    '        <Grid container spacing={1}>\n          <Grid item xs={6} sm={4} md={2}>',
    '        <Grid container spacing={0.5} alignItems="flex-start">\n          <Grid item xs={6} sm={4} md={2}>'
)

# 物件概要内のラベル（body2 → caption相当だが読みやすく）
# 「所在地」「売主氏名」「ATBB状況」「種別」「現況」「担当」のラベルを調整
# variant="body2" color="text.secondary" fontWeight="bold" → sx追加
old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>所在地</Typography>'
text = text.replace(old_label, new_label)

old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>売主氏名</Typography>'
text = text.replace(old_label, new_label)

old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">ATBB状況</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>ATBB状況</Typography>'
text = text.replace(old_label, new_label)

old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>種別</Typography>'
text = text.replace(old_label, new_label)

old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>現況</Typography>'
text = text.replace(old_label, new_label)

old_label = '            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>'
new_label = '            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: \'0.75rem\', lineHeight: 1.2 }}>担当</Typography>'
text = text.replace(old_label, new_label)

# 物件概要の値テキスト: variant="body1" fontWeight="medium" → variant="body2" fontWeight="medium" sx={{ fontSize: '0.9rem' }}
# 所在地の値
old_val = '                <Typography variant="body1" fontWeight="medium">\n                  {data.address || data.display_address || \'-\'}\n                </Typography>'
new_val = '                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                  {data.address || data.display_address || \'-\'}\n                </Typography>'
text = text.replace(old_val, new_val)

# 売主氏名の値
old_val = '              <Typography variant="body1" fontWeight="medium">\n                {data.seller_name || \'-\'}\n              </Typography>'
new_val = '              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                {data.seller_name || \'-\'}\n              </Typography>'
text = text.replace(old_val, new_val)

# ATBB状況の値
old_val = '              <Typography variant="body1" fontWeight="medium">\n                {getDisplayStatus(data.atbb_status) || \'-\'}\n              </Typography>'
new_val = '              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                {getDisplayStatus(data.atbb_status) || \'-\'}\n              </Typography>'
text = text.replace(old_val, new_val)

# 種別の値
old_val = '              <Typography variant="body1" fontWeight="medium">\n                {data.property_type || \'-\'}\n              </Typography>'
new_val = '              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                {data.property_type || \'-\'}\n              </Typography>'
text = text.replace(old_val, new_val)

# 現況の値
old_val = '              <Typography variant="body1" fontWeight="medium">\n                {data.current_status || \'-\'}\n              </Typography>'
new_val = '              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                {data.current_status || \'-\'}\n              </Typography>'
text = text.replace(old_val, new_val)

# 担当の値
old_val = '              <Typography variant="body1" fontWeight="medium">\n                {data.sales_assignee || \'-\'}\n              </Typography>'
new_val = '              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: \'0.9rem\' }}>\n                {data.sales_assignee || \'-\'}\n              </Typography>'
text = text.replace(old_val, new_val)

# 物件概要タイトルを少し大きく
old_title = '          <Typography variant="body2" color="text.secondary" fontWeight="bold">物件概要</Typography>'
new_title = '          <Typography variant="body1" color="text.secondary" fontWeight="bold">物件概要</Typography>'
text = text.replace(old_title, new_title)

# ===== 書き込み =====
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {filepath} を更新しました')

# ===== PropertySidebarStatus.tsx の修正 =====
# サイドバーの「カテゴリー」文字サイズ調整（既に変更済みのはずだが確認）
sidebar_path = 'frontend/frontend/src/components/PropertySidebarStatus.tsx'

with open(sidebar_path, 'rb') as f:
    sidebar_content = f.read()

sidebar_text = sidebar_content.decode('utf-8')

# サイドバー幅を少し広げる（200 → 220）
sidebar_text = sidebar_text.replace(
    '<Paper sx={{ width: 200, flexShrink: 0 }}>',
    '<Paper sx={{ width: 210, flexShrink: 0 }}>'
)

# カテゴリーのフォントサイズを確認・調整
# 既に h6 + fontSize: '1rem' になっているはず
# リストアイテムの py: 0.75 も確認済み

with open(sidebar_path, 'wb') as f:
    f.write(sidebar_text.encode('utf-8'))

print(f'✅ {sidebar_path} を更新しました')
print('完了！')
