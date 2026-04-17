# Bugfix Requirements Document

## Introduction

買主リスト（スプレッドシート）において、AT列（物件番号）に値が入力されているにもかかわらず、
その物件番号に紐づく以下の列に値が同期されないバグ。

- **AU列**（物件所在地 / `property_address`）
- **AY列**（住居表示 / `display_address`）
- **BQ列**（価格 / `price`）
- **BR列**（物件担当者 / `property_assignee`）

以前のデプロイ後は正常に動作していたが、しばらくすると再発する再現性のある問題。
AT列の物件番号をもとに `property_listings` テーブルから物件情報を取得し、
スプレッドシートの対応列に書き込む同期処理が壊れている。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストのAT列（物件番号）に値が入力されている THEN システムはAU列（物件所在地）・AY列（住居表示）・BQ列（価格）・BR列（物件担当者）に値を同期しない

1.2 WHEN 買主詳細画面で物件番号を入力して保存する THEN システムはスプレッドシートのAU列・AY列・BQ列・BR列を空白のまま維持する

1.3 WHEN 物件番号が既にDBに保存済みの状態で他のフィールドを更新する THEN システムはAU列・AY列・BQ列・BR列の同期を実行しない

### Expected Behavior (Correct)

2.1 WHEN 買主リストのAT列（物件番号）に値が入力されている THEN システムは SHALL `property_listings` テーブルから対応する物件情報を取得し、AU列・AY列・BQ列・BR列に値を書き込む

2.2 WHEN 買主詳細画面で物件番号を入力して保存する THEN システムは SHALL スプレッドシートのAU列（物件所在地）・AY列（住居表示）・BQ列（価格）・BR列（物件担当者）に物件情報を同期する

2.3 WHEN 物件番号が既にDBに保存済みの状態で他のフィールドを更新する THEN システムは SHALL 既存の物件番号に基づいてAU列・AY列・BQ列・BR列の値を維持・同期する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主リストのAT列（物件番号）が空白の場合 THEN システムは SHALL CONTINUE TO AU列・AY列・BQ列・BR列を変更しない

3.2 WHEN 買主詳細画面で物件番号以外のフィールド（内覧日・最新状況など）を更新する THEN システムは SHALL CONTINUE TO 対応するスプレッドシート列を正常に同期する

3.3 WHEN 物件番号に対応する物件が `property_listings` テーブルに存在しない THEN システムは SHALL CONTINUE TO エラーを発生させずに処理を継続し、物件番号のみを保存する

3.4 WHEN 買主の新規登録時に物件番号を入力する THEN システムは SHALL CONTINUE TO AU列・AY列・BQ列・BR列に物件情報を同期する

---

## Bug Condition (バグ条件の定式化)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerUpdateInput
  OUTPUT: boolean

  // AT列（物件番号）に値があるにもかかわらず、
  // AU列・AY列・BQ列・BR列に値が同期されない状態
  RETURN X.property_number が非null かつ 非空文字
    AND スプレッドシートの AU列・AY列・BQ列・BR列 が空白
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - AT列物件番号に基づく関連列の同期
FOR ALL X WHERE isBugCondition(X) DO
  result ← syncBuyerPropertyInfo'(X)
  ASSERT スプレッドシートの AU列 = property_listings[X.property_number].address
    AND スプレッドシートの AY列 = property_listings[X.property_number].display_address
    AND スプレッドシートの BQ列 = property_listings[X.property_number].price
    AND スプレッドシートの BR列 = property_listings[X.property_number].sales_assignee
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
