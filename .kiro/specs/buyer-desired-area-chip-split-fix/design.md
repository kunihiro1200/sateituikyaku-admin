# buyer-desired-area-chip-split-fix Bugfix Design

## Overview

買主希望条件ページ（`BuyerDesiredConditionsPage.tsx`）で、希望エリアの初期値をDBから読み込む際に `desired_area` の文字列を「、」（読点）で分割している。エリア名自体に読点が含まれる場合（例：「②中学校（滝尾、城東、原川）」）、エリア名内の読点も区切り文字として扱われ、1つのエリアが複数のチップに分割されて表示されるバグを修正する。

修正方針は最小限：`fetchBuyer` 内の初期化ロジックと `handleInlineFieldSave` 後の同期ロジックで、`desired_area` の分割を「`|`のみ」に限定する。

## Glossary

- **Bug_Condition (C)**: `desired_area` の値に `|` が含まれず、かつ読点（`、`）またはカンマ（`,`）を含む場合に、`split('、')` によって複数要素に分割されてしまう状態
- **Property (P)**: `desired_area` の各エリア名が1つのチップとして表示される（`selectedAreas` 配列の各要素がエリア名全体と一致する）
- **Preservation**: `|` 区切りで複数エリアが保存されている場合の正常な複数チップ表示、チェックボックスによる選択・解除動作
- **parseDesiredArea**: `desired_area` 文字列を `selectedAreas` 配列に変換するロジック（修正対象）
- **selectedAreas**: 現在選択中のエリアを保持するローカル state（`string[]`）

## Bug Details

### Bug Condition

バグは `desired_area` の値が `|` を含まない（旧フォーマット）かつ読点を含むエリア名が保存されている場合に発生する。`fetchBuyer` 内の初期化処理が `split('、')` を使用しており、エリア名内の読点も区切り文字として扱ってしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(desiredAreaValue)
  INPUT: desiredAreaValue of type string
  OUTPUT: boolean

  RETURN desiredAreaValue NOT CONTAINS '|'
         AND (desiredAreaValue CONTAINS '、' OR desiredAreaValue CONTAINS ',')
         AND desiredAreaValue IS_VALID_AREA_NAME
         // つまり: 旧フォーマット（|なし）かつ読点/カンマを含むエリア名
END FUNCTION
```

### Examples

- 入力: `"②中学校（滝尾、城東、原川）"` → バグあり: `["②中学校（滝尾", "城東", "原川）"]`（3チップ）→ 期待: `["②中学校（滝尾、城東、原川）"]`（1チップ）
- 入力: `"⑤中学校（大在、坂ノ市、鶴崎、佐賀関）"` → バグあり: 4チップ → 期待: 1チップ
- 入力: `"②中学校（滝尾、城東、原川）|⑥中学校（南大分、城南、賀来）"` → バグなし（`|`含むため正常に2チップ）
- 入力: `"㊵大分"` → バグなし（読点なし、正常に1チップ）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `|` 区切りで複数エリアが保存されている場合、各エリアを個別のチップとして表示する
- 読点を含まないエリア名（例：「㊵大分」）は引き続き1チップとして正しく表示される
- チェックボックスで選択・解除を行った際のチップ追加・削除動作は変わらない
- 選択後の保存値は引き続き `|` 区切りで保存される

**Scope:**
`|` を含む `desired_area` 値（新フォーマット）はバグの影響を受けていないため、修正後も同じ動作を維持する。チップの削除・追加インタラクションも変更しない。

## Hypothesized Root Cause

`BuyerDesiredConditionsPage.tsx` の `fetchBuyer` 関数内（108行目付近）に以下のコードがある：

```typescript
const initialAreas = areaVal
  ? (areaVal.includes('|')
      ? areaVal.split('|')
      : areaVal.split('、'))  // ← ここが問題
    .map((v: string) => v.trim()).filter(Boolean)
  : [];
```

`|` が含まれない場合に `split('、')` を実行しているため、エリア名内の読点（例：「②中学校（滝尾**、**城東**、**原川）」）も区切り文字として扱われる。

同様のロジックが `handleInlineFieldSave` 後の `desired_area` 同期処理（196行目付近）にも存在する：

```typescript
const updatedAreas = areaVal
  ? (areaVal.includes('|')
      ? areaVal.split('|')
      : areaVal.split('、'))  // ← 同じ問題
    .map((v: string) => v.trim()).filter(Boolean)
  : [];
```

**根本原因**: `desired_area` の保存フォーマットが `|` 区切りに統一されているにもかかわらず、旧フォーマット（読点区切り）へのフォールバックが残っており、エリア名内の読点と区切り文字の読点を区別できていない。

## Correctness Properties

Property 1: Bug Condition - 読点を含むエリア名が1チップとして表示される

_For any_ `desired_area` 値において、`AREA_OPTIONS` に定義された有効なエリア名（読点を含むものを含む）が `|` なしで単独保存されている場合、修正後の `parseDesiredArea` 関数は要素数1の配列を返し、そのエリア名全体が1つのチップとして表示される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - `|` 区切りの複数エリアが正しく複数チップとして表示される

_For any_ `desired_area` 値において、`|` で区切られた複数エリアが保存されている場合、修正後の `parseDesiredArea` 関数は元の動作と同一の結果（各エリアを個別要素とする配列）を返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx`

**Specific Changes**:

1. **`fetchBuyer` 内の初期化ロジック修正**（108行目付近）:
   ```typescript
   // 修正前
   const initialAreas = areaVal
     ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、'))
       .map((v: string) => v.trim()).filter(Boolean)
     : [];

   // 修正後
   const initialAreas = areaVal
     ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean)
     : [];
   ```

2. **`handleInlineFieldSave` 後の `desired_area` 同期ロジック修正**（196行目付近）:
   ```typescript
   // 修正前
   const updatedAreas = areaVal
     ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、'))
       .map((v: string) => v.trim()).filter(Boolean)
     : [];

   // 修正後
   const updatedAreas = areaVal
     ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean)
     : [];
   ```

**変更の根拠**: `desired_area` の保存フォーマットは `|` 区切りに統一されている（`NewBuyerPage.tsx` の `desiredArea.join('|')` および `BuyerDesiredConditionsPage.tsx` の `selectedAreasRef.current.join('|')` で確認済み）。旧フォーマット（読点区切り）へのフォールバックは不要であり、削除することでバグが解消される。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `split('、')` がエリア名内の読点を誤って分割することを確認する。

**Test Plan**: `parseDesiredArea` に相当するロジックを抽出し、読点を含むエリア名を入力として渡し、配列長が期待値（1）と異なることを確認する。

**Test Cases**:
1. **単一エリア（読点含む）**: `"②中学校（滝尾、城東、原川）"` → 未修正: 3要素（バグ確認）
2. **単一エリア（読点4つ）**: `"⑤中学校（大在、坂ノ市、鶴崎、佐賀関）"` → 未修正: 4要素（バグ確認）
3. **複数エリア（|区切り）**: `"②中学校（滝尾、城東、原川）|㊵大分"` → 未修正: 2要素（正常）
4. **単一エリア（読点なし）**: `"㊵大分"` → 未修正: 1要素（正常）

**Expected Counterexamples**:
- `split('、')` が括弧内の読点を区切り文字として扱い、エリア名が複数要素に分割される

### Fix Checking

**Goal**: 修正後、読点を含むエリア名が1要素として正しく解析されることを検証する。

**Pseudocode:**
```
FOR ALL areaValue WHERE isBugCondition(areaValue) DO
  result := parseDesiredArea_fixed(areaValue)
  ASSERT result.length === 1
  ASSERT result[0] === areaValue.trim()
END FOR
```

### Preservation Checking

**Goal**: `|` 区切りの複数エリアが修正前後で同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL areaValue WHERE NOT isBugCondition(areaValue) DO
  ASSERT parseDesiredArea_original(areaValue) = parseDesiredArea_fixed(areaValue)
END FOR
```

**Testing Approach**: `|` を含む入力は修正前後で同じ `split('|')` パスを通るため、動作は変わらない。プロパティベーステストで多数のエリア組み合わせを検証する。

**Test Cases**:
1. **複数エリア保存の保持**: `"②中学校（滝尾、城東、原川）|⑥中学校（南大分、城南、賀来）"` → 修正後も2要素
2. **読点なし単一エリアの保持**: `"㊵大分"` → 修正後も1要素
3. **空文字の保持**: `""` → 修正後も空配列

### Unit Tests

- `parseDesiredArea` ロジックの単体テスト（読点含むエリア名 → 1要素）
- `parseDesiredArea` ロジックの単体テスト（`|` 区切り複数エリア → 複数要素）
- 空文字・null入力のエッジケーステスト

### Property-Based Tests

- `AREA_OPTIONS` の全エリア名を単独入力として渡し、修正後の関数が常に1要素を返すことを検証
- `AREA_OPTIONS` から任意個数のエリアを選択し `|` 結合した値を入力として、修正後の関数が正しい要素数を返すことを検証

### Integration Tests

- `BuyerDesiredConditionsPage` のレンダリングテスト：読点含むエリアが保存されたバイヤーデータを渡し、チップ数が1であることを確認
- チェックボックスで選択・解除後の `selectedAreas` 状態が正しく更新されることを確認
