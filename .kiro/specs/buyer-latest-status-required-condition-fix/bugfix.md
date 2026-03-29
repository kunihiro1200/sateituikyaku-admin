# Bugfix Requirements Document

## Introduction

買主リストの「★最新状況」フィールドの必須チェック条件が誤っている。現在の実装では `latest_status` が空欄であれば**無条件で必須**として扱われているが、正しくは特定の条件を全て満たす場合のみ必須とすべきである。

誤った必須チェックにより、条件を満たさない買主（例：業者問合せあり、受付日が2026/2/8より前、電話問合せでヒアリングなし）でも「★最新状況」が未入力ハイライトされてしまっている。

影響箇所：
- `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `checkMissingFields` 関数
- `fetchBuyer` 内の `initialMissing` 構築処理

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `latest_status` が空欄である THEN システムは買主の問合せ種別・受付日・業者問合せの有無に関わらず「★最新状況」を必須フィールドとして赤くハイライトする

1.2 WHEN `broker_inquiry` に値が入っている（業者問合せあり）かつ `latest_status` が空欄 THEN システムは「★最新状況」を必須フィールドとして赤くハイライトする（業者問合せの場合は必須不要なのに誤って必須扱いされる）

1.3 WHEN `reception_date` が2026/2/8より前かつ `latest_status` が空欄 THEN システムは「★最新状況」を必須フィールドとして赤くハイライトする（古い受付日の買主は必須不要なのに誤って必須扱いされる）

1.4 WHEN `inquiry_source` に「電話」が含まれず `inquiry_hearing` も空欄で、かつ `inquiry_email_phone` が「済」でなく、`latest_status` が空欄 THEN システムは「★最新状況」を必須フィールドとして赤くハイライトする（電話問合せヒアリングなし・問合メール電話対応未済の場合は必須不要なのに誤って必須扱いされる）

### Expected Behavior (Correct)

2.1 WHEN 以下の全条件を満たす場合 THEN システムは「★最新状況」を必須フィールドとして扱い、空欄の場合に赤くハイライトする SHALL
- 条件A: `inquiry_hearing` が空欄でなく かつ `inquiry_source` に「電話」が含まれる、または `inquiry_email_phone` が「済」である
- 条件B: `reception_date` が2026/2/8以降である
- 条件C: `broker_inquiry` が空欄である

2.2 WHEN 上記2.1の条件を1つでも満たさない場合 THEN システムは「★最新状況」を必須フィールドとして扱わず SHALL、空欄でもハイライトしない

2.3 WHEN `broker_inquiry` に値が入っている（業者問合せあり）THEN システムは `latest_status` の空欄に関わらず「★最新状況」を必須フィールドとして扱わない SHALL

2.4 WHEN `reception_date` が2026/2/8より前 THEN システムは `latest_status` の空欄に関わらず「★最新状況」を必須フィールドとして扱わない SHALL

2.5 WHEN `inquiry_hearing` が空欄 かつ `inquiry_source` に「電話」が含まれない かつ `inquiry_email_phone` が「済」でない THEN システムは `latest_status` の空欄に関わらず「★最新状況」を必須フィールドとして扱わない SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 2.1の全条件を満たし `latest_status` が空欄でない THEN システムは「★最新状況」を必須ハイライトしない SHALL CONTINUE TO

3.2 WHEN `initial_assignee` が空欄 THEN システムは「初動担当」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.3 WHEN `broker_inquiry` が「業者問合せ」でなく `inquiry_source` が空欄 THEN システムは「問合せ元」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.4 WHEN `distribution_type` が空欄 THEN システムは「配信メール」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.5 WHEN `inquiry_source` に「メール」が含まれ `inquiry_email_phone` が空欄 THEN システムは「【問合メール】電話対応」を必須フィールドとして赤くハイライトする SHALL CONTINUE TO

3.6 WHEN ページ初回ロード時（`fetchBuyer`）に必須条件を満たす買主の `latest_status` が空欄 THEN システムは初回表示から「★最新状況」を赤くハイライトする SHALL CONTINUE TO

---

## Bug Condition（バグ条件の定式化）

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerData
  OUTPUT: boolean

  // 現在の誤った実装が「必須」と判定するが、正しくは「必須でない」ケース
  RETURN isBlank(X.latest_status)
    AND NOT (
      AND(
        OR(
          AND(isNotBlank(X.inquiry_hearing), contains(X.inquiry_source, "電話")),
          equals(X.inquiry_email_phone, "済")
        ),
        isAfterOrEqual(X.reception_date, "2026-02-08"),
        isBlank(X.broker_inquiry)
      )
    )
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← isLatestStatusRequired'(X)
  ASSERT result = false  // 必須フィールドとして扱われない
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT isLatestStatusRequired(X) = isLatestStatusRequired'(X)
END FOR
```
