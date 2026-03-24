#!/usr/bin/env python3
# broker_inquiry: ラベルとボタンを横並び、ボタンは均等幅で幅いっぱいに

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = """                    // broker_inquiryフィールドは特別処理（ボックス選択）
                    if (field.key === 'broker_inquiry') {
                      const BROKER_OPTIONS = ['業者', '個人'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {BROKER_OPTIONS.map((option) => {
                              const isSelected = buyer.broker_inquiry === option;
                              return (
                                <Button
                                  key={option}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={async () => {
                                    const newValue = isSelected ? '' : option;
                                    handleFieldChange(section.title, field.key, newValue);
                                    await handleInlineFieldSave(field.key, newValue);
                                  }}
                                  sx={{
                                    minWidth: 48,
                                    px: 1.5,
                                    py: 0.5,
                                    fontWeight: isSelected ? 'bold' : 'normal',
                                    borderRadius: 1,
                                  }}
                                >
                                  {option}
                                </Button>
                              );
                            })}
                          </Box>
                        </Grid>
                      );
                    }"""

new = """                    // broker_inquiryフィールドは特別処理（ボックス選択）
                    if (field.key === 'broker_inquiry') {
                      const BROKER_OPTIONS = ['業者', '個人'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {BROKER_OPTIONS.map((option) => {
                                const isSelected = buyer.broker_inquiry === option;
                                return (
                                  <Button
                                    key={option}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : option;
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {option}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }"""

if old in text:
    text = text.replace(old, new)
    print('OK: broker_inquiry レイアウトを横並び・均等幅に変更')
else:
    print('NG: パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
