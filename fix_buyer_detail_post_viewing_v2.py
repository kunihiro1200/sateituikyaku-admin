# fix_buyer_detail_post_viewing_v2.py
# BuyerDetailPage.tsx に post_viewing_seller_contact の buttonSelect 処理を追加する
# broker_survey の特別処理の直後に挿入する

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# broker_survey の処理ブロックの直後（three_calls_confirmed の前）に post_viewing_seller_contact を追加
old_anchor = """                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phoneに値があれば常時表示）
                    if (field.key === 'three_calls_confirmed') {"""

new_anchor = """                    // post_viewing_seller_contactフィールドは特別処理（ボタン選択・即時保存）
                    if (field.key === 'post_viewing_seller_contact') {
                      const POST_VIEWING_OPTIONS = ['済', '未', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {POST_VIEWING_OPTIONS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
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
                                    {opt}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }

                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phoneに値があれば常時表示）
                    if (field.key === 'three_calls_confirmed') {"""

text = text.replace(old_anchor, new_anchor)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('post_viewing_seller_contact の buttonSelect 処理を追加しました')
