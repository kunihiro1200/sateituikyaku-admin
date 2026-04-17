# Bugfix Requirements Document

## Introduction

買主番号7614がDBから誤って削除（論理削除）された後、スプレッドシート→DB同期を実行したにもかかわらず、買主リストで7614をクリックすると「データなし」と表示される。

根本原因は `syncSingleBuyer()` メソッドにある。このメソッドは既存レコードの確認時に `deleted_at` フィルタを適用しないため、論理削除済みのレコードを「既存の買主」として検出し、更新処理を行う。しかし更新データに `deleted_at: null` が含まれていないため、論理削除フラグが残ったままになる。その結果、`getByBuyerNumber()` が `deleted_at IS NULL` フィルタで検索しても該当レコードが見つからず、「データなし」となる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主がDBから論理削除（`deleted_at` がセット）された後にスプシ→DB同期を実行する THEN `syncSingleBuyer()` は `deleted_at` フィルタなしで既存レコードを検索し、論理削除済みレコードを「既存の買主」として検出する

1.2 WHEN `syncSingleBuyer()` が論理削除済みレコードを「既存の買主」として検出する THEN 更新データに `deleted_at: null` が含まれないため、`deleted_at` フラグがリセットされずに残る

1.3 WHEN `deleted_at` フラグが残ったまま同期が完了する THEN `getByBuyerNumber()` が `deleted_at IS NULL` フィルタで検索しても該当レコードが見つからず、「データなし」と表示される

### Expected Behavior (Correct)

2.1 WHEN 買主がDBから論理削除された後にスプシ→DB同期を実行する THEN `syncSingleBuyer()` は論理削除済みレコードを検出した場合、`deleted_at: null` を含む更新データでレコードを復元する

2.2 WHEN `syncSingleBuyer()` が論理削除済みレコードを復元する THEN `deleted_at` が `null` にリセットされ、買主が「アクティブ」状態に戻る

2.3 WHEN 同期完了後に買主番号7614をクリックする THEN `getByBuyerNumber()` がレコードを正常に取得し、買主詳細データが表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `deleted_at` が `null` のアクティブな買主に対して同期を実行する THEN システムは引き続き通常の更新処理（`deleted_at` を変更しない）を行う

3.2 WHEN スプレッドシートに存在しない買主番号に対して同期を実行する THEN システムは引き続き「Row not found in spreadsheet」エラーを記録し、その買主をスキップする

3.3 WHEN DBにも論理削除レコードにも存在しない新規買主を同期する THEN システムは引き続き新規挿入処理を行う

3.4 WHEN `detectMissingBuyers()` が不足している買主を検出する THEN システムは引き続き `deleted_at IS NULL` のアクティブな買主のみをDBから取得し、スプレッドシートと比較する

---

## Bug Condition (Pseudocode)

**Bug Condition Function**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerSyncInput
  OUTPUT: boolean
  
  // 論理削除済みレコードがDBに存在し、かつスプシにも存在する場合にバグが発生
  RETURN EXISTS(buyer IN DB WHERE buyer.buyer_number = X.buyer_number AND buyer.deleted_at IS NOT NULL)
         AND EXISTS(row IN Spreadsheet WHERE row['買主番号'] = X.buyer_number)
END FUNCTION
```

**Property: Fix Checking**:
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  syncSingleBuyer'(X.buyer_number, X.row)
  result ← getByBuyerNumber(X.buyer_number)
  ASSERT result IS NOT NULL
  ASSERT result.deleted_at IS NULL
END FOR
```

**Property: Preservation Checking**:
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT syncSingleBuyer'(X) = syncSingleBuyer(X)
END FOR
```
