#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の2つのバグを修正するスクリプト

修正1: loadVisitStats の定義を useEffect より前に移動（バグ2）
修正2: handleSaveAppointment にフォールバックロジックを追加（バグ1）
"""

import re

FILE_PATH = 'frontend/frontend/src/pages/CallModePage.tsx'

# ファイルをバイナリで読み込む（エンコーディング保護）
with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: loadVisitStats の定義ブロックを useEffect より前に移動
# ============================================================

# loadVisitStats の定義ブロックを特定して抽出
load_visit_stats_pattern = r'(  // 訪問統計を取得\n  const loadVisitStats = async \(\) => \{.*?\n  \};)\n'
match = re.search(load_visit_stats_pattern, text, re.DOTALL)

if not match:
    print('ERROR: loadVisitStats の定義ブロックが見つかりませんでした')
    exit(1)

load_visit_stats_block = match.group(1)
print(f'loadVisitStats ブロックを発見: {len(load_visit_stats_block)} 文字')

# 元の位置から削除（後ろの改行も含めて削除）
text_without_block = text[:match.start()] + text[match.end():]

# useEffect（訪問統計をロード）の直前に挿入する
# ターゲット: "  // 訪問統計をロード（visitDateまたはappointmentDateがある場合）\n  useEffect(() => {"
insert_before = '  // 訪問統計をロード（visitDateまたはappointmentDateがある場合）\n  useEffect(() => {'

insert_pos = text_without_block.find(insert_before)
if insert_pos == -1:
    print('ERROR: 挿入位置（useEffect の直前）が見つかりませんでした')
    exit(1)

print(f'挿入位置を発見: 行 {text_without_block[:insert_pos].count(chr(10)) + 1}')

# 定義ブロックを挿入（後ろに改行を追加）
text_fixed1 = (
    text_without_block[:insert_pos]
    + load_visit_stats_block + '\n\n'
    + text_without_block[insert_pos:]
)

print('修正1 完了: loadVisitStats を useEffect より前に移動しました')

# ============================================================
# 修正2: handleSaveAppointment にフォールバックロジックを追加
# ============================================================

# 修正対象の古いコード（api.put の呼び出し部分）
old_api_put = '''      await api.put(`/api/sellers/${id}`, {
        appointmentDate: appointmentDateISO,
        assignedTo: editedAssignedTo || null,
        visitValuationAcquirer: editedVisitValuationAcquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
      });'''

# 修正後のコード
new_api_put = '''      // editedVisitValuationAcquirer が空の場合のフォールバック
      let acquirer = editedVisitValuationAcquirer;
      if (!acquirer && employee?.email) {
        // 1. employees ステートから検索
        const staffFromState = employees.find((emp: any) => emp.email === employee.email);
        if (staffFromState) {
          acquirer = staffFromState.initials || staffFromState.name || staffFromState.email;
        } else {
          // 2. getActiveEmployees() を呼び出して再検索
          try {
            const freshEmployees = await getActiveEmployees();
            const freshStaff = freshEmployees.find((emp) => emp.email === employee.email);
            if (freshStaff) {
              acquirer = freshStaff.initials || freshStaff.name || freshStaff.email;
            } else {
              // 3. employee.initials を使用
              acquirer = (employee as any).initials || '';
            }
          } catch {
            acquirer = (employee as any).initials || '';
          }
        }
      }

      await api.put(`/api/sellers/${id}`, {
        appointmentDate: appointmentDateISO,
        assignedTo: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
      });'''

if old_api_put not in text_fixed1:
    print('ERROR: handleSaveAppointment 内の api.put 呼び出しが見つかりませんでした')
    exit(1)

text_fixed2 = text_fixed1.replace(old_api_put, new_api_put, 1)
print('修正2 完了: handleSaveAppointment にフォールバックロジックを追加しました')

# ============================================================
# ファイルに書き込む（BOMなし UTF-8）
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text_fixed2.encode('utf-8'))

print(f'\n✅ {FILE_PATH} を正常に更新しました')

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  WARNING: BOM が検出されました')
else:
    print('✅ BOMなし UTF-8 で保存されました')
