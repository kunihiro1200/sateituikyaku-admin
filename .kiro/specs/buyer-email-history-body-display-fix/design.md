# buyer-email-history-body-display-fix Bugfix Design

## Overview

買主リスト詳細画面（BuyerDetailPage）の「メール・SMS送信履歴」セクションで、メール履歴アイテムをクリックしてもメール本文が表示されないバグの修正。

`backend/src/routes/gmail.ts` の `/send` エンドポイントが `activityLogService.logEmail()` を呼び出す際に `body` パラメータを渡していないため、`activity_logs.metadata.body` が常に `undefined` になる。フロントエンドはクリック時に `metadata.body` を参照してモーダルを開く実装になっているため、本文が保存されていないと警告スナックバーが表示されるだけでモーダルが開かない。

修正は最小限で、`activityLogService.logEmail()` の呼び出しに `body: bodyText` を追加するだけで解決できる。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `/send` エンドポイントが `logEmail()` を `body` なしで呼び出し、`activity_logs.metadata.body` が `undefined` になる状態
- **Property (P)**: 期待される動作 — `logEmail()` 呼び出し時に `body: bodyText` が含まれ、`metadata.body` にメール本文が保存される
- **Preservation**: 修正によって変更してはならない既存動作（SMS履歴の動作、email_history保存、古い履歴の警告表示、添付ファイル送信）
- **logEmail()**: `backend/src/services/ActivityLogService.ts` の `ActivityLogService.logEmail()` メソッド。`activity_logs` テーブルにメール送信ログを記録する。`body?: string` パラメータを受け付けるが、呼び出し側が渡していなかった
- **metadata.body**: `activity_logs` テーブルの `metadata` JSON カラム内の `body` フィールド。フロントエンドがメール本文モーダルを開く際に参照する
- **bodyText**: `gmail.ts` の `/send` エンドポイントで `req.body.body` から取得したメール本文文字列

## Bug Details

### Bug Condition

バグは `backend/src/routes/gmail.ts` の `/send` エンドポイントが `activityLogService.logEmail()` を呼び出す際に `body` パラメータを渡していないことで発生する。`ActivityLogService.logEmail()` は `body?: string` パラメータを受け付けるが、呼び出し側がこれを省略しているため、`activity_logs.metadata.body` が常に `undefined` になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { endpoint: string, logEmailParams: object }
  OUTPUT: boolean

  RETURN input.endpoint = '/send'
         AND input.logEmailParams.body = undefined
         AND bodyText IS NOT undefined
END FUNCTION
```

### Examples

- **バグあり**: `/send` エンドポイントで `logEmail({ buyerId, propertyNumbers, recipientEmail, subject, templateName, senderEmail, createdBy })` を呼び出す → `metadata.body = undefined` → フロントエンドでクリックしても警告スナックバーのみ表示
- **修正後**: `/send` エンドポイントで `logEmail({ ..., body: bodyText })` を呼び出す → `metadata.body = "メール本文テキスト"` → フロントエンドでクリックするとモーダルが開く
- **エッジケース（古い履歴）**: 修正前に送信されたメールは `metadata.body = undefined` のまま → 警告スナックバーが表示される（これは正しい動作として維持する）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- SMS履歴アイテムをクリックした際の動作（モーダルを開かない既存動作）は変更しない
- メール送信成功時の `email_history` テーブルへの保存処理は変更しない
- メール送信成功レスポンス（`{ success: true }`）は変更しない
- `metadata.body` が存在しない古い履歴アイテムをクリックした際の警告スナックバー表示は変更しない
- 添付ファイル付きメール送信の動作は変更しない

**スコープ:**
`activityLogService.logEmail()` の呼び出し箇所に `body: bodyText` を追加するだけの最小限の修正。他の処理（メール送信、email_history保存、エラーハンドリング）は一切変更しない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は明確に特定できた：

1. **logEmail() 呼び出し時の body パラメータ欠落**: `backend/src/routes/gmail.ts` の `/send` エンドポイント（約130行目）で `activityLogService.logEmail()` を呼び出す際に `body: bodyText` が含まれていない
   - `bodyText` は `const bodyText = body.body;` で正しく取得されている
   - `ActivityLogService.logEmail()` は `body?: string` パラメータを受け付ける実装になっている
   - 呼び出し側がこのパラメータを渡し忘れている

2. **ActivityLogService.logEmail() の実装は正しい**: `body` パラメータを受け取り `metadata.body` に保存する実装は既に存在している（`body: params.body` として `metadata` に含まれている）

3. **フロントエンドの実装は正しい**: `metadata.body` を参照してモーダルを開く実装は正しく動作している

## Correctness Properties

Property 1: Bug Condition - logEmail() 呼び出し時に body が保存される

_For any_ メール送信リクエストで `bodyText` が存在する場合（isBugCondition が true）、修正後の `/send` エンドポイントは `activityLogService.logEmail()` を `body: bodyText` パラメータ付きで呼び出し、`activity_logs.metadata.body` にメール本文が保存される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - body パラメータ追加が既存動作に影響しない

_For any_ メール送信リクエストで isBugCondition が false の入力（SMS履歴操作、古い履歴アイテムのクリック、添付ファイル付き送信など）に対して、修正後のコードは元のコードと同じ動作を維持し、`email_history` 保存・送信レスポンス・エラーハンドリングは変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/routes/gmail.ts`

**Function**: `router.post('/send', ...)` 内の `activityLogService.logEmail()` 呼び出し箇所

**Specific Changes**:

1. **body パラメータの追加**: `activityLogService.logEmail()` の呼び出しに `body: bodyText` を追加する

**変更前:**
```typescript
await activityLogService.logEmail({
  buyerId: buyer.buyer_number || buyerId,
  propertyNumbers,
  recipientEmail: buyer.email,
  subject,
  templateName: templateName || undefined,
  senderEmail: senderEmail || 'tenant@ifoo-oita.com',
  createdBy: employeeId,
});
```

**変更後:**
```typescript
await activityLogService.logEmail({
  buyerId: buyer.buyer_number || buyerId,
  propertyNumbers,
  recipientEmail: buyer.email,
  subject,
  templateName: templateName || undefined,
  senderEmail: senderEmail || 'tenant@ifoo-oita.com',
  createdBy: employeeId,
  body: bodyText,
});
```

**変更規模**: 1行追加のみ。他のファイルへの変更は不要。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `/send` エンドポイントへのリクエストをシミュレートし、`activityLogService.logEmail()` が `body` なしで呼び出されることを確認する。修正前のコードでテストを実行して失敗を観察する。

**Test Cases**:
1. **body なし logEmail 呼び出しテスト**: `/send` エンドポイントを呼び出し、`logEmail()` の引数に `body` が含まれないことを確認（修正前のコードで失敗する）
2. **metadata.body が undefined テスト**: `activity_logs` に保存されたレコードの `metadata.body` が `undefined` であることを確認（修正前のコードで失敗する）
3. **フロントエンドモーダル非表示テスト**: `metadata.body = undefined` の履歴アイテムをクリックした際にモーダルが開かないことを確認（修正前の動作）

**Expected Counterexamples**:
- `logEmail()` の引数オブジェクトに `body` フィールドが存在しない
- `activity_logs.metadata.body` が `undefined` または `null`

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して期待動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := logEmail_fixed(input)
  ASSERT result.metadata.body = input.bodyText
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全入力に対して元のコードと同じ動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT logEmail_original(input) = logEmail_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様なメール本文・件名・買主IDの組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケース（空文字列、長い本文、特殊文字）を網羅できる
- 既存動作が全ての非バグ入力に対して維持されることを強く保証できる

**Test Cases**:
1. **email_history 保存の保持**: 修正前後で `email_history` テーブルへの保存内容が変わらないことを確認
2. **送信レスポンスの保持**: 修正前後で `{ success: true }` レスポンスが変わらないことを確認
3. **添付ファイル送信の保持**: 添付ファイルがある場合の動作が変わらないことを確認
4. **古い履歴の警告表示保持**: `metadata.body = undefined` の古いレコードに対してフロントエンドが警告を表示することを確認

### Unit Tests

- `activityLogService.logEmail()` が `body: bodyText` パラメータ付きで呼び出されることをモックで確認
- `activity_logs.metadata.body` に正しいメール本文が保存されることを確認
- `bodyText` が空文字列の場合の動作を確認
- 添付ファイルがある場合でも `body` が正しく保存されることを確認

### Property-Based Tests

- ランダムなメール本文（空文字列、長文、特殊文字、日本語）を生成し、`metadata.body` に正しく保存されることを検証
- ランダムな買主ID・件名・送信者メールの組み合わせで、`body` パラメータ追加が他のフィールドに影響しないことを検証
- 多様な入力パターンで `email_history` 保存処理が変わらないことを検証

### Integration Tests

- `/send` エンドポイントへの実際のリクエストで `activity_logs` に `metadata.body` が保存されることを確認
- 保存後にフロントエンドの買主詳細画面でメール履歴アイテムをクリックしてモーダルが開くことを確認
- 修正前に送信された古い履歴アイテムをクリックした際に警告スナックバーが表示されることを確認
