# Bugfix Requirements Document

## Introduction

買主詳細画面の「GMAIL送信」テンプレートで、`<<●氏名・会社名>>` プレースホルダーを置換する際、
業者問合せ（`broker_inquiry === '業者問合せ'`）の場合でも法人名（`company_name`）が宛名に付加されてしまうバグ。
業者問合せの場合は `buyer.name` のみを使用し、法人名を省略する必要がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `broker_inquiry` が `'業者問合せ'` であり、かつ `company_name` が存在する場合 THEN the system は `<<●氏名・会社名>>` を `{buyer.name}・{buyer.company_name}` の形式に置換する

1.2 WHEN `BuyerGmailSendButton` が `mergeMultiple` エンドポイントにリクエストを送信する場合 THEN the system は `buyer` オブジェクトに `broker_inquiry` フィールドを含めない（`brokerInquiry` プロパティを受け取っているにもかかわらず）

### Expected Behavior (Correct)

2.1 WHEN `broker_inquiry` が `'業者問合せ'` であり、かつ `company_name` が存在する場合 THEN the system SHALL `<<●氏名・会社名>>` を `buyer.name` のみに置換し、法人名を付加しない

2.2 WHEN `BuyerGmailSendButton` が `mergeMultiple` エンドポイントにリクエストを送信する場合 THEN the system SHALL `buyer` オブジェクトに `broker_inquiry` フィールドを含める

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `broker_inquiry` が `'業者問合せ'` 以外（空文字・`null`・その他の値）であり、かつ `company_name` が存在する場合 THEN the system SHALL CONTINUE TO `<<●氏名・会社名>>` を `{buyer.name}・{buyer.company_name}` の形式に置換する

3.2 WHEN `broker_inquiry` が `'業者問合せ'` 以外であり、かつ `company_name` が存在しない場合 THEN the system SHALL CONTINUE TO `<<●氏名・会社名>>` を `buyer.name`（または `buyer.buyerName`）のみに置換する

3.3 WHEN `<<氏名>>` プレースホルダーが使用される場合 THEN the system SHALL CONTINUE TO `broker_inquiry` の値に関わらず `buyer.name` のみに置換する

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerEmailMergeInput
  OUTPUT: boolean

  RETURN X.broker_inquiry = '業者問合せ' AND X.company_name ≠ ''
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← mergeAngleBracketPlaceholders'(X)
  ASSERT result.buyerName = X.name  // 法人名なし
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT mergeAngleBracketPlaceholders(X) = mergeAngleBracketPlaceholders'(X)
END FOR
```
