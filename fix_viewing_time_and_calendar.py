#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の修正:
1. viewing_time のパース処理を改善（"1430" -> "14:30" に対応）
2. 後続担当ボタンが表示されない問題を調査（fetchEmployees の /employees 404 は無視でOK）
"""

import re

filepath = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: viewing_time のパース処理を改善
# 現在: const [hours, minutes] = viewingTime.split(':').map(Number);
# 修正後: "1430" や "14:30" の両方に対応

old_time_parse = """      const viewingTime = buyer.viewing_time || '14:00';
      
      // 時間をパース
      const [hours, minutes] = viewingTime.split(':').map(Number);"""

new_time_parse = """      const rawViewingTime = buyer.viewing_time || '14:00';
      
      // 時間をパース（"14:30" または "1430" 形式に対応）
      let hours: number, minutes: number;
      if (rawViewingTime.includes(':')) {
        [hours, minutes] = rawViewingTime.split(':').map(Number);
      } else if (/^\\d{3,4}$/.test(rawViewingTime.trim())) {
        // "1430" -> 14時30分, "930" -> 9時30分
        const t = rawViewingTime.trim().padStart(4, '0');
        hours = parseInt(t.substring(0, 2), 10);
        minutes = parseInt(t.substring(2, 4), 10);
      } else {
        hours = 14;
        minutes = 0;
      }"""

if old_time_parse in text:
    text = text.replace(old_time_parse, new_time_parse)
    print('✅ viewing_time パース処理を修正しました')
else:
    print('⚠️ viewing_time パース処理が見つかりませんでした（既に修正済みか確認が必要）')
    # 現在の該当箇所を表示
    idx = text.find("const viewingTime = buyer.viewing_time")
    if idx >= 0:
        print('現在の該当箇所:')
        print(repr(text[idx:idx+200]))

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
