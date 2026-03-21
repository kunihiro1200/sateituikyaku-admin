with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. handleConfirmSend内のhandleQuickButtonSave呼び出しを削除（行2385付近）
old1 = """      // クイックボタンの状態を永続化（pending → persisted）- メールのみ
      if (type === 'email') {
        handleQuickButtonSave();
      }

      // 活動履歴を再読み込み
      const activitiesResponse = await api.get(`/api/sellers/${id}/activities`);"""

new1 = """      // 活動履歴を再読み込み
      const activitiesResponse = await api.get(`/api/sellers/${id}/activities`);"""

if old1 in text:
    text = text.replace(old1, new1)
    print('✅ handleConfirmSend内のhandleQuickButtonSave削除成功')
else:
    print('❌ handleConfirmSend内の対象文字列が見つかりません')

# 2. handleEmailTemplateSelect内のisButtonDisabledチェックとhandleQuickButtonClickを削除
old2 = """    // Check if button is already disabled
    const buttonId = `email_${templateId}`;
    if (isButtonDisabled(buttonId)) {
      console.log('⚠️ Button is already disabled:', buttonId);
      return;
    }

    // クイックボタンクリックを記録（pending状態に設定）
    handleQuickButtonClick(buttonId);

    const template = emailTemplates.find(t => t.id === templateId);"""

new2 = """    const template = emailTemplates.find(t => t.id === templateId);"""

if old2 in text:
    text = text.replace(old2, new2)
    print('✅ handleEmailTemplateSelect内のクイックボタン処理削除成功')
else:
    print('❌ handleEmailTemplateSelect内の対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
