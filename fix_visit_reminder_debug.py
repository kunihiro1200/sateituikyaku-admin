#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問前日メールのデバッグログを追加 - 実際の値を確認する
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = """    // 訪問日時
    // appointmentDate: TIMESTAMPTZ（"YYYY-MM-DDTHH:mm:ss.sssZ" UTC形式）→ new Date() で JST に変換
    // ただし古いデータが "YYYY-MM-DD HH:mm:ss" 形式（タイムゾーンなし）の場合は parseVisitDateToLocal を使用
    if (seller.appointmentDate) {"""

new_code = """    // 訪問日時
    // appointmentDate: TIMESTAMPTZ（"YYYY-MM-DDTHH:mm:ss.sssZ" UTC形式）→ new Date() で JST に変換
    // ただし古いデータが "YYYY-MM-DD HH:mm:ss" 形式（タイムゾーンなし）の場合は parseVisitDateToLocal を使用
    console.log('[visitReminder DEBUG] appointmentDate raw:', JSON.stringify(seller.appointmentDate));
    console.log('[visitReminder DEBUG] visitDate raw:', JSON.stringify(seller.visitDate));
    console.log('[visitReminder DEBUG] visitTime raw:', JSON.stringify(seller.visitTime));
    if (seller.appointmentDate) {"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ デバッグログを追加しました')
else:
    print('❌ 対象箇所が見つかりませんでした')
    idx = text.find('// 訪問日時')
    if idx >= 0:
        print(repr(text[idx:idx+200]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
