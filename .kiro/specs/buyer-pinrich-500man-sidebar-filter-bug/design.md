# Buyer Pinrich500万以上登録未 サイドバーフィルターバグ 設計ドキュメント

## Overview

買主リストのサイドバーにある「Pinrich500万以上登録未」カテゴリーをクリックしても空リストが返るバグを修正する。
また、このカテゴリーのカウント・フィルタリング対象を「受付日（reception_date）が2026年1月1日以降の買主」に限定する要件も合わせて対応する。

修正対象ファイルは `backend/src/services/BuyerService.ts` の3箇所のみ。フロントエンドの変更は不要。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `getBuyersByStatus('pinrich500manUnregistered')` が呼ばれたとき
- **Property (P)**: バグ条件が成立するときの正しい振る舞い — 4条件（email非空・price≤500万・pinrich_500man_registration未・reception_date≥2026-01-01）を満たす買主配列を返す
- **Preservation**: 修正によって変えてはいけない既存の振る舞い — 他カテゴリのフィルタリング・カウント計算
- **getBuyersByStatus**: `BuyerService.ts` 内の関数。ステータス文字列を受け取り、該当する買主配列を返す
- **getSidebarCountsFallback**: `BuyerService.ts` 内の関数。GASが利用できない場合にサイドバーカウントをDBから直接計算する
- **updateBuyerSidebarCounts**: `SidebarCountsUpdateService.ts` 経由で呼ばれるが、`pinrich500manUnregistered` のカウントは `BuyerService.ts` の `getSidebarCountsFallback` で管理される
- **pinrich_500man_registration**: 買主テーブルのカラム。値が `'未'` または null/空の場合、Pinrich500万未登録とみなす
- **reception_date**: 買主テーブルの受付日カラム。`YYYY-MM-DD` 形式の文字列で比較する

## Bug Details

### Bug Condition

バグは `getBuyersByStatus` に `'pinrich500manUnregistered'` が渡されたときに発動する。
`pinrich500manUnregistered` が「未実装の新カテゴリ」として空配列を返す条件分岐に含まれていないため、
その分岐をすり抜けて `filteredBuyers = []` が返る。

また、`getSidebarCountsFallback` のカウント計算では `reception_date >= '2026-01-01'` の条件が欠落しており、
2026年1月1日以前の買主もカウントに含まれてしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerStatusRequest
  OUTPUT: boolean

  RETURN X.status = 'pinrich500manUnregistered'
END FUNCTION
```

### Examples

- **バグ例1**: `getBuyersByStatus('pinrich500manUnregistered')` を呼ぶ → 条件を満たす買主が存在しても空配列が返る
- **バグ例2**: `getSidebarCountsFallback` でカウントを計算する → reception_date が 2025-12-31 の買主もカウントに含まれる
- **正常例（他カテゴリ）**: `getBuyersByStatus('todayCall')` を呼ぶ → 既存ロジックで正常にフィルタリングされる
- **エッジケース**: reception_date が null の買主 → フィルタリング対象外（カウントされない・リストに含まれない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `inquiryEmailUnanswered`、`brokerInquiry`、`generalViewingSellerContactPending`、`viewingPromotionRequired`、`pinrichUnregistered` カテゴリーは引き続き空配列を返す（未実装カテゴリのまま）
- `pinrich500manUnregistered` 以外の全カテゴリー（`viewingDayBefore`、`todayCall`、`threeCallUnchecked`、担当別カテゴリ等）のフィルタリングロジックは変更しない
- `getSidebarCountsFallback` で `pinrich500manUnregistered` 以外のカテゴリーのカウント計算ロジックは変更しない

**Scope:**
`status !== 'pinrich500manUnregistered'` となる全ての入力は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

調査済みの根本原因は以下の2点：

1. **getBuyersByStatus の条件分岐漏れ**: 約2504-2512行目の `else if` ブロックに `pinrich500manUnregistered` が含まれていない。
   - 既存の未実装カテゴリ群（`inquiryEmailUnanswered` 等）と同じ分岐に誤って含めるべきだったが、追加時に漏れた
   - 結果として `filteredBuyers = []` の初期値のまま返る

2. **getSidebarCountsFallback のカウント条件漏れ**: 約2183-2195行目のカウント計算に `reception_date >= '2026-01-01'` の条件がない。
   - `pinrich500manUnregistered` カテゴリーの仕様として「2026年1月1日以降の受付日の買主のみ対象」が定められているが、実装時に条件が追加されなかった

## Correctness Properties

Property 1: Bug Condition - pinrich500manUnregistered フィルタリング

_For any_ リクエスト X において `isBugCondition(X)` が true（つまり `X.status = 'pinrich500manUnregistered'`）のとき、
修正後の `getBuyersByStatus` は以下の4条件を全て満たす買主配列を返す SHALL:
- `buyer.email` が非空
- `Number(buyer.inquiry_property_price) <= 5000000`
- `buyer.pinrich_500man_registration` が `'未'` または null/空
- `buyer.reception_date >= '2026-01-01'`

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他カテゴリへの非影響

_For any_ リクエスト X において `isBugCondition(X)` が false（つまり `X.status !== 'pinrich500manUnregistered'`）のとき、
修正後の `getBuyersByStatus` は修正前と同一の結果を返す SHALL。

**Validates: Requirements 3.1, 3.2**

Property 3: Preservation - カウント計算への非影響

_For any_ カウント計算において `pinrich500manUnregistered` 以外のカテゴリーのカウント値は、
修正前後で同一である SHALL。

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

#### 修正1: getBuyersByStatus に pinrich500manUnregistered の専用分岐を追加（約2504行目付近）

**変更前**:
```typescript
} else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
           status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired' || 
           status === 'pinrichUnregistered') {
  // 新カテゴリの場合（2026年4月追加）
  filteredBuyers = [];
```

**変更後**:
```typescript
} else if (status === 'pinrich500manUnregistered') {
  // Pinrich500万以上登録未: 4条件でフィルタリング
  filteredBuyers = allBuyers.filter((buyer: any) => {
    return (
      buyer.email && String(buyer.email).trim() &&
      buyer.inquiry_property_price !== null &&
      buyer.inquiry_property_price !== undefined &&
      Number(buyer.inquiry_property_price) <= 5000000 &&
      (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
      buyer.reception_date && buyer.reception_date >= '2026-01-01'
    );
  });
} else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
           status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired' || 
           status === 'pinrichUnregistered') {
  // 新カテゴリの場合（2026年4月追加）
  filteredBuyers = [];
```

#### 修正2: getSidebarCountsFallback のカウント計算に reception_date 条件を追加（約2183行目付近）

**変更前**:
```typescript
// Pinrich500万以上登録未: email非空 AND price<=500万 AND (pinrich_500man_registration が '未' または null/空)
allBuyers.forEach((buyer: any) => {
  if (
    buyer.email && String(buyer.email).trim() &&
    buyer.inquiry_property_price !== null &&
    buyer.inquiry_property_price !== undefined &&
    Number(buyer.inquiry_property_price) <= 5000000 &&
    (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未')
  ) {
    result.pinrich500manUnregistered++;
  }
});
```

**変更後**:
```typescript
// Pinrich500万以上登録未: email非空 AND price<=500万 AND pinrich_500man_registration未 AND reception_date >= 2026-01-01
allBuyers.forEach((buyer: any) => {
  if (
    buyer.email && String(buyer.email).trim() &&
    buyer.inquiry_property_price !== null &&
    buyer.inquiry_property_price !== undefined &&
    Number(buyer.inquiry_property_price) <= 5000000 &&
    (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
    buyer.reception_date && buyer.reception_date >= '2026-01-01'
  ) {
    result.pinrich500manUnregistered++;
  }
});
```

#### 修正3: updateBuyerSidebarCounts（BuyerService.ts 内の関連カウント計算箇所）

`getSidebarCountsFallback` と同様に、`pinrich500manUnregistered` のカウント計算が存在する箇所に `reception_date >= '2026-01-01'` 条件を追加する。

**注意**: `reception_date` は `YYYY-MM-DD` 形式の文字列として格納されているため、文字列比較（`>= '2026-01-01'`）で正しく動作する。`Date` オブジェクトへの変換は不要（タイムゾーン問題を避けるため）。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：
1. **探索フェーズ**: 修正前のコードでバグを再現し、根本原因を確認する
2. **検証フェーズ**: 修正後のコードでバグが解消され、既存動作が保たれることを確認する

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `getBuyersByStatus('pinrich500manUnregistered')` を呼び出し、条件を満たす買主が存在するにもかかわらず空配列が返ることを確認する。

**Test Cases**:
1. **フィルタリング未実装テスト**: 4条件を満たす買主データを用意し、`getBuyersByStatus('pinrich500manUnregistered')` を呼ぶ → 空配列が返ることを確認（修正前コードで失敗）
2. **カウント過剰テスト**: reception_date が 2025-12-31 の買主を用意し、`getSidebarCountsFallback` を呼ぶ → カウントに含まれることを確認（修正前コードで失敗）
3. **reception_date null テスト**: reception_date が null の買主 → カウントに含まれないことを確認

**Expected Counterexamples**:
- `getBuyersByStatus('pinrich500manUnregistered')` が空配列を返す（条件を満たす買主が存在しても）
- 原因: `pinrich500manUnregistered` が未実装カテゴリの `else if` 分岐に含まれていない

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が正しい振る舞いをすることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := getBuyersByStatus_fixed(X)
  ASSERT ALL buyers IN result SATISFY (
    buyer.email != null AND buyer.email != '' AND
    Number(buyer.inquiry_property_price) <= 5000000 AND
    (buyer.pinrich_500man_registration = '未' OR buyer.pinrich_500man_registration IS NULL OR buyer.pinrich_500man_registration = '') AND
    buyer.reception_date >= '2026-01-01'
  )
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同一の結果を返すことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getBuyersByStatus_original(X) = getBuyersByStatus_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様なステータス値・買主データの組み合わせを自動生成できる
- 手動テストでは見落としやすいエッジケースを検出できる
- 「他カテゴリへの非影響」を強く保証できる

**Test Cases**:
1. **他カテゴリ保全テスト**: `todayCall`、`viewingDayBefore`、担当別カテゴリ等で修正前後の結果が一致することを確認
2. **未実装カテゴリ保全テスト**: `inquiryEmailUnanswered` 等が引き続き空配列を返すことを確認
3. **カウント保全テスト**: `pinrich500manUnregistered` 以外のカテゴリーのカウント値が修正前後で一致することを確認

### Unit Tests

- `getBuyersByStatus('pinrich500manUnregistered')` が4条件を満たす買主のみを返すことをテスト
- reception_date が null / '2025-12-31' / '2026-01-01' / '2026-06-01' の各ケースをテスト
- `getSidebarCountsFallback` のカウントが reception_date 条件を正しく適用することをテスト
- 他カテゴリ（`todayCall` 等）のフィルタリングが変更されていないことをテスト

### Property-Based Tests

- ランダムな買主データを生成し、`getBuyersByStatus('pinrich500manUnregistered')` の結果が全て4条件を満たすことを検証（Property 1）
- `status !== 'pinrich500manUnregistered'` のランダムなステータスで、修正前後の結果が一致することを検証（Property 2）
- ランダムな買主データで `getSidebarCountsFallback` のカウントが reception_date 条件を正しく適用することを検証（Property 3）

### Integration Tests

- 実際のDBデータを使い、サイドバーの「Pinrich500万以上登録未」をクリックして買主リストが表示されることを確認
- reception_date が 2025-12-31 の買主がリストに含まれないことを確認
- reception_date が 2026-01-01 の買主がリストに含まれることを確認
- 他のサイドバーカテゴリーが正常に動作することを確認
