# -*- coding: utf-8 -*-
# 「除外日にすること」をボックス表示から選択可能なドロップダウンに変更

with open('frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「除外日にすること」のボックス表示（読み取り専用）をFormControl+Selectに変更
old = '''                <Grid item xs={6}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, minHeight: 40 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      除外日にすること
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {exclusionAction || '－'}
                    </Typography>
                  </Box>
                </Grid>'''

new = '''                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>除外日にすること</InputLabel>
                    <Select
                      value={exclusionAction}
                      label="除外日にすること"
                      onChange={(e) => {
                        const value = e.target.value;
                        setExclusionAction(value);
                        // 除外日が設定されている場合、次電日を除外日に設定
                        if (value && exclusionDate) {
                          setEditedNextCallDate(exclusionDate);
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>未選択</em>
                      </MenuItem>
                      <MenuItem value="除外日になにかあれば除外">除外日になにかあれば除外</MenuItem>
                      <MenuItem value="除外日になにもせず除外">除外日になにもせず除外</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>'''

if old in text:
    text = text.replace(old, new)
    print('✅ 「除外日にすること」をドロップダウンに変更しました')
else:
    print('❌ 対象テキストが見つかりませんでした')

with open('frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
