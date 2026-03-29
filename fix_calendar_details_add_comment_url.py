#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Googleカレンダーの詳細欄にコメントと通話モードURLを追加
1. 保存後の自動オープン（fix_auto_open_calendar.pyで追加した部分）
2. 手動の「カレンダーで開く」ボタン
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 保存後の自動オープン部分のcalDetailsを修正
old_auto = "          const calDetails = encodeURIComponent(`売主名: ${seller?.name || ''}\\n電話: ${seller?.phoneNumber || ''}`);"
new_auto = """          const calDetails = encodeURIComponent(
            `売主名: ${seller?.name || ''}\\n` +
            `電話: ${seller?.phoneNumber || ''}\\n` +
            `\\n通話モードページ:\\n${window.location.href}\\n` +
            (seller?.comments ? `\\nコメント:\\n${seller.comments}` : '')
          );"""

if old_auto in text:
    text = text.replace(old_auto, new_auto, 1)
    print('✅ 自動オープン部分のcalDetailsを修正しました')
else:
    print('❌ 自動オープン部分が見つかりません')

# 2. 手動「カレンダーで開く」ボタンのdetailsを修正
# 現在: `売主名: ...\n住所: ...\n電話: ...\n\nGoogle Map:\n...\n\n通話モードページ:\n...\n\n訪問時注意点: ...\n\nコミュニケーション履歴...`
# 追加: コメントを「訪問時注意点」の後に追加
old_manual = "                                `訪問時注意点: ${seller.appointmentNotes || 'なし'}\\n` +\n                                `\\n` +\n                                `コミュニケーション履歴（通話した内容）:\\n${recentActivities || '履歴なし'}`"
new_manual = "                                `訪問時注意点: ${seller.appointmentNotes || 'なし'}\\n` +\n                                (seller.comments ? `\\nコメント:\\n${seller.comments}\\n` : '') +\n                                `\\n` +\n                                `コミュニケーション履歴（通話した内容）:\\n${recentActivities || '履歴なし'}`"

if old_manual in text:
    text = text.replace(old_manual, new_manual, 1)
    print('✅ 手動ボタン部分のdetailsを修正しました')
else:
    print('❌ 手動ボタン部分が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
