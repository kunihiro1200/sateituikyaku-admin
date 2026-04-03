# 買主内覧前日メール送信エラー修正 設計書

## Overview

買主リストの内覧ページで「内覧前日Eメール」送信ボタンを押すと500エラーが発生する問題を修正します。根本原因は`GoogleAuthService`がGoogle Calendar用の環境変数（`GOOGLE_CALENDAR_CLIENT_ID`等）を使用しているが、Gmail送信には会社アカウントのリフレッシュトークンが必要であり、現在のアーキテクチャでは会社アカウントのトークンが`google_calendar_tokens`テーブルに保存されていない可能性があることです。

修正アプローチは、エラーログを詳細化して根本原因を特定し、環境変数の確認とエラーハンドリングの改善を行います。

## Glossary

- **Bug_Condition (C)**: `/api/gmail/send`エンドポイントへのPOSTリクエストが500エラーを返す条件
- **Property (P)**: メール送信が成功し、200 OKが返される状態
- **Preservation**: 他のメール送信機能（売主へのメール、物件配信メール）は影響を受けない
- **GoogleAuthService**: Google OAuth2認証を管理するサービス（`backend/src/services/GoogleAuthService.ts`）
- **EmailService**: Gmail APIを使用してメールを送信するサービス（`backend/src/services/EmailService.ts`）
- **google_calendar_tokens**: Google Calendar/Gmail用のOAuth2トークンを保存するテーブル
- **会社アカウント**: `tenant@ifoo-oita.com`（Gmail送信に使用されるアカウント）

## Bug Details

### Bug Condition

バグは、買主内覧前日メール送信時に以下の条件で発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HTTPRequest
  OUTPUT: boolean
  
  RETURN input.endpoint === '/api/gmail/send'
         AND input.method === 'POST'
         AND input.body.buyerId !== null
         AND input.body.subject !== null
         AND input.body.body !== null
         AND input.body.senderEmail !== null
         AND response.status === 500
         AND (
           googleAuthService.getAuthenticatedClient() throws Error
           OR gmail.users.messages.send() throws Error
         )
END FUNCTION
```

### Examples

- **例1**: 買主BB14の内覧前日メール送信
  - 入力: `POST /api/gmail/send { buyerId: 'BB14', subject: '内覧のご連絡', body: '...' }`
  - 期待: 200 OK、メール送信成功
  - 実際: 500エラー、`GoogleAuthService.getAuthenticatedClient()`で認証エラー

- **例2**: 会社アカウントのトークンが存在しない
  - 入力: `POST /api/gmail/send { ... }`
  - 期待: 200 OK
  - 実際: 500エラー、`google_calendar_tokens`テーブルに会社アカウント（`tenant@ifoo-oita.com`）のトークンが存在しない

- **例3**: OAuth2トークンの有効期限切れ
  - 入力: `POST /api/gmail/send { ... }`
  - 期待: 200 OK（トークンが自動更新される）
  - 実際: 500エラー、リフレッシュトークンが無効

- **エッジケース**: Gmail APIクォータ制限
  - 入力: 短時間に大量のメール送信リクエスト
  - 期待: 429エラー（レート制限）
  - 実際: 500エラー（クォータエラーが適切にハンドリングされていない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主へのメール送信（`/api/sellers/:id/send-valuation-email`）は引き続き正常に動作する
- 物件配信メール（`/api/property-listings/:propertyNumber/send-distribution-emails`）は引き続き正常に動作する
- 他の買主関連機能（買主リスト表示、買主詳細表示）は影響を受けない

**Scope:**
`/api/gmail/send`エンドポイント以外のAPIは完全に影響を受けません。これには以下が含まれます：
- 売主管理機能
- 物件管理機能
- カレンダー管理機能

## Hypothesized Root Cause

コードレビューとエラーログの分析に基づき、最も可能性の高い根本原因は以下の通りです：

1. **会社アカウントのトークンが存在しない**
   - `GoogleAuthService.getAuthenticatedClient()`は会社アカウント（`tenant@ifoo-oita.com`）のトークンを`google_calendar_tokens`テーブルから取得しようとする
   - しかし、会社アカウントのトークンが登録されていない可能性がある
   - `GoogleAuthService.initializeCompanyAccountId()`で会社アカウントIDを取得しているが、トークンが存在しない場合は`GOOGLE_AUTH_REQUIRED`エラーがスローされる

2. **OAuth2トークンの有効期限切れ**
   - リフレッシュトークンが無効化されている（ユーザーがGoogle側でアクセスを取り消した）
   - `oauth2Client.getAccessToken()`でトークン更新に失敗する
   - エラーメッセージ: `invalid_grant`または`Token has been expired or revoked`

3. **環境変数の設定ミス**
   - `GOOGLE_CALENDAR_CLIENT_ID`、`GOOGLE_CALENDAR_CLIENT_SECRET`、`GOOGLE_CALENDAR_REDIRECT_URI`が正しく設定されていない
   - `GoogleAuthService.initializeOAuthClient()`で警告が出力されるが、エラーとしてスローされない
   - その後、`getAuthenticatedClient()`を呼び出すと`Google Calendar API is not configured`エラーがスローされる

4. **Gmail APIのクォータ制限**
   - 1日あたりの送信制限（通常は500通/日）に達している
   - レート制限（1秒あたり5リクエスト）に達している
   - エラーメッセージ: `quotaExceeded`または`rateLimitExceeded`

## Correctness Properties

Property 1: Bug Condition - メール送信成功

_For any_ HTTPリクエストで、エンドポイントが`/api/gmail/send`、メソッドが`POST`、必須パラメータ（`buyerId`, `subject`, `body`）が全て存在し、会社アカウントのOAuth2トークンが有効な場合、修正後のシステムはメールを正常に送信し、HTTPステータスコード200を返すものとします。

**Validates: Requirements 2.1（メール送信成功）, 2.2（成功メッセージ表示）**

Property 2: Preservation - 他のメール送信機能

_For any_ HTTPリクエストで、エンドポイントが`/api/gmail/send`以外のメール送信エンドポイント（`/api/sellers/:id/send-valuation-email`、`/api/property-listings/:propertyNumber/send-distribution-emails`）の場合、修正後のシステムは修正前と全く同じ動作を行い、既存のメール送信機能を保持するものとします。

**Validates: Requirements 3.1（売主メール送信保持）, 3.2（物件配信メール保持）, 3.3（他機能への影響なし）**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の修正を実施します：

**Phase 1: エラーログの詳細化（優先度1）**

**File**: `backend/src/routes/gmail.ts`

**Function**: `POST /send`

**Specific Changes**:
1. **エラーログの追加**
   - `try-catch`ブロックで詳細なエラー情報をログ出力
   - エラーメッセージ、スタックトレース、リクエストパラメータを記録
   
   ```typescript
   } catch (error: any) {
     console.error('[gmail/send] 詳細エラー:', {
       buyerId,
       subject,
       bodyLength: bodyText?.length || 0,
       senderEmail,
       attachmentsCount: attachments?.length || 0,
       errorMessage: error.message,
       errorStack: error.stack,
       errorCode: error.code,
     });
     res.status(500).json({ 
       error: 'メール送信に失敗しました',
       details: process.env.NODE_ENV === 'development' ? error.message : undefined,
       code: 'EMAIL_SEND_ERROR',
     });
   }
   ```

**File**: `backend/src/services/EmailService.ts`

**Function**: `sendBuyerEmail()`

**Specific Changes**:
2. **エラーログの追加**
   - Gmail API呼び出しの前後でログ出力
   - 認証エラー、クォータエラー、エンコーディングエラーを区別
   
   ```typescript
   } catch (error: any) {
     console.error('[EmailService] sendBuyerEmail エラー:', {
       to: params.to,
       subject: params.subject,
       bodyLength: params.body?.length || 0,
       attachmentsCount: params.attachments?.length || 0,
       errorMessage: error.message,
       errorStack: error.stack,
       errorCode: error.code,
       errorDetails: error.response?.data,
     });
     return { messageId: '', success: false, error: error.message };
   }
   ```

**File**: `backend/src/services/GoogleAuthService.ts`

**Function**: `getAuthenticatedClient()`

**Specific Changes**:
3. **エラーログの追加**
   - 認証エラーの詳細をログ出力
   - 会社アカウントIDの確認
   - トークンの存在確認
   
   ```typescript
   } catch (error: any) {
     console.error('[GoogleAuthService] 認証エラー:', {
       companyAccountId: this.companyAccountId,
       errorMessage: error.message,
       errorStack: error.stack,
       errorCode: error.code,
     });
     
     // 認証エラーの場合は特別なエラーコードを返す
     if (
       error.message === 'GOOGLE_AUTH_REQUIRED' ||
       error.message?.includes('invalid_grant') ||
       error.message?.includes('Token has been expired or revoked')
     ) {
       throw new Error('GOOGLE_AUTH_REQUIRED');
     }
     
     throw error;
   }
   ```

4. **会社アカウントトークンの存在確認ログ**
   - `getAccessToken()`で会社アカウントのトークンを取得する前にログ出力
   
   ```typescript
   async getAccessToken(): Promise<string> {
     if (!this.oauth2Client) {
       throw new Error('Google Calendar API is not configured');
     }

     try {
       const accountId = await this.getCompanyAccountId();
       
       console.log('[GoogleAuthService] 会社アカウントトークン取得開始:', {
         companyAccountId: accountId,
       });

       // データベースから会社アカウントのリフレッシュトークンを取得
       const { data: tokenData, error } = await this.table(
         'google_calendar_tokens'
       )
         .select('*')
         .eq('employee_id', accountId)
         .single();

       if (error || !tokenData) {
         console.error('[GoogleAuthService] 会社アカウントトークンが見つかりません:', {
           companyAccountId: accountId,
           error: error?.message,
         });
         throw new Error('GOOGLE_AUTH_REQUIRED');
       }
       
       console.log('[GoogleAuthService] 会社アカウントトークン取得成功');
       
       // ... 以降の処理
     }
   }
   ```

**Phase 2: 環境変数の確認（優先度2）**

**File**: `backend/src/services/GoogleAuthService.ts`

**Function**: `initializeOAuthClient()`

**Specific Changes**:
5. **環境変数の確認ログを改善**
   - 現在の確認ログに加えて、環境変数の値の一部を表示（セキュリティのため最初の4文字のみ）
   
   ```typescript
   console.log('🔍 Google Calendar ENV Check:', {
     clientId: clientId ? `✓ Set (${clientId.substring(0, 4)}...)` : '✗ Missing',
     clientSecret: clientSecret ? `✓ Set (${clientSecret.substring(0, 4)}...)` : '✗ Missing',
     redirectUri: redirectUri ? `✓ Set (${redirectUri})` : '✗ Missing',
   });
   ```

**Phase 3: エラーハンドリングの改善（優先度3）**

**File**: `backend/src/routes/gmail.ts`

**Function**: `POST /send`

**Specific Changes**:
6. **エラーレスポンスの改善**
   - ユーザーに分かりやすいエラーメッセージを返す
   - エラーコードを追加（フロントエンドでエラー種別を判定できるようにする）
   
   ```typescript
   } catch (error: any) {
     console.error('[gmail/send] 詳細エラー:', { ... });
     
     // エラー種別に応じたレスポンス
     if (error.message === 'GOOGLE_AUTH_REQUIRED') {
       return res.status(401).json({ 
         error: 'Google認証が必要です。管理者に連絡してください。',
         code: 'GOOGLE_AUTH_REQUIRED',
       });
     }
     
     if (error.code === 'quotaExceeded' || error.code === 'rateLimitExceeded') {
       return res.status(429).json({ 
         error: 'Gmail APIの送信制限に達しました。しばらく待ってから再度お試しください。',
         code: 'QUOTA_EXCEEDED',
       });
     }
     
     res.status(500).json({ 
       error: 'メール送信に失敗しました',
       details: process.env.NODE_ENV === 'development' ? error.message : undefined,
       code: 'EMAIL_SEND_ERROR',
     });
   }
   ```

7. **タイムアウトエラーのハンドリング改善**
   - 現在の30秒タイムアウトは適切だが、エラーメッセージを改善
   
   ```typescript
   const sendWithTimeout = Promise.race([
     emailService.sendBuyerEmail({ ... }),
     new Promise<never>((_, reject) =>
       setTimeout(() => reject(new Error('メール送信がタイムアウトしました（30秒）。ネットワーク接続を確認してください。')), 30000)
     ),
   ]);
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現し、根本原因を特定します。次に、修正後のコードでバグが解消され、既存機能が保持されることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認または反証します。反証された場合は、再度仮説を立てます。

**Test Plan**: 買主内覧前日メール送信をシミュレートし、500エラーが発生することを確認します。修正前のコードで実行し、エラーログから根本原因を特定します。

**Test Cases**:
1. **会社アカウントトークン不在テスト**: `google_calendar_tokens`テーブルに会社アカウント（`tenant@ifoo-oita.com`）のトークンが存在しない状態でメール送信（修正前のコードで失敗）
2. **OAuth2トークン有効期限切れテスト**: リフレッシュトークンを無効化してメール送信（修正前のコードで失敗）
3. **環境変数未設定テスト**: `GOOGLE_CALENDAR_CLIENT_ID`を削除してメール送信（修正前のコードで失敗）
4. **Gmail APIクォータ制限テスト**: 短時間に大量のメール送信リクエストを送信（修正前のコードで失敗する可能性）

**Expected Counterexamples**:
- 500エラーが発生し、エラーログに`GOOGLE_AUTH_REQUIRED`、`invalid_grant`、または`Google Calendar API is not configured`が記録される
- 可能性のある原因: 会社アカウントトークン不在、OAuth2トークン有効期限切れ、環境変数未設定

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後のシステムが期待される動作を行うことを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sendBuyerEmail_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Plan**: 探索テストで見つかったバグ条件を満たす入力を使用し、修正後のコードでメール送信が成功することを確認します。

**Test Cases**:
1. **会社アカウントトークン登録後のテスト**: 会社アカウントのトークンを`google_calendar_tokens`テーブルに登録し、メール送信が成功することを確認
2. **OAuth2トークン更新テスト**: リフレッシュトークンを使用してアクセストークンが自動更新され、メール送信が成功することを確認
3. **環境変数設定後のテスト**: 環境変数を正しく設定し、メール送信が成功することを確認
4. **エラーログ確認テスト**: 修正後のコードでエラーが発生した場合、詳細なエラーログが出力されることを確認

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後のシステムが修正前と同じ動作を行うことを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sendEmail_original(input) = sendEmail_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを検出する
- バグ条件を満たさない全ての入力に対して、動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードで他のメール送信機能（売主メール、物件配信メール）が正常に動作することを確認し、修正後も同じ動作を行うことを検証するproperty-based testを作成します。

**Test Cases**:
1. **売主メール送信保持テスト**: `/api/sellers/:id/send-valuation-email`エンドポイントが修正前と同じ動作を行うことを確認
2. **物件配信メール保持テスト**: `/api/property-listings/:propertyNumber/send-distribution-emails`エンドポイントが修正前と同じ動作を行うことを確認
3. **他の買主機能保持テスト**: 買主リスト表示、買主詳細表示が修正前と同じ動作を行うことを確認

### Unit Tests

- Gmail送信エンドポイント（`/api/gmail/send`）の正常系テスト
- エラーケース（認証エラー、クォータエラー、タイムアウト）のテスト
- エラーログが正しく出力されることを確認するテスト

### Property-Based Tests

- ランダムな買主データを生成し、メール送信が成功することを検証
- ランダムなエラー条件を生成し、適切なエラーハンドリングが行われることを検証
- 他のメール送信機能が多くのシナリオで正常に動作することを検証

### Integration Tests

- 買主内覧前日メール送信の完全なフロー（ボタンクリック → モーダル表示 → メール送信 → 成功メッセージ表示）をテスト
- エラー発生時のユーザーへのフィードバック（エラーメッセージ表示）をテスト
- メール履歴とアクティビティログが正しく記録されることをテスト

---

**作成日**: 2026年4月3日  
**作成者**: Kiro AI  
**最終更新日**: 2026年4月3日
