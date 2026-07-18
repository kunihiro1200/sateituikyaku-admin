with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = '''                              <Button
                                variant="contained"
                                color="secondary"
                                size="small"
                                onClick={() => {
                                  setEditedManualValuationAmount1(String(aiValuation.amount1));
                                  setEditedManualValuationAmount2(String(aiValuation.amount2));
                                  setEditedManualValuationAmount3(String(aiValuation.amount3));
                                }}
                              >
                                この査定額を手入力フォームに反映する
                              </Button>'''

new = '''                              <Button
                                variant="contained"
                                color="secondary"
                                size="small"
                                disabled={savingManualValuation}
                                onClick={async () => {
                                  const a1 = aiValuation.amount1;
                                  const a2 = aiValuation.amount2;
                                  const a3 = aiValuation.amount3;
                                  // フォームに反映
                                  setEditedManualValuationAmount1(String(a1));
                                  setEditedManualValuationAmount2(String(a2));
                                  setEditedManualValuationAmount3(String(a3));
                                  // DBに保存（万円→円変換）
                                  try {
                                    setSavingManualValuation(true);
                                    const assignedBy = employee?.name || '';
                                    await api.put(`/api/sellers/${id}`, {
                                      valuationAmount1: a1 * 10000,
                                      valuationAmount2: a2 * 10000,
                                      valuationAmount3: a3 * 10000,
                                      valuationAssignee: assignedBy,
                                      fixedAssetTaxRoadPrice: null,
                                    });
                                    setIsManualValuation(true);
                                    setValuationAssignee(assignedBy);
                                    setSeller(prev => prev ? {
                                      ...prev,
                                      valuationAmount1: a1 * 10000,
                                      valuationAmount2: a2 * 10000,
                                      valuationAmount3: a3 * 10000,
                                      fixedAssetTaxRoadPrice: undefined,
                                      valuationAssignee: assignedBy,
                                    } : prev);
                                    setSuccessMessage('AI査定額をDBに保存しました');
                                  } catch {
                                    setError('AI査定額の保存に失敗しました');
                                  } finally {
                                    setSavingManualValuation(false);
                                  }
                                }}
                              >
                                {savingManualValuation ? '保存中...' : 'この査定額を採用してDBに保存'}
                              </Button>'''

if old not in text:
    print("ERROR: old string not found")
    exit(1)

text = text.replace(old, new, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("Done!")
