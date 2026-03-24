#!/usr/bin/env python3
# broker_inquiry: 法人名の右隣に配置（xs=6）、ラベル上・ボタン下、選択肢変更

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 1. BUYER_FIELD_SECTIONS の broker_inquiry を xs=6 用に conditionalOn を削除（常に表示）
old_field_def = """      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'text', conditionalOn: 'company_name' },"""
new_field_def = """      { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'boxSelect' },"""

if old_field_def in text:
    text = text.replace(old_field_def, new_field_def)
    print('OK: broker_inquiry フィールド定義を更新')
else:
    print('NG: フィールド定義パターンが見つかりません')

# 2. broker_inquiry のレンダリングを変更
# 現在: xs=12、横並び（ラベル左・ボタン右）、選択肢['業者','個人']
# 変更後: xs=6、縦配置（ラベル上・ボタン下）、選択肢['業者問合せ','業者（両手）']
old_render = """                    // broker_inquiryフィールドは特別処理（ボックス選択）
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

new_render = """                    // broker_inquiryフィールドは特別処理（ボックス選択・法人名の右隣xs=6）
                    if (field.key === 'broker_inquiry') {
                      const BROKER_OPTIONS = ['業者問合せ', '業者（両手）'];
                      return (
                        <Grid item xs={6} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                                    fontSize: '0.7rem',
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

if old_render in text:
    text = text.replace(old_render, new_render)
    print('OK: broker_inquiry レンダリングを更新（xs=6、縦配置、新選択肢）')
else:
    print('NG: レンダリングパターンが見つかりません')

# 3. company_name を xs=6 に変更（法人名と業者問合せを同じ行に）
# gridSize は multiline でない場合 { xs: 12, sm: 6 } なので company_name はすでに sm=6
# ただし xs=12 なので xs=6 に変更する必要がある
# company_name は通常の InlineEditableField なので gridSize を使っている
# → BUYER_FIELD_SECTIONS で company_name に xs=6 を強制するため、
#   フィールド定義に gridXs プロパティを追加し、レンダリング側で使う方法は複雑
# → より簡単に: gridSize の計算ロジックで company_name を xs=6 にする

old_gridsize = """                  // multilineフィールドは全幅で表示
                  const gridSize = field.multiline ? { xs: 12 } : { xs: 12, sm: 6 };"""

new_gridsize = """                  // multilineフィールドは全幅で表示
                  // company_name は broker_inquiry と同じ行に並べるため xs=6
                  const gridSize = field.multiline ? { xs: 12 } : field.key === 'company_name' ? { xs: 6 } : { xs: 12, sm: 6 };"""

if old_gridsize in text:
    text = text.replace(old_gridsize, new_gridsize)
    print('OK: company_name を xs=6 に変更')
else:
    print('NG: gridSize パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
