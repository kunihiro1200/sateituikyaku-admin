with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: タブの文字色→背景色に変更
old_tabs = """            sx={{
              '& .MuiTab-root': { minWidth: 'auto', px: 2, fontWeight: 600 },
              '& .MuiTab-root:nth-of-type(1)': { color: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { color: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { color: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { color: '#6a1b9a' },
              '& .Mui-selected': { opacity: 1 },
              '& .MuiTabs-indicator': { backgroundColor: 'currentColor' },
            }}"""
new_tabs = """            sx={{
              '& .MuiTab-root': { minWidth: 120, px: 2, fontWeight: 600, borderRadius: '4px 4px 0 0', mr: 0.5, color: '#fff', opacity: 0.75 },
              '& .MuiTab-root:nth-of-type(1)': { bgcolor: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { bgcolor: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { bgcolor: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { bgcolor: '#6a1b9a' },
              '& .Mui-selected': { opacity: 1, fontWeight: 700 },
              '& .MuiTabs-indicator': { display: 'none' },
            }}"""
text = text.replace(old_tabs, new_tabs)

# 修正2: DialogTitleに「業務一覧」ボタンを追加（一番左端）
old_title = """        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0 }}>
          <Typography variant="h6">業務詳細 - {propertyNumber || ''}</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>"""
new_title = """        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="small"
              onClick={onClose}
              sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              業務一覧
            </Button>
            <Typography variant="h6">業務詳細 - {propertyNumber || ''}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </DialogTitle>"""
text = text.replace(old_title, new_title)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('タブ背景色:', '適用済み' if 'bgcolor: \'#2e7d32\'' in text else '失敗')
print('業務一覧ボタン:', '適用済み' if '業務一覧' in text else '失敗')
