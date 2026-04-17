# Bugfix Requirements Document

## Introduction

物件リスト詳細画面（`PropertyListingDetailPage`）で値下げ予約日（`price_reduction_scheduled_date`）を削除して保存した後、
サイドバーの「要値下げ」カテゴリーから該当物件が即座に消えないバグ。

「要値下げ」の判定は `calculatePropertyStatus()` によって動的に行われ、
`price_reduction_scheduled_date` が今日以前の場合に `price_reduction_due` を返す。
しかし、詳細画面で日付を削除・保存しても、`PropertyListingsPage` の `allListings` ステートが
即座に更新されないため、サイドバーのカウントとフィルタリングに反映されない。

`confirmation` フィールドには `propertyConfirmationUpdated` カスタムイベントによる即時更新の仕組みが
実装されているが、`price_reduction_scheduled_date` には同様の仕組みが存在しない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件詳細画面で `price_reduction_scheduled_date` を削除して保存する THEN システムはサイドバーの「要値下げ」カウントをそのまま維持し、該当物件が「要値下げ」カテゴリーに残り続ける

1.2 WHEN 「要値下げ」カテゴリーをクリックしてフィルタリングする THEN システムは日付削除済みの物件を「要値下げ」リストに表示し続ける

### Expected Behavior (Correct)

2.1 WHEN 物件詳細画面で `price_reduction_scheduled_date` を削除して保存する THEN システムは `PropertyListingsPage` の `allListings` ステートを即座に更新し、サイドバーの「要値下げ」カウントから該当物件を除外する

2.2 WHEN 「要値下げ」カテゴリーをクリックしてフィルタリングする THEN システムは `price_reduction_scheduled_date` が null または未来日付の物件を「要値下げ」リストに表示しない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件詳細画面で `price_reduction_scheduled_date` に今日以前の日付を設定して保存する THEN システムは SHALL CONTINUE TO その物件を「要値下げ」カテゴリーに表示する

3.2 WHEN `price_reduction_scheduled_date` が null の物件が存在する THEN システムは SHALL CONTINUE TO その物件を「要値下げ」カテゴリーに表示しない

3.3 WHEN `confirmation` フィールドを更新する THEN システムは SHALL CONTINUE TO `propertyConfirmationUpdated` イベントによる即時更新が正常に動作する

3.4 WHEN 物件詳細画面で価格情報以外のフィールドを保存する THEN システムは SHALL CONTINUE TO 他のサイドバーカテゴリーの表示に影響を与えない

---

## Bug Condition (バグ条件の定式化)

**Bug Condition Function**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListingUpdate
  OUTPUT: boolean

  RETURN X.price_reduction_scheduled_date が null に変更された
    AND PropertyListingsPage の allListings[X.property_number].price_reduction_scheduled_date が
        まだ今日以前の日付のまま（即時更新されていない）
END FUNCTION
```

**Property: Fix Checking**:
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← allListings' の X.property_number に対応するエントリ
  ASSERT result.price_reduction_scheduled_date = null
    AND calculatePropertyStatus(result).key ≠ 'price_reduction_due'
END FOR
```

**Property: Preservation Checking**:
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // 他のフィールドの更新・他のサイドバーカテゴリーの動作は変わらない
END FOR
```
