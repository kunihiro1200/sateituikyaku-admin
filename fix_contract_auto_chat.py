#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
契約完了ボタン押下時に自動でチャット送信する修正
- 「チャット送信」ボタンを削除
- セレクトボックスで「契約完了したのでネット非公開お願いします。」選択時に自動送信
- 物件番号と物件所在地はDBから取得済みのdataを使用
"""

path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(path, 'rb') as f:
    content = f.read()

# エンコーディングを検出して読み込む
try:
    text = content.decode('utf-8')
    print('UTF-8で読み込み成功')
except UnicodeDecodeError:
    text = content.decode('shift-jis', errors='replace')
    print('Shift-JISで読み込み（文字化けあり）')

# 現在のセレクトボックスのonChange（ダイアログを開くだけ）を
# 自動チャット送信に変更する

# 変更1: chatSendingステートを削除（不要になる）
# 変更2: セレクトのonChangeで直接チャット送信
# 変更3: ダイアログのチャット送信ボタンを削除

# --- 変更1: chatSendingステートを削除 ---
old_state = """  const [salesContractDialog, setSalesContractDialog] = useState(false);
  const [chatSending, setChatSending] = useState(false);"""

new_state = """  const [salesContractDialog, setSalesContractDialog] = useState(false);"""

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ chatSendingステート削除')
else:
    print('❌ chatSendingステートが見つかりません')

# --- 変更2: セレクトのonChangeを自動送信に変更 ---
old_onchange = """                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('sales_contract_completed', val);
                      if (val === '契約完了したのでネット非公開お願いします。') {
                        setSalesContractDialog(true);
                      }
                    }}"""

new_onchange = """                    onChange={async (e) => {
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
                          setSalesContractDialog(true);
                          setSnackbar({ open: true, message: 'チャットに送信しました', severity: 'success' });
                        } catch (e) {
                          setSalesContractDialog(true);
                          setSnackbar({ open: true, message: 'チャット送信に失敗しました', severity: 'error' });
                        }
                      }
                    }}"""

if old_onchange in text:
    text = text.replace(old_onchange, new_onchange)
    print('✅ onChangeを自動送信に変更')
else:
    print('❌ onChangeが見つかりません')

# --- 変更3: ダイアログのチャット送信ボタンを削除 ---
old_dialog_actions = """        <DialogActions>
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

new_dialog_actions = """        <DialogActions>
          <Button onClick={() => setSalesContractDialog(false)}>閉じる</Button>
        </DialogActions>"""

if old_dialog_actions in text:
    text = text.replace(old_dialog_actions, new_dialog_actions)
    print('✅ チャット送信ボタン削除')
else:
    print('❌ ダイアログアクションが見つかりません - 別パターンを試みます')
    # 改行の違いを考慮して検索
    import re
    pattern = r'<DialogActions>\s*<Button onClick=\{.*?setSalesContractDialog\(false\).*?\}>閉じる</Button>.*?</DialogActions>'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        print(f'パターンマッチ: {repr(match.group()[:100])}')
    else:
        print('パターンも見つかりません')

with open(path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
