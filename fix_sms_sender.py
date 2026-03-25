import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. normalInitials stateの後にsmsSenderName stateを追加
old = "  // 通常スタッフのイニシャル一覧（初動担当選択用）\n  const [normalInitials, setNormalInitials] = useState<string[]>([]);"
new = "  // 通常スタッフのイニシャル一覧（初動担当選択用）\n  const [normalInitials, setNormalInitials] = useState<string[]>([]);\n  // SMS送信者名（localStorageから取得）\n  const [smsSenderName, setSmsSenderName] = useState<string>(() => localStorage.getItem('smsSenderName') || '');\n  const [senderEmailInput, setSenderEmailInput] = useState('');\n  const [senderNameDialogOpen, setSenderNameDialogOpen] = useState(false);"
text = text.replace(old, new)

# 2. normal-initialsのuseEffectの後にsmsSenderName取得のuseEffectを追加
old = "    api.get('/api/employees/normal-initials')\n      .then(res => setNormalInitials(res.data.initials || []))\n      .catch(err => console.error('Failed to fetch normal initials:', err));\n  }, []);"
new = "    api.get('/api/employees/normal-initials')\n      .then(res => setNormalInitials(res.data.initials || []))\n      .catch(err => console.error('Failed to fetch normal initials:', err));\n  }, []);\n\n  // SMS送信者名が未設定の場合はダイアログを表示\n  useEffect(() => {\n    if (!smsSenderName) {\n      setSenderNameDialogOpen(true);\n    }\n  }, [smsSenderName]);\n\n  const handleSenderEmailLookup = async () => {\n    if (!senderEmailInput.trim()) return;\n    try {\n      const res = await api.get(`/api/employees/name-by-email?email=${encodeURIComponent(senderEmailInput.trim())}`);\n      const name = res.data.name;\n      if (name) {\n        localStorage.setItem('smsSenderName', name);\n        setSmsSenderName(name);\n        setSenderNameDialogOpen(false);\n      } else {\n        setSnackbar({ open: true, message: 'メアドが見つかりませんでした', severity: 'error' });\n      }\n    } catch (e) {\n      setSnackbar({ open: true, message: '名前の取得に失敗しました', severity: 'error' });\n    }\n  };"
text = text.replace(old, new)

# 3. SmsDropdownButtonにsenderNameを追加
old = "            <SmsDropdownButton\n              phoneNumber={buyer.phone_number}\n              buyerName={buyer.name || 'お客様'}\n              buyerNumber={buyer_number || ''}\n              propertyAddress={linkedProperties[0]?.display_address || linkedProperties[0]?.address || ''}\n              propertyType={linkedProperties[0]?.property_type || ''}\n              onSmsSent={fetchActivities}\n            />"
new = "            <SmsDropdownButton\n              phoneNumber={buyer.phone_number}\n              buyerName={buyer.name || 'お客様'}\n              buyerNumber={buyer_number || ''}\n              propertyAddress={linkedProperties[0]?.display_address || linkedProperties[0]?.address || ''}\n              propertyType={linkedProperties[0]?.property_type || ''}\n              senderName={smsSenderName}\n              onSmsSent={fetchActivities}\n            />"
text = text.replace(old, new)

# 4. Snackbarの直前にダイアログを追加
old = "      <Snackbar\n        open={snackbar.open}"
new = "      {/* SMS送信者名設定ダイアログ */}\n      <Dialog open={senderNameDialogOpen} onClose={() => setSenderNameDialogOpen(false)}>\n        <DialogTitle>SMS送信者名の設定</DialogTitle>\n        <DialogContent>\n          <Typography variant=\"body2\" sx={{ mb: 2 }}>あなたのメールアドレスを入力してください（名前の自動取得用）</Typography>\n          <TextField\n            fullWidth\n            size=\"small\"\n            label=\"メールアドレス\"\n            value={senderEmailInput}\n            onChange={(e) => setSenderEmailInput(e.target.value)}\n            onKeyDown={(e) => { if (e.key === 'Enter') handleSenderEmailLookup(); }}\n          />\n        </DialogContent>\n        <DialogActions>\n          <Button onClick={() => setSenderNameDialogOpen(false)}>スキップ</Button>\n          <Button variant=\"contained\" onClick={handleSenderEmailLookup}>設定</Button>\n        </DialogActions>\n      </Dialog>\n      <Snackbar\n        open={snackbar.open}"
text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
