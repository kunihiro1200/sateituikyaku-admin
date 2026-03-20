import re

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「スプレッドシートコメント（読み取り専用）」セクションを編集可能なUIに変更
old_section = '''            {/* スプレッドシートコメント表示（読み取り専用） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                スプレッドシートコメント（読み取り専用）
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'text.secondary',
                  }}
                >
                  {seller?.comments || 'コメントはありません'}
                </Typography>
              </Paper>
            </Box>'''

new_section = '''            {/* コメント表示・編集エリア */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                コメント
              </Typography>
              <TextField
                multiline
                fullWidth
                minRows={4}
                value={editableComments}
                onChange={(e) => setEditableComments(e.target.value)}
                placeholder="コメントはありません"
                variant="outlined"
                sx={{ bgcolor: 'white' }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={savingComments}
                onClick={handleSaveComments}
                sx={{ mt: 1 }}
              >
                {savingComments ? <CircularProgress size={16} /> : 'コメントを保存'}
              </Button>
            </Box>'''

if old_section in text:
    text = text.replace(old_section, new_section)
    print('✅ コメント表示セクションを置換しました')
else:
    print('❌ 対象セクションが見つかりませんでした')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
