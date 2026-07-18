with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

# 計算関数から自動保存部分を削除（計算と表示のみに）
old_calc = '''    setAiValuation({ amount1, amount2, amount3 });

    // 計算結果をDBに即時保存（万円→円変換）
    try {
      const assignedBy = employee?.name || '';
      await api.put(`/api/sellers/${id}`, {
        valuationAmount1: amount1 * 10000,
        valuationAmount2: amount2 * 10000,
        valuationAmount3: amount3 * 10000,
        valuationAssignee: assignedBy,
        fixedAssetTaxRoadPrice: null,
      });
      setIsManualValuation(true);
      setValuationAssignee(assignedBy);
      setEditedManualValuationAmount1(String(amount1));
      setEditedManualValuationAmount2(String(amount2));
      setEditedManualValuationAmount3(String(amount3));
      setSeller(prev => prev ? {
        ...prev,
        valuationAmount1: amount1 * 10000,
        valuationAmount2: amount2 * 10000,
        valuationAmount3: amount3 * 10000,
        fixedAssetTaxRoadPrice: undefined,
        valuationAssignee: assignedBy,
      } : prev);
      setSuccessMessage('AI査定額をDBに保存しました');
    } catch {
      // DB保存失敗でも表示は継続
    }
  };'''

new_calc = '''    setAiValuation({ amount1, amount2, amount3 });
  };'''

if old_calc not in text:
    print("ERROR: old_calc not found")
    exit(1)
text = text.replace(old_calc, new_calc, 1)

# asyncも不要になったので戻す
text = text.replace(
    '  const calculateAiValuation = async () => {',
    '  const calculateAiValuation = () => {',
    1
)

# 「自動保存済み」表示を「採用してDB保存」ボタンに戻す
old_auto = '''                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                                ✅ 計算と同時にDBへ自動保存済み
                              </Typography>'''

new_btn = '''                              <Button
                                variant="contained"
                                color="secondary"
                                size="small"
                                disabled={savingManualValuation}
                                onClick={async () => {
                                  const a1 = aiValuation.amount1;
                                  const a2 = aiValuation.amount2;
                                  const a3 = aiValuation.amount3;
                                  setEditedManualValuationAmount1(String(a1));
                                  setEditedManualValuationAmount2(String(a2));
                                  setEditedManualValuationAmount3(String(a3));
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

if old_auto not in text:
    print("ERROR: old_auto not found")
    exit(1)
text = text.replace(old_auto, new_btn, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("Done!")
