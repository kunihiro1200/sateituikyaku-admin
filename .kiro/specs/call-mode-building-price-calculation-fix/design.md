# 通話モード建物価格計算バグ修正 設計ドキュメント

## Overview

通話モードページ（CallModePage）の「計算根拠」セクションにある建物価格がマイナスや異常な値になるバグを修正する。

根本原因は2つある：
1. 築年数の上限チェックが行われていないため、木造33年以上・鉄骨/軽量鉄骨40年以上で減価償却額が基準価格を超えてマイナスになる
2. 建築単価が固定値（176200円/㎡）でハードコードされており、構造に応じた正しい建築単価が使用されていない

修正対象は `frontend/frontend/src/pages/CallModePage.tsx` の計算根拠セクション（約4800行付近）のみ。バックエンドの変更は不要。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 築年数が上限（木造33年、鉄骨/軽量鉄骨40年）以上、または建築単価が固定値176200円で計算されている状態
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — 建物価格が常に正の値（基準価格の10%以上）になること
- **Preservation**: 修正によって変更してはならない既存の動作 — 土地価格計算、計算根拠セクションの表示条件、築年数が上限未満の場合の正常な計算
- **calculateBuildingPrice**: `CallModePage.tsx` の計算根拠セクション内で建物価格を計算するインライン計算ロジック（約4800行付近）
- **buildingAge**: 築年数（2025 - buildYear で計算）
- **unitPrice**: 建築単価（構造に応じて決定される値）
- **basePrice**: 基準価格（unitPrice × buildingArea）

## Bug Details

### Bug Condition

バグは以下の2つの条件のいずれかが成立するときに発現する：

**条件A（築年数上限チェックなし）**: 構造が木造/空欄で築年数が33年以上、または構造が鉄骨/軽量鉄骨で築年数が40年以上の場合、減価償却額が基準価格を超えて建物価格がマイナスになる。

**条件B（建築単価ハードコード）**: 構造に関わらず常に176200円/㎡が使用されるため、正しい建築単価（木造=123100、軽量鉄骨=128400、鉄骨=237300）が反映されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { structure: string, buildYear: number, buildingArea: number }
  OUTPUT: boolean

  buildingAge := (buildYear == 0 OR buildYear == null) ? 35 : (2025 - buildYear)

  // 条件A: 築年数が上限以上でマイナスになる
  IF structure IN ['木造', '', null, '不明', '未確認'] AND buildingAge >= 33 THEN
    RETURN true
  END IF
  IF structure IN ['鉄骨', '軽量鉄骨'] AND buildingAge >= 40 THEN
    RETURN true
  END IF

  // 条件B: 建築単価が常に176200円（構造に関わらず）
  // 現在の実装は常にこの条件を満たす（全入力がバグ条件）
  RETURN true  // unitPrice が常に 176200 でハードコードされているため

END FUNCTION
```

### Examples

- **木造・築35年**: 建物価格 = 176200 × 100 × (1 - 0.9 × 35 × 0.031) = 176200 × 100 × (1 - 0.9765) = 176200 × 100 × 0.0235 ≈ 414,070円（正の値だが建築単価が誤り）
- **木造・築40年**: 建物価格 = 176200 × 100 - 176200 × 100 × 0.9 × 40 × 0.031 = 17,620,000 - 19,659,120 = **-2,039,120円（マイナス）**
- **鉄骨・築45年**: 建物価格 = 176200 × 100 - 176200 × 100 × 0.9 × 45 × 0.015 = 17,620,000 - 10,699,650 = 6,920,350円（正の値だが建築単価が誤り）
- **木造・築0年（空欄）**: デフォルト35年が適用されるべきだが、現在は0年として計算される

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 土地価格の計算（土地面積 × 固定資産税路線価 ÷ 0.6）は変更しない
- 計算根拠セクションの表示条件（`editedValuationAmount1` が存在し、`property` が存在する）は変更しない
- 築年数が上限未満の場合の正常な減価償却計算の結果は変更しない（ただし建築単価は正しい値に変更）
- 計算根拠セクションのUI構造・表示項目は変更しない

**スコープ:**
建物価格の計算ロジック（`unitPrice`、`buildingAge`、`buildingPrice` の計算部分）のみを修正する。土地価格計算、査定額の保存・表示、その他のUI要素は一切変更しない。

## Hypothesized Root Cause

コードの該当箇所（約4800行付近）を確認した結果、以下の問題が特定された：

1. **建築単価のハードコード**: `const unitPrice = 176200;` が構造に関わらず固定値で設定されている。正しくは構造（`property.structure`）に応じて木造=123100、軽量鉄骨=128400、鉄骨=237300を使用すべき。

2. **築年数上限チェックの欠如**: 
   ```typescript
   const depreciation = basePrice * 0.9 * buildingAge * 0.031;
   const buildingPrice = basePrice - depreciation;
   ```
   築年数が大きくなると `depreciation > basePrice` となりマイナスになる。上限チェック（木造33年、鉄骨/軽量鉄骨40年）が実装されていない。

3. **築年=0の場合のデフォルト値未適用**: `buildYear = 0` の場合に35年をデフォルトとして使用すべきだが、現在は `buildingAge = 2025 - 0 = 2025` という異常な値になる可能性がある（実際は `buildYear > 0 ? 2025 - buildYear : 0` で0になっているが、要件では35年がデフォルト）。

4. **`property` オブジェクトのみ参照**: 計算根拠セクションは `property` オブジェクトのみを参照しているが、`seller` の直接フィールド（`buildingAreaVerified` など）も考慮すべき可能性がある。ただし現在の要件では `property` の値を使用する。

## Correctness Properties

Property 1: Bug Condition - 建物価格は常に正の値（基準価格の10%以上）

_For any_ 入力（構造・築年数・建物面積の組み合わせ）において、修正後の計算ロジックは建物価格として `基準価格 × 0.1` 以上の正の値を返す。具体的には、築年数が上限（木造33年、鉄骨/軽量鉄骨40年）以上の場合は `unitPrice × buildingArea × 0.1` を返し、上限未満の場合は通常の減価償却計算結果（常に正の値）を返す。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - 土地価格計算の不変性

_For any_ 入力（土地面積・固定資産税路線価）において、修正後のコードは修正前のコードと同一の土地価格（`landArea × roadPrice / 0.6`）を返す。建物価格計算の変更は土地価格計算に一切影響しない。

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Location**: 計算根拠セクション（約4793〜4810行付近）

**現在のコード:**
```typescript
const buildingArea = property.buildingArea || 0;
const buildYear = property.buildYear || 0;
const buildingAge = buildYear > 0 ? 2025 - buildYear : 0;
const unitPrice = 176200;
const basePrice = unitPrice * buildingArea;
const depreciation = basePrice * 0.9 * buildingAge * 0.031;
const buildingPrice = basePrice - depreciation;
```

**修正後のコード:**
```typescript
const buildingArea = property.buildingAreaVerified || property.buildingArea || 0;
const buildYear = property.buildYear || 0;
// 築年=0または空欄の場合はデフォルト35年を使用
const buildingAge = buildYear > 0 ? 2025 - buildYear : 35;
const structure = property.structure || '';

// 構造に応じた建築単価（デフォルト値）
const unitPrice = (() => {
  if (structure === '鉄骨') return 237300;
  if (structure === '軽量鉄骨') return 128400;
  return 123100; // 木造・空欄・不明・未確認
})();

const basePrice = unitPrice * buildingArea;

// 築年数の上限チェック付き建物価格計算
const buildingPrice = (() => {
  if (structure === '鉄骨' || structure === '軽量鉄骨') {
    // 鉄骨・軽量鉄骨: 40年以上で残価10%
    if (buildingAge >= 40) return basePrice * 0.1;
    const rate = structure === '鉄骨' ? 0.015 : 0.025;
    return basePrice - basePrice * 0.9 * buildingAge * rate;
  } else {
    // 木造・空欄・その他: 33年以上で残価10%
    if (buildingAge >= 33) return basePrice * 0.1;
    return basePrice - basePrice * 0.9 * buildingAge * 0.031;
  }
})();
```

**Specific Changes:**
1. **建築単価の動的決定**: `const unitPrice = 176200` を構造に応じた条件分岐に変更
2. **築年数デフォルト値**: `buildYear > 0 ? 2025 - buildYear : 0` を `buildYear > 0 ? 2025 - buildYear : 35` に変更
3. **築年数上限チェック**: 木造33年以上・鉄骨/軽量鉄骨40年以上で `basePrice * 0.1` を返すロジックを追加
4. **建物面積の優先順位**: `buildingAreaVerified`（当社調べ）が入力されている場合はそちらを優先
5. **計算式表示の更新**: 計算根拠の表示テキスト（`unitPrice`、`depreciation`、`buildingPrice` の表示部分）も修正後の値を反映するよう更新

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず修正前のコードでバグを再現するテストを実行し、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 計算ロジックを純粋関数として抽出し、バグ条件（築年数上限超過・建築単価ハードコード）を持つ入力でテストを実行する。修正前のコードでは失敗することを確認する。

**Test Cases:**
1. **木造・築40年テスト**: 構造=木造、築年=1985（築40年）、建物面積=100㎡ → 修正前は負の値（約-2,039,120円）になることを確認
2. **鉄骨・築45年テスト**: 構造=鉄骨、築年=1980（築45年）、建物面積=100㎡ → 修正前は建築単価が誤り（176200円）であることを確認
3. **木造・築33年境界テスト**: 構造=木造、築年=1992（築33年）、建物面積=100㎡ → 修正前はマイナスになることを確認
4. **築年=0テスト**: 築年=0、建物面積=100㎡ → 修正前は buildingAge=0 で計算されることを確認

**Expected Counterexamples:**
- 木造・築33年以上: `buildingPrice < 0`（マイナス値）
- 全構造: `unitPrice === 176200`（固定値のまま）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して正しい動作を検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := calculateBuildingPrice_fixed(input)
  ASSERT result >= input.basePrice * 0.1  // 残価10%以上
  ASSERT result > 0                        // 正の値
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力（築年数が上限未満）に対して、修正前後で同じ結果になることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_ageLimit(input) DO
  // 建築単価は変わるため、土地価格計算のみ保持を検証
  ASSERT landPrice_original(input) = landPrice_fixed(input)
END FOR
```

**Testing Approach**: 土地価格計算は変更しないため、土地価格の保持を重点的に検証する。建物価格については、築年数が上限未満の場合に正の値が返ることを検証する。

**Test Cases:**
1. **土地価格保持テスト**: 土地面積=100㎡、路線価=50000円 → 修正前後で `100 × 50000 / 0.6 = 8,333,333円` が変わらないことを確認
2. **木造・築20年正常テスト**: 構造=木造、築年=2005（築20年）、建物面積=100㎡ → 修正後も正の値で、正しい建築単価（123100円）で計算されることを確認
3. **鉄骨・築30年正常テスト**: 構造=鉄骨、築年=1995（築30年）、建物面積=100㎡ → 修正後も正の値で、正しい建築単価（237300円）で計算されることを確認

### Unit Tests

- 各構造（木造・軽量鉄骨・鉄骨・空欄）の建築単価が正しく選択されることをテスト
- 築年数上限（木造33年、鉄骨/軽量鉄骨40年）の境界値テスト（32年・33年・34年、39年・40年・41年）
- 築年=0の場合にデフォルト35年が適用されることをテスト
- 建物価格が常に `basePrice * 0.1` 以上になることをテスト

### Property-Based Tests

- ランダムな築年数（0〜100年）と構造の組み合わせで、建物価格が常に正の値になることを検証
- ランダムな土地面積・路線価で、土地価格計算が修正前後で同一であることを検証
- 全構造・全築年数の組み合わせで、建物価格が `basePrice * 0.1` 以上 `basePrice` 以下の範囲に収まることを検証

### Integration Tests

- 通話モードページで木造・築40年の物件を表示し、計算根拠の建物価格が正の値で表示されることを確認
- 計算根拠セクションの表示テキスト（建築単価・計算式）が修正後の値を正しく反映していることを確認
- 土地価格の表示が修正前後で変わらないことを確認
