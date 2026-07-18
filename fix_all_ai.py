import re

# ===== 1. CallModePage: 計算ロジック完全書き直し + AI査定結果でDBに自動保存 =====
with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

# --- 1a: calculateAiValuation を完全シンプル化（面積補正なし、階数補正のみ） ---
old_calc_start = '  const calculateAiValuation = () => {'
old_calc_end = '  // 手入力査定額を保存する関数'

start_idx = text.find(old_calc_start)
end_idx = text.find(old_calc_end)
if start_idx == -1 or end_idx == -1:
    print(f"ERROR: calc markers not found start={start_idx} end={end_idx}")
    exit(1)

new_calc = '''  const calculateAiValuation = async () => {
    setAiValuationError(null);
    setAiValuation(null);

    const validRows = salesCaseRows.filter(
      (r) => r.floor.trim() && r.price.trim() && parseFloat(r.price) > 0
    );
    if (validRows.length === 0) {
      setAiValuationError('少なくとも1件の売買事例（階数・価格）を入力してください。');
      return;
    }

    // 現在の年月
    const now = new Date();
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);

    // 各事例のスコアリング（階数補正 + 時期スコアのみ。面積補正なし）
    const scored = validRows.map((r) => {
      const floor = parseFloat(r.floor) || 1;
      const price = parseFloat(r.price); // 万円

      let rowYM = 0;
      if (r.yearMonth.trim()) {
        const parts = r.yearMonth.trim().replace(/-/g, '/').split('/');
        if (parts.length === 2) rowYM = parseInt(parts[0]) * 100 + parseInt(parts[1]);
      }
      // 時期スコア
      let timeScore = 0.7;
      if (rowYM > 0) {
        const y = Math.floor((nowYM - rowYM) / 100);
        const m = (nowYM - rowYM) % 100;
        const months = y * 12 + m;
        if (months <= 6) timeScore = 1.0;
        else if (months <= 12) timeScore = 0.9;
        else if (months <= 24) timeScore = 0.8;
      }
      // 階数補正（3階基準、1階ごと±0.5%）
      const floorAdj = 1 + (floor - 3) * 0.005;
      const adjustedPrice = price * floorAdj;
      return { price, adjustedPrice, timeScore };
    });

    const totalW = scored.reduce((s, r) => s + r.timeScore, 0);
    const weightedAvg = scored.reduce((s, r) => s + r.adjustedPrice * r.timeScore, 0) / totalW;
    const rawMax = Math.max(...scored.map((r) => r.price));
    const adjMax = Math.max(...scored.map((r) => r.adjustedPrice));
    const baseMax = Math.max(rawMax, adjMax);

    // 査定額3 = 最高事例 + 20万（10万丸め）
    const amount3 = Math.round((baseMax + 20) / 10) * 10;
    // 幅200〜300万
    const spread = Math.max(200, Math.min(300, Math.round((amount3 - weightedAvg) / 10) * 10));
    const amount1 = Math.round(Math.max(amount3 - spread, weightedAvg * 0.92) / 10) * 10;
    const amount2 = Math.round((amount1 + amount3) / 2 / 10) * 10;

    setAiValuation({ amount1, amount2, amount3 });

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
  };

'''

text = text[:start_idx] + new_calc + old_calc_end + text[end_idx + len(old_calc_end):]

# --- 1b: 「採用してDBに保存」ボタンを削除（自動保存に変えたため不要） ---
old_btn = '''                              <Button
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

new_btn = '''                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                                ✅ 計算と同時にDBへ自動保存済み
                              </Typography>'''

if old_btn not in text:
    print("ERROR: old button not found")
    exit(1)
text = text.replace(old_btn, new_btn, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("CallModePage done!")

# ===== 2. DocumentModal: 一括読み取りボタンに「スクショのみ」追記 =====
with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\components\DocumentModal.tsx', 'rb') as f:
    doc_text = f.read().decode('utf-8')

old_label = '`🤖 売買事例を一括読み取り（画像${files.filter((f) => f.mimeType.startsWith(\'image/\')).length}枚）`'
new_label = '`🤖 売買事例を一括読み取り（スクショのみ・${files.filter((f) => f.mimeType.startsWith(\'image/\')).length}枚）`'

if old_label not in doc_text:
    print("ERROR: DocumentModal label not found")
    exit(1)
doc_text = doc_text.replace(old_label, new_label, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\components\DocumentModal.tsx', 'wb') as f:
    f.write(doc_text.encode('utf-8'))
print("DocumentModal done!")
