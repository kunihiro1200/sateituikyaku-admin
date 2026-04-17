# Bugfix Requirements Document

## Introduction

買主リストのサイドバーにある「Pinrich500万以上登録未」カテゴリーをクリックしても、データが表示されない（空リストになる）バグを修正する。
また、このカテゴリーのカウント・フィルタリング対象を「受付日（reception_date）が2026年1月1日以降の買主」に限定する要件も合わせて対応する。

根本原因は2点：
1. `getBuyersByStatus` 関数内で `pinrich500manUnregistered` が「フィルタリング未実装の新カテゴリ」として空配列を返す分岐に含まれていない（→ フォールスルーして空配列が返る）
2. カウント計算（`getSidebarCountsFallback` および `updateBuyerSidebarCounts`）に受付日フィルターが存在しない

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの「Pinrich500万以上登録未」カテゴリーをクリックしたとき THEN システムは空のリストを返す（データが存在しても0件表示になる）

1.2 WHEN `getBuyersByStatus('pinrich500manUnregistered')` が呼ばれたとき THEN システムは `filteredBuyers = []` を返す（`pinrich500manUnregistered` が未実装カテゴリの条件分岐に含まれていないため、空配列が返る）

1.3 WHEN サイドバーのカウントが計算されるとき THEN システムは受付日に関係なく全買主を対象にカウントする（2026年1月1日以前の買主も含まれる）

### Expected Behavior (Correct)

2.1 WHEN サイドバーの「Pinrich500万以上登録未」カテゴリーをクリックしたとき THEN システムは以下の条件を全て満たす買主リストを返す SHALL
- email が空でない
- inquiry_property_price が 5,000,000 以下
- pinrich_500man_registration が '未' または null/空
- reception_date が 2026-01-01 以降

2.2 WHEN `getBuyersByStatus('pinrich500manUnregistered')` が呼ばれたとき THEN システムは上記4条件でフィルタリングした買主配列を返す SHALL

2.3 WHEN `getSidebarCountsFallback` でカウントを計算するとき THEN システムは reception_date が 2026-01-01 以降の買主のみを対象に `pinrich500manUnregistered` をカウントする SHALL

2.4 WHEN `updateBuyerSidebarCounts` でカウントを更新するとき THEN システムは reception_date が 2026-01-01 以降の買主のみを対象に `pinrich500manUnregistered` をカウントする SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `inquiryEmailUnanswered`、`brokerInquiry`、`generalViewingSellerContactPending`、`viewingPromotionRequired`、`pinrichUnregistered` カテゴリーがクリックされたとき THEN システムは引き続き空配列を返す（これらは未実装カテゴリのまま） SHALL CONTINUE TO

3.2 WHEN `pinrich500manUnregistered` 以外のカテゴリー（`viewingDayBefore`、`todayCall`、`threeCallUnchecked`、担当別カテゴリ等）でフィルタリングするとき THEN システムは既存のフィルタリングロジックを変更せずに動作する SHALL CONTINUE TO

3.3 WHEN `getSidebarCountsFallback` で `pinrich500manUnregistered` 以外のカテゴリーのカウントを計算するとき THEN システムは既存のカウントロジックを変更せずに動作する SHALL CONTINUE TO

3.4 WHEN `updateBuyerSidebarCounts` で `pinrich500manUnregistered` 以外のカテゴリーのカウントを更新するとき THEN システムは既存のカウントロジックを変更せずに動作する SHALL CONTINUE TO

---

## Bug Condition (バグ条件の定式化)

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerStatusRequest
  OUTPUT: boolean

  RETURN X.status = 'pinrich500manUnregistered'
END FUNCTION
```

### Fix Checking プロパティ

```pascal
// Property: Fix Checking - pinrich500manUnregistered フィルタリング
FOR ALL X WHERE isBugCondition(X) DO
  result ← getBuyersByStatus'(X)
  ASSERT result.length >= 0
  ASSERT ALL buyers IN result SATISFY (
    buyer.email != null AND buyer.email != '' AND
    buyer.inquiry_property_price <= 5000000 AND
    (buyer.pinrich_500man_registration = '未' OR buyer.pinrich_500man_registration IS NULL OR buyer.pinrich_500man_registration = '') AND
    buyer.reception_date >= '2026-01-01'
  )
END FOR
```

### Preservation Checking プロパティ

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
