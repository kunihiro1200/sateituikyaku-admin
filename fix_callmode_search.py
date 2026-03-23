with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# 検索バーの遷移先を /sellers/${...} から /sellers/${...}/call に変更
old = "              navigate(`/sellers/${sellerNumberSearch.trim()}`);"
new = "              navigate(`/sellers/${sellerNumberSearch.trim()}/call`);"

if old in text:
    text = text.replace(old, new)
    print('✅ 遷移先修正成功')
else:
    print('❌ 対象コードが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
