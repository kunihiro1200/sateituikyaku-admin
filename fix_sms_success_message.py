import re

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# SMS送信後のsetSuccessMessageをSnackbarに変更
old = "        setSuccessMessage(`${template.label}を記録しました`);"
new = "        setSnackbarMessage(`${template.label}を記録しました`);\n        setSnackbarOpen(true);"

if old in text:
    text = text.replace(old, new)
    print('✅ SMS成功メッセージをSnackbarに変更しました')
else:
    print('❌ 対象文字列が見つかりませんでした')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
