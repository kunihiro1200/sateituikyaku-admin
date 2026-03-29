#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問取得日の日本時間（JST）対応修正
new Date().toISOString() はUTCなので、日本時間で今日の日付を取得するよう修正
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = "        : new Date().toISOString().slice(0, 10);  // 未設定の場合は今日の日付"
new_code = "        : new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');  // 未設定の場合は今日の日付（JST）"

if old_code in text:
    text = text.replace(old_code, new_code, 1)
    print('✅ 日本時間対応に修正しました')
else:
    print('❌ 対象コードが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
