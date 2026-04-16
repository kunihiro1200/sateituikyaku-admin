# Bugfix Requirements Document

## Introduction

物件一覧画面（PropertyListingsPage）の「買主」列に表示される買主件数が、物件詳細画面の「買主リスト」に表示される実際の件数と一致しないバグ。

例：物件番号 AA9729 の場合、一覧では「👥 2」と表示されるが、詳細画面では「買主リスト (8件)」として8名が表示されている。

**根本原因の特定：**

`BuyerLinkageService` に2つのメソッドが存在し、それぞれ異なるクエリロジックを使用している。

- **一覧用**（`getBuyerCountsForProperties`）：`buyers` テーブルの全レコードを取得し、`property_number` フィールドをカンマ区切りで分割してフロントエンド側で集計する。ただし、**`property_number` が完全一致する行のみ**をカウントしており、`property_number` フィールドに複数の物件番号がカンマ区切りで格納されているケースを正しく処理できていない可能性がある。また、キャッシュ（`BuyerLinkageCache`）が古い値を返している可能性もある。
- **詳細用**（`getBuyersForProperty`）：`.eq('property_number', propertyNumber)` で完全一致検索を行い、正しい件数を返している。

この2つのメソッド間のロジック不整合により、一覧と詳細で件数が異なる。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件一覧画面を表示したとき THEN システムは `getBuyerCountsForProperties` を呼び出し、全買主レコードを取得してフロントエンドで集計するが、`property_number` の完全一致のみを判定するため、実際の買主数より少ない件数を返す

1.2 WHEN `BuyerLinkageCache` にキャッシュされた買主件数が存在するとき THEN システムはキャッシュの古い値をそのまま返し、実際の買主数と異なる件数を表示する

1.3 WHEN 物件一覧の「買主」列を表示するとき THEN システムは実際の買主数（8件）ではなく誤った件数（2件）を表示する

### Expected Behavior (Correct)

2.1 WHEN 物件一覧画面を表示したとき THEN システムは `getBuyerCountsForProperties` において、`getBuyersForProperty` と同じクエリロジック（`.eq('property_number', propertyNumber)` による完全一致）を使用し、正確な買主件数を返す SHALL

2.2 WHEN `BuyerLinkageCache` にキャッシュされた買主件数が存在するとき THEN システムはキャッシュの有効期限を適切に管理し、古い値が返されないようにする SHALL

2.3 WHEN 物件一覧の「買主」列を表示するとき THEN システムは物件詳細画面の「買主リスト」と同じ件数を表示する SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件詳細画面で買主リストを取得するとき THEN システムは SHALL CONTINUE TO `getBuyersForProperty` を使用して正確な買主リストを返す

3.2 WHEN 買主件数が0件の物件を一覧表示するとき THEN システムは SHALL CONTINUE TO 0件として正しく表示する

3.3 WHEN 削除済み（`deleted_at` が NULL でない）買主が存在するとき THEN システムは SHALL CONTINUE TO 削除済み買主を件数に含めない

3.4 WHEN 物件一覧のページネーションで別ページに移動するとき THEN システムは SHALL CONTINUE TO 表示中の物件の買主件数を正しく取得・表示する

---

## Bug Condition (Pseudocode)

**Bug Condition Function:**

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyBuyerCountRequest
  OUTPUT: boolean

  // 一覧用カウントと詳細用カウントが異なる場合にバグ条件が成立
  RETURN getBuyerCountsForProperties([X.propertyNumber])[X.propertyNumber]
         ≠ getBuyersForProperty(X.propertyNumber).length
END FUNCTION
```

**Property: Fix Checking:**

```pascal
FOR ALL X WHERE isBugCondition(X) DO
  countFromList ← getBuyerCountsForProperties'([X.propertyNumber])[X.propertyNumber]
  countFromDetail ← getBuyersForProperty(X.propertyNumber).length
  ASSERT countFromList = countFromDetail
END FOR
```

**Property: Preservation Checking:**

```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getBuyerCountsForProperties(X) = getBuyerCountsForProperties'(X)
END FOR
```
