#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
テキスト入力フィールドをmultiline（ロングテキスト）に変更
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# renderTextInputにmultiline=trueを追加
old = """                            // テキスト入力ヘルパー
                            const renderTextInput = (fieldKey: string, label: string) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <InlineEditableField
                                  label={label}
                                  value={buyer[fieldKey] || ''}
                                  fieldName={fieldKey}
                                  onSave={async (newValue: any) => {
                                    const result = await handleInlineFieldSave(fieldKey, newValue);
                                    if (result && !result.success && result.error) {
                                      throw new Error(result.error);
                                    }
                                  }}
                                  onChange={(fn: string, nv: any) => handleFieldChange(section.title, fn, nv)}
                                  buyerId={buyer_number}
                                />
                              </Grid>
                            );"""

new = """                            // テキスト入力ヘルパー（ロングテキスト）
                            const renderTextInput = (fieldKey: string, label: string) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <InlineEditableField
                                  label={label}
                                  value={buyer[fieldKey] || ''}
                                  fieldName={fieldKey}
                                  multiline={true}
                                  onSave={async (newValue: any) => {
                                    const result = await handleInlineFieldSave(fieldKey, newValue);
                                    if (result && !result.success && result.error) {
                                      throw new Error(result.error);
                                    }
                                  }}
                                  onChange={(fn: string, nv: any) => handleFieldChange(section.title, fn, nv)}
                                  buyerId={buyer_number}
                                />
                              </Grid>
                            );"""

text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    print('BOM check:', repr(f.read(3)))
