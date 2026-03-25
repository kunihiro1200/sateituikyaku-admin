#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
物件詳細画面に「担当へCHAT」ボタンを追加するスクリプト
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. chatPanelOpen と chatMessage の状態変数を追加（chatSendingの直前に追加）
old_state = '  const [chatSending, setChatSending] = useState(false);'
new_state = '''  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSending, setChatSending] = useState(false);'''

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('✅ 状態変数を追加しました')
else:
    print('❌ 状態変数の挿入箇所が見つかりません')

# 2. handleSendChatToAssignee 関数を追加（handleBack関数の直前に追加）
old_handle_back = '  const handleBack = () => {'
new_handler = '''  // 担当へCHAT送信ハンドラー
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

  const handleBack = () => {'''

if old_handle_back in text:
    text = text.replace(old_handle_back, new_handler, 1)
    print('✅ handleSendChatToAssignee 関数を追加しました')
else:
    print('❌ handleBack の挿入箇所が見つかりません')

# 3. SMSボタンの後に「担当へCHAT」ボタンと入力フォームを追加
old_sms_section = '''                >
                  SMS
                </Button>
              )}
            </Box>
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && ('''

new_sms_section = '''                >
                  SMS
                </Button>
              )}
              {/* 担当へCHATボタン */}
              {data.sales_assignee && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setChatPanelOpen(!chatPanelOpen)}
                  sx={{
                    borderColor: '#7b1fa2',
                    color: '#7b1fa2',
                    '&:hover': {
                      borderColor: '#6a1b9a',
                      backgroundColor: '#7b1fa208',
                    },
                  }}
                >
                  担当へCHAT
                </Button>
              )}
            </Box>
            {/* 担当へCHAT入力フォーム */}
            {chatPanelOpen && data.sales_assignee && (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="担当へ質問_伝言"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && chatMessage.trim()) {
                      e.preventDefault();
                      handleSendChatToAssignee();
                    }
                  }}
                  sx={{ flex: 1, maxWidth: 400 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={chatSending || !chatMessage.trim()}
                  onClick={handleSendChatToAssignee}
                  sx={{ bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#6a1b9a' }, whiteSpace: 'nowrap' }}
                >
                  {chatSending ? <CircularProgress size={16} color="inherit" /> : '送信'}
                </Button>
              </Box>
            )}
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && ('''

if old_sms_section in text:
    text = text.replace(old_sms_section, new_sms_section, 1)
    print('✅ 担当へCHATボタンと入力フォームを追加しました')
else:
    print('❌ SMSボタン後の挿入箇所が見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)} (should NOT start with b"\\xef\\xbb\\xbf")')
