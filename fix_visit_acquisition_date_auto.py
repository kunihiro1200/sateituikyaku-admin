#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問予定日時を入力した際に訪問取得日を自動設定する修正
- visitAcquisitionDate が未設定の場合のみ、保存時に今日の日付を自動セット
- 既に設定済みの場合は上書きしない
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleSaveAppointment の API 送信部分に visitAcquisitionDate を追加
old_api_call = """      await api.put(`/api/sellers/${id}`, {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
      });"""

new_api_call = """      // 訪問取得日の自動設定: 未設定の場合のみ今日の日付をセット
      const visitAcquisitionDateToSave = seller?.visitAcquisitionDate
        ? undefined  // 既存値がある場合は送信しない（上書きしない）
        : new Date().toISOString().slice(0, 10);  // 未設定の場合は今日の日付

      await api.put(`/api/sellers/${id}`, {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
        ...(visitAcquisitionDateToSave !== undefined && { visitAcquisitionDate: visitAcquisitionDateToSave }),
      });"""

if old_api_call in text:
    text = text.replace(old_api_call, new_api_call, 1)
    print('✅ visitAcquisitionDate 自動設定を追加しました')
else:
    print('❌ API送信箇所が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
