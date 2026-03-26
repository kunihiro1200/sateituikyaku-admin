with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: パルスアニメーション用のkeyframesをDialogContent内に追加
# 保存ボタンのsxにパルスアニメーションを追加
old_save_btn = """          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saving ? '保存中...' : '保存'}
          </Button>"""

new_save_btn = """          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
              },
            } : {}}
          >
            {saving ? '保存中...' : '保存'}
          </Button>"""

text = text.replace(old_save_btn, new_save_btn)

# 修正2: サイト登録セクションの左右カラムの上部にも保存ボタンを追加
# SaveButtonコンポーネントを定義してSiteRegistrationSectionの上部に配置
# 左カラムの先頭と右カラムの先頭に保存ボタンを追加

old_left_top = """      {/* 左側：登録関係 */}
      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', mb: 1 }}>【登録関係】</Typography>"""

new_left_top = """      {/* 左側：登録関係 */}
      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0' }}>【登録関係】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(25, 118, 210, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>"""

text = text.replace(old_left_top, new_left_top)

old_right_top = """      {/* 右側：確認関係 */}
      <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>【確認関係】</Typography>"""

new_right_top = """      {/* 右側：確認関係 */}
      <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32' }}>【確認関係】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="success"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(46, 125, 50, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>"""

text = text.replace(old_right_top, new_right_top)

with open('frontend/frontend/src/components/WorkTaskDetailModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('パルスアニメーション:', '適用済み' if 'pulse-save' in text else '失敗')
print('左カラム保存ボタン:', '適用済み' if '登録関係】</Typography>\n          <Button' in text else '失敗')
print('右カラム保存ボタン:', '適用済み' if '確認関係】</Typography>\n          <Button' in text else '失敗')
