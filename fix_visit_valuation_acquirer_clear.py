#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問査定取得者クリアバグの修正
- 編集開始時の元の値を保持するstateを追加
- フォールバックロジックを「元の値がnull/undefinedの場合のみ」に限定
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. state宣言に originalVisitValuationAcquirer を追加
old_state = "  const [editedVisitValuationAcquirer, setEditedVisitValuationAcquirer] = useState<string>(''); // 訪問査定取得者"
new_state = "  const [editedVisitValuationAcquirer, setEditedVisitValuationAcquirer] = useState<string>(''); // 訪問査定取得者\n  const [originalVisitValuationAcquirer, setOriginalVisitValuationAcquirer] = useState<string | null>(null); // 編集開始時の元の値（nullは未設定、''はクリア済み）"

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('✅ state宣言を追加しました')
else:
    print('❌ state宣言が見つかりません')

# 2. 編集開始時に originalVisitValuationAcquirer を保存（sellerData から初期化する箇所）
old_init = "      setEditedVisitValuationAcquirer(sellerData.visitValuationAcquirer || '');\n      setEditedAppointmentNotes(sellerData.appointmentNotes || '');"
new_init = "      setEditedVisitValuationAcquirer(sellerData.visitValuationAcquirer || '');\n      setOriginalVisitValuationAcquirer(sellerData.visitValuationAcquirer ?? null); // 元の値を保存（nullは未設定）\n      setEditedAppointmentNotes(sellerData.appointmentNotes || '');"

if old_init in text:
    text = text.replace(old_init, new_init, 1)
    print('✅ 編集開始時の初期化を追加しました（sellerData）')
else:
    print('❌ 編集開始時の初期化（sellerData）が見つかりません')

# 3. フォールバックロジックを修正
# 「元の値がnull/undefinedの場合のみ」自動設定するように変更
old_fallback = """      // editedVisitValuationAcquirer が空の場合のフォールバック
      let acquirer = editedVisitValuationAcquirer;
      if (!acquirer && employee?.email) {"""

new_fallback = """      // editedVisitValuationAcquirer が空の場合のフォールバック
      // 重要: originalVisitValuationAcquirer が null/undefined の場合（新規設定）のみ自動設定
      // ユーザーが意図的にクリアした場合（元の値があって空にした）はフォールバックしない
      let acquirer = editedVisitValuationAcquirer;
      const isNewAppointment = originalVisitValuationAcquirer === null || originalVisitValuationAcquirer === undefined;
      if (!acquirer && isNewAppointment && employee?.email) {"""

if old_fallback in text:
    text = text.replace(old_fallback, new_fallback, 1)
    print('✅ フォールバックロジックを修正しました')
else:
    print('❌ フォールバックロジックが見つかりません')

# 4. キャンセル時の初期化（seller?.visitValuationAcquirer || '' の箇所）も originalVisitValuationAcquirer を設定
# 4208行目付近: setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');
# これが2箇所あるので両方対応

# キャンセル時の初期化（1箇所目）
old_cancel1 = "                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');\n                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');\n                      setEditedAppointmentNotes(seller?.appointmentNotes || '');\n                    } else {"
new_cancel1 = "                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');\n                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');\n                      setOriginalVisitValuationAcquirer(seller?.visitValuationAcquirer ?? null);\n                      setEditedAppointmentNotes(seller?.appointmentNotes || '');\n                    } else {"

if old_cancel1 in text:
    text = text.replace(old_cancel1, new_cancel1, 1)
    print('✅ キャンセル時の初期化（1箇所目）を追加しました')
else:
    print('❌ キャンセル時の初期化（1箇所目）が見つかりません')

# キャンセル時の初期化（2箇所目）
old_cancel2 = "                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');\n                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');\n                      setEditedAppointmentNotes(seller?.appointmentNotes || '');\n                    }"
new_cancel2 = "                      setEditedAssignedTo(seller?.visitAssignee || seller?.assignedTo || '');\n                      setEditedVisitValuationAcquirer(seller?.visitValuationAcquirer || '');\n                      setOriginalVisitValuationAcquirer(seller?.visitValuationAcquirer ?? null);\n                      setEditedAppointmentNotes(seller?.appointmentNotes || '');\n                    }"

if old_cancel2 in text:
    text = text.replace(old_cancel2, new_cancel2, 1)
    print('✅ キャンセル時の初期化（2箇所目）を追加しました')
else:
    print('❌ キャンセル時の初期化（2箇所目）が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 修正完了')
