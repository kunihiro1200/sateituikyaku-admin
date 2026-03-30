# -*- coding: utf-8 -*-
"""
Task 3.1: Fix for 営担列の同期バグ

このスクリプトはGASコード（gas_complete_code.js）を修正します。
日本語を含むため、Pythonスクリプトで編集し、UTF-8エンコーディングを保持します。

修正内容:
1. rowToObject関数: ヘッダー名を正規化（trim処理）
2. syncUpdatesToSupabase_関数: visit_assigneeの比較ロジック修正
"""

import re

# gas_complete_code.jsを読み込む（UTF-8）
with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: rowToObject関数のヘッダー名正規化
# ============================================================
# 修正前:
#   if (headers[j] === '') continue;
#   var val = rowData[j];
#   ...
#   obj[headers[j]] = val;
#
# 修正後:
#   var headerName = String(headers[j]).trim();
#   if (headerName === '') continue;
#   var val = rowData[j];
#   ...
#   obj[headerName] = val;

old_rowToObject = '''function rowToObject(headers, rowData) {
  var obj = {};
  // 反響詳細日時は時刻情報が必要なため、Dateオブジェクトをそのまま保持する列
  var datetimeColumns = { '反響詳細日時': true };
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headers[j]] = '';
      } else if (datetimeColumns[headers[j]]) {
        // 日時列はDateオブジェクトをそのまま保持（syncUpdatesToSupabase_でtoISOString()する）
        obj[headers[j]] = val;
      } else {
        obj[headers[j]] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      obj[headers[j]] = val;
    }
  }
  return obj;
}'''

new_rowToObject = '''function rowToObject(headers, rowData) {
  var obj = {};
  // 反響詳細日時は時刻情報が必要なため、Dateオブジェクトをそのまま保持する列
  var datetimeColumns = { '反響詳細日時': true };
  for (var j = 0; j < headers.length; j++) {
    // ヘッダー名を正規化（trim処理）
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else if (datetimeColumns[headerName]) {
        // 日時列はDateオブジェクトをそのまま保持（syncUpdatesToSupabase_でtoISOString()する）
        obj[headerName] = val;
      } else {
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      obj[headerName] = val;
    }
  }
  return obj;
}'''

text = text.replace(old_rowToObject, new_rowToObject)

# ============================================================
# 修正2: syncUpdatesToSupabase_関数のvisit_assignee比較ロジック修正
# ============================================================
# 修正前:
#   var rawVisitAssignee = row['営担'];
#   var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
#   if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
#
# 修正後:
#   var rawVisitAssignee = row['営担'];
#   // undefinedとnullの両方を正しく処理
#   var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
#   // 両方をnullに正規化してから比較
#   var dbVisitAssignee = dbSeller.visit_assignee || null;
#   if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }

old_visit_assignee_logic = '''    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }'''

new_visit_assignee_logic = '''    var rawVisitAssignee = row['営担'];
    // undefinedとnullの両方を正しく処理
    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
    // 両方をnullに正規化してから比較
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }'''

text = text.replace(old_visit_assignee_logic, new_visit_assignee_logic)

# ============================================================
# 修正3: syncVisitDateSellers関数のvisit_assignee比較ロジック修正
# ============================================================
# syncVisitDateSellers関数にも同じロジックがあるため、同様に修正

old_visit_assignee_logic_2 = '''    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }'''

new_visit_assignee_logic_2 = '''    var rawVisitAssignee = row['営担'];
    // undefinedとnullの両方を正しく処理
    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
    // 両方をnullに正規化してから比較
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }'''

text = text.replace(old_visit_assignee_logic_2, new_visit_assignee_logic_2)

# ============================================================
# 修正4: syncSellerNow関数のvisit_assignee比較ロジック修正
# ============================================================
# syncSellerNow関数にも同じロジックがあるため、同様に修正

old_visit_assignee_logic_3 = '''  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);'''

new_visit_assignee_logic_3 = '''  var rawVisitAssignee = rowObj['営担'];
  // undefinedとnullの両方を正しく処理
  updateData.visit_assignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);'''

text = text.replace(old_visit_assignee_logic_3, new_visit_assignee_logic_3)

# ============================================================
# 修正後のファイルを保存（UTF-8、BOMなし）
# ============================================================
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ gas_complete_code.js を修正しました')
print('')
print('修正内容:')
print('1. rowToObject関数: ヘッダー名を正規化（trim処理）')
print('2. syncUpdatesToSupabase_関数: visit_assigneeの比較ロジック修正')
print('3. syncVisitDateSellers関数: visit_assigneeの比較ロジック修正')
print('4. syncSellerNow関数: visit_assigneeの比較ロジック修正')
print('')
print('次のステップ:')
print('1. gas_complete_code.js をGASスクリプトエディタにコピー＆ペースト')
print('2. GASスクリプトを保存')
print('3. AA12497で動作確認')
