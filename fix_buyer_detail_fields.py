#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主詳細ページのフィールド整理:
1. 「問合せ・内覧情報」セクションから follow_up_assignee と latest_viewing_date を削除
2. 「内覧結果・後続対応」セクション（isViewingResultGroup）を丸ごと削除
   （viewing_result_follow_up, follow_up_assignee, latest_status は内覧ページで管理）
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 1. 「問合せ・内覧情報」セクションから follow_up_assignee を削除 =====
old_follow_up = '''      { key: 'follow_up_assignee', label: '後続担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },'''

new_follow_up = '''      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },'''

if old_follow_up in text:
    text = text.replace(old_follow_up, new_follow_up)
    print('✅ 問合せ・内覧情報セクションから後続担当を削除')
else:
    print('❌ 後続担当の削除対象が見つかりません')

# ===== 2. 「問合せ・内覧情報」セクションから latest_viewing_date を削除 =====
old_viewing_date = '''      { key: 'latest_viewing_date', label: '内覧日(最新)', type: 'date', inlineEditable: true },
      // viewing_notes は PropertyInfoCard 内に移動
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },'''

new_viewing_date = '''      // viewing_notes は PropertyInfoCard 内に移動
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },'''

if old_viewing_date in text:
    text = text.replace(old_viewing_date, new_viewing_date)
    print('✅ 問合せ・内覧情報セクションから内覧日(最新)を削除')
else:
    print('❌ 内覧日(最新)の削除対象が見つかりません')

# ===== 3. 「内覧結果・後続対応」セクション（isViewingResultGroup）を丸ごと削除 =====
old_viewing_result_section = '''  {
    title: '内覧結果・後続対応',
    isViewingResultGroup: true,  // 特別なグループとしてマーク
    fields: [
      { key: 'viewing_result_follow_up', label: '内覧結果・後続対応', multiline: true, inlineEditable: true },
      { key: 'follow_up_assignee', label: '後続担当', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true, fieldType: 'dropdown' },
    ],
  },
  {'''

new_viewing_result_section = '''  {'''

if old_viewing_result_section in text:
    text = text.replace(old_viewing_result_section, new_viewing_result_section)
    print('✅ 内覧結果・後続対応セクションを削除')
else:
    print('❌ 内覧結果・後続対応セクションの削除対象が見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイル書き込み完了')
