filepath = 'frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# SIGNATURE_EMAILの直前に建売専門HPリンクを追加（全箇所）
old = '${SIGNATURE_EMAIL.replace(/\\n/g, \'<br>\')}'
new = '<br>★建売専門HPはこちら<br><a href="https://sateituikyaku-admin-frontend.vercel.app/tateuri">https://sateituikyaku-admin-frontend.vercel.app/tateuri</a>${SIGNATURE_EMAIL.replace(/\\n/g, \'<br>\')}'

count = text.count(old)
if count > 0:
    text = text.replace(old, new)
    print(f'✅ 置換成功（{count}箇所）')
else:
    print('❌ 対象文字列が見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
