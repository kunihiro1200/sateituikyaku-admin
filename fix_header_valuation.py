# 計算完了後にseller stateを更新してヘッダーに査定額を反映するスクリプト
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      console.log('Valuation saved:', { amount1, amount2, amount3, assignedBy });"

new = """      // ヘッダーに反映するためseller stateを更新
      setSeller(prev => prev ? {
        ...prev,
        valuationAmount1: amount1,
        valuationAmount2: amount2,
        valuationAmount3: amount3,
        valuationAssignee: assignedBy,
      } : prev);

      console.log('Valuation saved:', { amount1, amount2, amount3, assignedBy });"""

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ seller state update added successfully')
else:
    print('❌ Target string not found')
    # デバッグ用に前後を表示
    idx = text.find('Valuation saved')
    if idx >= 0:
        print('Found at index:', idx)
        print(repr(text[idx-5:idx+60]))
