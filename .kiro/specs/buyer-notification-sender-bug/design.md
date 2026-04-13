# buyer-notification-sender-bug バグ修正デザイン

## Overview

内覧前日メール送信後、`notification_sender` フィールドに送信者の正しいイニシャルではなく「業者」という値が保存されるバグ。

`onEmailSent` コールバックが `/api/employees/initials-by-email` エンドポイントを呼び出してイニシャルを取得しようとするが、エンドポイントが誤った値（「業者」）を返している。

修正方針：`/api/employees/initials-by-email` エンドポイントの実装を修正し、ログインユーザーの正しいイニシャルを返すようにする。

## Glossary

- **Bug_Condition (C)**: ログインユーザーが内覧前日メールを送信した後、`notification_sender` に「業者」が保存される条件
- **Property (P)**: メール送信後、`notification_sender` にログインユーザーの正しいイニシャルが保存されること
- **Preservation**: 内覧前日メール送信以外の操作（手動ボタンクリック、他フィールド更新など）の動作が変わらないこと
- **`onEmailSent`**: `BuyerViewingResultPage.tsx` 内のコールバック。メール送信成功後に `notification_sender` を自動設定する
- **`initials-by-email`**: `backend/src/routes/employees.ts` の GET エンドポイント。認証トークンからメールを取得し、スプシまたはDBからイニシャルを返す
- **`getInitialsByEmail`**: `StaffManagementService.ts` のメソッド。スプシの「スタッフ」シートをメールで検索してイニシャルを返す
- **`GoogleSheetsClient`**: スプシ読み取りクライアント。`readAll()` はヘッダー名をキーとしたオブジェクト配列を返す

## Bug Details

### Bug Condition

内覧前日メールを送信すると `onEmailSent` コールバックが実行され、`/api/employees/initials-by-email` を呼び出す。このエンドポイントが「業者」を返すため、`notification_sender` に「業者」が保存される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { userEmail: string, action: string }
  OUTPUT: boolean

  RETURN input.action === 'sendPreDayEmail'
         AND initialsFromEndpoint(input.userEmail) === '業者'
         AND initialsFromEndpoint(input.userEmail) !== correctInitials(input.userEmail)
END FUNCTION
```

### Examples

- **例1（バグあり）**: tomokoのアカウントでメール送信 → `notification_sender` に「業者」が保存される（期待値: 「T」や「tomoko」などのイニシャル）
- **例2（バグあり）**: 他のスタッフアカウントでメール送信 → `notification_sender` に「業者」が保存される
- **例3（正常）**: 手動で通知送信者ボタンをクリック → 正しいイニシャルが保存される（この経路はバグの影響を受けない）
- **エッジケース**: `initials-by-email` が `null` を返す場合 → フォールバックの `employee.initial` が使われるが、`Employee` 型に `initial` フィールドが存在しないため `undefined` → `senderInitial` が空のまま → `handleInlineFieldSave` が呼ばれない

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- 手動で通知送信者ボタンをクリックして `notification_sender` を設定する動作
- 内覧前日メール以外のフィールド更新（内覧日、内覧結果、フォローアップ担当など）
- `broker_inquiry === '業者問合せ'` の買主に対する内覧前日ボタン非表示の判定
- `notification_sender` が入力済みの買主を「内覧日前日」カテゴリーから除外する計算
- 他のエンドポイント（`/api/employees/normal-initials` など）の動作

**スコープ:**
内覧前日メール送信の `onEmailSent` コールバック経由での `notification_sender` 自動設定のみが対象。それ以外の操作は完全に影響を受けない。

## Hypothesized Root Cause

コードとコンソールログ（`"Saving field: notification_sender, value: 業者"`）の分析から、以下の根本原因を仮説する：

1. **スプシの「スタッフ」シートに「業者」というイニシャルの行が存在し、そのメールアドレスがtomokoのメールアドレスと一致している**
   - `getInitialsByEmail` がメールアドレスで行を検索し、`matched['スタッフID'] || matched['イニシャル']` を返す
   - スプシのA列（イニシャル）が「業者」の行のE列（メアド）にtomokoのメールが入っている可能性
   - または、スプシのヘッダーが「スタッフID」でも「イニシャル」でもなく（例：A列ヘッダーが別名）、`matched['スタッフID']` と `matched['イニシャル']` が両方 `null` になり、別の経路で「業者」が設定される

2. **`getInitialsByEmail` のカラム参照が誤っている**
   - `fetchStaffData` ではA列（`row[0]`）をイニシャルとして使用しているが、`getInitialsByEmail` では `matched['スタッフID'] || matched['イニシャル']` を参照している
   - スプシのA列ヘッダーが「スタッフID」でも「イニシャル」でもない場合、正しいイニシャルが取得できない
   - `fetchStaffData` と `getInitialsByEmail` で異なるカラム名を参照しており、一貫性がない

3. **`GoogleSheetsClient` の認証方式の不一致**
   - `getInitialsByEmail` は `serviceAccountKeyPath` を使った `GoogleSheetsClient` を使用
   - `fetchStaffData` は `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数を使った直接認証を使用
   - `serviceAccountKeyPath` が設定されていない場合、例外が発生して `null` が返り、フォールバックが誤動作する可能性

4. **フォールバックの `employee.initial` フィールドが存在しない**
   - `Employee` 型には `initial` フィールドがなく（`initials` はある）
   - `(employee as any)?.initial` は常に `undefined` → フォールバックが機能しない
   - `initials-by-email` が `null` を返した場合、`senderInitial` が空のまま `handleInlineFieldSave` が呼ばれない

## Correctness Properties

Property 1: Bug Condition - 内覧前日メール送信後の通知送信者自動設定

_For any_ ログインユーザーが内覧前日メールを送信した場合（isBugCondition が true）、修正後の `onEmailSent` コールバックは `notification_sender` フィールドにそのユーザーの正しいイニシャル（「業者」以外の値）を保存しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 手動操作・他フィールド更新の動作保持

_For any_ 内覧前日メール送信以外の操作（手動ボタンクリック、他フィールド更新、他エンドポイント呼び出し）において、修正後のコードは修正前のコードと同一の結果を返し、既存の動作を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の仮説1・2に基づく修正：

**File**: `backend/src/services/StaffManagementService.ts`

**Function**: `getInitialsByEmail`

**Specific Changes**:

1. **カラム参照の修正**: `matched['スタッフID'] || matched['イニシャル']` を `fetchStaffData` と同じロジックに統一する
   - `fetchStaffData` ではA列（`row[0]`）をイニシャルとして使用している
   - `getInitialsByEmail` でも同様に、スプシのA列（イニシャル）を参照するよう修正
   - または `fetchStaffData` のキャッシュを活用してメールで検索する方式に変更

2. **`fetchStaffData` のキャッシュを活用する方式への変更（推奨）**:
   - `getInitialsByEmail` を `fetchStaffData` のキャッシュを使って実装し直す
   - `fetchStaffData` はすでにメールアドレスを `StaffInfo.email` として保持している
   - `GoogleSheetsClient` を直接使わず、`fetchStaffData` 経由でデータを取得することで認証方式の不一致も解消

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

**Function**: `onEmailSent` コールバック

**Specific Changes**:

3. **フォールバックの修正**: `(employee as any)?.initial` を `employee?.initials` に修正
   - `Employee` 型の正しいフィールド名は `initials`（複数形）
   - `initial`（単数形）は存在しないため、フォールバックが機能していない

4. **フォールバックの強化**: `initials-by-email` が `null` を返した場合でも `employee?.initials` を使用できるようにする

**File**: `backend/src/routes/employees.ts`

**Function**: `GET /initials-by-email`

**Specific Changes**:

5. **エラーハンドリングの改善**: スプシ取得が失敗した場合のログを追加し、デバッグを容易にする

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因の仮説を確認または反証する。

**Test Plan**: `getInitialsByEmail` をモックしてスプシのデータを制御し、「業者」が返される条件を特定する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **スプシに「業者」行が存在するケース**: メールアドレスが「業者」行のE列と一致する場合、`getInitialsByEmail` が「業者」を返すことを確認（未修正コードで失敗）
2. **カラム名不一致ケース**: スプシのA列ヘッダーが「スタッフID」でも「イニシャル」でもない場合、`getInitialsByEmail` が `null` を返すことを確認
3. **フォールバック動作確認**: `initials-by-email` が `null` を返した場合、`employee.initial` が `undefined` のため `handleInlineFieldSave` が呼ばれないことを確認
4. **エンドポイント統合テスト**: 実際の認証トークンで `/api/employees/initials-by-email` を呼び出し、「業者」が返ることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `getInitialsByEmail` が「業者」を返す（スプシのデータ問題またはカラム参照の誤り）
- フォールバックが機能せず `senderInitial` が空のまま

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力に対して正しいイニシャルが保存されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := onEmailSent_fixed(input)
  ASSERT notification_sender(result) !== '業者'
  ASSERT notification_sender(result) === correctInitials(input.userEmail)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original_behavior(input) === fixed_behavior(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。手動ボタンクリックや他フィールド更新など多様な入力パターンを自動生成し、動作が変わらないことを確認する。

**Test Cases**:
1. **手動ボタンクリック保持**: 通知送信者ボタンを手動クリックした場合、正しいイニシャルが保存されることを確認
2. **他フィールド更新保持**: 内覧日・内覧結果・フォローアップ担当の更新が `notification_sender` に影響しないことを確認
3. **`normal-initials` エンドポイント保持**: `/api/employees/normal-initials` の動作が変わらないことを確認
4. **`isViewingPreDay` 判定保持**: `notification_sender` が入力済みの場合に「内覧日前日」から除外される判定が変わらないことを確認

### Unit Tests

- `getInitialsByEmail` が正しいカラムからイニシャルを取得することをテスト
- `getInitialsByEmail` がスプシに「業者」行があっても正しいユーザーのイニシャルを返すことをテスト
- `onEmailSent` コールバックが `employee?.initials` をフォールバックとして使用することをテスト
- `initials-by-email` エンドポイントが正しいイニシャルを返すことをテスト

### Property-Based Tests

- ランダムなメールアドレスとスプシデータを生成し、`getInitialsByEmail` が常に正しいイニシャルを返すことを検証
- ランダムな `Employee` オブジェクトを生成し、`onEmailSent` が `initials` フィールドを正しく使用することを検証
- 多様なスプシヘッダー構造を生成し、カラム参照が一貫して動作することを検証

### Integration Tests

- tomokoのアカウントで内覧前日メールを送信し、`notification_sender` に「業者」以外の正しいイニシャルが保存されることを確認
- 修正後、`/api/employees/initials-by-email` が正しいイニシャルを返すことをエンドツーエンドで確認
- 手動ボタンクリックが引き続き正しく動作することを確認
