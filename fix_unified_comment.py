with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# unifiedComment.trim() を callMemo.trim() に置き換え
old = 'if (unifiedComment.trim()) {'
new = 'if (callMemo.trim()) {'

if old in text:
    text = text.replace(old, new)
    print('✅ 置き換え成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
