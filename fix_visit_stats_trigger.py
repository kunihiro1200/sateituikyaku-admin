#!/usr/bin/env python3
# editingAppointmentをuseEffectの依存配列から外し、
# 編集ボタンを押した時に直接loadVisitStatsを呼ぶよう修正

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: useEffectからeditingAppointmentを外す
old_effect = '''  // 訪問統計をロード（訪問予約フォームを開いた時、またはvisitDate/appointmentDateがある場合）
  useEffect(() => {
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (editingAppointment || visitDateValue) {
      loadVisitStats();
    }
  }, [editingAppointment, (seller as any)?.visitDate, seller?.appointmentDate]);'''

new_effect = '''  // 訪問統計をロード（visitDate/appointmentDateがある場合）
  useEffect(() => {
    const visitDateValue = (seller as any)?.visitDate || seller?.appointmentDate;
    if (visitDateValue) {
      loadVisitStats();
    }
  }, [(seller as any)?.visitDate, seller?.appointmentDate]);'''

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print('✅ useEffectを修正しました')
else:
    print('❌ useEffectの対象テキストが見つかりません')

# 修正2: 編集ボタンを押した時にloadVisitStatsを呼ぶ
# setEditingAppointment(!editingAppointment) の直前に loadVisitStats() を追加
# 編集ボタンのonClickハンドラを探す
old_toggle = '''                    setEditingAppointment(!editingAppointment);'''

# このパターンが複数ある可能性があるので、前後のコンテキストで特定する
# 編集ボタンのクリックハンドラ内にある箇所を探す
import re

# setEditingAppointment(!editingAppointment) の前後を確認
count = text.count(old_toggle)
print(f'setEditingAppointment(!editingAppointment) の出現回数: {count}')

# 編集ボタンのonClickで、setEditedAssignedToの後にsetEditingAppointmentが来る箇所を修正
old_click = '''                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');
                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');
                    setEditingAppointment(!editingAppointment);'''

new_click = '''                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');
                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');
                    setEditingAppointment(!editingAppointment);
                    // 訪問予約フォームを開いた時に当月の統計をロード
                    if (!editingAppointment) {
                      loadVisitStats();
                    }'''

if old_click in text:
    text = text.replace(old_click, new_click)
    print('✅ 編集ボタンのonClickにloadVisitStatsを追加しました')
else:
    print('❌ 編集ボタンのonClickの対象テキストが見つかりません')
    # 別のパターンを試す
    old_click2 = '''                      setEditedAssignedTo(seller?.assignedTo || '');
                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');
                    setEditingAppointment(!editingAppointment);'''
    if old_click2 in text:
        new_click2 = '''                      setEditedAssignedTo(seller?.assignedTo || '');
                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');
                    setEditingAppointment(!editingAppointment);
                    // 訪問予約フォームを開いた時に当月の統計をロード
                    if (!editingAppointment) {
                      loadVisitStats();
                    }'''
        text = text.replace(old_click2, new_click2)
        print('✅ 編集ボタンのonClick（パターン2）にloadVisitStatsを追加しました')
    else:
        print('❌ パターン2も見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
