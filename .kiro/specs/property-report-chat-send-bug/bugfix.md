# Bugfix Requirements Document

## Introduction

物件リスト詳細ページの `PUT /api/property-listings/:propertyNumber` エンドポイントは、
どのフィールドが更新されても無条件に Google Chat へ買付情報通知（`notifyGoogleChatOfferSaved`）を送信している。
そのため、報告書ページ（`PropertyReportPage`）で特記事項・報告日・担当者などを保存した場合でも、
買付チャットが誤って送信されてしまう。

買付チャットの送信は、買付情報フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）
のいずれかが更新リクエストに含まれる場合のみに限定されるべきである。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 報告書ページで報告日・担当者・特記事項などの買付情報以外のフィールドを保存する THEN システムは買付情報通知を Google Chat へ送信する

1.2 WHEN `PUT /api/property-listings/:propertyNumber` リクエストのボディに買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）が一切含まれない THEN システムは `notifyGoogleChatOfferSaved` を呼び出す

### Expected Behavior (Correct)

2.1 WHEN 報告書ページで報告日・担当者・特記事項などの買付情報以外のフィールドを保存する THEN システムは Google Chat への買付情報通知を送信しない

2.2 WHEN `PUT /api/property-listings/:propertyNumber` リクエストのボディに買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）のいずれかが含まれる THEN システムは `notifyGoogleChatOfferSaved` を呼び出し Google Chat へ通知を送信する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件詳細ページの買付情報セクションで買付日・状況・金額・コメントを編集して保存する THEN システムは CONTINUE TO Google Chat へ買付情報通知を送信する

3.2 WHEN 買付フィールドを含む更新リクエストが成功する THEN システムは CONTINUE TO `offer_status_updated_at` を現在時刻で記録する

3.3 WHEN 買付フィールドに空文字列が含まれる THEN システムは CONTINUE TO 空文字列を null に変換してから保存する

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListingUpdateRequest
  OUTPUT: boolean

  // 買付フィールドが一切含まれないリクエストでも通知が送信される
  RETURN NOT (X.updates contains any of ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'])
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← PUT_handler'(X)
  ASSERT notifyGoogleChatOfferSaved was NOT called
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT PUT_handler(X) = PUT_handler'(X)  // 買付フィールドあり → 通知は引き続き送信される
END FOR
```
