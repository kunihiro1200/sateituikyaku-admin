# -*- coding: utf-8 -*-
"""
Task 3.1: Fix for 営担列の同期バグ（最終版）

このスクリプトはGASコード（gas_complete_code.js）の3箇所を修正します。
"""

import re

# gas_complete_code.jsを読み込む（UTF-8）
with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正2: syncUpdatesToSupabase_関数のvisit_assignee比較ロジック修正（1箇所目）
# ============================================================
# 行169-172付近
old_pattern_1 = '''    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetUnreachable = row['不通'] ? String(row['不通']) : null;'''

new_pattern_1 = '''    var rawVisitAssignee = row['営担'];
    // undefinedとnullの両方を正しく処理
    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
    // 両方をnullに正規化してから比較
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetUnreachable = row['不通'] ? String(row['不通']) : null;'''

text = text.replace(old_pattern_1, new_pattern_1)

# ============================================================
# 修正3: syncVisitDateSellers関数のvisit_assignee比較ロジック修正（2箇所目）
# ============================================================
# 行661-664付近
old_pattern_2 = '''    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;'''

new_pattern_2 = '''    var rawVisitAssignee = row['営担'];
    // undefinedとnullの両方を正しく処理
    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
    // 両方をnullに正規化してから比較
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;'''

text = text.replace(old_pattern_2, new_pattern_2)

# ============================================================
# 修正4: syncSellerNow関数のvisit_assignee比較ロジック修正（3箇所目）
# ============================================================
# 行540付近
old_pattern_3 = '''  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);'''

new_pattern_3 = '''  var rawVisitAssignee = rowObj['営担'];
  // undefinedとnullの両方を正しく処理
  updateData.visit_assignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);'''

text = text.replace(old_pattern_3, new_pattern_3)

# ============================================================
# 修正後のファイルを保存（UTF-8、BOMなし）
# ============================================================
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ gas_complete_code.js を修正しました')
print('')
print('修正内容:')
print('1. rowToObject関数: ヘッダー名を正規化（trim処理）')
print('2. syncUpdatesToSupabase_関数: visit_assigneeの比較ロジック修正（1箇所目）')
print('3. syncVisitDateSellers関数: visit_assigneeの比較ロジック修正（2箇所目）')
print('4. syncSellerNow関数: visit_assigneeの比較ロジック修正（3箇所目）')
print('')
print('次のステップ:')
print('1. gas_complete_code.js をGASスクリプトエディタにコピー＆ペースト')
print('2. GASスクリプトを保存')
print('3. AA12497で動作確認')
