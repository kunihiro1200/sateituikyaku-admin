# Bugfix Requirements Document

## Introduction

買主詳細画面のヘッダーにあるGmail送信ボタンが、メールアドレスが存在しているにもかかわらずグレーアウト（無効化）されるバグ。
買主番号7359で確認されており、ボタンをクリックできないためGmailによるメール送信が行えない状態となっている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主のメールアドレスが存在し、かつ問い合わせ履歴テーブルに紐づく物件が `property_listings` テーブルに存在しない（または `status === 'current'` の物件が0件）の場合 THEN `selectedPropertyIds` が空のまま初期化され、Gmail送信ボタンが無効化（グレーアウト）される

1.2 WHEN 買主詳細画面を開いた際に `fetchInquiryHistoryTable` が空配列を返す場合 THEN `selectedPropertyIds` が空の `Set` のままとなり、Gmail送信ボタンの `isDisabled` が `true` になる

### Expected Behavior (Correct)

2.1 WHEN 買主のメールアドレスが存在する場合 THEN Gmail送信ボタンは有効化（クリック可能）されるべきであり、物件の選択状態に関わらずボタン自体は押せる状態であるべきである

2.2 WHEN 問い合わせ履歴に紐づく物件が存在しない、または `status === 'current'` の物件が0件の場合 THEN Gmail送信ボタンは有効化されており、クリック時に「物件を選択してください」のエラーメッセージを表示する（現在の動作）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 問い合わせ履歴に `status === 'current'` の物件が1件以上存在する場合 THEN Gmail送信ボタンは引き続き有効化された状態で表示される

3.2 WHEN 物件が1件も選択されていない状態でGmail送信ボタンをクリックした場合 THEN システムは引き続き「物件を選択してください」のエラーメッセージを表示する

3.3 WHEN 買主のメールアドレスが存在しない（空文字）場合 THEN Gmail送信ボタンの表示・非表示の既存ロジックは変更しない

3.4 WHEN 問い合わせ履歴が0件の場合 THEN `BuyerGmailSendButton` は引き続き `null`（非表示）を返す

---

## Bug Condition (バグ条件の定式化)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(buyer, inquiryHistory)
  INPUT: buyer（買主データ）, inquiryHistory（問い合わせ履歴配列）
  OUTPUT: boolean

  // メールアドレスが存在し、かつ問い合わせ履歴はあるが
  // status === 'current' の物件が0件の場合にバグが発生する
  hasEmail ← buyer.email != null AND buyer.email != ''
  hasHistory ← inquiryHistory.length > 0
  hasCurrentStatus ← inquiryHistory.filter(item => item.status === 'current').length > 0

  RETURN hasEmail AND hasHistory AND NOT hasCurrentStatus
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - Gmail送信ボタンの有効化
FOR ALL (buyer, inquiryHistory) WHERE isBugCondition(buyer, inquiryHistory) DO
  result ← renderBuyerGmailSendButton'(buyer, inquiryHistory)
  ASSERT result.button.disabled = false
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL (buyer, inquiryHistory) WHERE NOT isBugCondition(buyer, inquiryHistory) DO
  ASSERT renderBuyerGmailSendButton(buyer, inquiryHistory)
       = renderBuyerGmailSendButton'(buyer, inquiryHistory)
END FOR
```
