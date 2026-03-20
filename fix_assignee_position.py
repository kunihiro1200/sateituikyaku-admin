# AssigneeSectionを右カラム(xs=6)の外に移動するスクリプト
# 日本語ファイルのためUTF-8で読み書き

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 右カラム内のAssigneeSectionブロックを削除（\r\n対応）
old_in_right_col = "            {/* 担当者設定セクション */}\r\n            {seller && (\r\n              <AssigneeSection\r\n                seller={seller}\r\n                onUpdate={(fields) => setSeller((prev) => prev ? {{ ...prev, ...fields }} : prev)}\r\n              />\r\n            )}\r\n\r\n            {/* 不通フィールド"

new_in_right_col = "            {/* 不通フィールド"

if old_in_right_col in text:
    text = text.replace(old_in_right_col, new_in_right_col)
    print('✅ 右カラムからAssigneeSectionを削除しました')
else:
    print('❌ 右カラムのAssigneeSectionが見つかりません')
    idx = text.find('担当者設定セクション')
    if idx >= 0:
        print(repr(text[idx-20:idx+400]))

# 右カラムの終端の後に全幅でAssigneeSectionを追加（\r\n対応）
old_after_right_col = "            {/* 実績セクション */}\r\n            <CollapsibleSection title=\"実績\" defaultExpanded={false} headerColor=\"success.light\">\r\n              <PerformanceMetricsSection />\r\n            </CollapsibleSection>\r\n          </Grid>\r\n        </Grid>"

new_after_right_col = "            {/* 実績セクション */}\r\n            <CollapsibleSection title=\"実績\" defaultExpanded={false} headerColor=\"success.light\">\r\n              <PerformanceMetricsSection />\r\n            </CollapsibleSection>\r\n          </Grid>\r\n        </Grid>\r\n\r\n        {/* 担当者設定セクション（全幅） */}\r\n        {seller && (\r\n          <Box sx={{ mt: 2 }}>\r\n            <AssigneeSection\r\n              seller={seller}\r\n              onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}\r\n            />\r\n          </Box>\r\n        )}"

if old_after_right_col in text:
    text = text.replace(old_after_right_col, new_after_right_col)
    print('✅ 全幅エリアにAssigneeSectionを追加しました')
else:
    print('❌ 右カラム終端が見つかりません')
    idx = text.find('実績セクション')
    if idx >= 0:
        print(repr(text[idx-20:idx+300]))

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
