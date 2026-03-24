#!/usr/bin/env python3
# InlineEditableField: handleBlur で値が変わっていない場合はキャンセルする修正

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# handleBlur を修正: 値が変わっていない場合は cancelEdit を呼ぶ
old_blur = """  // Handle blur to save
  const handleBlur = async () => {
    if (isEditing && !isSaving) {
      await saveValue();
    }
  };"""

new_blur = """  // Handle blur to save (値が変わっていない場合はキャンセル)
  const handleBlur = async () => {
    if (isEditing && !isSaving) {
      // 値が変わっていない場合は保存せずキャンセル（空文字エラー防止）
      const currentVal = editValue ?? '';
      const originalVal = value ?? '';
      if (String(currentVal) === String(originalVal)) {
        cancelEdit();
        return;
      }
      await saveValue();
    }
  };"""

if old_blur in text:
    text = text.replace(old_blur, new_blur)
    print('OK: handleBlur に値変更チェックを追加')
else:
    print('NG: handleBlur パターンが見つかりません')

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
