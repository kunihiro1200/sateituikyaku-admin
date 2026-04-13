# 買主内覧前日通知メール 500エラー バグ修正デザイン

## Overview

買主リストの内覧前日通知メール（テンプレート: ☆内覧前日通知メール）を送信しようとすると、
`POST /api/gmail/send` が500 Internal Server Errorを返すバグ。

フロントエンドのメール本文プレビューは正常に表示されているため、問題はメール送信処理
（`EmailService.sendBuyerEmail` → `GoogleAuthService.getAuthenticatedClient`）に存在する。

修正方針: `getAuthenticatedClient` のトークン取得・設定ロジックを調査し、
アクセストークンが正しく設定されない問題を特定・修正する。

## Glossary

- **Bug_Condition (C)**: 買主への内覧前日通知メール送信ボタンを押した際に、`POST /api/gmail/send` が500を返す条件
- **Property (P)**: 有効なパラメータでメール送信リクエストを送った場合、Gmail APIを通じてメールが送信され `{ success: true }` が返る
- **Preservation**: 内覧前日通知メール以外のメール送信・プレビュー・テンプレートマージ機能は変更されない
- **sendBuyerEmail**: `backend/src/services/EmailService.ts` の買主向けメール送信メソッド（HTML対応・添付ファイル対応）
- **getAuthenticatedClient**: `backend/src/services/GoogleAuthService.ts` の会社アカウント用OAuth2クライアント取得メソッド
- **getAccessToken**: `GoogleAuthService` のアクセストークン取得メソッド（DBからリフレッシュトークンを取得してアクセストークンを発行）
- **google_calendar_tokens**: Google OAuth2トークンを保存するDBテーブル（`employee_id`, `encrypted_refresh_token` カラムを持つ）
- **COMPANY_ACCOUNT_UUID**: 会社アカウントの固定UUID（`66e35f74-7c31-430d-b235-5ad515581007`）

## Bug Details

### Bug Condition

買主への内覧前日通知メール送信時、`EmailService.sendBuyerEmail` が `GoogleAuthService.getAuthenticatedClient()` を呼び出すが、
このメソッド内でアクセストークンの取得と設定に問題がある可能性がある。

具体的には `getAuthenticatedClient` は以下の処理を行う:
1. `getAccessToken()` を呼び出してアクセストークンを取得
2. 新しい OAuth2 クライアントを作成
3. DBから会社アカウントのリフレッシュトークンを再度取得
4. `client.setCredentials({ access_token, refresh_token })` でクレデンシャルを設定

問題の可能性: `getAccessToken()` と `getAuthenticatedClient()` の両方でDBアクセスが発生しており、
トークンが期限切れ・無効・DBに存在しない場合に `GOOGLE_AUTH_REQUIRED` エラーが発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerId, propertyIds, senderEmail, subject, body }
  OUTPUT: boolean

  RETURN input.subject が内覧前日通知メールの件名である
         AND POST /api/gmail/send に送信された
         AND emailService.sendBuyerEmail() が success: false を返す
         AND 原因が GoogleAuthService.getAuthenticatedClient() の失敗である
END FUNCTION
```

### Examples

- **例1（バグあり）**: 買主ID `abc-123`、件名「内覧前日のご確認」でメール送信 → 500エラー、`result.success === false`
- **例2（バグあり）**: 有効な `senderEmail`、`subject`、`body` を送信 → `sendBuyerEmail` が `{ success: false, error: "..." }` を返す
- **例3（正常）**: メール本文プレビュー表示 → 日付・時間・住所が正しく表示される（バグの影響なし）
- **エッジケース**: `google_calendar_tokens` テーブルに会社アカウントのトークンが存在しない → `GOOGLE_AUTH_REQUIRED` エラー

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- 内覧前日通知メール以外のメール送信機能（`/api/gmail/send-to-buyer` など）は正常に動作し続ける
- メール本文プレビュー（`mergeMultiple` エンドポイント）は日付・時間・住所を正しく表示し続ける
- `mergeMultiple` エンドポイントはテンプレートのプレースホルダーを正しく置換し続ける
- `BuyerService.getById` は `buyer_number` でも `buyer_id` でも正しく検索し続ける

**スコープ:**
Gmail APIの認証・送信ロジック（`GoogleAuthService` / `EmailService`）の修正のみ。
フロントエンドのプレビュー表示・テンプレートマージ・買主情報取得には影響しない。

## Hypothesized Root Cause

コードを調査した結果、以下の根本原因が考えられる:

1. **二重DBアクセスによるトークン不整合**: `getAuthenticatedClient()` は内部で `getAccessToken()` を呼び出してアクセストークンを取得した後、さらに同じDBテーブルからリフレッシュトークンを再取得している。この二重アクセスは冗長であり、タイミング問題を引き起こす可能性がある。

2. **アクセストークンの設定方法の問題**: `getAuthenticatedClient()` では `client.setCredentials({ access_token, refresh_token })` でアクセストークンを直接設定しているが、`getAuthenticatedClientForEmployee()` では `client.refreshAccessToken()` を呼び出してトークンを更新している。会社アカウント用の `getAuthenticatedClient()` はアクセストークンの自動更新を行っていない可能性がある。

3. **Google OAuth2トークンの期限切れ**: `google_calendar_tokens` テーブルの会社アカウントのリフレッシュトークンが期限切れまたは無効になっている。この場合、`getAccessToken()` が `GOOGLE_AUTH_REQUIRED` エラーをスローする。

4. **環境変数の未設定**: `GOOGLE_CALENDAR_CLIENT_ID`、`GOOGLE_CALENDAR_CLIENT_SECRET`、`GOOGLE_CALENDAR_REDIRECT_URI` のいずれかが本番環境で未設定の場合、OAuth2クライアントの初期化に失敗する。

5. **会社アカウントUUIDの不一致**: `getCompanyAccountId()` が返すUUIDと `google_calendar_tokens` テーブルの `employee_id` が一致しない場合、トークンが見つからず `GOOGLE_AUTH_REQUIRED` エラーが発生する。

## Correctness Properties

Property 1: Bug Condition - メール送信成功

_For any_ リクエストで `isBugCondition` が true（有効な buyerId、subject、body が送信された）の場合、
修正後の `POST /api/gmail/send` エンドポイントは Gmail API を通じてメールを送信し、
`{ success: true }` を返す SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非バグ入力の動作保持

_For any_ リクエストで `isBugCondition` が false（メール送信以外の操作、または他のメール種別）の場合、
修正後のコードは修正前と同一の動作を SHALL 保持する。
具体的には、プレビュー表示・テンプレートマージ・買主情報取得は変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の変更を行う:

**File**: `backend/src/services/GoogleAuthService.ts`

**Function**: `getAuthenticatedClient`

**Specific Changes**:

1. **アクセストークン取得方法の統一**: `getAuthenticatedClient()` を `getAuthenticatedClientForEmployee()` と同様に、`client.refreshAccessToken()` を使用してトークンを自動更新する方式に変更する。これにより、アクセストークンの期限切れ問題を解消する。

2. **二重DBアクセスの排除**: `getAccessToken()` の呼び出しを削除し、DBからリフレッシュトークンを一度だけ取得してクライアントに設定する。

3. **エラーハンドリングの強化**: トークンが見つからない場合や更新に失敗した場合に、明確な `GOOGLE_AUTH_REQUIRED` エラーをスローする（`getAuthenticatedClientForEmployee` と同様のパターン）。

**修正前のコード（概要）:**
```typescript
async getAuthenticatedClient() {
  const accessToken = await this.getAccessToken(); // DBアクセス1回目
  const client = new google.auth.OAuth2(...);
  const { data: tokenData } = await this.table('google_calendar_tokens')
    .select('*').eq('employee_id', accountId).single(); // DBアクセス2回目
  if (tokenData) {
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  }
  return client;
}
```

**修正後のコード（概要）:**
```typescript
async getAuthenticatedClient() {
  const client = new google.auth.OAuth2(...);
  const { data: tokenData, error } = await this.table('google_calendar_tokens')
    .select('*').eq('employee_id', accountId).single(); // DBアクセス1回のみ
  if (error || !tokenData) {
    throw new Error('GOOGLE_AUTH_REQUIRED');
  }
  const refreshToken = decrypt(tokenData.encrypted_refresh_token);
  client.setCredentials({ refresh_token: refreshToken });
  // アクセストークンを自動更新（getAuthenticatedClientForEmployeeと同様）
  const { credentials } = await client.refreshAccessToken();
  client.setCredentials(credentials);
  return client;
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される:
1. **探索フェーズ**: 修正前のコードでバグを再現し、根本原因を確認する
2. **検証フェーズ**: 修正後のコードでバグが解消され、既存動作が保持されることを確認する

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因の仮説（`getAuthenticatedClient` のトークン設定問題）を確認または反証する。

**Test Plan**: `GoogleAuthService.getAuthenticatedClient()` をモックせずに呼び出し、
実際のエラーメッセージを確認する。また、`getAuthenticatedClient` と `getAuthenticatedClientForEmployee` の
動作の違いを比較する。

**Test Cases**:
1. **会社アカウントトークン取得テスト**: `getAuthenticatedClient()` を呼び出し、返されるクライアントが有効なアクセストークンを持つか確認（修正前は失敗する可能性）
2. **sendBuyerEmail 失敗テスト**: 有効なパラメータで `sendBuyerEmail` を呼び出し、`{ success: false }` が返ることを確認
3. **エラーメッセージ確認テスト**: 500エラー時のエラーメッセージを確認し、`GOOGLE_AUTH_REQUIRED` か別のエラーかを特定
4. **トークン存在確認テスト**: `google_calendar_tokens` テーブルに会社アカウントのレコードが存在するか確認

**Expected Counterexamples**:
- `getAuthenticatedClient()` が有効なアクセストークンを持つクライアントを返さない
- 考えられる原因: アクセストークンの自動更新が行われていない、DBのトークンが期限切れ

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sendBuyerEmail_fixed(input)
  ASSERT result.success === true
  ASSERT Gmail APIが呼び出された
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正前後で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT mergeMultiple_original(input) = mergeMultiple_fixed(input)
  ASSERT getById_original(input) = getById_fixed(input)
  ASSERT sendTobuyer_original(input) = sendToBuyer_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な入力パターン（異なる buyerId、subject、body）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強力に保証できる

**Test Cases**:
1. **mergeMultiple 保持テスト**: 修正前後で `mergeMultiple` エンドポイントが同じ結果を返すことを確認
2. **買主情報取得保持テスト**: `buyer_number` と `buyer_id` の両方で正しく検索できることを確認
3. **プレビュー表示保持テスト**: メール本文プレビューが日付・時間・住所を正しく表示することを確認
4. **他メール送信保持テスト**: `send-to-buyer` エンドポイントが引き続き正常に動作することを確認

### Unit Tests

- `GoogleAuthService.getAuthenticatedClient()` が有効なOAuth2クライアントを返すことをテスト
- `EmailService.sendBuyerEmail()` が成功時に `{ success: true, messageId: "..." }` を返すことをテスト
- `BuyerService.getById()` が UUID と buyer_number の両方で正しく検索できることをテスト
- トークンが存在しない場合に `GOOGLE_AUTH_REQUIRED` エラーがスローされることをテスト

### Property-Based Tests

- ランダムな有効メールパラメータを生成し、修正後の `sendBuyerEmail` が常に `success: true` を返すことを検証
- ランダムな非メール操作（プレビュー、テンプレートマージ）を生成し、修正前後で動作が一致することを検証
- 多様な buyerId（UUID形式・buyer_number形式）を生成し、`getById` が常に正しく動作することを検証

### Integration Tests

- `PreDayEmailButton` から `POST /api/gmail/send` までの完全なフローをテスト
- メール送信成功後に `email_history` と `activity_logs` に記録されることをテスト
- 送信後に `onEmailSent` コールバックが呼び出されることをテスト
