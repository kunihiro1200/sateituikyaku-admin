#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
frontend/frontend/src/types/index.ts の Seller インターフェースに
担当者設定フィールドを追加するスクリプト
"""

with open('frontend/frontend/src/types/index.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# cancelNoticeAssignee は既に存在するので、その後に6フィールドを追加する
# 「// その他」セクションの cancelNoticeAssignee の後に追加

old_str = '  // その他\n  cancelNoticeAssignee?: string;\n  exclusiveScript?: string;'
new_str = (
    '  // その他\n'
    '  cancelNoticeAssignee?: string;\n'
    '  // 担当者設定フィールド（call-mode-assignee-section）\n'
    '  unreachableSmsAssignee?: string;       // 不通時Sメール担当\n'
    '  valuationSmsAssignee?: string;         // 査定Sメール担当\n'
    '  valuationReasonEmailAssignee?: string; // 査定理由別３後Eメ担\n'
    '  valuationReason?: string;              // 査定理由（AO列）\n'
    '  longTermEmailAssignee?: string;        // 除外前、長期客メール担当\n'
    '  callReminderEmailAssignee?: string;    // 当社が電話したというリマインドメール担当\n'
    '  exclusiveScript?: string;'
)

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ フィールドを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    print('--- 検索対象 ---')
    print(repr(old_str))
    # デバッグ用: cancelNoticeAssignee 周辺を表示
    idx = text.find('cancelNoticeAssignee')
    if idx >= 0:
        print('--- cancelNoticeAssignee 周辺 ---')
        print(repr(text[idx-50:idx+100]))
    exit(1)

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/types/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# 確認
with open('frontend/frontend/src/types/index.ts', 'rb') as f:
    check = f.read()
check_text = check.decode('utf-8')
if 'unreachableSmsAssignee' in check_text and 'callReminderEmailAssignee' in check_text:
    print('✅ フィールドが正しく追加されています')
else:
    print('❌ フィールドの追加に失敗しました')
