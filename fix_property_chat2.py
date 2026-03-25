#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleSendChatToAssignee 関数を追加（handleBack関数の直前）
old_handle_back = '  const handleBack = () => {'
new_handler = (
    '  // \u62c5\u5f53\u3078CHAT\u9001\u4fe1\u30cf\u30f3\u30c9\u30e9\u30fc\n'
    '  const handleSendChatToAssignee = async () => {\n'
    '    if (!chatMessage.trim() || !propertyNumber) return;\n'
    '    setChatSending(true);\n'
    '    try {\n'
    '      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {\n'
    '        message: chatMessage,\n'
    '      });\n'
    "      setSnackbar({ open: true, message: '\u62c5\u5f53\u3078\u30c1\u30e3\u30c3\u30c8\u3092\u9001\u4fe1\u3057\u307e\u3057\u305f', severity: 'success' });\n"
    "      setChatMessage('');\n"
    '      setChatPanelOpen(false);\n'
    '    } catch (error: any) {\n'
    "      setSnackbar({ open: true, message: error.response?.data?.error || '\u30c1\u30e3\u30c3\u30c8\u9001\u4fe1\u306b\u5931\u6557\u3057\u307e\u3057\u305f', severity: 'error' });\n"
    '    } finally {\n'
    '      setChatSending(false);\n'
    '    }\n'
    '  };\n'
    '\n'
    '  const handleBack = () => {'
)

if old_handle_back in text:
    text = text.replace(old_handle_back, new_handler, 1)
    print('OK: handleSendChatToAssignee added')
else:
    print('ERROR: handleBack not found')

# SMSボタンの後に担当へCHATボタンと入力フォームを追加
old_sms = (
    '                >\n'
    '                  SMS\n'
    '                </Button>\n'
    '              )}\n'
    '            </Box>\n'
    '          </Box>\n'
    '          {buyerContext?.buyerId && buyerContext?.source === \'buyer-detail\' && ('
)

new_sms = (
    '                >\n'
    '                  SMS\n'
    '                </Button>\n'
    '              )}\n'
    '              {/* \u62c5\u5f53\u3078CHAT\u30dc\u30bf\u30f3 */}\n'
    '              {data.sales_assignee && (\n'
    '                <Button\n'
    '                  variant="outlined"\n'
    '                  size="small"\n'
    '                  onClick={() => setChatPanelOpen(!chatPanelOpen)}\n'
    '                  sx={{\n'
    "                    borderColor: '#7b1fa2',\n"
    "                    color: '#7b1fa2',\n"
    "                    '&:hover': {\n"
    "                      borderColor: '#6a1b9a',\n"
    "                      backgroundColor: '#7b1fa208',\n"
    '                    },\n'
    '                  }}\n'
    '                >\n'
    '                  \u62c5\u5f53\u3078CHAT\n'
    '                </Button>\n'
    '              )}\n'
    '            </Box>\n'
    '            {/* \u62c5\u5f53\u3078CHAT\u5165\u529b\u30d5\u30a9\u30fc\u30e0 */}\n'
    '            {chatPanelOpen && data.sales_assignee && (\n'
    '              <Box sx={{ display: \'flex\', gap: 1, mt: 0.5, alignItems: \'center\' }}>\n'
    '                <TextField\n'
    '                  size="small"\n'
    '                  placeholder="\u62c5\u5f53\u3078\u8cea\u554f_\u4f1d\u8a00"\n'
    '                  value={chatMessage}\n'
    '                  onChange={(e) => setChatMessage(e.target.value)}\n'
    '                  onKeyDown={(e) => {\n'
    '                    if (e.key === \'Enter\' && !e.shiftKey && chatMessage.trim()) {\n'
    '                      e.preventDefault();\n'
    '                      handleSendChatToAssignee();\n'
    '                    }\n'
    '                  }}\n'
    '                  sx={{ flex: 1, maxWidth: 400 }}\n'
    '                />\n'
    '                <Button\n'
    '                  variant="contained"\n'
    '                  size="small"\n'
    '                  disabled={chatSending || !chatMessage.trim()}\n'
    '                  onClick={handleSendChatToAssignee}\n'
    "                  sx={{ bgcolor: '#7b1fa2', '&:hover': { bgcolor: '#6a1b9a' }, whiteSpace: 'nowrap' }}\n"
    '                >\n'
    '                  {chatSending ? <CircularProgress size={16} color="inherit" /> : \'\u9001\u4fe1\'}\n'
    '                </Button>\n'
    '              </Box>\n'
    '            )}\n'
    '          </Box>\n'
    '          {buyerContext?.buyerId && buyerContext?.source === \'buyer-detail\' && ('
)

if old_sms in text:
    text = text.replace(old_sms, new_sms, 1)
    print('OK: CHAT button and form added')
else:
    print('ERROR: SMS section not found')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first3 = f.read(3)
print(f'BOM: {repr(first3)}')
