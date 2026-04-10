# 新築年月フォーマットバグ修正 設計書

## Overview

物件リスト（売主管理システム）の物件詳細情報セクション（`PropertyDetailsSection.tsx`）において、新築年月フィールドが `Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)` のような生のJavaScript Date文字列で表示されるバグを修正する。

既存の `formatConstructionDate()` ユーティリティ関数（`frontend/frontend/src/utils/constructionDateFormatter.ts`）が存在するにもかかわらず、`PropertyDetailsSection.tsx` の表示モードでこの関数が呼ばれていないことが根本原因である。修正は最小限で、`formatConstructionDate()` を呼び出すよう1箇所を変更するだけで対応できる。

## Glossary

- **Bug_Condition (C)**: `construction_year_month` フィールドの値が `formatConstructionDate()` を通さずにそのまま描画される条件
- **Property (P)**: 新築年月が `YYYY年M月` 形式の日本語フォーマットで表示されること
- **Preservation**: 他のフィールド（土地面積、建物面積、構造など）の表示形式が変わらないこと
- **formatConstructionDate**: `frontend/frontend/src/utils/constructionDateFormatter.ts` に定義された関数。様々な形式の日付文字列を `YYYY年MM月` 形式に変換する
- **PropertyDetailsSection**: `frontend/frontend/src/components/PropertyDetailsSection.tsx` に定義されたコンポーネント。物件詳細情報（面積、構造、新築年月など）を表示する
- **construction_year_month**: DBに保存される新築年月フィールド。`YYYY-MM` 形式で保存されているが、スプレッドシートから同期された場合に `Sat Apr 01 1978...` のようなDate.toString()形式になることがある

## Bug Details

### Bug Condition

バグは `PropertyDetailsSection.tsx` の表示モード（`isEditMode === false`）で `construction_year_month` フィールドを描画する際に発生する。`formatConstructionDate()` を呼ばずに `formatValue(data.construction_year_month)` をそのまま使用しているため、Date.toString()形式の文字列がそのまま表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { construction_year_month: string | null | undefined }
  OUTPUT: boolean

  IF input.construction_year_month IS null OR undefined THEN
    RETURN false  // 空値は別途処理される
  END IF

  // Date.toString()形式の文字列かどうかを判定
  // 例: "Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"
  RETURN input.construction_year_month MATCHES /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s\d{4}/
         AND formatConstructionDate(input.construction_year_month) IS null
         // formatConstructionDate()が認識できない形式 = バグ条件
END FUNCTION
```

### Examples

- **バグあり**: `construction_year_month = "Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"` → 現在: そのまま表示 / 期待: `1978年04月`
- **バグあり**: `construction_year_month = "Mon Nov 01 2008 00:00:00 GMT+0900 (Japan Standard Time)"` → 現在: そのまま表示 / 期待: `2008年11月`
- **正常**: `construction_year_month = "2020-03"` → 現在: `2020-03` / 期待: `2020年03月`（`formatConstructionDate()` を呼べば正しくなる）
- **正常**: `construction_year_month = null` → 現在: `-` / 期待: `-`（変わらない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 土地面積、建物面積、専有面積、構造、間取り、契約日、決済日フィールドの表示形式は変わらない
- 編集モード（`isEditMode === true`）の動作は変わらない（テキストフィールドへの入力・表示）
- `construction_year_month` が `null` または空の場合は引き続き `-` を表示する
- スプレッドシートへの同期処理は変わらない（フロントエンド表示のみの変更）

**Scope:**
`construction_year_month` フィールドの表示モードのみが変更対象。他のフィールドや編集モードは一切影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は明確である：

1. **`formatConstructionDate()` の未使用**: `PropertyDetailsSection.tsx` は `constructionDateFormatter.ts` をインポートしておらず、表示モードで `formatValue(data.construction_year_month)` をそのまま呼んでいる。一方、`PublicPropertyDetailPage.tsx` や `PublicPropertyCard.tsx` では正しく `formatConstructionDate()` を使用している。

2. **Date.toString()形式の入力**: スプレッドシートから同期された `construction_year_month` が `Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)` のようなJavaScript Date.toString()形式で保存されている。`formatConstructionDate()` はこの形式を認識できないため `null` を返す。

3. **二重の問題**: 表示側で `formatConstructionDate()` を呼ばないこと（主因）と、DBに保存されている値がDate.toString()形式であること（副因）が重なっている。

## Correctness Properties

Property 1: Bug Condition - 新築年月の日本語フォーマット表示

_For any_ `construction_year_month` の値が `YYYY-MM`、`YYYY/MM`、`YYYY年MM月` などの認識可能な形式である場合、修正後の `PropertyDetailsSection` は `formatConstructionDate()` を通した `YYYY年MM月` 形式の文字列を表示しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 空値・他フィールドの表示維持

_For any_ `construction_year_month` が `null`、`undefined`、または空文字である場合、修正後の `PropertyDetailsSection` は引き続き `-` を表示し、他のフィールド（土地面積、建物面積、構造など）の表示は変わらない。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/PropertyDetailsSection.tsx`

**Specific Changes**:

1. **インポート追加**: `formatConstructionDate` を `constructionDateFormatter` からインポートする
   ```typescript
   import { formatConstructionDate } from '../utils/constructionDateFormatter';
   ```

2. **表示モードの新築年月フィールドを修正**: `formatValue(data.construction_year_month)` を `formatConstructionDate()` を使った表示に変更する
   ```typescript
   // 変更前
   {formatValue(data.construction_year_month)}
   
   // 変更後
   {formatConstructionDate(data.construction_year_month) ?? formatValue(data.construction_year_month)}
   ```
   
   `formatConstructionDate()` が `null` を返す場合（認識できない形式）は `formatValue()` にフォールバックする。

**Note**: Date.toString()形式（`Sat Apr 01 1978...`）は `formatConstructionDate()` が認識できないため `null` を返す。この場合のフォールバック表示については、要件2.2に基づき `ja-JP` ロケールを使用した変換を `formatConstructionDate()` に追加することも検討する。

### Optional Enhancement

`formatConstructionDate()` にDate.toString()形式のパースを追加する：

**File**: `frontend/frontend/src/utils/constructionDateFormatter.ts`

```typescript
// Date.toString()形式のパース（例: "Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"）
const dateToStringMatch = trimmed.match(/^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}\s(\d{4})/);
if (dateToStringMatch) {
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}年${month}月`;
  }
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ：まず未修正コードでバグを再現するテストを書き、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `PropertyDetailsSection` コンポーネントを `isEditMode=false` でレンダリングし、`construction_year_month` に様々な形式の値を渡して表示内容を検証する。未修正コードでは `formatConstructionDate()` が呼ばれないため、生の文字列がそのまま表示される。

**Test Cases**:
1. **Date.toString()形式テスト**: `construction_year_month = "Sat Apr 01 1978 00:00:00 GMT+0900 (Japan Standard Time)"` を渡し、生の文字列がそのまま表示されることを確認（未修正コードで失敗するはず）
2. **YYYY-MM形式テスト**: `construction_year_month = "2020-03"` を渡し、`2020-03` がそのまま表示されることを確認（未修正コードでは `2020年03月` にならない）
3. **null値テスト**: `construction_year_month = null` を渡し、`-` が表示されることを確認（未修正コードでも正常）

**Expected Counterexamples**:
- `"Sat Apr 01 1978..."` がそのまま表示される（フォーマットされない）
- `"2020-03"` が `"2020年03月"` に変換されない

### Fix Checking

**Goal**: 修正後、バグ条件が成立する入力に対して正しい表示になることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := render PropertyDetailsSection with input (isEditMode=false)
  ASSERT result contains formatConstructionDate(input.construction_year_month)
         OR result contains YYYY年MM月 format
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力（null、他フィールド）に対して動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT render_original(input) = render_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストで多様な入力を生成し、null/undefined/空文字の場合は常に `-` が表示されることを検証する。

**Test Cases**:
1. **null保持テスト**: `construction_year_month = null` → `-` が表示される
2. **他フィールド保持テスト**: `land_area`, `building_area`, `structure` などの表示が変わらない
3. **編集モード保持テスト**: `isEditMode=true` の場合、テキストフィールドに生の値が表示される（フォーマットしない）

### Unit Tests

- `formatConstructionDate()` に各種形式の入力を渡して正しい出力を検証
- `PropertyDetailsSection` の表示モードで `formatConstructionDate()` が呼ばれることを検証
- null/undefined/空文字の入力で `-` が表示されることを検証

### Property-Based Tests

- ランダムな `YYYY-MM` 形式の文字列を生成し、`formatConstructionDate()` が常に `YYYY年MM月` 形式を返すことを検証
- ランダムな物件データを生成し、`construction_year_month` 以外のフィールドの表示が変わらないことを検証

### Integration Tests

- `PropertyListingsPage` で物件詳細セクションを開き、新築年月が日本語形式で表示されることを確認
- 編集モードと表示モードを切り替えて、それぞれ正しく動作することを確認
