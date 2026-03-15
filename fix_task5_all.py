#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task5の3つの修正:
1. PriceSection.tsx: コピーボタンを全角数字に変更
2. PropertyReportPage.tsx: 報告担当ToggleButtonラベルをイニシャルに戻す
3. EmailTemplateService.ts: <<担当名（営業）名前>> を staffInfo.name（姓名）に変更
"""

import os

# ===== 1. PriceSection.tsx: コピーを全角数字に =====
price_section_path = 'frontend/frontend/src/components/PriceSection.tsx'
with open(price_section_path, 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = "await navigator.clipboard.writeText(String(monthlyPayment));"
new = "await navigator.clipboard.writeText(toFullWidth(monthlyPayment));"

if old in text:
    text = text.replace(old, new)
    print(f"[1] PriceSection.tsx: コピーを全角数字に変更 ✓")
else:
    print(f"[1] PriceSection.tsx: 対象文字列が見つかりません（既に修正済み？）")

with open(price_section_path, 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 2. PropertyReportPage.tsx: ToggleButtonラベルをイニシャルに =====
report_page_path = 'frontend/frontend/src/pages/PropertyReportPage.tsx'
with open(report_page_path, 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = "                {getFullName(initial)}"
new = "                {initial}"

if old in text:
    text = text.replace(old, new)
    print(f"[2] PropertyReportPage.tsx: ToggleButtonラベルをイニシャルに変更 ✓")
else:
    print(f"[2] PropertyReportPage.tsx: 対象文字列が見つかりません（既に修正済み？）")

with open(report_page_path, 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 3. EmailTemplateService.ts: <<担当名（営業）名前>> を staffInfo.name に =====
email_service_path = 'backend/src/services/EmailTemplateService.ts'
with open(email_service_path, 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = "    // <<担当名（営業）名前>> → sales_assignee\n    result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');"
new = "    // <<担当名（営業）名前>> → staffInfo.name（姓名）\n    result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || property['sales_assignee'] || '');"

if old in text:
    text = text.replace(old, new)
    print(f"[3] EmailTemplateService.ts: <<担当名（営業）名前>> を staffInfo.name に変更 ✓")
else:
    print(f"[3] EmailTemplateService.ts: 対象文字列が見つかりません")
    # 別パターンを試す
    old2 = "result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');"
    new2 = "result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || property['sales_assignee'] || '');"
    if old2 in text:
        text = text.replace(old2, new2)
        print(f"[3] EmailTemplateService.ts: 別パターンで変更 ✓")
    else:
        print(f"[3] EmailTemplateService.ts: 変更できませんでした")

with open(email_service_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n全修正完了")
