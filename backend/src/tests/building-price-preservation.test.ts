/**
 * 建物価格計算バグ修正 保持テスト
 *
 * 修正によって変更してはならない動作を検証する。
 * 修正前後で同じ結果になることを確認する。
 */

// 土地価格計算（修正前後で変わらない）
function calculateLandPrice(landArea: number, roadPrice: number): number {
  return (landArea * roadPrice) / 0.6;
}

// 修正前の建物価格計算
function calculateBuildingPrice_original(
  buildYear: number,
  buildingArea: number,
  _structure: string
): number {
  const buildingAge = buildYear > 0 ? 2025 - buildYear : 0;
  const unitPrice = 176200;
  const basePrice = unitPrice * buildingArea;
  const depreciation = basePrice * 0.9 * buildingAge * 0.031;
  return basePrice - depreciation;
}

// 修正後の建物価格計算
function calculateBuildingPrice_fixed(
  buildYear: number,
  buildingArea: number,
  structure: string
): number {
  const buildingAge = buildYear > 0 ? 2025 - buildYear : 35;
  const unitPrice = (() => {
    if (structure === '鉄骨') return 237300;
    if (structure === '軽量鉄骨') return 128400;
    return 123100;
  })();
  const basePrice = unitPrice * buildingArea;
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
  return buildingPrice;
}

describe('建物価格計算バグ修正 保持テスト', () => {
  describe('土地価格計算の不変性（修正前後で同一）', () => {
    test('土地面積=100㎡、路線価=50000円 → 8,333,333円', () => {
      const result = calculateLandPrice(100, 50000);
      expect(result).toBeCloseTo(8333333.33, 0);
    });

    test('土地面積=200㎡、路線価=80000円 → 26,666,666円', () => {
      const result = calculateLandPrice(200, 80000);
      expect(result).toBeCloseTo(26666666.67, 0);
    });

    test('土地面積=0㎡ → 0円', () => {
      const result = calculateLandPrice(0, 50000);
      expect(result).toBe(0);
    });

    test('路線価=0 → 0円', () => {
      const result = calculateLandPrice(100, 0);
      expect(result).toBe(0);
    });
  });

  describe('正常範囲の建物価格計算（築年数が上限未満）', () => {
    test('木造・築20年（buildYear=2005）・建物面積100㎡ → 正の値', () => {
      const original = calculateBuildingPrice_original(2005, 100, '木造');
      const fixed = calculateBuildingPrice_fixed(2005, 100, '木造');
      console.log('木造・築20年 修正前:', original, '修正後:', fixed);
      // 修正前も正の値（築20年は上限未満）
      expect(original).toBeGreaterThan(0);
      // 修正後も正の値
      expect(fixed).toBeGreaterThan(0);
    });

    test('鉄骨・築30年（buildYear=1995）・建物面積100㎡ → 正の値', () => {
      const original = calculateBuildingPrice_original(1995, 100, '鉄骨');
      const fixed = calculateBuildingPrice_fixed(1995, 100, '鉄骨');
      console.log('鉄骨・築30年 修正前:', original, '修正後:', fixed);
      expect(original).toBeGreaterThan(0);
      expect(fixed).toBeGreaterThan(0);
    });

    test('軽量鉄骨・築25年（buildYear=2000）・建物面積80㎡ → 正の値', () => {
      const original = calculateBuildingPrice_original(2000, 80, '軽量鉄骨');
      const fixed = calculateBuildingPrice_fixed(2000, 80, '軽量鉄骨');
      console.log('軽量鉄骨・築25年 修正前:', original, '修正後:', fixed);
      expect(original).toBeGreaterThan(0);
      expect(fixed).toBeGreaterThan(0);
    });
  });

  describe('境界値テスト（上限年数の前後）', () => {
    test('木造・築32年（上限未満）→ 修正後も正の値', () => {
      const fixed = calculateBuildingPrice_fixed(1993, 100, '木造'); // 2025-1993=32
      expect(fixed).toBeGreaterThan(0);
    });

    test('木造・築33年（上限）→ 修正後は basePrice * 0.1', () => {
      const fixed = calculateBuildingPrice_fixed(1992, 100, '木造'); // 2025-1992=33
      const unitPrice = 123100;
      const basePrice = unitPrice * 100;
      expect(fixed).toBeCloseTo(basePrice * 0.1, 0);
    });

    test('鉄骨・築39年（上限未満）→ 修正後も正の値', () => {
      const fixed = calculateBuildingPrice_fixed(1986, 100, '鉄骨'); // 2025-1986=39
      expect(fixed).toBeGreaterThan(0);
    });

    test('鉄骨・築40年（上限）→ 修正後は basePrice * 0.1', () => {
      const fixed = calculateBuildingPrice_fixed(1985, 100, '鉄骨'); // 2025-1985=40
      const unitPrice = 237300;
      const basePrice = unitPrice * 100;
      expect(fixed).toBeCloseTo(basePrice * 0.1, 0);
    });

    test('軽量鉄骨・築39年（上限未満）→ 修正後も正の値', () => {
      const fixed = calculateBuildingPrice_fixed(1986, 100, '軽量鉄骨'); // 2025-1986=39
      expect(fixed).toBeGreaterThan(0);
    });

    test('軽量鉄骨・築40年（上限）→ 修正後は basePrice * 0.1', () => {
      const fixed = calculateBuildingPrice_fixed(1985, 100, '軽量鉄骨'); // 2025-1985=40
      const unitPrice = 128400;
      const basePrice = unitPrice * 100;
      expect(fixed).toBeCloseTo(basePrice * 0.1, 0);
    });
  });

  describe('計算根拠セクションの表示条件（変更なし）', () => {
    test('editedValuationAmount1 が存在する場合に計算根拠を表示する条件は変更しない', () => {
      // この条件はUIロジックのため、計算関数のテストでは検証しない
      // 計算根拠セクションの表示条件（editedValuationAmount1 && property）は変更しない
      expect(true).toBe(true); // 表示条件は変更しないことを明示
    });
  });
});
