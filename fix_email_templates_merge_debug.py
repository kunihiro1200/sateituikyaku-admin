#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
emailTemplates.ts の /property/merge エンドポイントにデバッグ情報を追加
"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# staffInfo のデバッグ情報をレスポンスに追加
old = """    res.json({ subject: mergedSubject, body: mergedBody, sellerName });"""

new = """    res.json({ subject: mergedSubject, body: mergedBody, sellerName, _debug: { salesAssignee: salesAssignee, staffInfoFound: !!staffInfo, staffPhone: staffInfo?.phone || null, staffEmail: staffInfo?.email || null, staffHoliday: staffInfo?.regularHoliday || null } });"""

if old in text:
    text = text.replace(old, new)
    print('✅ デバッグ情報をレスポンスに追加しました')
else:
    print('❌ 対象箇所が見つかりませんでした')
    idx = text.find('res.json({ subject: mergedSubject')
    print(f'  位置: {idx}')
    if idx > 0:
        print(f'  前後: {repr(text[idx-50:idx+100])}')

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
