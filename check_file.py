#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# owned_home_hearing の周辺を確認
idx = text.find('owned_home_hearing')
chunk = text[idx-5:idx+200]
print("=== owned_home_hearing context ===")
print(repr(chunk))

# viewing_notes の周辺を確認
vn_idx = text.find('viewing_notes')
chunk2 = text[vn_idx-100:vn_idx+100]
print("=== viewing_notes context ===")
print(repr(chunk2))

# 置換対象文字列の確認
old_section = "      { key: 'owned_home_hearing', label: '\u6301\u5bb6\u30d2\u30a2\u30ea\u30f3\u30b0', inlineEditable: true },\n      // viewing_notes \u306f PropertyInfoCard \u5185\u306b\u79fb\u52d5"
print("=== old_section found:", old_section in text)

# broker_end の確認
old_broker_end = "                    // \u305d\u306e\u4ed6\u306e\u30d5\u30a3\u30fc\u30eb\u30c9\n                    const handleFieldSave = async (newValue: any) => {"
print("=== old_broker_end found:", old_broker_end in text)
