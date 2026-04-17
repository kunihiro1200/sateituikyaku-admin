# 買主内覧前日メール送信エラー バグ修正 デザイン

## Overview

買主リストの「内覧前日メール」テンプレートをEmailボタンからクリックして送信すると、断続的に「送れませんでした」（HTTP 500）エラーが発生するバグを修正する。

根本原因は `backend/src/services/GoogleAuthService.ts` の `getAuthenticatedClient()` メソッドが呼ばれるたびに `client.refreshAccessToken()` を無条件に実行しており、このトークン更新処理にリトライロジックが存在しないことにある。Google APIの一時的な問題（レート制限・ネットワーク遅延・タイムアウト等）が発生すると即座に例外がスローされ、500エラーとして伝播する。

修正方針は、`getAuthenticatedClient()` 内の `refreshAccessToken()` 呼び出しにエクスポネンシャルバックオフ付きリトライロジックを追加することである。一時的な失敗は自動的に回復し、永続的な認証エラー（`invalid_grant` 等）はリトライせずに即座に失敗させる。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `getAuthenticatedClient()` 内の `refreshAccessToken()` が一時的なエラー（レート制限・ネットワーク遅延・タイムアウト等）で失敗する状態
- **Property (P)**: 期待される正しい動作 — 一時的な失敗はリトライで自動回復し、メール送信を正常に完了する
- **Preservation**: 修正によって変更してはならない既存の動作 — Gmail API `messages.send` の既存リトライロジック、他テンプレートのメール送信、`email_history` と `activity_logs` への記録、カレンダー等の他Google API機能
- **getAuthenticatedClient**: `backend/src/services/GoogleAuthService.ts` 内のメソッド。会社アカウント用の認証済みOAuth2クライアントを返す。毎回 `refreshAccessToken()` を呼び出してアクセストークンを更新する
- **refreshAccessToken**: Google OAuth2クライアントのメソッド。リフレッシュトークンを使ってアクセストークンを更新する。Google APIへのネットワーク呼び出しを伴うため一時的に失敗することがある
- **一時的エラー**: レート制限（429）、ネットワーク遅延、タイムアウト、一時的なサーバーエラー（500/503）など、時間をおいて再試行すれば成功する可能性があるエラー
- **永続的エラー**: `invalid_grant`、`Token has been expired or revoked` など、リトライしても回復しない認証エラー
- **エクスポネンシャルバックオフ**: リトライ間隔を指数関数的に増加させる戦略（例: 1秒 → 2秒 → 4秒）

## Bug Details

### Bug Condition

バグは、`GoogleAuthService.getAuthenticatedClient()` が呼ばれた際に `client.refreshAccessToken()` がGoogle APIの一時的な問題で失敗する場合に発生する。現在のコードにはリトライロジックが存在しないため、一時的な失敗がそのまま例外として伝播し、最終的に HTTP 500 エラーとなる。

**Formal Specification:**
```
FUNCTION isBugCondition(sendRequest)
  INPUT: sendRequest（メール送信リクエスト）
  OUTPUT: boolean

  // GoogleAuthService.getAuthenticatedClient() が
  // refreshAccessToken() の一時的な失敗で例外をスローする状態
  tokenRefreshFails ← refreshAccessToken() が一時的なエラーを返す
                      （レート制限・ネットワーク遅延・タイムアウト等）

  RETURN tokenRefreshFails
END FUNCTION
```

### Examples

- **例1（レート制限）**: Google APIのレート制限（429）が発生 → `refreshAccessToken()` が即座に失敗 → リトライなしで例外スロー → HTTP 500「送れませんでした」
- **例2（ネットワーク遅延）**: 一時的なネットワーク遅延でタイムアウト → `refreshAccessToken()` が失敗 → リトライなしで例外スロー → HTTP 500
- **例3（一時的サーバーエラー）**: Google APIサーバーの一時的な503エラー → `refreshAccessToken()` が失敗 → リトライなしで例外スロー → HTTP 500
- **エッジケース（永続的エラー）**: `invalid_grant`（リフレッシュトークン失効）→ リトライしても回復しないため、即座に `GOOGLE_AUTH_REQUIRED` エラーとして失敗させる（リトライ対象外）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Gmail API `messages.send` が一時的に失敗する場合、既存のリトライロジック（`gmail.ts` の `sendWithTimeout` 等）によるリトライを行う
- 「内覧前日メール」以外のテンプレートを使用してEmail送信する場合、引き続き正常に動作する
- メール送信が成功する場合、`email_history` と `activity_logs` への記録を行う
- カレンダー送信など他のGoogle API機能（`getAuthenticatedClient()` を使用する他の呼び出し元）は引き続き正常に動作する
- `invalid_grant` 等の永続的な認証エラーは、リトライせずに即座に `GOOGLE_AUTH_REQUIRED` エラーとして伝播する

**Scope:**
`isBugCondition` が false となる入力（`refreshAccessToken()` が成功する正常ケース、または永続的な認証エラーのケース）は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通りである：

1. **リトライロジックの欠如**: `getAuthenticatedClient()` の `refreshAccessToken()` 呼び出し部分（`backend/src/services/GoogleAuthService.ts` の約290行目）に try/catch はあるが、リトライロジックが存在しない。一時的な失敗が即座に例外として伝播する。

   ```typescript
   // 現在のコード（リトライなし）
   try {
     const { credentials } = await client.refreshAccessToken();
     client.setCredentials(credentials);
   } catch (refreshError) {
     console.error('[GoogleAuthService] 会社アカウントのアクセストークン更新に失敗:', refreshError);
     throw new Error('GOOGLE_AUTH_REQUIRED');
   }
   ```

2. **一時的エラーと永続的エラーの区別なし**: 現在のコードは `refreshAccessToken()` の失敗を全て `GOOGLE_AUTH_REQUIRED` として扱う。レート制限やネットワーク遅延による一時的な失敗も、`invalid_grant` による永続的な失敗も同じ扱いになっている。

3. **毎回のトークン更新**: `getAuthenticatedClient()` は呼ばれるたびに必ず `refreshAccessToken()` を実行する。アクセストークンがまだ有効な場合でも更新を試みるため、Google APIへの呼び出し頻度が高くなりレート制限に引っかかりやすい。

4. **呼び出し元の連鎖**: `EmailService.sendBuyerEmail()` → `GoogleAuthService.getAuthenticatedClient()` → `refreshAccessToken()` の呼び出し連鎖で、最下層の一時的な失敗が最上層まで伝播する。

## Correctness Properties

Property 1: Bug Condition - トークン更新失敗時のリトライ回復

_For any_ メール送信リクエストにおいて `isBugCondition(sendRequest)` が true（`refreshAccessToken()` が一時的なエラーで失敗する）の場合、修正後の `getAuthenticatedClient()` はリトライを行い、一時的な失敗を自動的に回復してメール送信を完了する。最終的にリトライが全て失敗した場合は明確なエラーメッセージを返す。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 正常ケースおよび他機能の動作維持

_For any_ メール送信リクエストにおいて `isBugCondition(sendRequest)` が false（`refreshAccessToken()` が成功する、または永続的な認証エラーが発生する）の場合、修正後の `getAuthenticatedClient()` は修正前と同じ動作（成功時は認証済みクライアントを返す、永続的エラー時は `GOOGLE_AUTH_REQUIRED` をスロー）を行う。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、最小限の変更で修正する。

**File**: `backend/src/services/GoogleAuthService.ts`

**Function**: `getAuthenticatedClient()`

**Specific Changes**:

1. **一時的エラーの判定関数を追加**: `refreshAccessToken()` の失敗が一時的なものかどうかを判定するヘルパー関数を追加する。

   ```typescript
   private isTransientError(error: any): boolean {
     // 永続的な認証エラーはリトライしない
     if (
       error.message?.includes('invalid_grant') ||
       error.message?.includes('Token has been expired or revoked') ||
       error.message === 'GOOGLE_AUTH_REQUIRED'
     ) {
       return false;
     }
     // レート制限、ネットワークエラー、一時的なサーバーエラーはリトライ対象
     const status = error.status || error.code || error.response?.status;
     return (
       status === 429 ||
       status === 500 ||
       status === 503 ||
       error.code === 'ECONNRESET' ||
       error.code === 'ETIMEDOUT' ||
       error.code === 'ENOTFOUND' ||
       error.message?.includes('timeout') ||
       error.message?.includes('network')
     );
   }
   ```

2. **エクスポネンシャルバックオフ付きリトライロジックを追加**: `refreshAccessToken()` の呼び出しをリトライロジックでラップする。

   ```typescript
   // リトライ設定
   const MAX_RETRIES = 3;
   const BASE_DELAY_MS = 1000; // 1秒

   let lastError: any;
   for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
     try {
       const { credentials } = await client.refreshAccessToken();
       client.setCredentials(credentials);
       break; // 成功したらループを抜ける
     } catch (refreshError: any) {
       lastError = refreshError;
       
       // 永続的なエラーはリトライしない
       if (!this.isTransientError(refreshError)) {
         console.error('[GoogleAuthService] 永続的な認証エラー（リトライなし）:', refreshError.message);
         throw new Error('GOOGLE_AUTH_REQUIRED');
       }
       
       // 最後の試行だった場合はエラーをスロー
       if (attempt === MAX_RETRIES) {
         console.error(`[GoogleAuthService] ${MAX_RETRIES}回リトライ後も失敗:`, refreshError.message);
         throw new Error('GOOGLE_AUTH_REQUIRED');
       }
       
       // エクスポネンシャルバックオフで待機
       const delay = BASE_DELAY_MS * Math.pow(2, attempt);
       console.warn(`[GoogleAuthService] トークン更新失敗（試行${attempt + 1}/${MAX_RETRIES + 1}）。${delay}ms後にリトライ:`, refreshError.message);
       await new Promise(resolve => setTimeout(resolve, delay));
     }
   }
   ```

3. **同様のパターンを `getAuthenticatedClientForEmployee()` にも適用**: `getAuthenticatedClientForEmployee()` も同じパターンで `refreshAccessToken()` を呼び出しているため、同様のリトライロジックを追加する（要件3.4のカレンダー機能保護）。

4. **ログの改善**: リトライ試行のログを追加して、断続的な失敗の診断を容易にする。

## Testing Strategy

### Validation Approach

テスト戦略は二段階アプローチを採用する。まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。リトライロジックが存在しないことを証明する。

**Test Plan**: `getAuthenticatedClient()` の `refreshAccessToken()` 呼び出しをモックして一時的なエラーを注入し、現在のコードがリトライせずに即座に例外をスローすることを確認する。未修正コードで実行してバグを証明する。

**Test Cases**:
1. **レート制限テスト**: `refreshAccessToken()` が429エラーを返すようにモック → 現在のコードが即座に `GOOGLE_AUTH_REQUIRED` をスローすることを確認（未修正コードで PASS、バグの証明）
2. **ネットワークタイムアウトテスト**: `refreshAccessToken()` がタイムアウトエラーを返すようにモック → 現在のコードが即座に失敗することを確認（未修正コードで PASS、バグの証明）
3. **一時的サーバーエラーテスト**: `refreshAccessToken()` が503エラーを返すようにモック → 現在のコードが即座に失敗することを確認（未修正コードで PASS、バグの証明）
4. **永続的エラーテスト**: `refreshAccessToken()` が `invalid_grant` を返すようにモック → 現在のコードが `GOOGLE_AUTH_REQUIRED` をスローすることを確認（修正後も同じ動作であることを確認）

**Expected Counterexamples**:
- `refreshAccessToken()` が一時的なエラーを返した場合、現在のコードはリトライせずに即座に `GOOGLE_AUTH_REQUIRED` をスローする
- 呼び出し元の `EmailService.sendBuyerEmail()` はこのエラーを受け取り、`{ success: false, error: 'GOOGLE_AUTH_REQUIRED' }` を返す
- `gmail.ts` ルートは HTTP 500 を返す

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の `getAuthenticatedClient()` がリトライを行い、最終的に成功または明確なエラーを返すことを検証する。

**Pseudocode:**
```
FOR ALL sendRequest WHERE isBugCondition(sendRequest) DO
  result ← getAuthenticatedClient_fixed(sendRequest)
  // 一時的な失敗はリトライで回復
  ASSERT refreshAccessToken が複数回呼ばれた
  AND (result = 認証済みクライアント OR result = 明確なエラーメッセージ)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の `getAuthenticatedClient()` が修正前と同じ動作を行うことを検証する。

**Pseudocode:**
```
FOR ALL sendRequest WHERE NOT isBugCondition(sendRequest) DO
  ASSERT getAuthenticatedClient_original(sendRequest) = getAuthenticatedClient_fixed(sendRequest)
  // 成功時: 同じ認証済みクライアントを返す
  // 永続的エラー時: 同じ GOOGLE_AUTH_REQUIRED をスロー
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 様々なエラーパターン（エラーコード、メッセージ、ステータスコードの組み合わせ）を自動生成して網羅できる
- 手動テストでは見落としやすいエッジケース（エラーコードの境界値等）を検出できる
- 修正前後の動作が同一であることを強く保証できる

**Test Cases**:
1. **正常ケースの保持**: `refreshAccessToken()` が成功する場合、修正後も同じ認証済みクライアントを返すことを確認
2. **永続的エラーの保持**: `invalid_grant` エラーの場合、修正後もリトライせずに即座に `GOOGLE_AUTH_REQUIRED` をスローすることを確認
3. **他テンプレートのメール送信保持**: 「内覧前日メール」以外のテンプレートでも正常に動作することを確認
4. **email_history 記録の保持**: メール送信成功時に `email_history` と `activity_logs` への記録が行われることを確認

### Unit Tests

- `isTransientError()` が一時的なエラー（429、503、タイムアウト等）に対して `true` を返すこと
- `isTransientError()` が永続的なエラー（`invalid_grant` 等）に対して `false` を返すこと
- `refreshAccessToken()` が1回目に失敗して2回目に成功する場合、修正後の `getAuthenticatedClient()` が成功すること
- `refreshAccessToken()` が全リトライで失敗する場合、修正後の `getAuthenticatedClient()` が `GOOGLE_AUTH_REQUIRED` をスローすること
- `refreshAccessToken()` が `invalid_grant` を返す場合、リトライせずに即座に `GOOGLE_AUTH_REQUIRED` をスローすること

### Property-Based Tests

- ランダムな一時的エラー（429、503、タイムアウト等）を生成して、修正後の `getAuthenticatedClient()` が最大 `MAX_RETRIES` 回リトライすることを検証
- ランダムな永続的エラーを生成して、修正後の `getAuthenticatedClient()` がリトライせずに即座に失敗することを検証
- `refreshAccessToken()` が N 回失敗して N+1 回目に成功するパターン（N ≤ MAX_RETRIES）を生成して、修正後が成功することを検証

### Integration Tests

- 「内覧前日メール」テンプレートを選択してEmailボタンから送信する際に、`refreshAccessToken()` が1回目に失敗して2回目に成功する場合、メール送信が正常に完了すること
- `refreshAccessToken()` が全リトライで失敗する場合、HTTP 500 ではなく適切なエラーメッセージが返ること
- カレンダー送信など他のGoogle API機能が引き続き正常に動作すること
