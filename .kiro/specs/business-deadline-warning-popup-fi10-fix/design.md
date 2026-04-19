# 業務リストFI10 締日超過警告ポップアップ バグ修正デザイン

## Overview

業務リスト（WorkTaskDetailModal）のFI10フィールド「サイト登録納期予定日（site_registration_due_date）」において、モーダルを開くたびに「⚠️ 締日超過の警告」ポップアップが毎回表示されてしまうバグを修正する。

本来、この警告はユーザーが日付フィールドを入力・変更した時のみ表示されるべきである。現在の実装では `checkDeadlineOnLoad` 関数が `useEffect`（モーダルオープン時）と `fetchData()`（データ取得完了時）の両方で呼ばれており、既存データが締日を超過している場合は閲覧するだけで毎回警告が表示される。

修正方針は最小限の変更とし、`useEffect` 内と `fetchData()` 内の `checkDeadlineOnLoad` 呼び出しを削除するのみとする。`handleFieldChange` の締日チェックロジックはそのまま維持する。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — モーダルオープン時またはデータ再取得時に `checkDeadlineOnLoad` が呼ばれ、締日超過の警告ポップアップが表示される
- **Property (P)**: 期待される正しい動作 — 警告ポップアップはユーザーが日付フィールドを変更した時のみ表示される
- **Preservation**: 修正によって変えてはいけない既存の動作 — `handleFieldChange` 経由の締日チェックと警告表示
- **checkDeadlineOnLoad**: `WorkTaskDetailModal.tsx` 内の関数。`site_registration_due_date` と `floor_plan_due_date` が締日を超過しているか確認し、超過していれば警告ダイアログを開く
- **handleFieldChange**: フィールド値変更時に呼ばれるハンドラ。締日チェック対象フィールドが変更された場合に `isDeadlineExceeded` を呼び出す
- **isDeadlineExceeded**: 日付と締日を比較して超過しているか判定するユーティリティ関数
- **warningDialog**: 警告ポップアップの表示状態を管理する state（`open: boolean`, `fieldLabel: string`）

## Bug Details

### Bug Condition

バグは以下の2つのタイミングで発動する：

1. モーダルを開いた時（`useEffect` 内で `checkDeadlineOnLoad(taskData)` が呼ばれる）
2. バックグラウンドでデータを再取得した後（`fetchData()` 内で `checkDeadlineOnLoad(response.data)` が呼ばれる）

ユーザーが日付を変更していなくても、既存データの `site_registration_due_date` または `floor_plan_due_date` が締日を超過していれば、モーダルを開くたびに警告が表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(event)
  INPUT: event of type { type: 'modal_open' | 'fetch_complete', taskData: WorkTaskData }
  OUTPUT: boolean

  IF event.type IN ['modal_open', 'fetch_complete']
    AND (isDeadlineExceeded(taskData.site_registration_due_date, taskData.site_registration_deadline)
         OR isDeadlineExceeded(taskData.floor_plan_due_date, taskData.site_registration_deadline))
  THEN
    RETURN true  // バグ条件成立：警告が不当に表示される
  ELSE
    RETURN false
  END IF
END FUNCTION
```

### Examples

- **例1（バグあり）**: `site_registration_due_date` が締日を1日超過している物件のモーダルを開く → 警告ポップアップが表示される（本来は表示されるべきでない）
- **例2（バグあり）**: 同じモーダルを閉じて再度開く → 再び警告ポップアップが表示される（毎回表示される）
- **例3（バグあり）**: モーダルを開いた直後、バックグラウンドで `fetchData(true)` が完了する → 警告ポップアップが2回表示される可能性がある
- **例4（正常）**: `site_registration_due_date` が締日以内の物件のモーダルを開く → 警告は表示されない

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- ユーザーが `site_registration_due_date` フィールドに締日を超過する日付を入力した時、警告ポップアップが表示される
- ユーザーが `floor_plan_due_date` フィールドに締日を超過する日付を入力した時、警告ポップアップが表示される
- ユーザーが締日を超過しない日付を入力した時、警告ポップアップは表示されない
- 警告ポップアップの「確認しました」ボタンでポップアップを閉じられる

**Scope:**
日付フィールドの変更（`handleFieldChange` 経由）以外のすべての操作は、この修正によって影響を受けてはならない。具体的には：
- モーダルのオープン・クローズ操作
- データの読み込み・再取得
- 他のフィールドの編集・保存
- タブ切り替えなどのUI操作

## Hypothesized Root Cause

バグの根本原因は明確に特定されている：

1. **useEffect 内での不適切な呼び出し**: `useEffect`（`open` と `propertyNumber` に依存）内で `checkDeadlineOnLoad(taskData)` を呼び出している。モーダルが開くたびにこの effect が実行され、警告チェックが走る。

2. **fetchData 内での不適切な呼び出し**: `fetchData()` 内で `checkDeadlineOnLoad(response.data)` を呼び出している。バックグラウンド取得（`fetchData(true)`）完了時にも警告チェックが走る。

3. **設計上の意図の誤り**: `checkDeadlineOnLoad` という関数名が示す通り、この関数は「ロード時のチェック」として実装されたが、要件上は「ユーザーが日付を変更した時のみ」チェックすべきである。

4. **handleFieldChange は正しく実装済み**: 日付変更時のチェック（`handleFieldChange` 内）は正しく実装されており、修正不要。

## Correctness Properties

Property 1: Bug Condition - モーダルオープン・データ取得時に警告を表示しない

_For any_ イベントがモーダルオープン（`useEffect` 実行）またはデータ取得完了（`fetchData` 完了）であり、ユーザーが日付フィールドを変更していない場合、修正後の `WorkTaskDetailModal` は `warningDialog` を開かない（`setWarningDialog({ open: true, ... })` を呼び出さない）。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 日付変更時の警告表示は維持される

_For any_ ユーザー操作が `handleFieldChange` 経由の日付フィールド変更であり、入力値が締日を超過している場合、修正後のコードは修正前と同じく `warningDialog` を開く（`setWarningDialog({ open: true, fieldLabel: ... })` を呼び出す）。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の最小限の変更を行う：

**File**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

**Specific Changes**:

1. **useEffect 内の checkDeadlineOnLoad 呼び出しを削除**:
   ```typescript
   // 修正前
   if (initialData) {
     const taskData = initialData as WorkTaskData;
     setData(taskData);
     setLoading(false);
     checkDeadlineOnLoad(taskData);  // ← この行を削除
     fetchData(true);
   } else {
     fetchData(false);
   }

   // 修正後
   if (initialData) {
     const taskData = initialData as WorkTaskData;
     setData(taskData);
     setLoading(false);
     fetchData(true);
   } else {
     fetchData(false);
   }
   ```

2. **fetchData 内の checkDeadlineOnLoad 呼び出しを削除**:
   ```typescript
   // 修正前
   const response = await api.get(`/api/work-tasks/${propertyNumber}`);
   setData(response.data);
   checkDeadlineOnLoad(response.data);  // ← この行を削除

   // 修正後
   const response = await api.get(`/api/work-tasks/${propertyNumber}`);
   setData(response.data);
   ```

3. **handleFieldChange のロジックはそのまま維持**（変更なし）:
   ```typescript
   // このコードは変更しない
   if (field in DEADLINE_CHECK_FIELDS) {
     const deadline = editedData['site_registration_deadline'] ?? data?.['site_registration_deadline'];
     if (isDeadlineExceeded(value, deadline)) {
       setWarningDialog({ open: true, fieldLabel: DEADLINE_CHECK_FIELDS[field] });
     }
   }
   ```

4. **checkDeadlineOnLoad 関数自体の扱い**: 呼び出し箇所がなくなるため、関数定義も削除可能。ただし、将来的な再利用の可能性を考慮して残しても問題ない（デッドコードとなるが影響なし）。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず修正前のコードでバグを再現するテストを書き、次に修正後のコードで正しい動作を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `WorkTaskDetailModal` をレンダリングし、締日超過データでモーダルを開いた時に `warningDialog` が開かれることを確認する。これらのテストは修正前のコードで失敗（バグを再現）することを期待する。

**Test Cases**:
1. **モーダルオープン時の警告テスト**: `site_registration_due_date` が締日を超過しているデータで `open=true` にした時、`warningDialog.open` が `true` になることを確認（修正前は true になる = バグ再現）
2. **fetchData 完了時の警告テスト**: `fetchData` が完了した後に `warningDialog.open` が `true` になることを確認（修正前は true になる = バグ再現）
3. **日付未変更での再オープンテスト**: モーダルを閉じて再度開いた時に再び警告が表示されることを確認（修正前は表示される = バグ再現）

**Expected Counterexamples**:
- モーダルを開くだけで `setWarningDialog({ open: true, ... })` が呼ばれる
- 原因: `useEffect` 内の `checkDeadlineOnLoad` 呼び出し

### Fix Checking

**Goal**: 修正後のコードで、モーダルオープン時に警告が表示されないことを確認する。

**Pseudocode:**
```
FOR ALL event WHERE isBugCondition(event) DO
  result := render WorkTaskDetailModal with buggy data (open=true)
  ASSERT warningDialog.open = false  // 警告は表示されない
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、日付変更時の警告表示が維持されることを確認する。

**Pseudocode:**
```
FOR ALL userAction WHERE NOT isBugCondition(userAction) DO
  ASSERT original_handleFieldChange(userAction) = fixed_handleFieldChange(userAction)
END FOR
```

**Testing Approach**: `handleFieldChange` の動作は修正前後で同一であるため、単体テストで十分に検証できる。

**Test Cases**:
1. **締日超過日付入力の保持**: `site_registration_due_date` に締日超過の日付を入力した時、警告が表示されることを確認
2. **floor_plan_due_date の保持**: `floor_plan_due_date` に締日超過の日付を入力した時、警告が表示されることを確認
3. **締日以内日付入力の保持**: 締日以内の日付を入力した時、警告が表示されないことを確認
4. **警告クローズの保持**: 警告ポップアップの「確認しました」ボタンで閉じられることを確認

### Unit Tests

- `useEffect` 実行後（モーダルオープン時）に `warningDialog.open` が `false` であることを確認
- `fetchData` 完了後に `warningDialog.open` が `false` であることを確認
- `handleFieldChange` で締日超過日付を入力した時に `warningDialog.open` が `true` になることを確認
- `handleFieldChange` で締日以内の日付を入力した時に `warningDialog.open` が `false` のままであることを確認

### Property-Based Tests

- ランダムな `WorkTaskData`（締日超過あり・なし両方）を生成し、モーダルオープン時に警告が表示されないことを確認
- ランダムな日付入力を生成し、締日超過の場合のみ警告が表示されることを確認（`handleFieldChange` の動作検証）

### Integration Tests

- 締日超過データでモーダルを開き、警告が表示されないことを確認
- 同じモーダルを複数回開閉し、毎回警告が表示されないことを確認
- モーダルを開いた後、日付フィールドを締日超過の値に変更し、警告が表示されることを確認
- モーダルを開いた後、日付フィールドを締日以内の値に変更し、警告が表示されないことを確認
