import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# owned_home_hearing_inquiry: 横並び → 縦並び（ラベル上、ボタン下）
old_inquiry = '''                    // owned_home_hearing_inquiry フィールドは特別処理（スタッフイニシャル選択）
                    if (field.key === 'owned_home_hearing_inquiry') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {normalInitials.map((initial) => {
                                const isSelected = buyer.owned_home_hearing_inquiry === initial;
                                return (
                                  <Button
                                    key={initial}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : initial;
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
                                    {initial}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }'''

new_inquiry = '''                    // owned_home_hearing_inquiry フィールドは特別処理（スタッフイニシャル選択）
                    if (field.key === 'owned_home_hearing_inquiry') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {normalInitials.map((initial) => {
                                const isSelected = buyer.owned_home_hearing_inquiry === initial;
                                return (
                                  <Button
                                    key={initial}
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    color="primary"
                                    onClick={async () => {
                                      const newValue = isSelected ? '' : initial;
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);
                                    }}
                                    sx={{
                                      minWidth: 40,
                                      px: 1.5,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {initial}
                                  </Button>
                                );
                              })}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }'''

# owned_home_hearing_result: 横並び → 縦並び（ラベル上、ボタン下）
old_result = '''                    // owned_home_hearing_result フィールドは特別処理（4择ボタン・条件付き表示）
                    if (field.key === 'owned_home_hearing_result') {
                      if (!buyer.owned_home_hearing_inquiry) return null;
                      const RESULT_OPTIONS = ['持家（マンション）', '持家（戸建）', '賃貸', '他不明'];
                      const showValuationText = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0.5 }}>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {RESULT_OPTIONS.map((option) => {
                                  const isSelected = buyer.owned_home_hearing_result === option;
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
                              {showValuationText && (
                                <Typography variant="caption" color="primary.main" sx={{ mt: 0.5 }}>
                                  机上査定を無料で行っていますがこの後メールで査定額差し上げましょうか？
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }'''

new_result = '''                    // owned_home_hearing_result フィールドは特別処理（4択ボタン・条件付き表示）
                    if (field.key === 'owned_home_hearing_result') {
                      if (!buyer.owned_home_hearing_inquiry) return null;
                      const RESULT_OPTIONS = ['持家（マンション）', '持家（戸建）', '賃貸', '他不明'];
                      const showValuationText = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {RESULT_OPTIONS.map((option) => {
                                const isSelected = buyer.owned_home_hearing_result === option;
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
                            {showValuationText && (
                              <Typography variant="caption" color="primary.main" sx={{ mt: 0.5 }}>
                                机上査定を無料で行っていますがこの後メールで査定額差し上げましょうか？
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      );
                    }'''

# valuation_required: 横並び → 縦並び（ラベル上、ボタン下）
old_valuation = '''                    // valuation_required フィールドは特別処理（2择ボタン・条件付き表示）
                    if (field.key === 'valuation_required') {
                      const showValuation = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      if (!showValuation) return null;
                      const VALUATION_OPTIONS = ['要', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                              {VALUATION_OPTIONS.map((option) => {
                                const isSelected = buyer.valuation_required === option;
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
                    }'''

new_valuation = '''                    // valuation_required フィールドは特別処理（2択ボタン・条件付き表示）
                    if (field.key === 'valuation_required') {
                      const showValuation = ['持家（マンション）', '持家（戸建）'].includes(
                        buyer.owned_home_hearing_result
                      );
                      if (!showValuation) return null;
                      const VALUATION_OPTIONS = ['要', '不要'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {VALUATION_OPTIONS.map((option) => {
                                const isSelected = buyer.valuation_required === option;
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
                    }'''

if old_inquiry in text:
    text = text.replace(old_inquiry, new_inquiry)
    print('OK: owned_home_hearing_inquiry replaced')
else:
    print('NG: owned_home_hearing_inquiry not found')

if old_result in text:
    text = text.replace(old_result, new_result)
    print('OK: owned_home_hearing_result replaced')
else:
    print('NG: owned_home_hearing_result not found')

if old_valuation in text:
    text = text.replace(old_valuation, new_valuation)
    print('OK: valuation_required replaced')
else:
    print('NG: valuation_required not found')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
