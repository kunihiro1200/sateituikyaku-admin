with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. salesContractDialogの後にchatSending状態を追加
old_state = '  const [salesContractDialog, setSalesContractDialog] = useState(false);'
new_state = '''  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [chatSending, setChatSending] = useState(false);'''

text = text.replace(old_state, new_state)

# 2. ダイアログのDialogActionsを更新（チャット送信ボタンを追加）
old_dialog_actions = '''        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
        </DialogActions>'''

new_dialog_actions = '''        <DialogActions>
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
        </DialogActions>'''

text = text.replace(old_dialog_actions, new_dialog_actions)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Updated dialog with chat send button.')
