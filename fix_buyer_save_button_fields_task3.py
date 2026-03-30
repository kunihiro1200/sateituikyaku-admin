#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク3: カスタムフィールドの保存フロー変更
BuyerDetailPage.tsx の以下フィールドから handleInlineFieldSave の呼び出しを削除する:
  3.1 initial_assignee
  3.2 owned_home_hearing_inquiry (staffSelect)
  3.3 owned_home_hearing_result (homeHearingResult)
  3.4 valuation_required (valuationRequired)
  3.5 broker_inquiry (boxSelect)
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ---- 3.1 initial_assignee ----
# 変更前:
#                                     // バックグラウンドで保存
#                                     handleInlineFieldSave('initial_assignee', newValue).catch(console.error);
# 変更後:
#                                     // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
old_31 = (
    "                                    // バックグラウンドで保存\n"
    "                                    handleInlineFieldSave('initial_assignee', newValue).catch(console.error);"
)
new_31 = (
    "                                    // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない"
)
assert old_31 in text, "3.1 initial_assignee: 対象文字列が見つかりません"
text = text.replace(old_31, new_31, 1)

# ---- 3.2 owned_home_hearing_inquiry (staffSelect) ----
# 変更前:
#                                       setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
#                                       handleFieldChange(section.title, field.key, newValue);
#                                       handleInlineFieldSave(field.key, newValue).catch(console.error);
#                                     }}
#                                     sx={{
#                                       minWidth: 40,
# 変更後: handleInlineFieldSave の行を削除してコメントに置換
old_32 = (
    "                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);\n"
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      handleInlineFieldSave(field.key, newValue).catch(console.error);\n"
    "                                    }}\n"
    "                                    sx={{\n"
    "                                      minWidth: 40,"
)
new_32 = (
    "                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);\n"
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない\n"
    "                                    }}\n"
    "                                    sx={{\n"
    "                                      minWidth: 40,"
)
assert old_32 in text, "3.2 owned_home_hearing_inquiry: 対象文字列が見つかりません"
text = text.replace(old_32, new_32, 1)

# ---- 3.3 owned_home_hearing_result (homeHearingResult) ----
# 変更前:
#                                       handleFieldChange(section.title, field.key, newValue);
#                                       setMissingRequiredFields(prev => {
#                                         ...
#                                       });
#                                       handleInlineFieldSave(field.key, newValue).catch(console.error);
#                                     }}
#                                     sx={{
#                                       flex: 1,
#                                       py: 0.5,
#                                       fontWeight: isSelected ? 'bold' : 'normal',
#                                       borderRadius: 1,
#                                     }}
#                                   >
#                                     {option}
#                                   </Button>
#                                 );
#                               })}
#                             </Box>
#                             {showValuationText && (
old_33 = (
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      setMissingRequiredFields(prev => {\n"
    "                                        const next = new Set(prev);\n"
    "                                        if (newValue && String(newValue).trim()) next.delete('owned_home_hearing_result');\n"
    "                                        else next.add('owned_home_hearing_result');\n"
    "                                        return next;\n"
    "                                      });\n"
    "                                      handleInlineFieldSave(field.key, newValue).catch(console.error);\n"
    "                                    }}"
)
new_33 = (
    "                                      handleFieldChange(section.title, field.key, newValue);\n"
    "                                      setMissingRequiredFields(prev => {\n"
    "                                        const next = new Set(prev);\n"
    "                                        if (newValue && String(newValue).trim()) next.delete('owned_home_hearing_result');\n"
    "                                        else next.add('owned_home_hearing_result');\n"
    "                                        return next;\n"
    "                                      });\n"
    "                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない\n"
    "                                    }}"
)
assert old_33 in text, "3.3 owned_home_hearing_result: 対象文字列が見つかりません"
text = text.replace(old_33, new_33, 1)

# ---- 3.4 valuation_required (valuationRequired) ----
# 変更前:
#                                         handleFieldChange(section.title, field.key, newValue);
#                                         // 保存はバックグラウンドで実行
#                                         handleInlineFieldSave(field.key, newValue);
#                                       }}
#                                       sx={{
#                                         flex: 1,
#                                         py: 0.5,
#                                         fontWeight: isSelected ? 'bold' : 'normal',
#                                         borderRadius: 1,
#                                       }}
#                                     >
#                                       {option}
#                                     </Button>
#                                   );
#                                 })}
#                               </Box>
#                             </Box>
#                           </Grid>
#                           {buyer.valuation_required === '要' && (() => {
old_34 = (
    "                                        handleFieldChange(section.title, field.key, newValue);\n"
    "                                        // 保存はバックグラウンドで実行\n"
    "                                        handleInlineFieldSave(field.key, newValue);\n"
    "                                      }}"
)
new_34 = (
    "                                        handleFieldChange(section.title, field.key, newValue);\n"
    "                                        // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない\n"
    "                                      }}"
)
assert old_34 in text, "3.4 valuation_required: 対象文字列が見つかりません"
text = text.replace(old_34, new_34, 1)

# ---- 3.5 broker_inquiry (boxSelect) ----
# 変更前:
#                                     setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
#                                     handleFieldChange(section.title, field.key, newValue);
#                                     handleInlineFieldSave(field.key, newValue).catch(console.error);
#                                   }}
#                                   sx={{
#                                     flex: 1,
#                                     py: 0.5,
#                                     fontSize: '0.7rem',
old_35 = (
    "                                    setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);\n"
    "                                    handleFieldChange(section.title, field.key, newValue);\n"
    "                                    handleInlineFieldSave(field.key, newValue).catch(console.error);\n"
    "                                  }}\n"
    "                                  sx={{\n"
    "                                    flex: 1,\n"
    "                                    py: 0.5,\n"
    "                                    fontSize: '0.7rem',"
)
new_35 = (
    "                                    setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);\n"
    "                                    handleFieldChange(section.title, field.key, newValue);\n"
    "                                    // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない\n"
    "                                  }}\n"
    "                                  sx={{\n"
    "                                    flex: 1,\n"
    "                                    py: 0.5,\n"
    "                                    fontSize: '0.7rem',"
)
assert old_35 in text, "3.5 broker_inquiry: 対象文字列が見つかりません"
text = text.replace(old_35, new_35, 1)

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了: タスク3の変更を適用しました")
print("  3.1 initial_assignee: handleInlineFieldSave を削除")
print("  3.2 owned_home_hearing_inquiry: handleInlineFieldSave を削除")
print("  3.3 owned_home_hearing_result: handleInlineFieldSave を削除")
print("  3.4 valuation_required: handleInlineFieldSave を削除")
print("  3.5 broker_inquiry: handleInlineFieldSave を削除")
