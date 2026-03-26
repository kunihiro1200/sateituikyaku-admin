with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 1. nextCallDate必須バリデーションを確認ダイアログに変更
old_validation = """    if (!nextCallDate) {
      setError('次電日は必須です');
      return;
    }"""
new_validation = ""  # 削除
if old_validation in text:
    text = text.replace(old_validation, new_validation, 1)
    print('OK: removed hard validation')
else:
    print('ERROR: validation not found')

# 2. nextCallDate確認ダイアログ用stateを追加
old_state = "  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);"
new_state = "  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);\n  const [nextCallDateConfirmOpen, setNextCallDateConfirmOpen] = useState(false);"
if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('OK: state added')
else:
    print('ERROR: state not found')

# 3. handleSubmitの先頭に次電日チェックを追加
old_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');"""
new_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 次電日未入力の場合は確認ダイアログを表示
    if (!nextCallDate && !nextCallDateConfirmOpen) {
      setNextCallDateConfirmOpen(true);
      return;
    }
    setNextCallDateConfirmOpen(false);"""
if old_submit in text:
    text = text.replace(old_submit, new_submit, 1)
    print('OK: submit check added')
else:
    print('ERROR: submit not found')

# 4. 次電日フィールドのrequiredを削除
old_required = """                  required
                  label="次電日"
                  type="date"
                  value={nextCallDate}"""
new_required = """                  label="次電日"
                  type="date"
                  value={nextCallDate}"""
if old_required in text:
    text = text.replace(old_required, new_required, 1)
    print('OK: removed required attr')
else:
    print('ERROR: required attr not found')

# 5. 確認ダイアログのJSXを登録ボタンの前に追加
old_btn_area = """          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>"""
new_btn_area = """          {/* 次電日未入力確認ダイアログ */}
          <Dialog open={nextCallDateConfirmOpen} onClose={() => setNextCallDateConfirmOpen(false)}>
            <DialogTitle>次電日が未入力です</DialogTitle>
            <DialogContent>
              <Typography>次電日が入力されていませんがよろしいですか？</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNextCallDateConfirmOpen(false)}>戻る</Button>
              <Button
                variant="contained"
                onClick={async () => {
                  setNextCallDateConfirmOpen(false);
                  // フォームを直接送信
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  await handleSubmit(fakeEvent);
                }}
              >
                このまま登録する
              </Button>
            </DialogActions>
          </Dialog>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>"""
if old_btn_area in text:
    text = text.replace(old_btn_area, new_btn_area, 1)
    print('OK: dialog added')
else:
    print('ERROR: button area not found')

# 6. Dialog系のimportを確認・追加
if 'DialogTitle' not in text:
    old_mui = "  CircularProgress,\n  FormControl,\n  InputLabel,\n  Select,"
    new_mui = "  CircularProgress,\n  FormControl,\n  InputLabel,\n  Select,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,"
    if old_mui in text:
        text = text.replace(old_mui, new_mui, 1)
        print('OK: Dialog import added')
    else:
        print('NOTE: Dialog import check needed')
else:
    print('OK: Dialog already imported')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
