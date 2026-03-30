# -*- coding: utf-8 -*-
"""
バグ修正: owned_home_hearing_inquiry を解除した際に
owned_home_hearing_result の必須状態が残るバグを修正する。

owned_home_hearing_inquiry のボタンクリック時に
missingRequiredFields を更新する処理を追加する。
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# owned_home_hearing_inquiry のボタンクリック時に missingRequiredFields を更新する処理を追加
# 現在: setBuyer + handleFieldChange のみ
# 修正後: setBuyer + handleFieldChange + missingRequiredFields の更新

OLD_INQUIRY_CLICK = '''                                    onClick={async () => {
                                      const newValue = isSelected ? '' : initial;
                                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                                      handleFieldChange(section.title, field.key, newValue);
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}'''

NEW_INQUIRY_CLICK = '''                                    onClick={async () => {
                                      const newValue = isSelected ? '' : initial;
                                      setBuyer((prev: any) => {
                                        if (!prev) return prev;
                                        const updated = { ...prev, [field.key]: newValue };
                                        // owned_home_hearing_inquiry が変わったら owned_home_hearing_result の必須状態を再計算
                                        setMissingRequiredFields(prevMissing => {
                                          const next = new Set(prevMissing);
                                          if (isHomeHearingResultRequired(updated)) {
                                            if (!updated.owned_home_hearing_result || !String(updated.owned_home_hearing_result).trim()) {
                                              next.add('owned_home_hearing_result');
                                            }
                                          } else {
                                            next.delete('owned_home_hearing_result');
                                          }
                                          return next;
                                        });
                                        return updated;
                                      });
                                      handleFieldChange(section.title, field.key, newValue);
                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
                                    }}'''

if NEW_INQUIRY_CLICK in text:
    print('既に修正済みです。スキップします。')
elif OLD_INQUIRY_CLICK in text:
    text = text.replace(OLD_INQUIRY_CLICK, NEW_INQUIRY_CLICK, 1)
    print('owned_home_hearing_inquiry クリック時の missingRequiredFields 更新処理を追加しました。')
else:
    print('ERROR: 対象のコードブロックが見つかりません。', file=sys.stderr)
    sys.exit(1)

# UTF-8 で書き戻す
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を UTF-8 で書き戻しました。')
