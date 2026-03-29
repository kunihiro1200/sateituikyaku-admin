# Bugfix Requirements Document

## Introduction

買主リストの詳細画面において、【問い合わせメール】電話対応フィールド（`inquiry_email_phone`）の値に関わらず、「3回架電済み」（`three_calls_done` 等）が常に必須項目として扱われているバグを修正する。

正しい動作は、`inquiry_email_phone` が「不通」の場合のみ「3回架電済み」を必須とし、それ以外（未入力・「不通」以外の値）の場合は必須としないことである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `inquiry_email_phone` が「不通」以外の値（例：「済」「対応中」など）である THEN システムは「3回架電済み」を必須フィールドとして扱い、未入力の場合に赤くハイライトする

1.2 WHEN `inquiry_email_phone` が空欄（未入力）である THEN システムは「3回架電済み」を必須フィールドとして扱い、未入力の場合に赤くハイライトする

1.3 WHEN `inquiry_email_phone` が「不通」である THEN システムは「3回架電済み」を必須フィールドとして扱う（これは正しい動作）

### Expected Behavior (Correct)

2.1 WHEN `inquiry_email_phone` が「不通」である THEN システムは「3回架電済み」を必須フィールドとして扱い、未入力の場合に赤くハイライトする SHALL

2.2 WHEN `inquiry_email_phone` が「不通」以外の値（例：「済」「対応中」など）である THEN システムは「3回架電済み」を必須フィールドとして扱わず、未入力でもハイライトしない SHALL

2.3 WHEN `inquiry_email_phone` が空欄（未入力）である THEN システムは「3回架電済み」を必須フィールドとして扱わず、未入力でもハイライトしない SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `inquiry_email_phone` が「不通」であり「3回架電済み」が入力済みである THEN システムは「3回架電済み」を必須ハイライトしない SHALL CONTINUE TO

3.2 WHEN `inquiry_source` に「メール」が含まれ `inquiry_email_phone` が空欄である THEN システムは「【問合メール】電話対応」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.3 WHEN `initial_assignee` が空欄である THEN システムは「初動担当」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.4 WHEN `distribution_type` が空欄である THEN システムは「配信メール」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.5 WHEN `inquiry_email_phone` が「不通」以外の場合に「3回架電済み」に値が入力されている THEN システムはその値を保持し、保存・表示を正常に行い続ける SHALL CONTINUE TO

---

## Bug Condition（バグ条件の定式化）

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerData
  OUTPUT: boolean

  // 現在の誤った実装が「必須」と判定するが、正しくは「必須でない」ケース
  RETURN NOT equals(X.inquiry_email_phone, "不通")
    AND isBlank(X.three_calls_done)
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← isThreeCallsDoneRequired'(X)
  ASSERT result = false  // 必須フィールドとして扱われない
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT isThreeCallsDoneRequired(X) = isThreeCallsDoneRequired'(X)
END FOR
```
