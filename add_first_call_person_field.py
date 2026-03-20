# CallModePageに「1番電話」フィールドを追加するスクリプト
# CRLF (Windows改行) ファイルに対応

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

# バイト列のまま処理（CRLF保持）
# UTF-8でデコードしてCRLFを保持
text = content.decode('utf-8')

# デバッグ: 検索文字列の確認
print('=== デバッグ ===')
idx = text.find("editedContactMethod, setEditedContactMethod")
print(f'editedContactMethod位置: {idx}')
if idx > 0:
    print(repr(text[idx-5:idx+100]))

# 1. 状態変数の追加（editedContactMethodの後）
# CRLFを使用
old_state = "  const [editedContactMethod, setEditedContactMethod] = useState<string>('');\r\n  const [savingCommunication, setSavingCommunication] = useState(false);"

new_state = "  const [editedContactMethod, setEditedContactMethod] = useState<string>('');\r\n  const [editedFirstCallPerson, setEditedFirstCallPerson] = useState<string>('');\r\n  const [savingCommunication, setSavingCommunication] = useState(false);"

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ 1. 状態変数を追加しました')
else:
    print('❌ 1. 状態変数の挿入箇所が見つかりません')
    # LFのみで試す
    old_state_lf = "  const [editedContactMethod, setEditedContactMethod] = useState<string>('');\n  const [savingCommunication, setSavingCommunication] = useState(false);"
    if old_state_lf in text:
        new_state_lf = "  const [editedContactMethod, setEditedContactMethod] = useState<string>('');\n  const [editedFirstCallPerson, setEditedFirstCallPerson] = useState<string>('');\n  const [savingCommunication, setSavingCommunication] = useState(false);"
        text = text.replace(old_state_lf, new_state_lf)
        print('✅ 1. 状態変数を追加しました（LF版）')

# 2. seller読み込み時の初期化（useEffect内）
old_init = "      setEditedContactMethod(seller.contactMethod || '');\r\n      isInitialLoadRef.current = true; // 初回ロードフラグをリセット"
new_init = "      setEditedContactMethod(seller.contactMethod || '');\r\n      setEditedFirstCallPerson(seller.firstCallPerson || '');\r\n      isInitialLoadRef.current = true; // 初回ロードフラグをリセット"

if old_init in text:
    text = text.replace(old_init, new_init)
    print('✅ 2. useEffect初期化を追加しました')
else:
    print('❌ 2. useEffect初期化の挿入箇所が見つかりません')
    # LFで試す
    old_init_lf = "      setEditedContactMethod(seller.contactMethod || '');\n      isInitialLoadRef.current = true; // 初回ロードフラグをリセット"
    if old_init_lf in text:
        new_init_lf = "      setEditedContactMethod(seller.contactMethod || '');\n      setEditedFirstCallPerson(seller.firstCallPerson || '');\n      isInitialLoadRef.current = true; // 初回ロードフラグをリセット"
        text = text.replace(old_init_lf, new_init_lf)
        print('✅ 2. useEffect初期化を追加しました（LF版）')

# 3. 変更検知条件の更新
old_has_changes = "      editedContactMethod !== (seller.contactMethod || '');"
new_has_changes = "      editedContactMethod !== (seller.contactMethod || '') ||\r\n      editedFirstCallPerson !== (seller.firstCallPerson || '');"

if old_has_changes in text:
    text = text.replace(old_has_changes, new_has_changes, 1)
    print('✅ 3. 変更検知条件を更新しました')
else:
    print('❌ 3. 変更検知条件の箇所が見つかりません')

# 4. 自動保存APIコール（useEffect内）の更新
old_auto_save = "          contactMethod: editedContactMethod || null,\r\n        });\r\n\r\n        console.log('\u2705 \u30b3\u30df\u30e5\u30cb\u30b1\u30fc\u30b7\u30e7\u30f3\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u81ea\u52d5\u4fdd\u5b58\u3057\u307e\u3057\u305f');"
new_auto_save = "          contactMethod: editedContactMethod || null,\r\n          firstCallPerson: editedFirstCallPerson || null,\r\n        });\r\n\r\n        console.log('\u2705 \u30b3\u30df\u30e5\u30cb\u30b1\u30fc\u30b7\u30e7\u30f3\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u81ea\u52d5\u4fdd\u5b58\u3057\u307e\u3057\u305f');"

if old_auto_save in text:
    text = text.replace(old_auto_save, new_auto_save)
    print('✅ 4. 自動保存APIコールを更新しました')
else:
    # 日本語なしで検索
    idx4 = text.find("          contactMethod: editedContactMethod || null,")
    print(f'❌ 4. 自動保存APIコールの箇所が見つかりません (idx={idx4})')
    if idx4 > 0:
        print(repr(text[idx4:idx4+200]))

# 6. キャッシュヒット時の初期化
old_cache_init = "      setEditedContactMethod(sellerData.contactMethod || '');\r\n\r\n      // \u30ed\u30fc\u30c7\u30a3\u30f3\u30b0\u7d42\u4e86\uff08\u753b\u9762\u3092\u8868\u793a\uff09- employees/activities \u53d6\u5f97\u3092\u5f85\u305f\u305a\u306b\u8868\u793a"
new_cache_init = "      setEditedContactMethod(sellerData.contactMethod || '');\r\n      setEditedFirstCallPerson(sellerData.firstCallPerson || '');\r\n\r\n      // \u30ed\u30fc\u30c7\u30a3\u30f3\u30b0\u7d42\u4e86\uff08\u753b\u9762\u3092\u8868\u793a\uff09- employees/activities \u53d6\u5f97\u3092\u5f85\u305f\u305a\u306b\u8868\u793a"

if old_cache_init in text:
    text = text.replace(old_cache_init, new_cache_init)
    print('✅ 6. キャッシュヒット時の初期化を追加しました')
else:
    idx6 = text.find("      setEditedContactMethod(sellerData.contactMethod || '');")
    print(f'❌ 6. キャッシュヒット時の初期化の箇所が見つかりません (idx={idx6})')
    if idx6 > 0:
        print(repr(text[idx6:idx6+200]))

# 7. 保存ボタン押下時のAPIコール更新
# 2つ目のcontactMethod箇所を更新（1つ目は自動保存）
count_contact = text.count("        contactMethod: editedContactMethod || null,")
print(f'contactMethod箇所数: {count_contact}')

# 「コミュニケーションフィールドを保存」の後のAPIコールを更新
old_save_api = "      // \u30b3\u30df\u30e5\u30cb\u30b1\u30fc\u30b7\u30e7\u30f3\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u4fdd\u5b58\r\n      await api.put(`/api/sellers/${id}`, {\r\n        phoneContactPerson: editedPhoneContactPerson || null,\r\n        preferredContactTime: editedPreferredContactTime || null,\r\n        contactMethod: editedContactMethod || null,\r\n      });"
new_save_api = "      // \u30b3\u30df\u30e5\u30cb\u30b1\u30fc\u30b7\u30e7\u30f3\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u4fdd\u5b58\r\n      await api.put(`/api/sellers/${id}`, {\r\n        phoneContactPerson: editedPhoneContactPerson || null,\r\n        preferredContactTime: editedPreferredContactTime || null,\r\n        contactMethod: editedContactMethod || null,\r\n        firstCallPerson: editedFirstCallPerson || null,\r\n      });"

if old_save_api in text:
    text = text.replace(old_save_api, new_save_api)
    print('✅ 7. 保存ボタン押下時のAPIコールを更新しました')
else:
    print('❌ 7. 保存ボタン押下時のAPIコールの箇所が見つかりません')

# 8. UIの追加（コメント表示・編集エリアの直前）
# 日本語文字列をUnicodeエスケープで検索
comment_label = '\u30b3\u30e1\u30f3\u30c8'  # コメント
old_ui_marker = "            {/* \u30b3\u30e1\u30f3\u30c8\u8868\u793a\u30fb\u7de8\u96c6\u30a8\u30ea\u30a2 */}\r\n            <Box sx={{ mb: 2 }}>\r\n              <Typography variant=\"subtitle2\" gutterBottom>\r\n                \u30b3\u30e1\u30f3\u30c8\r\n              </Typography>"

new_ui_content = """            {/* 1\u756a\u96fb\u8a71\u30d5\u30a3\u30fc\u30eb\u30c9 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                1\u756a\u96fb\u8a71
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={editedFirstCallPerson}
                  onChange={(e) => setEditedFirstCallPerson(e.target.value)}
                  displayEmpty
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value=""><em>\u672a\u9078\u629e</em></MenuItem>
                  {activeEmployees.map((emp) => (
                    <MenuItem key={emp.initials || emp.name} value={emp.initials || ''}>
                      {emp.initials || emp.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* \u30b3\u30e1\u30f3\u30c8\u8868\u793a\u30fb\u7de8\u96c6\u30a8\u30ea\u30a2 */}\r\n            <Box sx={{ mb: 2 }}>\r\n              <Typography variant="subtitle2" gutterBottom>\r\n                \u30b3\u30e1\u30f3\u30c8\r\n              </Typography>"""

if old_ui_marker in text:
    text = text.replace(old_ui_marker, new_ui_content)
    print('✅ 8. UIを追加しました')
else:
    idx8 = text.find(old_ui_marker[:50])
    print(f'❌ 8. UIの挿入箇所が見つかりません (idx={idx8})')
    # 別の方法で検索
    idx8b = text.find("{/* \u30b3\u30e1\u30f3\u30c8\u8868\u793a\u30fb\u7de8\u96c6\u30a8\u30ea\u30a2 */}")
    print(f'コメント表示・編集エリア位置: {idx8b}')
    if idx8b > 0:
        print(repr(text[idx8b:idx8b+300]))

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了！')
