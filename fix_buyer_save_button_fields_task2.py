#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク2: buttonSelect / dropdown フィールドの保存フロー変更
- broker_survey, distribution_type, three_calls_confirmed (buttonSelect)
- inquiry_email_phone, pinrich (dropdown)
の handleInlineFieldSave 呼び出しを削除する
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== タスク2.1: buttonSelect フィールドの修正 =====

# 1. inquiry_email_phone の handleInlineFieldSave 呼び出しを削除
# （inquiry_email_phoneはdropdownだが、ボタン選択UIで実装されているため先に処理）
old1 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('inquiry_email_phone');
                                        else next.add('inquiry_email_phone');
                                        return next;
                                      });
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

                    // distribution_typeフィールドは特別処理"""

new1 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('inquiry_email_phone');
                                        else next.add('inquiry_email_phone');
                                        return next;
                                      });
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

                    // distribution_typeフィールドは特別処理"""

if old1 in text:
    text = text.replace(old1, new1, 1)
    print("✅ inquiry_email_phone の handleInlineFieldSave 削除完了")
else:
    print("❌ inquiry_email_phone のパターンが見つかりません")

# 2. distribution_type の handleInlineFieldSave 呼び出しを削除
old2 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('distribution_type');
                                        else next.add('distribution_type');
                                        return next;
                                      });
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt.label}
                                  </Button>"""

new2 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('distribution_type');
                                        else next.add('distribution_type');
                                        return next;
                                      });
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}
                                    sx={{
                                      flex: 1,
                                      py: 0.5,
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      borderRadius: 1,
                                    }}
                                  >
                                    {opt.label}
                                  </Button>"""

if old2 in text:
    text = text.replace(old2, new2, 1)
    print("✅ distribution_type の handleInlineFieldSave 削除完了")
else:
    print("❌ distribution_type のパターンが見つかりません")

# 3. pinrich の handleInlineFieldSave 呼び出しを削除
old3 = """                              onChange={async (e) => {
                                const newValue = e.target.value;
                                setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                handleFieldChange(section.title, field.key, newValue);
                                handleInlineFieldSave(field.key, newValue).catch(console.error);
                              }}"""

new3 = """                              onChange={async (e) => {
                                const newValue = e.target.value;
                                setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                handleFieldChange(section.title, field.key, newValue);
                                // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                              }}"""

if old3 in text:
    text = text.replace(old3, new3, 1)
    print("✅ pinrich の handleInlineFieldSave 削除完了")
else:
    print("❌ pinrich のパターンが見つかりません")

# 4. broker_survey の handleInlineFieldSave 呼び出しを削除
old4 = """                                    onClick={async () => {
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

"""

new4 = """                                    onClick={async () => {
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

"""

if old4 in text:
    text = text.replace(old4, new4, 1)
    print("✅ broker_survey の handleInlineFieldSave 削除完了")
else:
    print("❌ broker_survey のパターンが見つかりません")

# 5. three_calls_confirmed の handleInlineFieldSave 呼び出しを削除
old5 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('three_calls_confirmed');
                                        else next.add('three_calls_confirmed');
                                        return next;
                                      });
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

                    // confirmation_to_assigneeフィールドは"""

new5 = """                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('three_calls_confirmed');
                                        else next.add('three_calls_confirmed');
                                        return next;
                                      });
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

                    // confirmation_to_assigneeフィールドは"""

if old5 in text:
    text = text.replace(old5, new5, 1)
    print("✅ three_calls_confirmed の handleInlineFieldSave 削除完了")
else:
    print("❌ three_calls_confirmed のパターンが見つかりません")

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ 全変更完了")

# BOMチェック
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM check: {repr(first_bytes[:3])} (should NOT be b'\\xef\\xbb\\xbf')")
