#!/usr/bin/env python3
# visit_dateをnew Date()で変換せず文字列のまま使用するよう修正

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 編集モード開始時のvisitDate初期化を修正
old_init = """                      // visitDateとvisitTimeがあればそれを使用、なければappointmentDateを使用
                      let appointmentDateLocal = '';
                      if (seller?.visitDate) {
                        // visitDateとvisitTimeから日時を構築
                        const visitDateObj = new Date(seller.visitDate);
                        const dateStr = visitDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
                        const timeStr = seller.visitTime || '00:00:00';
                        const timeOnly = timeStr.substring(0, 5); // HH:mm
                        appointmentDateLocal = `${dateStr}T${timeOnly}`;
                      } else if (seller?.appointmentDate) {
                        // ローカル時刻でdatetime-local形式に変換（toISOStringはUTCを返すため）
                        const d = new Date(seller.appointmentDate);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        appointmentDateLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      }"""

new_init = """                      // visitDateとvisitTimeがあればそれを使用（文字列のまま、タイムゾーン変換なし）
                      let appointmentDateLocal = '';
                      if (seller?.visitDate) {
                        // visit_date は YYYY-MM-DD 形式の文字列
                        const dateStr = typeof seller.visitDate === 'string'
                          ? seller.visitDate.split('T')[0]  // Date型の場合も考慮
                          : (seller.visitDate as any).toISOString().split('T')[0];
                        const timeStr = seller.visitTime || '00:00';
                        const timeOnly = timeStr.substring(0, 5); // HH:mm
                        appointmentDateLocal = `${dateStr}T${timeOnly}`;
                      } else if (seller?.appointmentDate) {
                        // appointmentDateはUTCなのでローカル時刻に変換
                        const d = new Date(seller.appointmentDate);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        appointmentDateLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      }"""

if old_init in text:
    text = text.replace(old_init, new_init)
    print('✅ 編集モード開始時の初期化を修正しました')
else:
    print('❌ 対象テキストが見つかりません')

# キャンセル時の初期化も修正（visitDateを優先）
old_cancel = """                      // ローカル時刻でdatetime-local形式に変換
                      const toLocalDateTimeStr = (dateStr: string) => {
                        const d = new Date(dateStr);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      };
                      const appointmentDateLocal = seller?.appointmentDate 
                        ? toLocalDateTimeStr(seller.appointmentDate)
                        : '';
                      setEditedAppointmentDate(appointmentDateLocal);
                      setEditedAssignedTo(seller?.assignedTo || '');"""

new_cancel = """                      // キャンセル時: visitDateを優先、なければappointmentDateを使用
                      let cancelDateLocal = '';
                      if (seller?.visitDate) {
                        const dateStr = typeof seller.visitDate === 'string'
                          ? seller.visitDate.split('T')[0]
                          : (seller.visitDate as any).toISOString().split('T')[0];
                        const timeStr = seller.visitTime || '00:00';
                        cancelDateLocal = `${dateStr}T${timeStr.substring(0, 5)}`;
                      } else if (seller?.appointmentDate) {
                        const d = new Date(seller.appointmentDate);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        cancelDateLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      }
                      setEditedAppointmentDate(cancelDateLocal);
                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');"""

if old_cancel in text:
    text = text.replace(old_cancel, new_cancel)
    print('✅ キャンセル時の初期化を修正しました')
else:
    print('❌ キャンセル時の対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
