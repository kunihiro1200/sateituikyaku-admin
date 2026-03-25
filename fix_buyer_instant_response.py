# -*- coding: utf-8 -*-
"""
InlineEditableFieldのonSaveをノンブロッキングに変更。
UIを即座に更新し、API保存はバックグラウンドで実行する。
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. inquiry_source の handleFieldSave をノンブロッキングに
old_inquiry_save = """                    if (field.key === 'inquiry_source') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };"""

new_inquiry_save = """                    if (field.key === 'inquiry_source') {
                      const handleFieldSave = async (newValue: any) => {
                        // UIを即座に更新（楽観的更新）
                        setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                        handleFieldChange(section.title, field.key, newValue);
                        // 必須フィールドの再チェック
                        setMissingRequiredFields(prev => {
                          const next = new Set(prev);
                          if (newValue && String(newValue).trim()) next.delete('inquiry_source');
                          else next.add('inquiry_source');
                          return next;
                        });
                        // バックグラウンドで保存
                        handleInlineFieldSave(field.key, newValue).catch(console.error);
                      };"""

text = text.replace(old_inquiry_save, new_inquiry_save)

# 2. latest_status の handleFieldSave をノンブロッキングに
old_latest_save = """                    if (field.key === 'latest_status') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };"""

new_latest_save = """                    if (field.key === 'latest_status') {
                      const handleFieldSave = async (newValue: any) => {
                        // UIを即座に更新（楽観的更新）
                        setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                        handleFieldChange(section.title, field.key, newValue);
                        // 必須フィールドの再チェック
                        setMissingRequiredFields(prev => {
                          const next = new Set(prev);
                          if (newValue && String(newValue).trim()) next.delete('latest_status');
                          else next.add('latest_status');
                          return next;
                        });
                        // バックグラウンドで保存
                        handleInlineFieldSave(field.key, newValue).catch(console.error);
                      };"""

text = text.replace(old_latest_save, new_latest_save)

# 3. その他フィールドの handleFieldSave をノンブロッキングに
old_other_save = """                    // その他のフィールド
                    const handleFieldSave = async (newValue: any) => {
                      const result = await handleInlineFieldSave(field.key, newValue);
                      if (result && !result.success && result.error) {"""

new_other_save = """                    // その他のフィールド
                    const handleFieldSave = async (newValue: any) => {
                      // UIを即座に更新（楽観的更新）
                      setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
                      // バックグラウンドで保存
                      const result = await handleInlineFieldSave(field.key, newValue);
                      if (result && !result.success && result.error) {"""

text = text.replace(old_other_save, new_other_save)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
