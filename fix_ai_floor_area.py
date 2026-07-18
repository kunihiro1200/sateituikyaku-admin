with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

old_calc = '''  // AI査定計算ロジック（売買事例から査定額1/2/3を算出）
  const calculateAiValuation = () => {
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
    // 査定額2 = 査定額3 - 200〜300万（10万丸め）
    const spread23 = Math.round(Math.max(200, Math.min(300, amount3 - weightedAvg)) / 10) * 10;
    const amount2 = amount3 - spread23;
    // 査定額1 = 査定額2 - 200〜300万（10万丸め）
    const spread12 = Math.round(Math.max(200, Math.min(300, amount2 - weightedAvg * 0.92)) / 10) * 10;
    const amount1 = amount2 - spread12;

    setAiValuation({ amount1, amount2, amount3 });
  };'''

new_calc = '''  // AI査定計算ロジック（売買事例から査定額1/2/3を算出）
  const calculateAiValuation = () => {
    setAiValuationError(null);
    setAiValuation(null);

    const validRows = salesCaseRows.filter(
      (r) => r.floor.trim() && r.price.trim() && parseFloat(r.price) > 0
    );
    if (validRows.length === 0) {
      setAiValuationError('少なくとも1件の売買事例（階数・価格）を入力してください。');
      return;
    }

    // 対象物件の階数：物件所在地から部屋番号を抽出して推測
    // 例: "福岡市○○ 1108号" → 4桁なら上2桁=11階、3桁なら上1桁=4階
    const address = property?.address || seller?.propertyAddress || '';
    const roomMatch = address.match(/(\d{3,4})号/);
    let targetFloor = 1;
    if (roomMatch) {
      const roomNum = roomMatch[1];
      targetFloor = roomNum.length === 4
        ? parseInt(roomNum.substring(0, 2))  // 1108 → 11階
        : parseInt(roomNum.substring(0, 1)); // 403 → 4階
    }

    // 対象物件の専有面積：当社調べ優先 → 建物面積
    const targetArea = parseFloat(editedBuildingAreaVerified) || parseFloat(editedBuildingArea) ||
      property?.buildingAreaVerified || property?.buildingArea || seller?.buildingArea || 0;

    // 現在の年月
    const now = new Date();
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);

    // 各事例のスコアリング
    const scored = validRows.map((r) => {
      const caseFloor = parseFloat(r.floor) || 1;
      const caseArea = parseFloat(r.exclusiveArea) || 0;
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

      // 面積補正：事例と対象物件の面積が異なる場合、㎡単価で換算
      let areaAdjPrice = price;
      if (targetArea > 0 && caseArea > 0) {
        const unitPrice = price / caseArea; // 万円/㎡
        areaAdjPrice = unitPrice * targetArea;
      }

      // 階数補正：対象物件階 vs 事例階、1階ごと1%
      const floorAdj = 1 + (targetFloor - caseFloor) * 0.01;
      const adjustedPrice = areaAdjPrice * floorAdj;

      return { price, adjustedPrice, timeScore, caseFloor, caseArea };
    });

    const totalW = scored.reduce((s, r) => s + r.timeScore, 0);
    const weightedAvg = scored.reduce((s, r) => s + r.adjustedPrice * r.timeScore, 0) / totalW;
    const adjMax = Math.max(...scored.map((r) => r.adjustedPrice));
    // 事例最高の生価格（面積補正後の値と比較して大きい方）
    const baseMax = adjMax;

    // 査定額3 = 補正済み最高価格 + 20万（10万丸め）
    const amount3 = Math.round((baseMax + 20) / 10) * 10;
    // 査定額2 = 査定額3 - 200〜300万
    const spread23 = Math.round(Math.max(200, Math.min(300, amount3 - weightedAvg)) / 10) * 10;
    const amount2 = amount3 - spread23;
    // 査定額1 = 査定額2 - 200〜300万
    const spread12 = Math.round(Math.max(200, Math.min(300, amount2 - weightedAvg * 0.92)) / 10) * 10;
    const amount1 = amount2 - spread12;

    setAiValuation({ amount1, amount2, amount3, targetFloor, targetArea });
  };'''

if old_calc not in text:
    print("ERROR: old_calc not found")
    exit(1)

text = text.replace(old_calc, new_calc, 1)

# aiValuationのstateの型にtargetFloor/targetAreaを追加
old_type = "  const [aiValuation, setAiValuation] = useState<{ amount1: number; amount2: number; amount3: number } | null>(null);"
new_type = "  const [aiValuation, setAiValuation] = useState<{ amount1: number; amount2: number; amount3: number; targetFloor: number; targetArea: number } | null>(null);"

if old_type not in text:
    print("ERROR: old_type not found")
    exit(1)
text = text.replace(old_type, new_type, 1)

# AI査定結果の表示に「対象物件: 8階・100㎡」を追記
old_result_title = '''                              <Typography variant="subtitle1" fontWeight="bold" color="secondary" gutterBottom>
                                🤖 AI査定結果
                              </Typography>'''
new_result_title = '''                              <Typography variant="subtitle1" fontWeight="bold" color="secondary" gutterBottom>
                                🤖 AI査定結果
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                対象物件: {aiValuation.targetFloor}階・{aiValuation.targetArea > 0 ? `${aiValuation.targetArea}㎡` : '面積未設定'}
                              </Typography>'''

if old_result_title not in text:
    print("ERROR: old_result_title not found")
    exit(1)
text = text.replace(old_result_title, new_result_title, 1)

with open(r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("Done!")
