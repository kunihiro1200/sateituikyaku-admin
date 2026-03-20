with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# SMS送信時はhandleQuickButtonSaveを呼ばないよう修正
old_save = "      // クイックボタンの状態を永続化（pending → persisted）\n      handleQuickButtonSave();"
new_save = "      // クイックボタンの状態を永続化（pending → persisted）- メールのみ\n      if (type === 'email') {\n        handleQuickButtonSave();\n      }"

if old_save in text:
    text = text.replace(old_save, new_save)
    print('handleQuickButtonSave fixed: SMS excluded')
else:
    print('ERROR: pattern not found')
    idx = text.find('handleQuickButtonSave')
    print('Context:', repr(text[idx-100:idx+200]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
