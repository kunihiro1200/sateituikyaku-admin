import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# inquiry_email_phone の古い実装を新しい実装に置換
old_inquiry = '''                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）
                    if (field.key === 'inquiry_email_phone') {
                      // 問合せ元に「電話」が含まれる場合は非表示
                      if (buyer.inquiry_source && buyer.inquiry_source.includes('電話')) {
                        return null;
                      }
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {['済', '未'].map((opt) => (
                                <Button
                                  key={opt}
                                  size="small"
                                  variant={value === opt ? 'contained' : 'outlined'}
                                  color={opt === '済' ? 'success' : 'error'}
                                  onClick={() => handleInlineFieldSave('inquiry_email_phone', opt)}
                                  sx={{ minWidth: 48 }}
                                >
                                  {opt}
                                </Button>
                              ))}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }'''

new_inquiry = '''                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）
                    if (field.key === 'inquiry_email_phone') {
                      // 問合せ元に「電話」が含まれる場合は非表示
                      if (buyer.inquiry_source && buyer.inquiry_source.includes('電話')) {
                        return null;
                      }
                      const INQUIRY_EMAIL_PHONE_BTNS = ['済', '未', '不通', '電話番号なし', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {INQUIRY_EMAIL_PHONE_BTNS.map((opt) => {
                                const isSelected = value === opt;
                                return (
                                  <Button
                                    key={opt}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color={opt === '済' ? 'success' : opt === '未' ? 'error' : 'primary'}
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
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
                    }'''

if old_inquiry in text:
    text = text.replace(old_inquiry, new_inquiry)
    print('✅ inquiry_email_phone を置換しました')
else:
    print('❌ inquiry_email_phone の対象テキストが見つかりません')

# three_calls_confirmed の古い実装（ドロップダウン）を新しい実装（ボタン選択）に置換
old_three = '''                    // three_calls_confirmedフィールドは特別処理（ドロップダウン）
                    if (field.key === 'three_calls_confirmed') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={THREE_CALLS_CONFIRMED_OPTIONS}
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }'''

new_three = '''                    // three_calls_confirmedフィールドは特別処理（ボタン選択）
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
                    }'''

if old_three in text:
    text = text.replace(old_three, new_three)
    print('✅ three_calls_confirmed を置換しました')
else:
    print('❌ three_calls_confirmed の対象テキストが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
