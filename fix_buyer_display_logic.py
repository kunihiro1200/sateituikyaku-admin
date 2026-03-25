# BuyerDetailPage.tsx の表示ロジック修正
# 1. vendor_survey: 値が空でない場合は常時表示（「未」のときはオレンジ強調）
# 2. three_calls_confirmed: inquiry_email_phone に値があれば常時表示（不通限定を解除）

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: vendor_survey の表示条件を「値が空でない場合」に変更 ---
old_vendor = """                    // vendor_surveyフィールドは特別処理（「未」のときだけボタン選択UIを表示）
                    if (field.key === 'vendor_survey') {
                      // 「未」のときだけ表示
                      if (buyer?.vendor_survey !== '未') {
                        return null;
                      }
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="warning.main" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {VENDOR_SURVEY_BTNS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '未' ? 'warning' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);
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
                    }"""

new_vendor = """                    // vendor_surveyフィールドは特別処理（値が入っている場合は常時表示、「未」のときはオレンジ強調）
                    if (field.key === 'vendor_survey') {
                      // 値が空の場合は非表示
                      if (!buyer?.vendor_survey) {
                        return null;
                      }
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      const isUmi = buyer?.vendor_survey === '未';
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold', color: isUmi ? 'warning.main' : 'text.secondary' }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {VENDOR_SURVEY_BTNS.map((opt) => {
                                const isSelected = buyer?.[field.key] === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '未' ? 'warning' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);
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
                    }"""

if old_vendor in text:
    text = text.replace(old_vendor, new_vendor)
    print('変更1: vendor_survey 表示条件を「値が空でない場合」に変更完了')
else:
    print('エラー: 変更1のターゲットが見つかりません')

# --- 変更2: three_calls_confirmed の表示条件を「inquiry_email_phone に値があれば表示」に変更 ---
old_three = """                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phone=不通のときのみ表示・必須）
                    if (field.key === 'three_calls_confirmed') {
                      // inquiry_email_phone が「不通」の場合のみ表示
                      if (buyer?.inquiry_email_phone !== '不通') {
                        return null;
                      }"""

new_three = """                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phoneに値があれば常時表示）
                    if (field.key === 'three_calls_confirmed') {
                      // inquiry_email_phone に値がない場合は非表示
                      if (!buyer?.inquiry_email_phone) {
                        return null;
                      }"""

if old_three in text:
    text = text.replace(old_three, new_three)
    print('変更2: three_calls_confirmed 表示条件を「inquiry_email_phoneに値があれば表示」に変更完了')
else:
    print('エラー: 変更2のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を更新しました')
