with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

# CRLFファイルなのでCRLFで処理
text = content.decode('utf-8')

errors = []

# 1. state追加（CRLF対応）
old1 = "  // \u901a\u8a71\u30e1\u30e2\u5165\u529b\u6b04\u306e\u72b6\u614b\r\n  const [callMemo, setCallMemo] = useState<string>('');\r\n  const [savingMemo, setSavingMemo] = useState(false);"
new1 = "  // \u901a\u8a71\u30e1\u30e2\u5165\u529b\u6b04\u306e\u72b6\u614b\r\n  const [callMemo, setCallMemo] = useState<string>('');\r\n  const [savingMemo, setSavingMemo] = useState(false);\r\n\r\n  // \u30b3\u30e1\u30f3\u30c8\u76f4\u63a5\u7de8\u96c6\u306e\u72b6\u614b\r\n  const [editableComments, setEditableComments] = useState<string>('');\r\n  const [savingComments, setSavingComments] = useState(false);"
if old1 in text:
    text = text.replace(old1, new1)
    print('✅ 1. state追加完了')
else:
    errors.append('1. state追加対象が見つかりません')

# 2. handleSaveComments関数追加（CRLF対応）
old2 = "  // \u901a\u8a71\u30e1\u30e2\u306e\u4fdd\u5b58\u51e6\u7406\r\n  const handleSaveCallMemo = async () => {"
new2 = (
    "  // \u30b3\u30e1\u30f3\u30c8\u76f4\u63a5\u7de8\u96c6\u306e\u4fdd\u5b58\u51e6\u7406\r\n"
    "  const handleSaveComments = async () => {\r\n"
    "    try {\r\n"
    "      setSavingComments(true);\r\n"
    "      setError(null);\r\n"
    "\r\n"
    "      await api.put(`/api/sellers/${id}`, {\r\n"
    "        comments: editableComments,\r\n"
    "      });\r\n"
    "\r\n"
    "      setSuccessMessage('\u30b3\u30e1\u30f3\u30c8\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f');\r\n"
    "      setTimeout(() => {\r\n"
    "        setSuccessMessage(null);\r\n"
    "      }, 3000);\r\n"
    "    } catch (err: any) {\r\n"
    "      console.error('\u30b3\u30e1\u30f3\u30c8\u4fdd\u5b58\u30a8\u30e9\u30fc:', err);\r\n"
    "      setError('\u30b3\u30e1\u30f3\u30c8\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f');\r\n"
    "    } finally {\r\n"
    "      setSavingComments(false);\r\n"
    "    }\r\n"
    "  };\r\n"
    "\r\n"
    "  // \u901a\u8a71\u30e1\u30e2\u306e\u4fdd\u5b58\u51e6\u7406\r\n"
    "  const handleSaveCallMemo = async () => {"
)
if old2 in text:
    text = text.replace(old2, new2)
    print('✅ 2. handleSaveComments追加完了')
else:
    errors.append('2. handleSaveCallMemo対象が見つかりません')

# 3. キャッシュヒット時のeditableComments初期化（CRLF対応）
old3 = "            setSeller(freshData);\r\n            setUnreachableStatus(freshData.unreachableStatus || null);\r\n          }\r\n        }).catch(() => {});"
new3 = "            setSeller(freshData);\r\n            setUnreachableStatus(freshData.unreachableStatus || null);\r\n            setEditableComments(freshData.comments || '');\r\n          }\r\n        }).catch(() => {});"
if old3 in text:
    text = text.replace(old3, new3)
    print('✅ 3. キャッシュヒット時のeditableComments初期化追加完了')
else:
    errors.append('3. キャッシュヒット時の対象が見つかりません')

# 4. メインのeditableComments初期化（CRLF対応）
old4 = "      setSeller(sellerData);\r\n      setUnreachableStatus(sellerData.unreachableStatus || null);\r\n\r\n      // \u53cd\u97ff\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9URL\u3092\u975e\u540c\u671f\u3067\u53d6\u5f97\uff08\u30a8\u30e9\u30fc\u3067\u3082\u7d9a\u884c\uff09"
new4 = "      setSeller(sellerData);\r\n      setUnreachableStatus(sellerData.unreachableStatus || null);\r\n      setEditableComments(sellerData.comments || '');\r\n\r\n      // \u53cd\u97ff\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9URL\u3092\u975e\u540c\u671f\u3067\u53d6\u5f97\uff08\u30a8\u30e9\u30fc\u3067\u3082\u7d9a\u884c\uff09"

# 実際の文字列で確認
old4_actual = "      setSeller(sellerData);\r\n      setUnreachableStatus(sellerData.unreachableStatus || null);\r\n\r\n      // 反響URLを非同期で取得（エラーでも続行）"
new4_actual = "      setSeller(sellerData);\r\n      setUnreachableStatus(sellerData.unreachableStatus || null);\r\n      setEditableComments(sellerData.comments || '');\r\n\r\n      // 反響URLを非同期で取得（エラーでも続行）"
if old4_actual in text:
    text = text.replace(old4_actual, new4_actual)
    print('✅ 4. メインのeditableComments初期化追加完了')
else:
    errors.append('4. メインのsetSeller対象が見つかりません')

# 5. UIをTextField編集可能に変更（CRLF対応）
old5 = (
    "            {/* \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u30b3\u30e1\u30f3\u30c8\u8868\u793a\uff08\u8aad\u307f\u53d6\u308a\u5c02\u7528\uff09 */}\r\n"
    "            <Box sx={{ mb: 2 }}>\r\n"
    "              <Typography variant=\"subtitle2\" gutterBottom>\r\n"
    "                \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u30b3\u30e1\u30f3\u30c8\uff08\u8aad\u307f\u53d6\u308a\u5c02\u7528\uff09\r\n"
    "              </Typography>\r\n"
    "              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>\r\n"
    "                <Typography\r\n"
    "                  variant=\"body2\"\r\n"
    "                  sx={{\r\n"
    "                    whiteSpace: 'pre-wrap',\r\n"
    "                    wordBreak: 'break-word',\r\n"
    "                    color: 'text.secondary',\r\n"
    "                  }}\r\n"
    "                >\r\n"
    "                  {seller?.comments || '\u30b3\u30e1\u30f3\u30c8\u306f\u3042\u308a\u307e\u305b\u3093'}\r\n"
    "                </Typography>\r\n"
    "              </Paper>\r\n"
    "            </Box>"
)
new5 = (
    "            {/* \u30b3\u30e1\u30f3\u30c8\u8868\u793a\u30fb\u7de8\u96c6\u30a8\u30ea\u30a2 */}\r\n"
    "            <Box sx={{ mb: 2 }}>\r\n"
    "              <Typography variant=\"subtitle2\" gutterBottom>\r\n"
    "                \u30b3\u30e1\u30f3\u30c8\r\n"
    "              </Typography>\r\n"
    "              <TextField\r\n"
    "                multiline\r\n"
    "                fullWidth\r\n"
    "                minRows={4}\r\n"
    "                value={editableComments}\r\n"
    "                onChange={(e) => setEditableComments(e.target.value)}\r\n"
    "                placeholder=\"\u30b3\u30e1\u30f3\u30c8\u306f\u3042\u308a\u307e\u305b\u3093\"\r\n"
    "                variant=\"outlined\"\r\n"
    "                sx={{ bgcolor: 'white' }}\r\n"
    "              />\r\n"
    "              <Button\r\n"
    "                variant=\"outlined\"\r\n"
    "                size=\"small\"\r\n"
    "                disabled={savingComments}\r\n"
    "                onClick={handleSaveComments}\r\n"
    "                sx={{ mt: 1 }}\r\n"
    "              >\r\n"
    "                {savingComments ? <CircularProgress size={16} /> : '\u30b3\u30e1\u30f3\u30c8\u3092\u4fdd\u5b58'}\r\n"
    "              </Button>\r\n"
    "            </Box>"
)
if old5 in text:
    text = text.replace(old5, new5)
    print('✅ 5. UIをTextField編集可能に変更完了')
else:
    errors.append('5. UIセクションの対象が見つかりません')

if errors:
    print('\n❌ エラー:')
    for e in errors:
        print(f'  - {e}')
else:
    print('\n✅ 全変更完了')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
