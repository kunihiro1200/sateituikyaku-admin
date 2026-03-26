with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 古いステータス情報セクション（訪問査定情報の後にある重複したもの）を削除
old_status_section = """
          {/* ステータス情報セクション */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ステータス情報
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="状況"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="following_up">追客中</MenuItem>
                  <MenuItem value="appointment_scheduled">訪問予定</MenuItem>
                  <MenuItem value="visited">訪問済み</MenuItem>
                  <MenuItem value="exclusive_contract">専任媒介</MenuItem>
                  <MenuItem value="general_contract">一般媒介</MenuItem>
                  <MenuItem value="other_decision">他決</MenuItem>
                  <MenuItem value="follow_up_not_needed">追客不要</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="確度"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                >
                  <MenuItem value="A">A（売る気あり）</MenuItem>
                  <MenuItem value="B">B（売る気あるがまだ先の話）</MenuItem>
                  <MenuItem value="B_PRIME">B'（売る気は全く無い）</MenuItem>
                  <MenuItem value="C">C（電話が繋がらない）</MenuItem>
                  <MenuItem value="D">D（再建築不可）</MenuItem>
                  <MenuItem value="E">E（収益物件）</MenuItem>
                  <MenuItem value="DUPLICATE">ダブり（重複している）</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="担当社員"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* 競合情報セクション */}"""

new_status_section = """

          {/* 競合情報セクション */}"""

if old_status_section in text:
    text = text.replace(old_status_section, new_status_section, 1)
    print('OK: removed duplicate status section')
else:
    print('ERROR: target not found')
    # デバッグ用に周辺を確認
    idx = text.find('ステータス情報セクション')
    print(f'Found at positions: {[i for i in range(len(text)) if text[i:i+10] == "ステータス情報"]}')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
