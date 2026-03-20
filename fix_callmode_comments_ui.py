with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLFをLFに正規化して処理
text_lf = text.replace('\r\n', '\n')

# ============================================================
# 1. UIの並び替え：
#    現在: 保存ボタン → 1番電話 → コメント欄（コメントを保存ボタン付き）
#    変更後: 保存ボタン → コメント欄（ボタンなし） → 1番電話
# ============================================================

old_ui = (
    '            {/* 1番電話フィールド */}\n'
    '            <Box sx={{ mb: 2 }}>\n'
    '              <Typography variant="subtitle2" gutterBottom>\n'
    '                1番電話\n'
    '              </Typography>\n'
    '              <FormControl fullWidth size="small">\n'
    '                <Select\n'
    '                  value={editedFirstCallPerson}\n'
    '                  onChange={(e) => setEditedFirstCallPerson(e.target.value)}\n'
    '                  displayEmpty\n'
    '                  sx={{ bgcolor: \'white\' }}\n'
    '                >\n'
    '                  <MenuItem value=""><em>未選択</em></MenuItem>\n'
    '                  {activeEmployees.map((emp) => (\n'
    '                    <MenuItem key={emp.initials || emp.name} value={emp.initials || \'\'}>\n'
    '                      {emp.initials || emp.name}\n'
    '                    </MenuItem>\n'
    '                  ))}\n'
    '                </Select>\n'
    '              </FormControl>\n'
    '            </Box>\n'
    '\n'
    '            {/* コメント表示・編集エリア */}\n'
    '            <Box sx={{ mb: 2 }}>\n'
    '              <Typography variant="subtitle2" gutterBottom>\n'
    '                コメント\n'
    '              </Typography>\n'
    '              <TextField\n'
    '                multiline\n'
    '                fullWidth\n'
    '                minRows={4}\n'
    '                value={editableComments}\n'
    '                onChange={(e) => setEditableComments(e.target.value)}\n'
    '                placeholder="コメントはありません"\n'
    '                variant="outlined"\n'
    '                sx={{ bgcolor: \'white\' }}\n'
    '              />\n'
    '              <Button\n'
    '                variant="outlined"\n'
    '                size="small"\n'
    '                disabled={savingComments}\n'
    '                onClick={handleSaveComments}\n'
    '                sx={{ mt: 1 }}\n'
    '              >\n'
    '                {savingComments ? <CircularProgress size={16} /> : \'コメントを保存\'}\n'
    '              </Button>\n'
    '            </Box>'
)

new_ui = (
    '{/* コメント表示・編集エリア（新規コメント保存時に自動更新） */}\n'
    '            <Box sx={{ mb: 2 }}>\n'
    '              <Typography variant="subtitle2" gutterBottom>\n'
    '                コメント\n'
    '              </Typography>\n'
    '              <TextField\n'
    '                multiline\n'
    '                fullWidth\n'
    '                minRows={4}\n'
    '                value={editableComments}\n'
    '                onChange={(e) => setEditableComments(e.target.value)}\n'
    '                placeholder="コメントはありません"\n'
    '                variant="outlined"\n'
    '                sx={{ bgcolor: \'white\' }}\n'
    '              />\n'
    '            </Box>\n'
    '\n'
    '            {/* 1番電話フィールド */}\n'
    '            <Box sx={{ mb: 2 }}>\n'
    '              <Typography variant="subtitle2" gutterBottom>\n'
    '                1番電話\n'
    '              </Typography>\n'
    '              <FormControl fullWidth size="small">\n'
    '                <Select\n'
    '                  value={editedFirstCallPerson}\n'
    '                  onChange={(e) => setEditedFirstCallPerson(e.target.value)}\n'
    '                  displayEmpty\n'
    '                  sx={{ bgcolor: \'white\' }}\n'
    '                >\n'
    '                  <MenuItem value=""><em>未選択</em></MenuItem>\n'
    '                  {activeEmployees.map((emp) => (\n'
    '                    <MenuItem key={emp.initials || emp.name} value={emp.initials || \'\'}>\n'
    '                      {emp.initials || emp.name}\n'
    '                    </MenuItem>\n'
    '                  ))}\n'
    '                </Select>\n'
    '              </FormControl>\n'
    '            </Box>'
)

if old_ui in text_lf:
    text_lf = text_lf.replace(old_ui, new_ui)
    print('✅ UI並び替え・コメント保存ボタン削除完了')
else:
    print('❌ UI: 対象が見つかりません')
    # デバッグ: 部分一致を確認
    if 'コメントを保存' in text_lf:
        idx = text_lf.find('コメントを保存')
        print('  コメントを保存 周辺:', repr(text_lf[idx-300:idx+50]))

# ============================================================
# 2. handleSaveCallMemoでloadAllData()の前にsetEditableComments追加
#    （loadAllDataが非同期なので、先に即時反映する）
# ============================================================

old_memo = (
    '      // 成功メッセージ\n'
    "      setSuccessMessage('コメントを保存しました');\n"
    '\n'
    '      // 通話メモ入力欄をクリア\n'
    "      setCallMemo('');\n"
    '\n'
    '      // ページをリロード（最新のコメントを表示）\n'
    '      await loadAllData();'
)

new_memo = (
    '      // コメント欄を即時更新（二重保存不要）\n'
    '      setEditableComments(updatedComments);\n'
    '\n'
    '      // 成功メッセージ\n'
    "      setSuccessMessage('コメントを保存しました');\n"
    '\n'
    '      // 通話メモ入力欄をクリア\n'
    "      setCallMemo('');\n"
    '\n'
    '      // ページをリロード（最新のコメントを表示）\n'
    '      await loadAllData();'
)

if old_memo in text_lf:
    text_lf = text_lf.replace(old_memo, new_memo)
    print('✅ handleSaveCallMemo: setEditableComments追加完了')
else:
    print('❌ handleSaveCallMemo: 対象が見つかりません')
    if 'setSuccessMessage' in text_lf:
        idx = text_lf.find("setSuccessMessage('コメントを保存しました')")
        print('  周辺:', repr(text_lf[idx-200:idx+100]))

# CRLFに戻す
text_out = text_lf.replace('\n', '\r\n')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text_out.encode('utf-8'))

print('Done!')
