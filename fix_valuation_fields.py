#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク4.1: valuation_required 特別処理ブロックに査定フィールドを追加
UTF-8エンコーディングを維持しながら変更を適用する
"""

file_path = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前のコード（return文全体）
old_code = '''                      return (
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
                      );'''

# 変更後のコード（フラグメントでラップし、査定フィールドを追加）
new_code = '''                      return (
                        <>
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
                          {buyer.valuation_required === '要' && VALUATION_FIELDS.map((vField) => (
                            <Grid item xs={12} key={`valuation-field-${vField.key}`}>
                              <InlineEditableField
                                label={vField.label}
                                value={buyer[vField.key] || ''}
                                fieldName={vField.key}
                                onSave={async (newValue: any) => {
                                  const result = await handleInlineFieldSave(vField.key, newValue);
                                  if (result && !result.success && result.error) {
                                    throw new Error(result.error);
                                  }
                                }}
                                onChange={(fieldName: string, newValue: any) => handleFieldChange(section.title, fieldName, newValue)}
                                buyerId={buyer_number}
                              />
                            </Grid>
                          ))}
                        </>
                      );'''

if old_code in text:
    text = text.replace(old_code, new_code, 1)
    print('✅ 変更を適用しました')
else:
    print('❌ 対象コードが見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('valuation_required フィールドは特別処理')
    if idx >= 0:
        print(f'  ブロック開始位置: {idx}')
        print(f'  前後100文字: {repr(text[idx:idx+200])}')
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました（UTF-8）')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')
