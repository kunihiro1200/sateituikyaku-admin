# -*- coding: utf-8 -*-
"""
ボタン系フィールドの onClick で setBuyer を先に呼び、
handleInlineFieldSave はバックグラウンドで実行する。
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# inquiry_email_phone と three_calls_confirmed のボタン
# パターン: handleFieldChange + await handleInlineFieldSave
old_btn1 = """                                      const newValue = isSelected ? '' : opt;
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);"""

new_btn1 = """                                      const newValue = isSelected ? '' : opt;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);"""

# 2箇所あるので両方置換
text = text.replace(old_btn1, new_btn1)

# broker_inquiry ボタン
old_btn2 = """                                    const newValue = isSelected ? '' : option;
                                    handleFieldChange(section.title, field.key, newValue);
                                    await handleInlineFieldSave(field.key, newValue);"""

new_btn2 = """                                    const newValue = isSelected ? '' : option;
                                    setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                    handleFieldChange(section.title, field.key, newValue);
                                    handleInlineFieldSave(field.key, newValue).catch(console.error);"""

text = text.replace(old_btn2, new_btn2)

# owned_home_hearing_inquiry ボタン
old_btn3 = """                                      const newValue = isSelected ? '' : initial;
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);"""

new_btn3 = """                                      const newValue = isSelected ? '' : initial;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);"""

text = text.replace(old_btn3, new_btn3)

# owned_home_hearing_result ボタン
old_btn4 = """                                      const newValue = isSelected ? '' : option;
                                      handleFieldChange(section.title, field.key, newValue);
                                      await handleInlineFieldSave(field.key, newValue);"""

new_btn4 = """                                      const newValue = isSelected ? '' : option;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);"""

text = text.replace(old_btn4, new_btn4)

# renderButtonSelect内のボタン（valuation fields）
old_btn5 = """                                            const newValue = isSelected ? '' : option;
                                            // UIを即座に更新（awaitしない）
                                            handleFieldChange(section.title, fieldKey, newValue);
                                            setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: newValue } : prev);
                                            // 保存はバックグラウンドで実行
                                            handleInlineFieldSave(fieldKey, newValue);"""

new_btn5 = """                                            const newValue = isSelected ? '' : option;
                                            setBuyer((prev: any) => prev ? { ...prev, [fieldKey]: newValue } : prev);
                                            handleFieldChange(section.title, fieldKey, newValue);
                                            handleInlineFieldSave(fieldKey, newValue).catch(console.error);"""

text = text.replace(old_btn5, new_btn5)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# 残っているawait handleInlineFieldSaveを確認
remaining = text.count('await handleInlineFieldSave')
print(f'Done! 残りのawait handleInlineFieldSave: {remaining}箇所')
