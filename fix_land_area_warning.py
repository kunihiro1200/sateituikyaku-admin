# 固定資産税路線価入力時に土地面積の警告を表示するスクリプト
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ========== 1. state追加（autoCalculating stateの後に追加） ==========
old_state = '  const [autoCalculating, setAutoCalculating] = useState(false);\r\n  const [sendingEmail, setSendingEmail] = useState(false);\r\n  const calculationTimerRef = useRef<NodeJS.Timeout | null>(null);'

new_state = '  const [autoCalculating, setAutoCalculating] = useState(false);\r\n  const [sendingEmail, setSendingEmail] = useState(false);\r\n  const calculationTimerRef = useRef<NodeJS.Timeout | null>(null);\r\n  // 土地面積警告ダイアログ用の状態\r\n  const [landAreaWarning, setLandAreaWarning] = useState<string | null>(null);'

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ Step 1: state added')
else:
    print('❌ Step 1: state not found')
    idx = text.find('autoCalculating, setAutoCalculating')
    if idx >= 0:
        print(repr(text[idx-10:idx+120]))

# ========== 2. onChange に警告チェックを追加 ==========
old_onchange = '                            onChange={(e) => {\r\n                              const value = e.target.value;\r\n                              setEditedFixedAssetTaxRoadPrice(value);\r\n                              if (value && parseFloat(value) > 0) {\r\n                                debouncedAutoCalculate(value);\r\n                              }\r\n                            }}'

new_onchange = '                            onChange={(e) => {\r\n                              const value = e.target.value;\r\n                              setEditedFixedAssetTaxRoadPrice(value);\r\n                              if (value && parseFloat(value) > 0) {\r\n                                // 土地面積の警告チェック\r\n                                const land = propInfo.landArea || property?.landArea || seller?.landArea || 0;\r\n                                const building = propInfo.buildingArea || property?.buildingArea || seller?.buildingArea || 0;\r\n                                const landNum = parseFloat(String(land)) || 0;\r\n                                const buildingNum = parseFloat(String(building)) || 0;\r\n                                if (landNum > 0 && (landNum <= 99 || (buildingNum > 0 && landNum < buildingNum))) {\r\n                                  setLandAreaWarning(`土地面積が${landNum}㎡（約${Math.round(landNum / 3.306)}坪）ですが確認大丈夫ですか？`);\r\n                                }\r\n                                debouncedAutoCalculate(value);\r\n                              }\r\n                            }}'

if old_onchange in text:
    text = text.replace(old_onchange, new_onchange)
    print('✅ Step 2: onChange updated')
else:
    print('❌ Step 2: onChange not found')
    idx = text.find('debouncedAutoCalculate(value)')
    if idx >= 0:
        print(repr(text[idx-200:idx+60]))

# ========== 3. 警告ダイアログをJSXに追加（confirmDialogの直前） ==========
old_dialog = '      {/* 確認ダイアログ */}\r\n      <Dialog \r\n        open={confirmDialog.open}'

new_dialog = '      {/* 土地面積警告ダイアログ */}\r\n      <Dialog open={!!landAreaWarning} onClose={() => setLandAreaWarning(null)}>\r\n        <DialogTitle>⚠️ 土地面積の確認</DialogTitle>\r\n        <DialogContent>\r\n          <Typography>{landAreaWarning}</Typography>\r\n        </DialogContent>\r\n        <DialogActions>\r\n          <Button onClick={() => setLandAreaWarning(null)} variant="contained">確認しました</Button>\r\n        </DialogActions>\r\n      </Dialog>\r\n\r\n      {/* 確認ダイアログ */}\r\n      <Dialog \r\n        open={confirmDialog.open}'

if old_dialog in text:
    text = text.replace(old_dialog, new_dialog)
    print('✅ Step 3: warning dialog added')
else:
    print('❌ Step 3: dialog anchor not found')
    idx = text.find('確認ダイアログ')
    if idx >= 0:
        print(repr(text[idx-10:idx+80]))

# 書き込み
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('Done!')
