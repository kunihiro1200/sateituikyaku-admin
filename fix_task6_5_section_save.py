with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      setSnackbar({ open: true, message: '保存しました', severity: 'success' });"
new = """      // スプシ同期失敗時は警告表示
      if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
        setSnackbar({
          open: true,
          message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
          severity: 'warning',
        });
      } else {
        setSnackbar({ open: true, message: '保存しました', severity: 'success' });
      }"""

if old in text:
    text = text.replace(old, new, 1)
    with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: target string not found')
