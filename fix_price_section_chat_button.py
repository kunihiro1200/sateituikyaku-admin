#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PriceSection.tsx の修正:
1. ボタンをオレンジ色に変更
2. ラベルを「物件担当へCHAT送信（画像添付可能）」に変更
3. 送信確認ダイアログに画像添付機能を追加
"""

with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. importにImageSelectorModalを追加
old_import = "import api from '../services/api';"
new_import = "import api from '../services/api';\nimport ImageSelectorModal from './ImageSelectorModal';"
text = text.replace(old_import, new_import, 1)

# 2. stateにimageSelectorOpenとselectedImageUrlを追加
old_state = "  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);"
new_state = """  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);"""
text = text.replace(old_state, new_state, 1)

# 3. ボタンの色をオレンジに変更、ラベルを変更
old_button_style = """                sx={{
                  backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#d32f2f' : '#1976d2',
                  '&:hover': {
                    backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#b71c1c' : '#1565c0',
                  },
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  animation: isPriceChanged && scheduledNotifications.length === 0 ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                    '70%': { boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                  },
                }}
              >
                {sendingChat ? '送信中...' : '物件担当へCHAT送信'}"""
new_button_style = """                sx={{
                  backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#e65100' : '#f57c00',
                  '&:hover': {
                    backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#bf360c' : '#e65100',
                  },
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  animation: isPriceChanged && scheduledNotifications.length === 0 ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.7)' },
                    '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
                  },
                }}
              >
                {sendingChat ? '送信中...' : '物件担当へCHAT送信（画像添付可能）'}"""
text = text.replace(old_button_style, new_button_style, 1)

# 4. ダイアログに画像添付UIを追加
old_dialog = """      {/* 送信確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chat送信の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            以下の内容をGoogle Chatに送信します：
          </Typography>
          <Box sx={{ mt: 1, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {`${propertyNumber ? `物件番号：${propertyNumber}\\n` : ''}【値下げ通知】\\n${getLatestPriceReduction() || ''}\\n${address || ''}\\n${window.location.origin}/property-listings/${propertyNumber}`}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendPriceReductionChat}
            disabled={sendingChat}
            sx={{ backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}
          >
            {sendingChat ? '送信中...' : '送信する'}
          </Button>
        </DialogActions>
      </Dialog>"""
new_dialog = """      {/* 送信確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onClose={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); }} maxWidth="sm" fullWidth>
        <DialogTitle>Chat送信の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            以下の内容をGoogle Chatに送信します：
          </Typography>
          <Box sx={{ mt: 1, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {`${propertyNumber ? `物件番号：${propertyNumber}\\n` : ''}【値下げ通知】\\n${getLatestPriceReduction() || ''}\\n${address || ''}\\n${window.location.origin}/property-listings/${propertyNumber}`}
          </Box>
          {/* 画像添付セクション */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              画像添付（任意）：
            </Typography>
            {selectedImageUrl ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box
                  component="img"
                  src={selectedImageUrl}
                  alt="添付画像"
                  sx={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 1, border: '1px solid #ddd' }}
                />
                <Button size="small" color="error" onClick={() => setSelectedImageUrl(undefined)}>
                  削除
                </Button>
              </Box>
            ) : (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setImageSelectorOpen(true)}
                sx={{ mt: 0.5 }}
              >
                📷 画像を選択
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendPriceReductionChat}
            disabled={sendingChat}
            sx={{ backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}
          >
            {sendingChat ? '送信中...' : '送信する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onClose={() => setImageSelectorOpen(false)}
        onConfirm={(images) => {
          if (images.length > 0) {
            setSelectedImageUrl(images[0].previewUrl || images[0].url || '');
          }
          setImageSelectorOpen(false);
        }}
        sellerNumber={propertyNumber}
      />"""
text = text.replace(old_dialog, new_dialog, 1)

# 5. handleSendPriceReductionChat で selectedImageUrl を使うように修正
# imageUrl を渡す部分を探して修正
old_send = "    await onChatSend({ imageUrl: undefined });"
new_send = "    await onChatSend({ imageUrl: selectedImageUrl });"
if old_send in text:
    text = text.replace(old_send, new_send, 1)
else:
    # onChatSend呼び出しを探す
    old_send2 = "    await onChatSend({});"
    new_send2 = "    await onChatSend({ imageUrl: selectedImageUrl });"
    if old_send2 in text:
        text = text.replace(old_send2, new_send2, 1)

# 送信後にselectedImageUrlをリセット
old_success = "    onChatSendSuccess('物件担当へCHAT通知を送信しました');"
new_success = "    onChatSendSuccess('物件担当へCHAT通知を送信しました');\n    setSelectedImageUrl(undefined);"
if old_success in text:
    text = text.replace(old_success, new_success, 1)

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('1. ボタン色をオレンジに変更')
print('2. ラベルを「物件担当へCHAT送信（画像添付可能）」に変更')
print('3. 送信確認ダイアログに画像添付UIを追加')
print('4. ImageSelectorModalを組み込み')
