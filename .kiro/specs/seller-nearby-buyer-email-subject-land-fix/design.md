# Seller Nearby Buyer Email Subject Land Fix - Bugfix Design

## Overview

売主リストの近隣買主メール送信機能において、物件種別が「土地」の場合でも件名末尾に「事前に内覧可能です！」が付与されてしまうバグを修正する。

土地は建物が存在しないため「内覧」という表現が不適切である。`handleSendEmail` 関数内の件名生成ロジックに `isLand()` チェックを追加し、物件種別が「土地」の場合は当該文言を省略する。

既存の `isLand()` ユーティリティ関数（`frontend/frontend/src/utils/propertyTypeUtils.ts`）が既に存在しており、`NearbyBuyersList.tsx` でもインポート済みのため、最小限の変更で修正可能である。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — 物件種別が「土地」（`isLand()` が `true` を返す）の状態で近隣買主メール送信ボタンを押下する
- **Property (P)**: バグ条件が成立する際の期待される正しい動作 — 件名が `${address}に興味のあるかた！もうすぐ売り出します！` となり「事前に内覧可能です！」を含まない
- **Preservation**: 修正によって変更してはならない既存の動作 — 物件種別が「土地」以外の場合の件名生成（「事前に内覧可能です！」を含む）
- **isLand()**: `frontend/frontend/src/utils/propertyTypeUtils.ts` に定義されたユーティリティ関数。`'土'`、`'land'`、`'土地'` のいずれかと一致する場合に `true` を返す
- **effectivePropertyType**: `NearbyBuyersList.tsx` 内で `props` 優先、なければ API 取得値を使用する物件種別の実効値
- **handleSendEmail**: `NearbyBuyersList.tsx` 内のメール送信処理関数。件名・本文を生成してメール送信APIを呼び出す

## Bug Details

### Bug Condition

物件種別が「土地」の場合でも、件名生成ロジックが物件種別を考慮せず固定文字列 `事前に内覧可能です！` を末尾に付与してしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { effectivePropertyType: string | null | undefined }
  OUTPUT: boolean

  RETURN isLand(input.effectivePropertyType) = true
         AND 件名に「事前に内覧可能です！」が含まれる
END FUNCTION
```

### Examples

- **バグ発動例**: 物件種別「土地」で送信ボタン押下 → 件名 `〇〇町1-2-3に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`（「事前に内覧可能です！」が不適切に含まれる）
- **期待される動作**: 物件種別「土地」で送信ボタン押下 → 件名 `〇〇町1-2-3に興味のあるかた！もうすぐ売り出します！`（「事前に内覧可能です！」が省略される）
- **正常ケース（戸建）**: 物件種別「戸建」で送信ボタン押下 → 件名 `〇〇町1-2-3に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`（現行通り維持）
- **正常ケース（マンション）**: 物件種別「マンション」で送信ボタン押下 → 件名 `〇〇町1-2-3に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`（現行通り維持）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 物件種別が「土地」以外（戸建・マンション・収益物件等）の場合、件名は `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！` のまま維持される
- メール本文の生成ロジックは変更されない
- 送信先の選択・フィルタリングロジックは変更されない
- その他のメール送信フロー（バリデーション、API呼び出し等）は変更されない

**Scope:**
物件種別が「土地」でない全ての入力は、この修正によって完全に影響を受けない。これには以下が含まれる：
- 物件種別「戸建」（`'戸'`、`'detached_house'`、`'戸建'`、`'戸建て'`）
- 物件種別「マンション」
- 物件種別「収益物件」（`'収'`、`'income'`、`'収益物件'`）
- 物件種別が `null` または `undefined` の場合

## Hypothesized Root Cause

バグの根本原因は以下の通りである：

1. **件名生成ロジックが物件種別を考慮していない**: `handleSendEmail` 関数内の件名生成（約541行目付近）が固定文字列として `事前に内覧可能です！` を常に付与しており、`effectivePropertyType` を参照していない

   ```typescript
   // 現在のコード（バグあり）
   const subject = `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
   ```

2. **既存の `isLand()` 関数が件名生成に適用されていない**: `isLand()` は既に `NearbyBuyersList.tsx` でインポートされ、ボタン表示制御（`showLandAndHouseButtons`）には使用されているが、件名生成には適用されていない

## Correctness Properties

Property 1: Bug Condition - 土地の場合は件名に「事前に内覧可能です！」を含まない

_For any_ 入力において `isLand(effectivePropertyType)` が `true` を返す場合、修正後の `handleSendEmail` 関数は件名を `${address}に興味のあるかた！もうすぐ売り出します！` と生成し、「事前に内覧可能です！」を含まない SHALL。

**Validates: Requirements 2.1**

Property 2: Preservation - 土地以外の場合は件名が変わらない

_For any_ 入力において `isLand(effectivePropertyType)` が `false` を返す場合（土地以外の物件種別、または `null`/`undefined`）、修正後の `handleSendEmail` 関数は修正前と同一の件名 `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！` を生成する SHALL。

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/NearbyBuyersList.tsx`

**Function**: `handleSendEmail`（約541行目付近）

**Specific Changes**:

1. **件名生成ロジックに `isLand()` チェックを追加**:
   ```typescript
   // 修正前
   const subject = `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;

   // 修正後
   const subject = isLand(effectivePropertyType)
     ? `${address}に興味のあるかた！もうすぐ売り出します！`
     : `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
   ```

2. **追加インポート不要**: `isLand` は既に26行目でインポート済み、`effectivePropertyType` も同スコープ内で定義済みのため、追加変更は不要

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが発動することを確認し、根本原因分析を検証する。

**Test Plan**: `handleSendEmail` 関数の件名生成部分を単体テストし、物件種別「土地」の場合に「事前に内覧可能です！」が含まれることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **土地の件名テスト**: `effectivePropertyType = '土地'` で件名生成 → 「事前に内覧可能です！」が含まれることを確認（未修正コードで失敗するはず）
2. **土（略称）の件名テスト**: `effectivePropertyType = '土'` で件名生成 → 同上
3. **land（英語）の件名テスト**: `effectivePropertyType = 'land'` で件名生成 → 同上

**Expected Counterexamples**:
- 物件種別「土地」で件名に「事前に内覧可能です！」が含まれる
- 原因: 件名生成ロジックが `effectivePropertyType` を参照していない固定文字列

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  subject := generateSubject_fixed(input.effectivePropertyType, input.address)
  ASSERT NOT contains(subject, '事前に内覧可能です！')
  ASSERT subject = `${input.address}に興味のあるかた！もうすぐ売り出します！`
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT generateSubject_original(input) = generateSubject_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- 多様な物件種別（戸建・マンション・収益物件・null・undefined）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 土地以外の全入力で動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードで戸建・マンション等の件名生成動作を観察し、その動作を保持するプロパティベーステストを作成する。

**Test Cases**:
1. **戸建の件名保持**: `effectivePropertyType = '戸建'` で件名に「事前に内覧可能です！」が含まれることを確認
2. **マンションの件名保持**: `effectivePropertyType = 'マンション'` で件名に「事前に内覧可能です！」が含まれることを確認
3. **null/undefinedの件名保持**: `effectivePropertyType = null` で件名に「事前に内覧可能です！」が含まれることを確認
4. **収益物件の件名保持**: `effectivePropertyType = '収益物件'` で件名に「事前に内覧可能です！」が含まれることを確認

### Unit Tests

- 物件種別「土地」（`'土'`、`'land'`、`'土地'`）の各値で件名に「事前に内覧可能です！」が含まれないことをテスト
- 物件種別「戸建」「マンション」「収益物件」で件名に「事前に内覧可能です！」が含まれることをテスト
- `effectivePropertyType` が `null` または `undefined` の場合に件名が変わらないことをテスト

### Property-Based Tests

- ランダムな非土地物件種別を生成し、件名に「事前に内覧可能です！」が含まれることを検証
- ランダムな住所文字列を生成し、土地の場合の件名フォーマットが正しいことを検証
- `isLand()` が `true` を返す全ての入力値で件名が正しいことを検証

### Integration Tests

- 物件種別「土地」の売主で近隣買主メール送信フローを実行し、件名が正しいことを確認
- 物件種別「戸建」の売主で近隣買主メール送信フローを実行し、件名が変わらないことを確認
- 物件種別「土地」でメール送信後、送信履歴に正しい件名が記録されることを確認
