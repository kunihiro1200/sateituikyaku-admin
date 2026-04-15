with open('frontend/frontend/src/components/TemplateSelectionModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 削除対象ブロック
old_block = """    if (name === '内覧後御礼メール') {
      if (!viewingDate) return false;
      return viewingDate.getTime() <= today.getTime();
    }

    if (name === '☆内覧前日通知メール') {"""

new_block = """    if (name === '☆内覧前日通知メール') {"""

if old_block in text:
    text = text.replace(old_block, new_block)
    print('置換成功')
else:
    print('対象ブロックが見つかりませんでした')

with open('frontend/frontend/src/components/TemplateSelectionModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
