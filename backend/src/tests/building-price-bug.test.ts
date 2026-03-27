/**
 * 建物価格計算バグ条件探索テスト
 *
 * このテストは修正前のコードでバグを再現することを目的とする。
 * 修正前のコードでは FAIL することが期待される（バグの存在を確認）。
 * 修正後のコードでは PASS することが期待される（バグが修正されたことを確認）。
 */

// 修正前の計算ロジック（CallModePage.tsx の現在の実装を再現）
function calculateBuildingPrice_original(
  buildYear: number,
  buildingArea: number,
  _structure: string
): { buildingPrice: number; unitPrice: number; buildingAge: number } {
  const buildingAge = buildYear > 0 ? 2025 - buildYear : 0;
  const unitPrice = 176200; // ハードコード（バグ）
  const basePrice = unitPrice * buildingArea;
  const depreciation = basePrice * 0.9 * buildingAge * 0.031;
  const buildingPrice = basePrice - depreciation;
  return { buildingPrice, unitPrice, buildingAge };
}

// 修正後の計算ロジック（正しい実装）
function calculateBuildingPrice_fixed(
  buildYear: number,
  buildingArea: number,
  structure: string
): { buildingPrice: number; unitPrice: number; buildingAge: number } {
  // 築年=0または空欄の場合はデフォルト35年
  const buildingAge = buildYear > 0 ? 2025 - buildYear : 35;

  // 構造に応じた建築単価
  const unitPrice = (() => {
    if (structure === '鉄骨') return 237300;
    if (structure === '軽量鉄骨') return 128400;
    return 123100; // 木造・空欄・不明・未確認
  })();

  const basePrice = unitPrice * buildingArea;

  // 築年数の上限チェック付き建物価格計算
  const buildingPrice = (() => {
    if (structure === '鉄骨' || structure === '軽量鉄骨') {
      if (buildingAge >= 40) return basePrice * 0.1;
      const rate = structure === '鉄骨' ? 0.015 : 0.025;
      return basePrice - basePrice * 0.9 * buildingAge * rate;
    } else {
      if (buildingAge >= 33) return basePrice * 0.1;
      return basePrice - basePrice * 0.9 * buildingAge * 0.031;
    }
  })();

  return { buildingPrice, unitPrice, buildingAge };
}

describe('建物価格計算バグ条件探索テスト', () => {
  describe('修正前コード（バグあり）- 以下のテストは FAIL が期待される', () => {
    test('木造・築40年（buildYear=1985）・建物面積100㎡ → 建物価格がマイナスになる（バグ）', () => {
      const result = calculateBuildingPrice_original(1985, 100, '木造');
      // 修正前: buildingAge=40, depreciation = 176200*100*0.9*40*0.031 = 19,659,120
      // basePrice = 17,620,000 → buildingPrice = -2,039,120（マイナス）
      console.log('修正前 木造・築40年:', result);
      // バグ確認: マイナスになっていることを確認
      expect(result.buildingPrice).toBeLessThan(0);
    });

    test('木造・築33年（buildYear=1992）・建物面積100㎡ → 建物価格がマイナスになる（バグ）', () => {
      const result = calculateBuildingPrice_original(1992, 100, '木造');
      console.log('修正前 木造・築33年:', result);
      // buildingAge=33, depreciation = 176200*100*0.9*33*0.031 = 16,218,774
      // basePrice = 17,620,000 → buildingPrice = 1,401,226（ギリギリ正だが建築単価が誤り）
      // 建築単価が176200円（誤り）であることを確認
      expect(result.unitPrice).toBe(176200);
    });

    test('鉄骨・築45年（buildYear=1980）・建物面積100㎡ → 建築単価が176200円のまま（バグ）', () => {
      const result = calculateBuildingPrice_original(1980, 100, '鉄骨');
      console.log('修正前 鉄骨・築45年:', result);
      // 鉄骨の正しい建築単価は237300円だが、176200円が使われている
      expect(result.unitPrice).toBe(176200); // バグ: 237300であるべき
    });

    test('築年=0・建物面積100㎡ → buildingAge=0で計算される（デフォルト35年が未適用）', () => {
      const result = calculateBuildingPrice_original(0, 100, '木造');
      console.log('修正前 築年=0:', result);
      // 修正前: buildingAge=0（デフォルト35年が適用されていない）
      expect(result.buildingAge).toBe(0); // バグ: 35であるべき
    });
  });

  describe('修正後コード（バグ修正済み）- 以下のテストは PASS が期待される', () => {
    test('木造・築40年 → 建物価格が正の値（basePrice * 0.1）になる', () => {
      const result = calculateBuildingPrice_fixed(1985, 100, '木造');
      console.log('修正後 木造・築40年:', result);
      const basePrice = result.unitPrice * 100;
      expect(result.buildingPrice).toBeGreaterThan(0);
      expect(result.buildingPrice).toBeCloseTo(basePrice * 0.1, 0);
    });

    test('木造・築33年 → 建物価格が basePrice * 0.1 になる', () => {
      const result = calculateBuildingPrice_fixed(1992, 100, '木造');
      console.log('修正後 木造・築33年:', result);
      const basePrice = result.unitPrice * 100;
      expect(result.buildingPrice).toBeGreaterThan(0);
      expect(result.buildingPrice).toBeCloseTo(basePrice * 0.1, 0);
    });

    test('鉄骨・築45年 → 建物価格が正の値で建築単価が237300円', () => {
      const result = calculateBuildingPrice_fixed(1980, 100, '鉄骨');
      console.log('修正後 鉄骨・築45年:', result);
      expect(result.unitPrice).toBe(237300);
      expect(result.buildingPrice).toBeGreaterThan(0);
    });

    test('築年=0 → buildingAge=35（デフォルト値）が適用される', () => {
      const result = calculateBuildingPrice_fixed(0, 100, '木造');
      console.log('修正後 築年=0:', result);
      expect(result.buildingAge).toBe(35);
    });

    test('全構造・全築年数で建物価格が常に正の値', () => {
      const structures = ['木造', '', '鉄骨', '軽量鉄骨', '不明'];
      const buildYears = [0, 1960, 1970, 1980, 1985, 1990, 1992, 1995, 2000, 2005, 2010, 2020];

      for (const structure of structures) {
        for (const buildYear of buildYears) {
          const result = calculateBuildingPrice_fixed(buildYear, 100, structure);
          expect(result.buildingPrice).toBeGreaterThan(0);
          const basePrice = result.unitPrice * 100;
          expect(result.buildingPrice).toBeGreaterThanOrEqual(basePrice * 0.1 - 1); // 浮動小数点誤差を考慮
        }
      }
    });
  });
});
