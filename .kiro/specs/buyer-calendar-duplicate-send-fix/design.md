# buyer-calendar-duplicate-send-fix バグ修正設計書

## Overview

買主内覧結果ページ（`BuyerViewingResultPage.tsx`）の「📅 カレンダーで開く」ボタンをクリックすると、`handleCalendarButtonClick` 関数が Google カレンダー URL に `add` と `src` の両パラメータを同時に付与するため、後続担当のカレンダーに同じイベントが2件重複して登録される。

また、後続担当が「業者」の場合に `tenant@ifoo-oita.com` をハードコードして送信しているため、テナント系カレンダーへの誤送信が発生している。

修正方針：
1. `add` パラメータを削除し、`src` パラメータのみ使用する（後続担当のカレンダーに直接1件作成）
2. 後続担当が「業者」の場合はカレンダー送信をスキップし、適切なメッセージを表示する

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `add` と `src` の両パラメータが同時に使用される、または後続担当が「業者」の場合に `tenant@ifoo-oita.com` が使用される
- **Property (P)**: 期待される正しい動作 — 後続担当のカレンダーにイベントが1件のみ登録される（業者の場合はスキップ）
- **Preservation**: 修正によって変更してはならない既存の動作
- **handleCalendarButtonClick**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` 内の関数。カレンダーボタンクリック時に Google カレンダー URL を生成して新しいタブで開く
- **assignedEmail**: 後続担当のメールアドレス。従業員マスタから検索して取得する
- **follow_up_assignee**: 買主データの後続担当フィールド（イニシャルまたは「業者」）

## Bug Details

### Bug Condition

後続担当が設定された状態でカレンダーボタンをクリックすると、`handleCalendarButtonClick` 関数が `add` パラメータ（ゲスト招待）と `src` パラメータ（カレンダー直接作成）を同時に Google カレンダー URL に付与する。また、後続担当が「業者」の場合は `tenant@ifoo-oita.com` をハードコードして使用する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { followUpAssignee: string, assignedEmail: string }
  OUTPUT: boolean

  RETURN (input.assignedEmail != ''
          AND urlContains('add=' + input.assignedEmail)
          AND urlContains('src=' + encodeURIComponent(input.assignedEmail)))
         OR (input.followUpAssignee == '業者'
             AND input.assignedEmail == 'tenant@ifoo-oita.com')
END FUNCTION
```

### Examples

- **重複送信の例**: 後続担当が「田中（tanaka@example.com）」の場合、URL に `add=tanaka%40example.com&src=tanaka%40example.com` が付与され、同じイベントが2件登録される
- **誤送信の例**: 後続担当が「業者」の場合、`tenant@ifoo-oita.com` のカレンダーにイベントが送信される（期待: 送信しない）
- **正常ケース（修正後）**: 後続担当が「田中」の場合、`src=tanaka%40example.com` のみ付与され、1件のみ登録される
- **エッジケース（修正後）**: 後続担当が「業者」の場合、カレンダー送信をスキップしてメッセージを表示する

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 後続担当が従業員マスタに存在するイニシャルに設定されている場合、従業員マスタからメールアドレスを検索してカレンダー送信先として使用する動作は変わらない
- 後続担当が従業員マスタに存在しない場合、エラーメッセージを表示してカレンダー送信を中断する動作は変わらない
- 後続担当のイニシャルが複数の社員に一致する場合、「複数の社員に一致します」エラーメッセージを表示してカレンダー送信を中断する動作は変わらない
- カレンダーボタンクリック時に Google カレンダーの新規イベント作成画面を新しいタブで開く動作は変わらない
- `calendarOpened` フラグを `true` に設定し、離脱ガードを解除する動作は変わらない
- `/api/buyer-appointments` へのメール通知送信を試みる動作は変わらない

**Scope:**
後続担当が「業者」以外の正常な従業員イニシャルである場合、バグ修正の影響を受けるのは URL パラメータの生成部分のみ。それ以外の処理（日時計算、タイトル生成、説明生成、メール通知）は一切変更しない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り特定済み：

1. **`add` と `src` の二重使用**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` の 586〜591 行付近で、`params.append('add', assignedEmail)` と `&src=${encodeURIComponent(assignedEmail)}` が同時に URL に付与されている
   - `add` パラメータ: Google カレンダーでゲストとして招待 → 招待メールが届き、自分のカレンダーにも追加される（1件目）
   - `src` パラメータ: 指定したカレンダーに直接イベントを作成（2件目）
   - 結果: 同じイベントが2件登録される

2. **「業者」のハードコード**: `followUpAssignee === '業者'` の場合に `assignedEmail = 'tenant@ifoo-oita.com'` をセットしており、テナント系カレンダーへの誤送信が発生している

## Correctness Properties

Property 1: Bug Condition - カレンダーイベントの重複送信防止

_For any_ 後続担当が設定された状態でカレンダーボタンがクリックされる入力において、バグ条件が成立する（`isBugCondition` が true を返す）場合、修正後の `handleCalendarButtonClick` 関数は Google カレンダー URL に `add` パラメータを付与せず `src` パラメータのみを使用し、後続担当のカレンダーにイベントが1件のみ登録されるようにしなければならない。また、後続担当が「業者」の場合はカレンダー送信をスキップし、適切なメッセージを表示しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の正常動作の保持

_For any_ バグ条件が成立しない入力（後続担当が「業者」以外の有効な従業員イニシャルである場合、または後続担当が未設定・不正な場合）において、修正後の `handleCalendarButtonClick` 関数は修正前と同じ動作（エラーメッセージ表示、`calendarOpened` フラグ設定、メール通知送信）を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

**Function**: `handleCalendarButtonClick`

**Specific Changes**:

1. **`add` パラメータの削除**: 以下のコードを削除する
   ```typescript
   // 削除対象
   if (assignedEmail) {
     params.append('add', assignedEmail);
   }
   ```

2. **`src` パラメータのみ使用**: `src` パラメータの付与はそのまま維持する
   ```typescript
   // 維持（変更なし）
   const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';
   ```

3. **「業者」の場合のスキップ処理**: `assignedEmail = 'tenant@ifoo-oita.com'` のセットを削除し、代わりにスキップ処理を追加する
   ```typescript
   // 修正前（削除）
   if (followUpAssignee === '業者') {
     assignedEmail = 'tenant@ifoo-oita.com';
   }

   // 修正後（置換）
   if (followUpAssignee === '業者') {
     setSnackbar({
       open: true,
       message: '後続担当が「業者」のため、カレンダー送信をスキップしました',
       severity: 'warning',
     });
     return;
   }
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを再現するテストを実行してバグの存在を確認し、次に修正後のコードでバグが解消され既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: `handleCalendarButtonClick` をモックして Google カレンダー URL の生成結果を検証するテストを作成し、修正前のコードで実行して失敗を確認する。

**Test Cases**:
1. **重複パラメータテスト**: 後続担当が有効な従業員の場合、生成された URL に `add=` と `src=` が両方含まれることを確認（修正前は失敗するはず）
2. **業者誤送信テスト**: 後続担当が「業者」の場合、`tenant@ifoo-oita.com` が URL に含まれることを確認（修正前は失敗するはず）
3. **1件のみ登録テスト**: 修正後、URL に `add=` が含まれず `src=` のみ含まれることを確認
4. **業者スキップテスト**: 修正後、後続担当が「業者」の場合に `return` されてカレンダーが開かれないことを確認

**Expected Counterexamples**:
- 修正前: URL に `add=tanaka%40example.com` と `src=tanaka%40example.com` が両方含まれる
- 修正前: 後続担当「業者」の場合、URL に `tenant%40ifoo-oita.com` が含まれる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleCalendarButtonClick_fixed(input)
  ASSERT NOT urlContains(result, 'add=')
  ASSERT urlContains(result, 'src=') OR followUpAssignee == '業者'
  IF followUpAssignee == '業者' THEN
    ASSERT calendarNotOpened(result)
    ASSERT snackbarShown(result, 'warning')
  END IF
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleCalendarButtonClick_original(input) = handleCalendarButtonClick_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な従業員データ（イニシャル、メールアドレス）に対して自動的に多数のテストケースを生成できる
- 手動テストでは見落としがちなエッジケース（特殊文字を含むメールアドレスなど）を検出できる
- 既存動作が保持されていることを強く保証できる

**Test Plan**: 修正前のコードで正常動作（従業員マスタ検索、エラーメッセージ表示）を観察し、その動作を保持するプロパティベーステストを作成する。

**Test Cases**:
1. **従業員マスタ検索の保持**: 有効なイニシャルで従業員が1件見つかる場合、`src` パラメータにそのメールアドレスが使用されることを確認
2. **複数マッチエラーの保持**: 同じイニシャルを持つ従業員が複数いる場合、エラーメッセージが表示されてカレンダーが開かれないことを確認
3. **未登録エラーの保持**: 後続担当が従業員マスタに存在しない場合、エラーメッセージが表示されてカレンダーが開かれないことを確認
4. **calendarOpened フラグの保持**: 正常にカレンダーが開かれた場合、`calendarOpened` が `true` になることを確認

### Unit Tests

- 後続担当が有効な従業員の場合、URL に `add=` が含まれず `src=` のみ含まれることを検証
- 後続担当が「業者」の場合、カレンダーが開かれず warning スナックバーが表示されることを検証
- 後続担当が従業員マスタに存在しない場合、error スナックバーが表示されることを検証
- 後続担当のイニシャルが複数マッチする場合、error スナックバーが表示されることを検証

### Property-Based Tests

- ランダムな従業員データを生成し、有効なイニシャルの場合は常に `src=` のみ（`add=` なし）が URL に含まれることを検証
- ランダムな入力に対して、「業者」以外の後続担当では `tenant@ifoo-oita.com` が URL に含まれないことを検証
- 多様な従業員マスタ構成に対して、既存のエラーハンドリング動作が保持されることを検証

### Integration Tests

- 実際の従業員マスタデータを使用して、カレンダーボタンクリックから Google カレンダー URL 生成までの全フローを検証
- 後続担当が「業者」の場合のスキップフローを検証
- カレンダーを開いた後のメール通知送信フローが変わらないことを検証
