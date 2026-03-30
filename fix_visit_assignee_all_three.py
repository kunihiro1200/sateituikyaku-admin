# -*- coding: utf-8 -*-
"""
営担（visit_assignee）同期バグ修正スクリプト（全3箇所）

修正箇所:
1. syncUpdatesToSupabase_関数（172-174行目）
2. syncSellerNow関数（429行目）
3. syncVisitDateSellers関数（664-666行目）
"""

# gas_complete_code.jsを読み込む（UTF-8）
with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 各箇所を個別に修正（行番号で特定）
lines = text.split('\n')

# 修正1: 172-174行目（syncUpdatesToSupabase_関数）
# 172行目: var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
# 174行目: if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
if 171 < len(lines) and "var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined)" in lines[172]:
    lines[172] = "    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);"
    # 173行目に新しい行を挿入
    lines.insert(173, "    var dbVisitAssignee = dbSeller.visit_assignee || null;")
    # 174行目（元の173行目）を修正
    if "if (sheetVisitAssignee !== (dbSeller.visit_assignee || null))" in lines[174]:
        lines[174] = "    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }"
    print('✅ syncUpdatesToSupabase_関数内の修正完了（172-174行目）')
else:
    print('⚠️ syncUpdatesToSupabase_関数内の修正対象が見つかりません（172行目）')

# 修正2: 429行目（syncSellerNow関数）
# updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
if 428 < len(lines) and "updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined)" in lines[429]:
    lines[429] = "  updateData.visit_assignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);"
    print('✅ syncSellerNow関数内の修正完了（429行目）')
else:
    print('⚠️ syncSellerNow関数内の修正対象が見つかりません（429行目）')

# 修正3: 664-666行目（syncVisitDateSellers関数）
# 664行目: var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
# 666行目: if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
if 663 < len(lines) and "var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined)" in lines[664]:
    lines[664] = "    var sheetVisitAssignee = (!rawVisitAssignee || rawVisitAssignee === '外す') ? null : String(rawVisitAssignee);"
    # 665行目に新しい行を挿入
    lines.insert(665, "    var dbVisitAssignee = dbSeller.visit_assignee || null;")
    # 666行目（元の665行目）を修正
    if "if (sheetVisitAssignee !== (dbSeller.visit_assignee || null))" in lines[666]:
        lines[666] = "    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }"
    print('✅ syncVisitDateSellers関数内の修正完了（664-666行目）')
else:
    print('⚠️ syncVisitDateSellers関数内の修正対象が見つかりません（664行目）')

# 修正後のテキストを結合
text = '\n'.join(lines)

# UTF-8で書き込む（BOMなし）
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ gas_complete_code.js の修正完了（全3箇所）')
print('')
print('次のステップ:')
print('1. gas_complete_code.js をGASスクリプトエディタにコピー＆ペースト')
print('2. GASスクリプトを保存')
print('3. AA12497で動作確認（スプレッドシートの「営担」列に値が入っている売主でテスト）')
print('4. 10分後にDBを確認して visit_assignee が正しく反映されているか確認')
