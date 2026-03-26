with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. 次電日を必須項目に（labelとrequired追加）
old_next_call = """                <TextField
                  fullWidth
                  label="次電日"
                  type="date"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />"""
new_next_call = """                <TextField
                  fullWidth
                  required
                  label="次電日"
                  type="date"
                  value={nextCallDate}
                  onChange={(e) => setNextCallDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />"""
if old_next_call in text:
    text = text.replace(old_next_call, new_next_call, 1)
    print('OK: nextCallDate required')
else:
    print('ERROR: nextCallDate not found')

# 2. バリデーションに次電日必須チェック追加
old_validation = """    if (!confidence) {
      setError('確度は必須です');
      return;
    }"""
new_validation = """    if (!confidence) {
      setError('確度は必須です');
      return;
    }

    if (!nextCallDate) {
      setError('次電日は必須です');
      return;
    }"""
if old_validation in text:
    text = text.replace(old_validation, new_validation, 1)
    print('OK: nextCallDate validation')
else:
    print('ERROR: validation not found')

# 3. 追客情報セクションの確度フィールドを削除（重複）
old_confidence_field = """              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="確度"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                >
                  <MenuItem value="">選択なし</MenuItem>
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
                  select
                  label="連絡方法\""""

new_confidence_field = """              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="連絡方法\""""

if old_confidence_field in text:
    text = text.replace(old_confidence_field, new_confidence_field, 1)
    print('OK: removed duplicate confidence')
else:
    print('ERROR: duplicate confidence not found')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
