with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# handleSmsTemplateSelect から isButtonDisabled チェックと handleQuickButtonClick を削除
# SMS テンプレートは何度でも使えるべきなので無効化しない

old_sms_handler = """  const handleSmsTemplateSelect = (templateId: string) => {
    if (!templateId) return;

    // Check if button is already disabled
    const buttonId = `sms_${templateId}`;
    if (isButtonDisabled(buttonId)) {
      console.log('⚠️ Button is already disabled:', buttonId);
      return;
    }

    // クイックボタンクリックを記録（pending状態に設定）
    handleQuickButtonClick(buttonId);

    const template = smsTemplates.find(t => t.id === templateId);"""

new_sms_handler = """  const handleSmsTemplateSelect = (templateId: string) => {
    if (!templateId) return;

    const template = smsTemplates.find(t => t.id === templateId);"""

if old_sms_handler in text:
    text = text.replace(old_sms_handler, new_sms_handler)
    print('SMS handler fixed: removed isButtonDisabled check')
else:
    print('ERROR: old_sms_handler not found!')
    # デバッグ用に周辺を表示
    idx = text.find('handleSmsTemplateSelect')
    print('Context:', repr(text[idx:idx+500]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
