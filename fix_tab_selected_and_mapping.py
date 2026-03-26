with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: タブの選択中スタイルを改善
# 選択中は白文字・フル不透明・下線・スケールアップで明確に示す
old_tabs = """            sx={{
              '& .MuiTab-root': { minWidth: 120, px: 2, fontWeight: 600, borderRadius: '4px 4px 0 0', mr: 0.5, color: '#fff', opacity: 0.75 },
              '& .MuiTab-root:nth-of-type(1)': { bgcolor: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { bgcolor: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { bgcolor: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { bgcolor: '#6a1b9a' },
              '& .Mui-selected': { opacity: 1, fontWeight: 700 },
              '& .MuiTabs-indicator': { display: 'none' },
            }}"""
new_tabs = """            sx={{
              '& .MuiTab-root': { minWidth: 120, px: 2, fontWeight: 600, borderRadius: '4px 4px 0 0', mr: 0.5, color: 'rgba(255,255,255,0.6)', opacity: 1 },
              '& .MuiTab-root:nth-of-type(1)': { bgcolor: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { bgcolor: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { bgcolor: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { bgcolor: '#6a1b9a' },
              '& .Mui-selected': {
                color: '#fff !important',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: 'inset 0 -4px 0 rgba(255,255,255,0.8)',
                filter: 'brightness(1.25)',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}"""
text = text.replace(old_tabs, new_tabs)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('タブ修正:', '適用済み' if 'brightness(1.25)' in text else '失敗')
