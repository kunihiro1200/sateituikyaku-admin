with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 競合情報・Pinrich・除外管理・その他情報セクションを削除
# 登録ボタンの直前まで全て削除

old = """
          {/* 競合情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              競合情報
            </Typography>"""

# 削除対象の開始から登録ボタンの直前まで
start_marker = "\n\n          {/* 競合情報セクション */}"
end_marker = "\n\n          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx >= 0 and end_idx >= 0:
    text = text[:start_idx] + end_marker + text[end_idx + len(end_marker):]
    print('OK: removed sections')
else:
    print(f'ERROR: start={start_idx}, end={end_idx}')

# pinrichStatus のデフォルトを '登録不要' に
text = text.replace(
    "const [pinrichStatus, setPinrichStatus] = useState('');",
    "const [pinrichStatus, setPinrichStatus] = useState('登録不要');",
    1
)

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
