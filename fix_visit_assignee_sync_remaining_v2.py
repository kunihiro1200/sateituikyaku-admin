# -*- coding: utf-8 -*-
"""
営担（visit_assignee）同期バグ修正スクリプト（残り2箇所）

修正箇所:
1. syncVisitDateSellers関数（663-664行目）
2. syncSellerNow関数（429行目）
"""

# gas_complete_code.jsを読み込む（UTF-8）
with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: syncVisitDateSellers関数内（663-664行目）
# 修正前のコード（正確な文字列）
old_code_1 = """    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;"""

# 修正後のコード
new_code_1 = """    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;"""

# 修正2: syncSellerNow関数内（429行目）
# 修正前のコード（正確な文字列）
old_code_2 = """  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);"""

# 修正後のコード
new_code_2 = """  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);
  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);"""

# 修正を適用
count = 0
if old_code_1 in text:
    text = text.replace(old_code_1, new_code_1)
    print('✅ syncVisitDateSellers関数内の修正完了（663-664行目）')
    count += 1
else:
    print('⚠️ syncVisitDateSellers関数内の修正対象が見つかりません')

if old_code_2 in text:
    text = text.replace(old_code_2, new_code_2)
    print('✅ syncSellerNow関数内の修正完了（429行目）')
    count += 1
else:
    print('⚠️ syncSellerNow関数内の修正対象が見つかりません')

# UTF-8で書き込む（BOMなし）
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'\n✅ gas_complete_code.js の修正完了（{count}/2箇所）')
print('')
print('次のステップ:')
print('1. gas_complete_code.js をGASスクリプトエディタにコピー＆ペースト')
print('2. GASスクリプトを保存')
print('3. AA12497で動作確認（スプレッドシートの「営担」列に値が入っている売主でテスト）')
print('4. 10分後にDBを確認して visit_assignee が正しく反映されているか確認')
