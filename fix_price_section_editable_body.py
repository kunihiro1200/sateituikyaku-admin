#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PriceSection.tsx の修正:
- 送信確認ダイアログの本文を編集可能なテキストエリアに変更
- ダイアログを開いたときに初期テキストをstateにセット
- 送信時はstateのテキストを使用
"""

with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. chatMessageBody stateを追加
old_state = "  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);\n  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);"
new_state = """  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);
  const [chatMessageBody, setChatMessageBody] = useState('');"""
text = text.replace(old_state, new_state, 1)

# 2. ボタンクリック時にchatMessageBodyを初期化してからダイアログを開く
old_open = """                onClick={() => {
                  if (getLatestPriceReduction()) setConfirmDialogOpen(true);
                  else onChatSendError('値下げ履歴が見つかりません');
                }}"""
new_open = """                onClick={() => {
                  const latestReduction = getLatestPriceReduction();
                  if (latestReduction) {
                    const propertyUrl = `${window.location.origin}/property-listings/${propertyNumber}`;
                    const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\\n` : '';
                    setChatMessageBody(`${propertyNumberLine}【値下げ通知】\\n${latestReduction}\\n${address || ''}\\n${propertyUrl}`);
                    setConfirmDialogOpen(true);
                  } else {
                    onChatSendError('値下げ履歴が見つかりません');
                  }
                }}"""
text = text.replace(old_open, new_open, 1)

# 3. 送信時にchatMessageBodyを使用するよう変更
old_send_msg = """      const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\\n` : '';
      const imageUrlLine = selectedImageUrl ? `\\n📷 ${selectedImageUrl}` : '';
      const message = {
        text: `${propertyNumberLine}【値下げ通知】\\n${latestReduction}\\n${address || ''}\\n${propertyUrl}${imageUrlLine}`
      };"""
new_send_msg = """      const imageUrlLine = selectedImageUrl ? `\\n📷 ${selectedImageUrl}` : '';
      const message = {
        text: `${chatMessageBody}${imageUrlLine}`
      };"""
text = text.replace(old_send_msg, new_send_msg, 1)

# 4. ダイアログのBox（本文表示）をTextFieldに変更
old_dialog_body = """          <Box sx={{ mt: 1, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {`${propertyNumber ? `物件番号：${propertyNumber}\\n` : ''}【値下げ通知】\\n${getLatestPriceReduction() || ''}\\n${address || ''}\\n${window.location.origin}/property-listings/${propertyNumber}`}
          </Box>"""
new_dialog_body = """          <TextField
            fullWidth
            multiline
            rows={6}
            value={chatMessageBody}
            onChange={(e) => setChatMessageBody(e.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.75rem', '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
          />"""
text = text.replace(old_dialog_body, new_dialog_body, 1)

# 5. キャンセル時にchatMessageBodyもリセット
old_close1 = "onClose={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); }}"
new_close1 = "onClose={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); setChatMessageBody(''); }}"
text = text.replace(old_close1, new_close1, 1)

old_close2 = "<Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); }}>キャンセル</Button>"
new_close2 = "<Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); setChatMessageBody(''); }}>キャンセル</Button>"
text = text.replace(old_close2, new_close2, 1)

# 6. 送信成功後にchatMessageBodyもリセット
old_success = "      onChatSendSuccess('値下げ通知を送信しました');\n      setSelectedImageUrl(undefined);"
new_success = "      onChatSendSuccess('値下げ通知を送信しました');\n      setSelectedImageUrl(undefined);\n      setChatMessageBody('');"
text = text.replace(old_success, new_success, 1)

# 7. TextFieldのimportを確認（既にあるはず）
if 'TextField' not in text.split('import')[1]:
    text = text.replace(
        "import { useState } from 'react';\nimport { Box, Typography, TextField,",
        "import { useState } from 'react';\nimport { Box, Typography, TextField,"
    )

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! 本文編集可能に変更しました')
