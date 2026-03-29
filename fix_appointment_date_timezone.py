#!/usr/bin/env python3
# 訪問予定日時の編集フォームでタイムゾーンずれを修正
# toISOString()はUTCを返すので、ローカル時刻に変換する

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# toLocalISOStringヘルパー関数を追加するのではなく、
# 既存のappointmentDateLocal計算を修正する

# キャンセル時の初期化（UTC問題）
old_cancel = """                      const appointmentDateLocal = seller?.appointmentDate 
                        ? new Date(seller.appointmentDate).toISOString().slice(0, 16)
                        : '';
                      setEditedAppointmentDate(appointmentDateLocal);
                      setEditedAssignedTo(seller?.assignedTo || '');"""

new_cancel = """                      // ローカル時刻でdatetime-local形式に変換
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

if old_cancel in text:
    text = text.replace(old_cancel, new_cancel)
    print('✅ キャンセル時の初期化を修正しました')
else:
    print('❌ キャンセル時の対象テキストが見つかりません')

# 編集モード開始時のappointmentDate変換（UTC問題）
old_edit = """                      } else if (seller?.appointmentDate) {
                        appointmentDateLocal = new Date(seller.appointmentDate).toISOString().slice(0, 16);
                      }"""

new_edit = """                      } else if (seller?.appointmentDate) {
                        // ローカル時刻でdatetime-local形式に変換（toISOStringはUTCを返すため）
                        const d = new Date(seller.appointmentDate);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        appointmentDateLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      }"""

if old_edit in text:
    text = text.replace(old_edit, new_edit)
    print('✅ 編集モード開始時の変換を修正しました')
else:
    print('❌ 編集モード開始時の対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
