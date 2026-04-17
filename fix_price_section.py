#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PriceSection.tsx の送信確認ダイアログを改修するスクリプト
- ImageSelectorModal の組み込み（タスク2.1）
- onChatSend 呼び出しへの変更（タスク2.2）
"""

import sys

FILE_PATH = 'frontend/frontend/src/components/PriceSection.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

# BOMチェック
if content[:3] == b'\xef\xbb\xbf':
    print('WARNING: BOM detected, removing...')
    content = content[3:]

text = content.decode('utf-8')

# ============================================================
# 1. import に ImageSelectorModal を追加
# ============================================================
old_import = "import api from '../services/api';"
new_import = """import api from '../services/api';
import ImageSelectorModal from './ImageSelectorModal';"""

text = text.replace(old_import, new_import, 1)

# ============================================================
# 2. state に selectedImageUrl と imageSelectorOpen を追加
# ============================================================
old_state = """  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [copiedMonthly, setCopiedMonthly] = useState(false);"""

new_state = """  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [copiedMonthly, setCopiedMonthly] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);"""

text = text.replace(old_state, new_state, 1)

# ============================================================
# 3. handleSendPriceReductionChat を削除し、新しい送信ハンドラーに置き換え
# ============================================================
old_handler = """  const handleSendPriceReductionChat = async () => {
    const latestReduction = getLatestPriceReduction();
    if (!latestReduction) {
      onChatSendError('値下げ履歴が見つかりません');
      return;
    }

    setSendingChat(true);
    setConfirmDialogOpen(false);
    try {
      const webhookUrl = 'https://chat.googleapis.com/v1/spaces/AAAAw9wyS-o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=t6SJmZ8af-yyB38DZzAqGOKYI-DnIl6wYtVo-Lyskuk';
      const propertyUrl = `${window.location.origin}/property-listings/${propertyNumber}`;

      const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\\n` : '';
      const message = {
        text: `${propertyNumberLine}【値下げ通知】\\n${latestReduction}\\n${address || ''}\\n${propertyUrl}`
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send message to Google Chat');
      }

      onChatSendSuccess('値下げ通知を送信しました');
    } catch (error: any) {
      console.error('Failed to send price reduction chat:', error);
      onChatSendError('値下げ通知の送信に失敗しました');
    } finally {
      setSendingChat(false);
    }
  };"""

new_handler = """  // 送信確認ダイアログから onChatSend を呼び出す
  const handleConfirmSend = async () => {
    setSendingChat(true);
    setConfirmDialogOpen(false);
    try {
      await onChatSend({ imageUrl: selectedImageUrl });
      onChatSendSuccess('物件担当へCHAT通知を送信しました');
    } catch (error: any) {
      console.error('Failed to send property chat:', error);
      const errorCode = error?.response?.data?.error?.code;
      if (errorCode === 'WEBHOOK_NOT_FOUND') {
        onChatSendError('担当者のCHATアドレスが設定されていません');
      } else {
        onChatSendError('CHAT送信に失敗しました');
      }
    } finally {
      setSendingChat(false);
      setSelectedImageUrl(undefined);
    }
  };"""

text = text.replace(old_handler, new_handler, 1)

# ============================================================
# 4. 送信確認ダイアログの内容を更新
#    - 画像添付ボタンを追加
#    - 「送信する」ボタンのonClickを handleConfirmSend に変更
# ============================================================
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
          {/* 画像添付オプション（任意） */}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setImageSelectorOpen(true)}
              sx={{ fontSize: '0.75rem' }}
            >
              画像を添付する（任意）
            </Button>
            {selectedImageUrl && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <img
                  src={selectedImageUrl}
                  alt="添付画像"
                  style={{ maxWidth: 80, maxHeight: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', flex: 1 }}>
                  {selectedImageUrl}
                </Typography>
                <Button size="small" onClick={() => setSelectedImageUrl(undefined)} sx={{ minWidth: 'auto', fontSize: '0.7rem' }}>
                  削除
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSend}
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
        onSelect={(images) => {
          if (images.length > 0) {
            const img = images[0];
            setSelectedImageUrl(img.url || img.previewUrl);
          }
          setImageSelectorOpen(false);
        }}
      />"""

text = text.replace(old_dialog, new_dialog, 1)

# ============================================================
# 書き込み（BOMなしUTF-8）
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PriceSection.tsx updated successfully.')

# BOM確認
with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT start with b"\\xef\\xbb\\xbf")')
