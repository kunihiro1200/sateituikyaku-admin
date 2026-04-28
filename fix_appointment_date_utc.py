#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
appointmentDate が "2026-04-30T13:00:00+00:00" 形式の場合の修正
+00:00 はUTCオフセットなので new Date() すると JST +9時間になる
→ タイムゾーン情報を除去して直接パースする
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = """    console.log('[visitReminder DEBUG] appointmentDate raw:', JSON.stringify(seller.appointmentDate));
    console.log('[visitReminder DEBUG] visitDate raw:', JSON.stringify(seller.visitDate));
    console.log('[visitReminder DEBUG] visitTime raw:', JSON.stringify(seller.visitTime));
    if (seller.appointmentDate) {
      const apptStr = String(seller.appointmentDate);
      let apptMonth: number, apptDay: number, apptHour: number, apptMin: number;
      if (apptStr.includes('Z') || apptStr.includes('+')) {
        // UTC形式 → new Date() でJSTに変換（正しい）
        const appointmentDate = new Date(apptStr);
        apptMonth = appointmentDate.getMonth() + 1;
        apptDay = appointmentDate.getDate();
        apptHour = appointmentDate.getHours();
        apptMin = appointmentDate.getMinutes();
      } else {
        // タイムゾーンなし形式 → parseVisitDateToLocal で直接パース（UTC解釈を回避）
        const localStr = parseVisitDateToLocal(apptStr); // "YYYY-MM-DDTHH:mm"
        const [apptDatePart, apptTimePart = '00:00'] = localStr.split('T');
        const [ay, am, ad] = apptDatePart.split('-').map(Number);
        const [ah, aMin] = apptTimePart.split(':').map(Number);
        apptMonth = am; apptDay = ad; apptHour = ah; apptMin = aMin;
      }
      const dateStr = `${apptMonth}月${apptDay}日`;
      const timeStr = `${apptHour}:${String(apptMin).padStart(2, '0')}`;
      result = result.replace(/<<訪問日>>/g, dateStr);
      result = result.replace(/<<時間>>/g, timeStr);"""

new_code = """    if (seller.appointmentDate) {
      // appointmentDate は "YYYY-MM-DDTHH:mm:ss+00:00" 形式（UTC）で来る
      // new Date() でパースすると JST +9時間になるため、タイムゾーン部分を除去して直接パース
      const apptStr = String(seller.appointmentDate);
      // タイムゾーン情報（+00:00, Z, +09:00 など）を除去して "YYYY-MM-DDTHH:mm:ss" にする
      const apptStrNoTz = apptStr.replace(/([+-]\d{2}:\d{2}|Z)$/, '');
      const localStr = parseVisitDateToLocal(apptStrNoTz); // "YYYY-MM-DDTHH:mm"
      const [apptDatePart, apptTimePart = '00:00'] = localStr.split('T');
      const [, am, ad] = apptDatePart.split('-').map(Number);
      const [ah, aMin] = apptTimePart.split(':').map(Number);
      const dateStr = `${am}月${ad}日`;
      const timeStr = `${ah}:${String(aMin).padStart(2, '0')}`;
      result = result.replace(/<<訪問日>>/g, dateStr);
      result = result.replace(/<<時間>>/g, timeStr);"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 修正しました')
else:
    print('❌ 対象箇所が見つかりませんでした')
    idx = text.find('[visitReminder DEBUG]')
    if idx >= 0:
        print(repr(text[idx:idx+100]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
