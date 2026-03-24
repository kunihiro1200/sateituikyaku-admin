#!/usr/bin/env python3
# initial_assignee と broker_inquiry を Button ベースのボックス選択UIに変更

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# ===== 1. initial_assignee のChip → Buttonボックス選択 =====
old_initial = """                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {normalInitials.map((initial) => (
                              <Chip
                                key={initial}
                                label={initial}
                                size="small"
                                onClick={async () => {
                                  const newValue = buyer.initial_assignee === initial ? '' : initial;
                                  await handleInlineFieldSave('initial_assignee', newValue);
                                }}
                                color={buyer.initial_assignee === initial ? 'primary' : 'default'}
                                variant={buyer.initial_assignee === initial ? 'filled' : 'outlined'}
                                sx={{ cursor: 'pointer', fontWeight: buyer.initial_assignee === initial ? 'bold' : 'normal' }}
                              />
                            ))}
                            {/* 現在の値がリストにない場合も表示 */}
                            {buyer.initial_assignee && !normalInitials.includes(buyer.initial_assignee) && (
                              <Chip
                                label={buyer.initial_assignee}
                                size="small"
                                color="primary"
                                variant="filled"
                                sx={{ fontWeight: 'bold' }}
                              />
                            )}
                          </Box>"""

new_initial = """                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {normalInitials.map((initial) => {
                              const isSelected = buyer.initial_assignee === initial;
                              return (
                                <Button
                                  key={initial}
                                  size="small"
                                  variant={isSelected ? 'contained' : 'outlined'}
                                  color="primary"
                                  onClick={async () => {
                                    const newValue = isSelected ? '' : initial;
                                    await handleInlineFieldSave('initial_assignee', newValue);
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
                            {/* 現在の値がリストにない場合も表示 */}
                            {buyer.initial_assignee && !normalInitials.includes(buyer.initial_assignee) && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                sx={{ minWidth: 40, px: 1.5, py: 0.5, fontWeight: 'bold', borderRadius: 1 }}
                              >
                                {buyer.initial_assignee}
                              </Button>
                            )}
                          </Box>"""

if old_initial in text:
    text = text.replace(old_initial, new_initial)
    print('OK: initial_assignee をButtonボックス選択に変更')
else:
    print('NG: initial_assignee パターンが見つかりません')

# ===== 2. broker_inquiry のChip → Buttonボックス選択 =====
old_broker = """                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {BROKER_OPTIONS.map((option) => (
                              <Chip
                                key={option}
                                label={option}
                                size="small"
                                onClick={async () => {
                                  const newValue = buyer.broker_inquiry === option ? '' : option;
                                  handleFieldChange(section.title, field.key, newValue);
                                  await handleInlineFieldSave(field.key, newValue);
                                }}
                                color={buyer.broker_inquiry === option ? 'primary' : 'default'}
                                variant={buyer.broker_inquiry === option ? 'filled' : 'outlined'}
                                sx={{ cursor: 'pointer', fontWeight: buyer.broker_inquiry === option ? 'bold' : 'normal' }}
                              />
                            ))}
                          </Box>"""

new_broker = """                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
                          </Box>"""

if old_broker in text:
    text = text.replace(old_broker, new_broker)
    print('OK: broker_inquiry をButtonボックス選択に変更')
else:
    print('NG: broker_inquiry パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
