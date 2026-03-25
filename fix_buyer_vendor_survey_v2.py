# BuyerDetailPage.tsx の修正スクリプト
# 1. vendor_survey: 値が「未」のときだけボタン選択UIを表示
# 2. three_calls_confirmed: 選択肢を「3回架電OK」「3回架電未」「他」の3択に変更

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: vendor_survey を「未」のときだけ表示 ---
old_vendor = """                    // vendor_surveyフィールドは特別処理（ボタン選択）
                    if (field.key === 'vendor_survey') {
                      const VENDOR_SURVEY_BTNS = ['確認済み', '未'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
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
                                    color="primary"
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

new_vendor = """                    // vendor_surveyフィールドは特別処理（「未」のときだけボタン選択UIを表示）
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

if old_vendor in text:
    text = text.replace(old_vendor, new_vendor)
    print('変更1: vendor_survey 条件付き表示（未のみ）完了')
else:
    print('エラー: 変更1のターゲットが見つかりません')

# --- 変更2: three_calls_confirmed の選択肢を3択に変更 ---
old_three = """                      const THREE_CALLS_BTNS = ['確認済み', '未'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="error" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}>
                              {field.label} *
                            </Typography>"""

new_three = """                      const THREE_CALLS_BTNS = ['3回架電OK', '3回架電未', '他'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="error" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}>
                              {field.label} *
                            </Typography>"""

if old_three in text:
    text = text.replace(old_three, new_three)
    print('変更2: three_calls_confirmed 3択に変更完了')
else:
    print('エラー: 変更2のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を更新しました')
