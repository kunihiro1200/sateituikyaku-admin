with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLFを考慮した検索文字列
old = '              </Box>\r\n            </Box>\r\n\r\n            {/* \u4e0d\u901a\u30d5\u30a3\u30fc\u30eb\u30c9\uff08inquiry_date >= 2026-01-01\u306e\u58f2\u4e3b\u306e\u307f\u8868\u793a\uff09 */}'

new = '              </Box>\r\n            </Box>\r\n\r\n            {/* \u62c5\u5f53\u8005\u8a2d\u5b9a\u30bb\u30af\u30b7\u30e7\u30f3 */}\r\n            {seller && (\r\n              <AssigneeSection\r\n                seller={seller}\r\n                onUpdate={(fields) => setSeller((prev) => prev ? {{ ...prev, ...fields }} : prev)}\r\n              />\r\n            )}\r\n\r\n            {/* \u4e0d\u901a\u30d5\u30a3\u30fc\u30eb\u30c9\uff08inquiry_date >= 2026-01-01\u306e\u58f2\u4e3b\u306e\u307f\u8868\u793a\uff09 */}'

if old in text:
    text = text.replace(old, new, 1)
    print('✅ AssigneeSection を1番電話の直後に挿入しました')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ: 前後の文字列を確認
    idx = text.find('不通フィールド')
    print('前後:', repr(text[idx-80:idx+30]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
