# -*- coding: utf-8 -*-
"""売買契約完了ダイアログコンポーネントをSnackbarの直前に追加"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      <Snackbar\n        open={snackbar.open}"

new = """      {/* 売買契約完了 チャット送信メッセージダイアログ */}
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
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}"""

if old in text:
    text = text.replace(old, new, 1)
    print('✅ ダイアログコンポーネントを追加しました')
else:
    print('❌ Snackbarが見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
