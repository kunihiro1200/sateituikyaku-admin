with open('frontend/frontend/src/components/AssigneeSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
        メール送信確認
      </Typography>"""

new = """  return (
    <Box sx={{ mb: 2, bgcolor: '#f0f4ff', borderRadius: 2, p: 2, border: '1px solid #c5cae9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
          メール送信確認
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f44336', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>SMS</Typography>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1976d2', flexShrink: 0, ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>Email</Typography>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800', flexShrink: 0, ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>両方</Typography>
        </Box>
      </Box>"""

if old in text:
    text = text.replace(old, new)
    print('✅ ヘッダー修正成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
