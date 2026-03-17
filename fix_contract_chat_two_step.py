#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx のチャット送信ダイアログを2段階に変更:
1. 「チャット送信メッセージを表示」→ チャット送信確認ダイアログ（「チャット送信」ボタン）
2. 「チャット送信」ボタン押下後 → スプレッドシートURLダイアログ（「担当は〜」メッセージ）
"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read().decode('utf-8')

# 1. state 定義に salesContractUrlDialog を追加
old_state = """  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [chatSending, setChatSending] = useState(false);"""

new_state = """  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [salesContractUrlDialog, setSalesContractUrlDialog] = useState(false);
  const [chatSending, setChatSending] = useState(false);"""

content = content.replace(old_state, new_state)

# 2. ダイアログ本体を2段階に変更
old_dialog = """      {/* 売買契約完了 チャット送信メッセージダイアログ */}
      <Dialog open={salesContractDialog} onClose={() => setSalesContractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信メッセージ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            担当は、チャット送信後、下記より物件番号のみを入力してください↓↓
          </Typography>
          <Link
            href="https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ wordBreak: 'break-all' }}
          >
            https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762
          </Link>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={chatSending}
            onClick={async () => {
              if (!data?.property_number) return;
              setChatSending(true);
              try {
                const apiBase = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiBase}/api/property-listings/${data.property_number}/notify-contract-completed`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error('送信失敗');
                setSnackbar({ open: true, message: 'チャットに送信しました', severity: 'success' });
                setSalesContractDialog(false);
              } catch (e) {
                setSnackbar({ open: true, message: 'チャット送信に失敗しました', severity: 'error' });
              } finally {
                setChatSending(false);
              }
            }}
          >
            {chatSending ? '送信中...' : 'チャット送信'}
          </Button>
        </DialogActions>
      </Dialog>"""

new_dialog = """      {/* 売買契約完了 チャット送信確認ダイアログ（ステップ1） */}
      <Dialog open={salesContractDialog} onClose={() => setSalesContractDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            売買契約完了の通知をチャットに送信しますか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={chatSending}
            onClick={async () => {
              if (!data?.property_number) return;
              setChatSending(true);
              try {
                const apiBase = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiBase}/api/property-listings/${data.property_number}/notify-contract-completed`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error('送信失敗');
                setSnackbar({ open: true, message: 'チャットに送信しました', severity: 'success' });
                setSalesContractDialog(false);
                setSalesContractUrlDialog(true);
              } catch (e) {
                setSnackbar({ open: true, message: 'チャット送信に失敗しました', severity: 'error' });
              } finally {
                setChatSending(false);
              }
            }}
          >
            {chatSending ? '送信中...' : 'チャット送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 売買契約完了 スプレッドシートURLダイアログ（ステップ2） */}
      <Dialog open={salesContractUrlDialog} onClose={() => setSalesContractUrlDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>チャット送信メッセージ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            担当は、チャット送信後、下記より物件番号のみを入力してください↓↓
          </Typography>
          <Link
            href="https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            sx={{ wordBreak: 'break-all' }}
          >
            https://docs.google.com/spreadsheets/d/1D3qEGGroXQ17jwF5aoRN5TeSswTxRvoAhHY87bSA56M/edit?gid=534678762#gid=534678762
          </Link>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalesContractUrlDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>"""

content = content.replace(old_dialog, new_dialog)

with open(filepath, 'wb') as f:
    f.write(content.encode('utf-8'))

print("Done!")
