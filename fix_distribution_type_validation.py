#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の distribution_type ボタン選択UIで
「要」を選択した際に希望条件（エリア・予算・種別）の未入力チェックを追加する。
未入力の場合は保存をブロックし、希望条件ページへの誘導メッセージを表示する。
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# distribution_type ボタンの onClick に保存前バリデーションを追加
old_onclick = """                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt.value;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('distribution_type');
                                        else next.add('distribution_type');
                                        return next;
                                      });
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);
                                    }}"""

new_onclick = """                                    onClick={async () => {
                                      const newValue = isSelected ? '' : opt.value;

                                      // 「要」に変更する場合、希望条件の必須チェック
                                      if (newValue === '要' && buyer) {
                                        const missingConditions: string[] = [];
                                        if (!buyer.desired_area || !String(buyer.desired_area).trim()) missingConditions.push('エリア');
                                        if (!buyer.budget || !String(buyer.budget).trim()) missingConditions.push('予算');
                                        if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) missingConditions.push('希望種別');
                                        if (missingConditions.length > 0) {
                                          setSnackbar({
                                            open: true,
                                            message: `配信メールを「要」にするには、希望条件の${missingConditions.join('・')}を先に入力してください。「希望条件」ボタンから入力できます。`,
                                            severity: 'error',
                                          });
                                          return; // 保存しない
                                        }
                                      }

                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      setMissingRequiredFields(prev => {
                                        const next = new Set(prev);
                                        if (newValue && String(newValue).trim()) next.delete('distribution_type');
                                        else next.add('distribution_type');
                                        return next;
                                      });
                                      handleInlineFieldSave(field.key, newValue).catch(console.error);
                                    }}"""

text = text.replace(old_onclick, new_onclick, 1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! BuyerDetailPage.tsx updated with distribution_type validation.')
