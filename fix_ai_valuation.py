import re

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 置換対象の開始・終了マーカー
start_marker = '  // AI査定計算ロジック（売買事例から査定額1/2/3を算出）'
end_marker = '  // 手入力査定額を保存する関数'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: marker not found. start={start_idx}, end={end_idx}")
    exit(1)

new_function = '''  // AI査定計算ロジック（売買事例から査定額1/2/3を算出）
  const calculateAiValuation = () => {
    setAiValuationError(null);
    setAiValuation(null);

    // 入力済みの売買事例のみ対象
    const validRows = salesCaseRows.filter(
      (r) => r.floor.trim() && r.price.trim() && parseFloat(r.price) > 0
    );

    if (validRows.length === 0) {
      setAiValuationError('少なくとも1件の売買事例（階数・価格）を入力してください。');
      return;
    }

    // 対象物件の専有面積（㎡）。300㎡超は異常値とみなし0扱い
    const rawTargetArea = property?.buildingAreaVerified || property?.buildingArea || seller?.buildingArea || 0;
    const targetArea = (rawTargetArea > 0 && rawTargetArea <= 300) ? rawTargetArea : 0;

    // 現在の年月（比較基準）
    const now = new Date();
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);

    // 各事例に調整スコアを付ける
    const scoredRows = validRows.map((r) => {
      const floor = parseFloat(r.floor) || 1;
      const price = parseFloat(r.price); // 万円単位
      const area = r.exclusiveArea.trim() ? (parseFloat(r.exclusiveArea) || 0) : 0;

      // 販売年月のパース（"2024/06" or "2024-06" 形式）
      let rowYM = 0;
      if (r.yearMonth.trim()) {
        const parts = r.yearMonth.trim().replace('-', '/').split('/');
        if (parts.length === 2) {
          rowYM = parseInt(parts[0]) * 100 + parseInt(parts[1]);
        }
      }

      // 販売時期スコア（近いほど高い）
      let timeScore = 0.7;
      if (rowYM > 0) {
        const yearDiff = Math.floor((nowYM - rowYM) / 100);
        const monthDiff = (nowYM - rowYM) % 100;
        const totalMonths = yearDiff * 12 + monthDiff;
        if (totalMonths <= 6) timeScore = 1.0;
        else if (totalMonths <= 12) timeScore = 0.9;
        else if (totalMonths <= 24) timeScore = 0.8;
        else timeScore = 0.7;
      }

      // 階数補正（高い階ほど+、3階基準で1階ごと0.5%）
      const floorAdjustment = 1 + (floor - 3) * 0.005;

      // 面積補正：事例の専有面積と対象物件の専有面積が両方有効な場合のみ適用
      // ※ 面積は必ず㎡単位（300以下）で妥当性チェック
      let areaAdjustedPrice = price;
      if (
        targetArea > 0 && targetArea <= 300 &&
        area > 0 && area <= 300 &&
        Math.abs(area - targetArea) > 2
      ) {
        const unitPricePerSqm = price / area; // 万円/㎡
        areaAdjustedPrice = unitPricePerSqm * targetArea;
      }

      const adjustedPrice = areaAdjustedPrice * floorAdjustment;
      return { ...r, adjustedPrice, timeScore, floor, area, price };
    });

    // 時期スコアで重み付けした加重平均を計算
    const totalWeight = scoredRows.reduce((sum, r) => sum + r.timeScore, 0);
    const weightedAvg =
      scoredRows.reduce((sum, r) => sum + r.adjustedPrice * r.timeScore, 0) / totalWeight;

    // 生の最高価格（万円）
    const rawMaxPrice = Math.max(...scoredRows.map((r) => r.price));
    // 調整済み最高価格
    const maxAdjusted = Math.max(...scoredRows.map((r) => r.adjustedPrice));
    // 査定額3のベース：生の最高価格と調整済み最高価格の大きい方（事例より低くならない）
    const baseMax = Math.max(maxAdjusted, rawMaxPrice);

    // 査定額3 = 最高事例価格 + 20万（10万単位丸め）
    const amount3 = Math.round((baseMax + 20) / 10) * 10;

    // 査定額1〜3の幅: 200〜300万
    const spread = Math.max(200, Math.min(300, Math.round((amount3 - weightedAvg) / 10) * 10));
    const amount1 = Math.round(Math.max(amount3 - spread, weightedAvg * 0.92) / 10) * 10;
    const amount2 = Math.round(((amount1 + amount3) / 2) / 10) * 10;

    setAiValuation({ amount1, amount2, amount3 });
  };

'''

text = text[:start_idx] + new_function + end_marker + text[end_idx + len(end_marker):]

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")
