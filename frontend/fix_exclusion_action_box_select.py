# -*- coding: utf-8 -*-
# 「除外日にすること」をドロップダウンからボックス選択（ボタン形式）に変更

with open('frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''                <Grid item xs={6}>
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

new = '''                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    除外日にすること
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['除外日になにかあれば除外', '除外日になにもせず除外'].map((option) => (
                      <Button
                        key={option}
                        variant={exclusionAction === option ? 'contained' : 'outlined'}
                        color={exclusionAction === option ? 'primary' : 'inherit'}
                        size="small"
                        onClick={() => {
                          const value = exclusionAction === option ? '' : option;
                          setExclusionAction(value);
                          // 除外日が設定されている場合、次電日を除外日に設定
                          if (value && exclusionDate) {
                            setEditedNextCallDate(exclusionDate);
                          }
                        }}
                        sx={{ minWidth: 80 }}
                      >
                        {option}
                      </Button>
                    ))}
                  </Box>
                </Grid>'''

if old in text:
    text = text.replace(old, new)
    print('✅ 「除外日にすること」をボックス選択に変更しました')
else:
    print('❌ 対象テキストが見つかりませんでした')

with open('frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
