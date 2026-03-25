# BuyerDetailPage.tsx の変更スクリプト
# 1. BUYER_FIELD_SECTIONS に vendor_survey を inquiry_hearing の直前に追加
# 2. three_calls_confirmed の fieldType を dropdown から buttonSelect に変更
# 3. three_calls_confirmed のレンダリングを条件付き表示・2択に変更
# 4. vendor_survey のレンダリングを追加

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: BUYER_FIELD_SECTIONS に vendor_survey を inquiry_hearing の直前に追加 ---
# また three_calls_confirmed の fieldType を dropdown から buttonSelect に変更
old_section = """      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'dropdown' },"""

new_section = """      { key: 'vendor_survey', label: '業者向けアンケート', inlineEditable: true, fieldType: 'buttonSelect' },
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'buttonSelect' },"""

if old_section in text:
    text = text.replace(old_section, new_section)
    print('変更1: BUYER_FIELD_SECTIONS 更新完了')
else:
    print('エラー: 変更1のターゲットが見つかりません')

# --- 変更2: three_calls_confirmed のレンダリングを条件付き表示・2択に変更 ---
old_three_calls = """                    // three_calls_confirmedフィールドは特別処理（ボタン選択）
                    if (field.key === 'three_calls_confirmed') {
                      const THREE_CALLS_BTNS = ['3回架電OK', '3回架電未', '他'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {THREE_CALLS_BTNS.map((opt) => {
                                const isSelected = value === opt;
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

new_three_calls = """                    // vendor_surveyフィールドは特別処理（ボタン選択）
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
                    }

                    // three_calls_confirmedフィールドは特別処理（inquiry_email_phone=不通のときのみ表示・必須）
                    if (field.key === 'three_calls_confirmed') {
                      // inquiry_email_phone が「不通」の場合のみ表示
                      if (buyer?.inquiry_email_phone !== '不通') {
                        return null;
                      }
                      const THREE_CALLS_BTNS = ['確認済み', '未'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="error" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}>
                              {field.label} *
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {THREE_CALLS_BTNS.map((opt) => {
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

if old_three_calls in text:
    text = text.replace(old_three_calls, new_three_calls)
    print('変更2: three_calls_confirmed レンダリング更新完了')
else:
    print('エラー: 変更2のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を更新しました')
