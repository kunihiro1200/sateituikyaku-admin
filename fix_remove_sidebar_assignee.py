with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# サイドバーのAssigneeSectionブロックを削除
old = '            <CallLogDisplay sellerId={id!} />\r\n            \r\n            {/* \u62c5\u5f53\u8005\u8a2d\u5b9a\u30bb\u30af\u30b7\u30e7\u30f3 */}\r\n            {seller && (\r\n              <AssigneeSection\r\n                seller={seller}\r\n                onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}\r\n              />\r\n            )}\r\n\r\n            {/* \u8ffd\u5ba2\u30ed\u30b0\u5c65\u6b74\uff08APPSHEET\uff09 */}'

new = '            <CallLogDisplay sellerId={id!} />\r\n\r\n            {/* \u8ffd\u5ba2\u30ed\u30b0\u5c65\u6b74\uff08APPSHEET\uff09 */}'

if old in text:
    text = text.replace(old, new, 1)
    print('✅ サイドバーのAssigneeSectionを削除しました')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ
    idx = text.find('CallLogDisplay sellerId')
    print('前後:', repr(text[idx:idx+300]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
