with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 担当へCHAT送信成功後に履歴を再取得
old_code1 = """      setSnackbar({ open: true, message: '担当へチャットを送信しました', severity: 'success' });
      setChatMessage('');
      setChatPanelOpen(false);"""

new_code1 = """      setSnackbar({ open: true, message: '担当へチャットを送信しました', severity: 'success' });
      setChatMessage('');
      setChatPanelOpen(false);
      // CHAT送信履歴を再取得
      fetchChatHistoryData();"""

text = text.replace(old_code1, new_code1)

# 事務へCHAT送信成功後に履歴を再取得
old_code2 = """      // 確認フィールドを「未」に自動設定
      setConfirmation('未');
      setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
      setChatToOfficeMessage('');
      setChatToOfficePanelOpen(false);"""

new_code2 = """      // 確認フィールドを「未」に自動設定
      setConfirmation('未');
      setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
      setChatToOfficeMessage('');
      setChatToOfficePanelOpen(false);
      // CHAT送信履歴を再取得
      fetchChatHistoryData();"""

text = text.replace(old_code2, new_code2)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Added chat history refresh after sending!')
