"""
ReinsRegistrationPage.tsx のレインズURLセクションを
「レインズシステムを開く」リンクのみに簡略化する
"""

filepath = 'frontend/src/pages/ReinsRegistrationPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# レインズURL セクション全体を置換
old_section = '''              {/* レインズURL */}
              <Box sx={{ flex: '2 1 200px' }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1.5 }}>
                  レインズURL
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="https://system.reins.jp/..."
                    value={reinsUrl}
                    onChange={(e) => setReinsUrl(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSaveReinsUrl}
                    disabled={savingReinsUrl}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {savingReinsUrl ? <CircularProgress size={16} /> : '保存'}
                  </Button>
                  {reinsUrl && (
                    <IconButton size="small" onClick={() => window.open(reinsUrl, '_blank')}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  onClick={() => window.open('https://system.reins.jp/', '_blank')}
                  sx={{ mt: 0.5, p: 0 }}
                >
                  レインズシステムを開く
                </Button>
              </Box>'''

new_section = '''              {/* レインズシステムリンク */}
              <Box sx={{ flex: '2 1 200px', display: 'flex', alignItems: 'center' }}>
                <Button
                  variant="text"
                  size="small"
                  endIcon={<OpenInNewIcon fontSize="small" />}
                  onClick={() => window.open('https://system.reins.jp/', '_blank')}
                  sx={{ p: 0 }}
                >
                  レインズシステムを開く
                </Button>
              </Box>'''

if old_section in text:
    text = text.replace(old_section, new_section)
    print('✅ レインズURLセクションを修正しました')
else:
    print('❌ パターンが見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
