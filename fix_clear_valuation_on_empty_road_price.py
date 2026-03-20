# 固定資産税路線価を空欄にして「完了」を押した時に査定額もクリアするスクリプト
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF対応: \r\nで検索
old = '                    <Button size="small" onClick={() => setEditingValuation(!editingValuation)}>\r\n                      {editingValuation ? \'完了\' : \'編集\'}\r\n                    </Button>'

new = '                    <Button size="small" onClick={async () => {\r\n                      // 編集モードを終了する時（完了ボタン）\r\n                      if (editingValuation) {\r\n                        // 固定資産税路線価が空欄になった場合、査定額もクリア\r\n                        if (!editedFixedAssetTaxRoadPrice || parseFloat(editedFixedAssetTaxRoadPrice) <= 0) {\r\n                          try {\r\n                            await api.put(`/api/sellers/${id}`, {\r\n                              fixedAssetTaxRoadPrice: null,\r\n                              valuationAmount1: null,\r\n                              valuationAmount2: null,\r\n                              valuationAmount3: null,\r\n                            });\r\n                            setEditedValuationAmount1(\'\');\r\n                            setEditedValuationAmount2(\'\');\r\n                            setEditedValuationAmount3(\'\');\r\n                            setSeller(prev => prev ? {\r\n                              ...prev,\r\n                              fixedAssetTaxRoadPrice: undefined,\r\n                              valuationAmount1: undefined,\r\n                              valuationAmount2: undefined,\r\n                              valuationAmount3: undefined,\r\n                            } : prev);\r\n                          } catch (err) {\r\n                            console.error(\'Failed to clear valuation:\', err);\r\n                          }\r\n                        }\r\n                      }\r\n                      setEditingValuation(!editingValuation);\r\n                    }}>\r\n                      {editingValuation ? \'完了\' : \'編集\'}\r\n                    </Button>'

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ Clear valuation on empty road price added successfully')
else:
    print('❌ Target string not found')
    idx = text.find('setEditingValuation(!editingValuation)')
    if idx >= 0:
        print(repr(text[idx-120:idx+60]))
