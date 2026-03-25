# Bugfix Requirements Document

## Introduction

買主詳細画面（`BuyerDetailPage`）の「メール・SMS送信履歴」セクションにおいて、SMS送信履歴の「送信者」欄に送信者の名前（例：「国広」）ではなく、電話番号（例：`09066394800`）が表示されているバグを修正する。

コードを調査した結果、以下の問題が確認された：

- `BuyerDetailPage.tsx` の `Activity` インターフェースに `employee` フィールドが定義されていない
- そのため `activity.employee` が `undefined` となり、`getDisplayName(activity.employee)` が `'担当者'` を返す
- しかし実際の表示では `displayName` が正しく解決されず、SMS送信者欄に `metadata.phoneNumber`（送信先電話番号）が表示されている

**バグ条件（Bug Condition）**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ActivityLog
  OUTPUT: boolean

  RETURN X.action = 'sms'
    AND X.employee IS NOT NULL in DB
    AND X.employee is undefined in frontend Activity interface
END FUNCTION
```

**修正プロパティ（Fix Checking）**:
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderSmsHistoryRow(X)
  ASSERT result.senderDisplay = employeeName (例: "国広")
    AND result.senderDisplay ≠ phoneNumber
END FOR
```

**保全プロパティ（Preservation Checking）**:
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderSmsHistoryRow(F(X)) = renderSmsHistoryRow(F'(X))
END FOR
```

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN SMS送信履歴が「メール・SMS送信履歴」セクションに表示される THEN システムは送信者欄に送信者の名前ではなく電話番号（例：`09066394800`）を表示する

1.2 WHEN `activity.action === 'sms'` かつ `activity.employee` が `undefined`（フロントエンドの `Activity` 型に `employee` フィールドが未定義）の場合 THEN システムは `getDisplayName(undefined)` を呼び出し、`displayName` が正しく解決されない

### Expected Behavior (Correct)

2.1 WHEN SMS送信履歴が「メール・SMS送信履歴」セクションに表示される THEN システムは送信者欄に送信者の名前（例：「国広」）を表示する SHALL

2.2 WHEN `activity.action === 'sms'` かつ `activity.employee` オブジェクトが存在する場合 THEN システムは `getDisplayName(activity.employee)` を正しく呼び出し、従業員名（例：「国広」）を返す SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN メール送信履歴が「メール・SMS送信履歴」セクションに表示される THEN システムは送信者欄に送信者の名前とメールアドレスを引き続き正しく表示する SHALL CONTINUE TO

3.2 WHEN 通話履歴が「通話履歴」セクションに表示される THEN システムは担当者名を引き続き正しく表示する SHALL CONTINUE TO

3.3 WHEN `activity.employee` が `null` または `undefined` の場合 THEN システムは送信者欄に `'担当者'` または `'不明'` を引き続き表示する SHALL CONTINUE TO
