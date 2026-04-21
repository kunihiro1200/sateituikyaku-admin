# Bugfix Requirements Document

## Introduction

業務リスト（WorkTasksPage）の詳細モーダル（WorkTaskDetailModal）において、`EditableButtonSelect` コンポーネントで表示されるボタン選択フィールドに問題がある。現在選択中のオプション（例：「他」）を再度クリックしても値が空欄にならない。

ユーザーの要望として、業務リストの全フィールドで「2度押したら空欄になる」トグル動作を実現する必要がある。

対象コンポーネント: `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の `EditableButtonSelect`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `EditableButtonSelect` のボタン（例：「他」）が既に選択されている状態で同じボタンをクリックする THEN the system は値を変更せず、同じ値（例：「他」）のままにする

1.2 WHEN `site_registration_confirmed` フィールドに「他」が設定されている状態で「他」ボタンをクリックする THEN the system はフィールドを空欄にせず「他」のままにする

1.3 WHEN `EditableButtonSelect` を使用する任意のフィールドで、現在選択中のオプションを再クリックする THEN the system は値をクリアせず、選択状態を維持し続ける

### Expected Behavior (Correct)

2.1 WHEN `EditableButtonSelect` のボタンが既に選択されている状態で同じボタンをクリックする THEN the system SHALL フィールドの値を `null`（空欄）に設定する

2.2 WHEN `site_registration_confirmed` フィールドに「他」が設定されている状態で「他」ボタンをクリックする THEN the system SHALL フィールドを空欄（`null`）にする

2.3 WHEN `EditableButtonSelect` を使用する任意のフィールドで、現在選択中のオプションを再クリックする THEN the system SHALL 値を `null` にクリアし、ボタンの選択状態（`contained` スタイル）を解除する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `EditableButtonSelect` で現在選択されていないボタンをクリックする THEN the system SHALL CONTINUE TO そのボタンの値をフィールドに設定する

3.2 WHEN `EditableYesNo` コンポーネントで Y または N ボタンを操作する THEN the system SHALL CONTINUE TO 既存のトグル動作（同じ値を再クリックで `null` にする）を維持する

3.3 WHEN `EditableButtonSelect` で別のオプションに切り替える（例：「確認中」→「完了」） THEN the system SHALL CONTINUE TO 新しい値を正しく設定する

3.4 WHEN フィールドの値が空欄（`null` または空文字）の状態でいずれかのボタンをクリックする THEN the system SHALL CONTINUE TO クリックしたボタンの値を設定する

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = { field: string, currentValue: string | null, clickedOption: string }
  OUTPUT: boolean

  // 現在の値と同じオプションをクリックした場合がバグ条件
  RETURN X.currentValue = X.clickedOption
END FUNCTION
```

```pascal
// Property: Fix Checking - 同じオプション再クリックで空欄になる
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleFieldChange'(X.field, X.clickedOption)
  ASSERT getValue(X.field) = null
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleFieldChange(X.field, X.clickedOption) = handleFieldChange'(X.field, X.clickedOption)
END FOR
```
