#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
broker_survey の handleInlineFieldSave 呼び出しを削除する
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """                                    onClick={async () => {
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

                    // three_calls_confirmedフィールドは特別処理"""

new = """                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
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

                    // three_calls_confirmedフィールドは特別処理"""

if old in text:
    text = text.replace(old, new, 1)
    print("✅ broker_survey の handleInlineFieldSave 削除完了")
else:
    print("❌ パターンが見つかりません")
    # デバッグ: 周辺テキストを確認
    idx = text.find("// three_calls_confirmedフィールドは特別処理")
    if idx >= 0:
        print("周辺テキスト（前200文字）:")
        print(repr(text[idx-200:idx]))

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ 書き込み完了")
