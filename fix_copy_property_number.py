with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 物件番号フィールドをクリックでコピーできるように変更
# EditableField の property_number を特別処理
# DialogTitle の物件番号表示をクリックでコピー可能に変更

old_title = """          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onClose}
              sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              業務一覧
            </Button>
            <Typography variant="h6">業務詳細 - {propertyNumber || ''}</Typography>
          </Box>"""

new_title = """          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onClose}
              sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              業務一覧
            </Button>
            <Typography variant="h6">業務詳細 -</Typography>
            <Box
              onClick={() => { navigator.clipboard.writeText(propertyNumber || ''); }}
              sx={{
                cursor: 'pointer',
                px: 1.5, py: 0.5,
                bgcolor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 1,
                fontWeight: 700,
                fontSize: '1.1rem',
                userSelect: 'all',
                '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' },
                '&:active': { bgcolor: '#bbdefb' },
              }}
              title="クリックでコピー"
            >
              {propertyNumber || ''}
            </Box>
          </Box>"""

text = text.replace(old_title, new_title)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done:', '適用済み' if 'navigator.clipboard' in text else '失敗')
