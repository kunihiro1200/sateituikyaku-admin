with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. fix_sms_sender.pyで追加した不要なstateを削除
old = """  // SMS送信者名（localStorageから取得）
  const [smsSenderName, setSmsSenderName] = useState<string>(() => localStorage.getItem('smsSenderName') || '');
  const [senderEmailInput, setSenderEmailInput] = useState('');
  const [senderNameDialogOpen, setSenderNameDialogOpen] = useState(false);"""
new = ""
text = text.replace(old, new)

# 2. fix_sms_sender.pyで追加した不要なuseEffectとhandlerを削除
old = """
  // SMS送信者名が未設定の場合はダイアログを表示
  useEffect(() => {
    if (!smsSenderName) {
      setSenderNameDialogOpen(true);
    }
  }, [smsSenderName]);

  const handleSenderEmailLookup = async () => {
    if (!senderEmailInput.trim()) return;
    try {
      const res = await api.get(`/api/employees/name-by-email?email=${encodeURIComponent(senderEmailInput.trim())}`);
      const name = res.data.name;
      if (name) {
        localStorage.setItem('smsSenderName', name);
        setSmsSenderName(name);
        setSenderNameDialogOpen(false);
      } else {
        setSnackbar({ open: true, message: 'メアドが見つかりませんでした', severity: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: '名前の取得に失敗しました', severity: 'error' });
    }
  };"""
new = ""
text = text.replace(old, new)

# 3. fix_sms_sender.pyで追加した不要なダイアログを削除
old = """      {/* SMS送信者名設定ダイアログ */}
      <Dialog open={senderNameDialogOpen} onClose={() => setSenderNameDialogOpen(false)}>
        <DialogTitle>SMS送信者名の設定</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>あなたのメールアドレスを入力してください（名前の自動取得用）</Typography>
          <TextField
            fullWidth
            size="small"
            label="メールアドレス"
            value={senderEmailInput}
            onChange={(e) => setSenderEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSenderEmailLookup(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSenderNameDialogOpen(false)}>スキップ</Button>
          <Button variant="contained\" onClick={handleSenderEmailLookup}>設定</Button>
        </DialogActions>
      </Dialog>
"""
new = ""
text = text.replace(old, new)

# 4. 不要なDialog importを削除
old = "  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n"
new = ""
text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done - cleaned up!')
