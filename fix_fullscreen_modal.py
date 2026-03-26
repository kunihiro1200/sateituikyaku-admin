with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# maxWidth="md" fullWidth を fullScreen に変更
old = '<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>'
new = '<Dialog open={open} onClose={onClose} fullScreen>'
text = text.replace(old, new)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done:', '適用済み' if 'fullScreen' in text else '失敗')
