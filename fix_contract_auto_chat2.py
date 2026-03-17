#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
契約完了ボタン押下時に自動でチャット送信する修正
- 「チャット送信」ボタンを削除
- セレクトボックスで選択時に自動送信
"""

path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: chatSendingステートを削除 ---
old1 = """  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [chatSending, setChatSending] = useState(false);"""

new1 = """  const [salesContractDialog, setSalesContractDialog] = useState(false);"""

if old1 in text:
    text = text.replace(old1, new1)
    print('✅ chatSendingステート削除')
else:
    print('❌ chatSendingステートが見つかりません')

# --- 変更2: セレクトのonChangeを自動送信に変更 ---
old2 = """                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('sales_contract_completed', val);
                      if (val === '契約完了したのでネット非公開お願いします。') {
                        setSalesContractDialog(true);
                      }
                    }}"""

new2 = """                    onChange={async (e) => {
                      const val = e.target.value;
                      handleFieldChange('sales_contract_completed', val);
                      if (val === '契約完了したのでネット非公開お願いします。') {
                        // 自動でチャット送信
                        try {
                          const apiBase = import.meta.env.VITE_API_URL || '';
                          const res = await fetch(`${apiBase}/api/property-listings/${data?.property_number}/notify-contract-completed`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          });
                          if (!res.ok) throw new Error('送信失敗');
                          setSnackbar({ open: true, message: 'チャットに送信しました', severity: 'success' });
                        } catch (e) {
                          setSnackbar({ open: true, message: 'チャット送信に失敗しました', severity: 'error' });
                        }
                        setSalesContractDialog(true);
                      }
                    }}"""

if old2 in text:
    text = text.replace(old2, new2)
    print('✅ onChangeを自動送信に変更')
else:
    print('❌ onChangeが見つかりません')

# --- 変更3: ダイアログのチャット送信ボタンを削除 ---
old3 = """        <DialogActions>
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
        </DialogActions>"""

new3 = """        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
        </DialogActions>"""

if old3 in text:
    text = text.replace(old3, new3)
    print('✅ チャット送信ボタン削除')
else:
    print('❌ ダイアログアクションが見つかりません')
    # デバッグ: 周辺を表示
    idx = text.find('setSalesContractDialog(false)}>閉じる</Button>')
    if idx >= 0:
        print('  周辺テキスト:')
        print(repr(text[idx-50:idx+300]))

with open(path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')

# 確認
with open(path, 'rb') as f:
    check = f.read().decode('utf-8')

if 'chatSending' not in check:
    print('✅ chatSending削除確認OK')
else:
    print('❌ chatSendingがまだ残っています')

if 'notify-contract-completed' in check:
    print('✅ notify-contract-completed確認OK')
else:
    print('❌ notify-contract-completedが見つかりません')
