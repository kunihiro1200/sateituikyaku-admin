# PropertyListingDetailPage.tsx に handleSendChatToAssignee 関数を追加し、
# SMSボタンの隣に「担当へCHAT」ボタンと入力フォームを追加する

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. handleSendChatToAssignee 関数を追加（handleCopyPublicUrl の後）
old_func = '''  // 公開URLを新しいタブで開く
  const handleOpenPublicUrl = () => {'''

new_func = '''  // 担当へCHAT送信
  const handleSendChatToAssignee = async () => {
    if (!chatMessage.trim() || !propertyNumber) return;
    setChatSending(true);
    try {
      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
        message: chatMessage,
      });
      setSnackbar({ open: true, message: '担当へチャットを送信しました', severity: 'success' });
      setChatMessage('');
      setChatPanelOpen(false);
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.error || 'チャット送信に失敗しました', severity: 'error' });
    } finally {
      setChatSending(false);
    }
  };

  // 公開URLを新しいタブで開く
  const handleOpenPublicUrl = () => {'''

if old_func in text:
    text = text.replace(old_func, new_func, 1)
    print('✅ handleSendChatToAssignee 関数を追加しました')
else:
    print('❌ 挿入箇所が見つかりません')

# 2. SMSボタンの後に「担当へCHAT」ボタンと入力フォームを追加
old_sms = '''              {data.seller_contact && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `sms:${data.seller_contact}`; }}
                  startIcon={<SmsIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: '#2e7d3208',
                    },
                  }}
                >
                  SMS
                </Button>
              )}
            </Box>'''

new_sms = '''              {data.seller_contact && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { window.location.href = `sms:${data.seller_contact}`; }}
                  startIcon={<SmsIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: '#2e7d3208',
                    },
                  }}
                >
                  SMS
                </Button>
              )}
              {data.sales_assignee && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setChatPanelOpen(!chatPanelOpen)}
                  sx={{
                    borderColor: '#7b1fa2',
                    color: '#7b1fa2',
                    '&:hover': {
                      borderColor: '#4a148c',
                      backgroundColor: '#7b1fa208',
                    },
                  }}
                >
                  担当へCHAT
                </Button>
              )}
            </Box>
            {chatPanelOpen && data.sales_assignee && (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="担当へ質問_伝言"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={chatSending || !chatMessage.trim()}
                  onClick={handleSendChatToAssignee}
                  sx={{ backgroundColor: '#7b1fa2', '&:hover': { backgroundColor: '#4a148c' } }}
                >
                  {chatSending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : '送信'}
                </Button>
              </Box>
            )}'''

if old_sms in text:
    text = text.replace(old_sms, new_sms, 1)
    print('✅ 担当へCHATボタンと入力フォームを追加しました')
else:
    print('❌ SMSボタン箇所が見つかりません')

# 3. CircularProgress が既にインポートされているか確認
if 'CircularProgress' in text:
    print('✅ CircularProgress は既にインポート済みです')
else:
    print('⚠️ CircularProgress のインポートが必要です')

# UTF-8で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
