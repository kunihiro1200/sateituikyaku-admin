with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: タブに色付け
old_tabs = """          sx={{
              '& .MuiTab-root': { minWidth: 'auto', px: 2 },
              '& .Mui-selected': { color: 'error.main' },
              '& .MuiTabs-indicator': { backgroundColor: 'error.main' },
            }}"""
new_tabs = """          sx={{
              '& .MuiTab-root': { minWidth: 'auto', px: 2, fontWeight: 600 },
              '& .MuiTab-root:nth-of-type(1)': { color: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { color: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { color: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { color: '#6a1b9a' },
              '& .Mui-selected': { opacity: 1 },
              '& .MuiTabs-indicator': { backgroundColor: 'currentColor' },
            }}"""
text = text.replace(old_tabs, new_tabs)

# 修正2: 青い自動計算テキストボックスを削除（重複しているため）
old_autotext = """      {/* 変更2: email_distribution に応じた自動計算テキスト */}
      {emailDistAutoText && (
        <Box sx={{ bgcolor: 'info.light', p: 1.5, mb: 1.5, borderRadius: 1 }}>
          <Typography
            variant="body2"
            sx={{ userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {emailDistAutoText}
          </Typography>
        </Box>
      )}"""
new_autotext = ""
text = text.replace(old_autotext, new_autotext)

# 修正3: コメント（サイト登録）をマルチラインに変更
# EditableField を EditableMultilineField 相当に変更
old_comment = '      <EditableField label="コメント（サイト登録）" field="site_registration_comment" />'
new_comment = """      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>コメント（サイト登録）</Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            value={getValue('site_registration_comment') || ''}
            onChange={(e) => handleFieldChange('site_registration_comment', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Grid>
      </Grid>"""
text = text.replace(old_comment, new_comment)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('タブ色付け:', '適用済み' if 'nth-of-type(1)' in text else '失敗')
print('青ボックス削除:', '適用済み' if 'info.light' not in text else '失敗')
print('コメントマルチライン:', '適用済み' if 'minRows={2}' in text else '失敗')
