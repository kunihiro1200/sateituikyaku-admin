# 固定資産税路線価編集時の査定額再計算バグ Bugfix Design

## Overview

売主リストページ（通話モードページ）において、固定資産税路線価を編集しても査定額1/2/3が自動再計算されない問題を修正します。

現在、固定資産税路線価を最初に入力すると査定額が自動計算されますが、その後に固定資産税路線価を編集（例: 50000 → 60000）しても査定額が更新されません。また、ページリロード後に査定額1のみが再計算され、査定額2/3が空欄になるという不整合も発生しています。

修正により、固定資産税路線価を編集するたびに査定額1/2/3が即座に再計算され、ページリロードなしで正確な査定額を確認できるようになります。

## Glossary

- **Bug_Condition (C)**: 固定資産税路線価を編集しても査定額が再計算されない状態
- **Property (P)**: 固定資産税路線価を編集すると査定額1/2/3が即座に再計算される
- **Preservation**: 既存の査定額計算ロジック（初回入力時の自動計算、手入力査定額の優先順位）が維持される
- **固定資産税路線価**: `fixed_asset_tax_road_price`フィールド（円/㎡単位）
- **査定額1/2/3**: `valuation_amount_1/2/3`フィールド（円単位）
- **自動計算査定額**: BC/BD/BE列（スプレッドシート列54-56）に保存される査定額
- **手入力査定額**: CB/CC/CD列（スプレッドシート列79-81）に保存される査定額（最優先）
- **debouncedAutoCalculate**: 固定資産税路線価入力後1秒待ってから査定額を自動計算する関数

## Bug Details

### Bug Condition

バグは、固定資産税路線価を最初に入力した後、その値を編集する場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'edit', field: 'fixedAssetTaxRoadPrice', oldValue: number, newValue: number }
  OUTPUT: boolean
  
  RETURN input.action == 'edit'
         AND input.field == 'fixedAssetTaxRoadPrice'
         AND input.oldValue != null
         AND input.newValue != input.oldValue
         AND NOT valuationAmountsRecalculated()
END FUNCTION
```

### Examples

- **例1**: 固定資産税路線価を50000から60000に編集 → 査定額が更新されない（バグ）
- **例2**: 固定資産税路線価を最初に50000と入力 → 査定額が自動計算される（正常）
- **例3**: 固定資産税路線価を50000から60000に編集後、ページをリロード → 査定額1のみ再計算、査定額2/3が空欄（バグ）
- **例4**: 手入力査定額保存ボタンを押す → 手入力査定額が優先される（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 固定資産税路線価を最初に入力した時の自動計算は引き続き動作する
- 手入力査定額保存ボタンを押した時の動作は変更しない（手入力査定額が優先される）
- 固定資産税路線価以外のフィールド（土地面積、建物面積等）の編集動作は変更しない
- 査定額の優先順位ロジック（手動入力優先、なければ自動計算）は維持する

**Scope:**
固定資産税路線価の編集時の査定額再計算のみを修正します。以下は変更しません：
- 初回入力時の自動計算ロジック
- 手入力査定額の保存ロジック
- 査定額の優先順位ロジック
- スプレッドシートへの同期ロジック

## Hypothesized Root Cause

バグの根本原因は以下の通りです：

1. **onChange ハンドラーの条件分岐**: `CallModePage.tsx`の固定資産税路線価入力フィールドの`onChange`ハンドラーが、値が変更された時に`debouncedAutoCalculate`を呼び出しているが、何らかの条件で呼び出されていない可能性がある

2. **デバウンスタイマーの問題**: `debouncedAutoCalculate`関数が、既存のタイマーをクリアして新しいタイマーを設定しているが、コンポーネントの再レンダリング時にタイマーが失われている可能性がある

3. **ページリロード後の不整合**: ページリロード後に査定額1のみが再計算され、査定額2/3が空欄になるのは、バックエンドAPIの`calculate-valuation-amount2`と`calculate-valuation-amount3`が呼び出されていない可能性がある

4. **状態管理の問題**: `editedFixedAssetTaxRoadPrice`の状態が正しく更新されていない、または`autoCalculating`フラグが正しく管理されていない可能性がある


## Correctness Properties

Property 1: Bug Condition - 固定資産税路線価編集時の査定額再計算

_For any_ 固定資産税路線価の編集操作において、値が変更された場合（oldValue ≠ newValue）、システムは即座に査定額1/2/3を再計算し、UIに反映する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 既存の査定額計算ロジックの維持

_For any_ 固定資産税路線価の初回入力、手入力査定額の保存、その他のフィールドの編集において、システムは既存のロジックを維持し、査定額の優先順位ロジック（手動入力優先、なければ自動計算）を正しく適用する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を実施します：

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `onChange` ハンドラー（固定資産税路線価入力フィールド）

**Specific Changes**:
1. **onChange ハンドラーの修正**:
   - 現在: `debouncedAutoCalculate(value)`を条件付きで呼び出し
   - 変更後: 値が変更された時に必ず`debouncedAutoCalculate(value)`を呼び出す
   - 条件: `value && parseFloat(value) > 0`の場合のみ呼び出す（空欄や0の場合は呼び出さない）

2. **デバウンスタイマーの管理**:
   - `useRef`を使用して`calculationTimerRef`を管理
   - コンポーネントのアンマウント時にタイマーをクリア
   - `useEffect`のクリーンアップ関数で`clearTimeout(calculationTimerRef.current)`を実行

3. **autoCalculateValuations 関数の修正**:
   - 査定額1/2/3の計算を順次実行
   - 各計算が完了してから次の計算を開始
   - エラーハンドリングを追加（1つの計算が失敗しても他の計算を続行）

4. **ページリロード後の不整合の修正**:
   - `useEffect`で`fixedAssetTaxRoadPrice`が存在する場合、査定額1/2/3を全て再計算
   - 現在: 査定額1のみ再計算
   - 変更後: 査定額1/2/3を全て再計算

5. **状態管理の改善**:
   - `autoCalculating`フラグを正しく管理
   - 計算開始時に`true`、計算完了時に`false`
   - エラー発生時も`false`に戻す

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを採用します：まず、修正前のコードでバグを再現し、次に修正後のコードで正しく動作することを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 
1. 通話モードページを開く
2. 固定資産税路線価を最初に入力（例: 50000）
3. 査定額1/2/3が自動計算されることを確認
4. 固定資産税路線価を編集（例: 50000 → 60000）
5. 査定額1/2/3が更新されないことを確認（バグ再現）
6. ページをリロード
7. 査定額1のみが再計算され、査定額2/3が空欄になることを確認（バグ再現）

**Test Cases**:
1. **固定資産税路線価を編集**: 50000 → 60000（バグ再現）
2. **固定資産税路線価を編集**: 60000 → 70000（バグ再現）
3. **固定資産税路線価を空欄にする**: 60000 → 空欄（査定額がクリアされるか確認）
4. **ページリロード後**: 査定額1のみ再計算、査定額2/3が空欄（バグ再現）

**Expected Counterexamples**:
- 固定資産税路線価を編集しても査定額が更新されない
- ページリロード後に査定額2/3が空欄になる

### Fix Checking

**Goal**: 修正後のコードで、固定資産税路線価を編集すると査定額1/2/3が即座に再計算されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := editFixedAssetTaxRoadPrice(input.newValue)
  ASSERT result.valuationAmount1 == calculateValuationAmount1(input.newValue)
  ASSERT result.valuationAmount2 == calculateValuationAmount2(result.valuationAmount1)
  ASSERT result.valuationAmount3 == calculateValuationAmount3(result.valuationAmount1)
END FOR
```

**Test Cases**:
1. **固定資産税路線価を編集**: 50000 → 60000 → 査定額1/2/3が即座に再計算される
2. **固定資産税路線価を編集**: 60000 → 70000 → 査定額1/2/3が即座に再計算される
3. **固定資産税路線価を空欄にする**: 60000 → 空欄 → 査定額がクリアされる
4. **ページリロード後**: 査定額1/2/3が全て正しく再計算される

### Preservation Checking

**Goal**: 修正後も、固定資産税路線価の初回入力、手入力査定額の保存、その他のフィールドの編集が正しく動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) == fixedBehavior(input)
END FOR
```

**Testing Approach**: 修正前後で、固定資産税路線価の初回入力、手入力査定額の保存、その他のフィールドの編集の動作を比較し、変更がないことを確認します。

**Test Cases**:
1. **固定資産税路線価を最初に入力**: 50000 → 査定額1/2/3が自動計算される（変更なし）
2. **手入力査定額保存ボタンを押す**: 手入力査定額が優先される（変更なし）
3. **土地面積を編集**: 査定額は再計算されない（変更なし）
4. **査定額の優先順位**: 手動入力優先、なければ自動計算（変更なし）

### Unit Tests

- 固定資産税路線価の編集時に`debouncedAutoCalculate`が呼び出されることを確認
- `autoCalculateValuations`関数が査定額1/2/3を順次計算することを確認
- デバウンスタイマーが正しく管理されることを確認（1秒後に実行）
- エラーハンドリングが正しく動作することを確認

### Property-Based Tests

- ランダムな固定資産税路線価の値を生成し、編集時に査定額1/2/3が正しく再計算されることを確認
- ランダムな土地面積・建物面積を生成し、査定額の計算式が正しいことを確認
- 固定資産税路線価の初回入力と編集で、同じ値を入力した場合に同じ査定額が計算されることを確認

### Integration Tests

- 通話モードページで固定資産税路線価を編集し、査定額1/2/3が即座に再計算されることを確認
- ページリロード後に査定額1/2/3が全て正しく再計算されることを確認
- 手入力査定額保存ボタンを押した後、固定資産税路線価を編集しても手入力査定額が優先されることを確認
