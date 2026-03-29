#!/usr/bin/env python3
# 訪問予約保存時のタイムゾーン問題を修正
# datetime-local値をUTCに変換せず、visit_date/visit_timeとして直接送信する

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleSaveAppointmentの送信部分を修正
# appointmentDateISO（UTC変換）の代わりに、visit_date/visit_timeを直接送信
old_save = """      // datetime-localの値をISO形式に変換
      const appointmentDateISO = editedAppointmentDate 
        ? new Date(editedAppointmentDate).toISOString() 
        : null;

      console.log('Saving appointment:', {
        appointmentDate: appointmentDateISO,
        assignedTo: editedAssignedTo,
        visitValuationAcquirer: editedVisitValuationAcquirer,
        appointmentNotes: editedAppointmentNotes,
      });

      // editedVisitValuationAcquirer が空の場合のフォールバック"""

new_save = """      // datetime-localの値からvisit_date（YYYY-MM-DD）とvisit_time（HH:mm:ss）を抽出
      // タイムゾーン変換せずローカル時刻のまま使用
      let visitDateStr: string | null = null;
      let visitTimeStr: string | null = null;
      if (editedAppointmentDate) {
        // editedAppointmentDate は "YYYY-MM-DDTHH:mm" 形式
        const [datePart, timePart] = editedAppointmentDate.split('T');
        visitDateStr = datePart; // YYYY-MM-DD
        visitTimeStr = timePart ? `${timePart}:00` : '00:00:00'; // HH:mm:ss
      }

      console.log('Saving appointment:', {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo,
        visitValuationAcquirer: editedVisitValuationAcquirer,
        appointmentNotes: editedAppointmentNotes,
      });

      // editedVisitValuationAcquirer が空の場合のフォールバック"""

if old_save in text:
    text = text.replace(old_save, new_save)
    print('✅ handleSaveAppointmentの変換部分を修正しました')
else:
    print('❌ 対象テキストが見つかりません')

# api.putの送信内容を修正
old_put = """      await api.put(`/api/sellers/${id}`, {
        appointmentDate: appointmentDateISO,
        assignedTo: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
      });"""

new_put = """      await api.put(`/api/sellers/${id}`, {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
      });"""

if old_put in text:
    text = text.replace(old_put, new_put)
    print('✅ api.putの送信内容を修正しました')
else:
    print('❌ api.putの対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
