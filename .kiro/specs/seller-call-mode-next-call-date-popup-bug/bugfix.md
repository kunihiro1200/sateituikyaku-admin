# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（CallModePage: `/sellers/:id/call`）において、反響日付が3日以上経過した売主に対して何らかの編集を行った際、「次電日を変更しなくてよいか？」という確認ダイアログ（NextCallDateReminderDialog）が表示される仕様がある。

このダイアログは「次電日が変更されていない場合」にのみ表示されるべきだが、**次電日を変更した場合でもダイアログが表示されてしまう**バグが発生している。

バグの根本原因は `shouldShowReminderDialog` 関数に渡される `nextCallDateUnchanged` の判定ロジックにある。具体的には、次電日の「変更前の値」を保持する `savedNextCallDate` が、バックグラウンドポーリング（`freshData` 更新）によって `editedNextCallDate` が上書きされた際に同期されないため、`editedNextCallDate === savedNextCallDate` が誤って `true` になるケースが存在する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 反響日付が3日以上経過した売主の通話モードページで次電日を変更し、その後ページ遷移を試みる THEN システムは「次電日を変更しなくてよいか？」ダイアログを表示する

1.2 WHEN 次電日を変更して保存した後、バックグラウンドポーリングが `editedNextCallDate` を古い値に上書きし、その後ページ遷移を試みる THEN システムは `editedNextCallDate === savedNextCallDate` を `true` と誤判定し、ダイアログを表示する

### Expected Behavior (Correct)

2.1 WHEN 反響日付が3日以上経過した売主の通話モードページで次電日を変更し、その後ページ遷移を試みる THEN システムはダイアログを表示しない（次電日が変更済みのため）

2.2 WHEN 次電日が変更されていない状態でページ遷移を試みる THEN システムは SHALL 「次電日を変更しなくてよいか？」ダイアログを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 反響日付が3日以上経過しておらず、次電日を変更せずにページ遷移を試みる THEN システムは SHALL CONTINUE TO ダイアログを表示しない

3.2 WHEN 反響日付が3日以上経過しているが、状況（当社）が「追客中」を含まない場合にページ遷移を試みる THEN システムは SHALL CONTINUE TO ダイアログを表示しない

3.3 WHEN 反響日付が3日以上経過しており、追客中であり、ページ編集がなく、次電日も変更していない状態でページ遷移を試みる THEN システムは SHALL CONTINUE TO ダイアログを表示しない（pageEdited が false のため）

3.4 WHEN 反響日付が3日以上経過しており、追客中であり、次電日以外のフィールドを編集し、次電日は変更していない状態でページ遷移を試みる THEN システムは SHALL CONTINUE TO ダイアログを表示する

---

## Bug Condition Pseudocode

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type { editedNextCallDate: string, savedNextCallDate: string }
  OUTPUT: boolean

  // 次電日が実際には変更されているにもかかわらず、
  // savedNextCallDate が正しく更新されていないため
  // editedNextCallDate === savedNextCallDate が true になる状態
  RETURN X.editedNextCallDate !== X.savedNextCallDate_actual
         AND X.editedNextCallDate === X.savedNextCallDate_stale
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - 次電日変更時はダイアログを表示しない
FOR ALL X WHERE isBugCondition(X) DO
  result ← shouldShowReminderDialog'(isElapsed, isFollowingUp, pageEdited, nextCallDateUnchanged)
  ASSERT result = false
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT shouldShowReminderDialog(X) = shouldShowReminderDialog'(X)
END FOR
```
