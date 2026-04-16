# buyer-gmail-send-account-bug Bugfix Design

## Overview

買主詳細画面のGmail送信機能において、yurine~アカウントからメール送信すると「送信できませんでした」エラーが発生するバグの修正設計。

根本原因の仮説：`backend/src/routes/gmail.ts`が`EmailService.ts`の`sendBuyerEmail`を呼び出す際、フロントエンドから渡される`senderEmail`（yurine~のメールアドレス）をGmail APIの**Fromヘッダー**に設定しているが、実際の**送信認証**は常に会社アカウント（tenant@ifoo-oita.com）の`google_calendar_tokens`テーブルのトークンを使用している。Gmail APIは「認証アカウントと異なるFromアドレスでの送信」を許可しない（Send As設定がない場合）ため、yurine~のメールアドレスをFromに設定するとエラーが発生する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 - yurine~アカウントでログインした状態でGmail送信を実行し、senderEmailにyurine~のメールアドレスが設定される
- **Property (P)**: 期待される動作 - Gmail APIを通じてメールが正常に送信される
- **Preservation**: 修正によって変更してはいけない既存の動作 - tomoko~アカウントからの送信、送信履歴の記録
- **sendBuyerEmail**: `backend/src/services/EmailService.ts`の関数。Gmail APIを使ってメールを送信する
- **getAuthenticatedClient**: `backend/src/services/GoogleAuthService.ts`の関数。`google_calendar_tokens`テーブルから会社アカウントのOAuthトークンを取得して認証済みクライアントを返す
- **senderEmail**: フロントエンドから送信される送信者メールアドレス。現在はGmailのFromヘッダーに設定されるが、認証には使われない
- **google_calendar_tokens**: 各従業員のGoogleOAuthリフレッシュトークンを保存するテーブル

## Bug Details

### Bug Condition

バグはyurine~アカウントでログインした状態でGmail送信ボタンを押下したときに発生する。`BuyerGmailSendButton`コンポーネントが`employee.email`（yurine~のメールアドレス）を`senderEmail`として`/api/gmail/send`に送信し、バックエンドがそのアドレスをGmailの`From`ヘッダーに設定するが、実際の送信認証は会社アカウントのトークンを使用するため、Gmail APIが「Send As」権限エラーを返す。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { senderEmail: string, employeeEmail: string }
  OUTPUT: boolean

  RETURN input.senderEmail IS NOT NULL
         AND input.senderEmail != 'tenant@ifoo-oita.com'
         AND input.senderEmail != companyAccountEmail
         AND NOT hasSendAsPermission(input.senderEmail, companyGmailAccount)
END FUNCTION
```

### Examples

- **例1（バグ発生）**: yurine~アカウントでログイン → Gmail送信ボタン押下 → senderEmail = 'yurine@ifoo-oita.com' → Fromヘッダーに設定 → Gmail APIが「Send As権限なし」エラー → 「送信できませんでした」表示
- **例2（正常動作）**: tomoko~アカウントでログイン → Gmail送信ボタン押下 → senderEmail = 'tenant@ifoo-oita.com'（会社アカウントと一致）→ Fromヘッダーに設定 → Gmail API送信成功
- **例3（バグ発生）**: 会社アカウント以外の任意のアカウントでログイン → senderEmailが会社アカウントと異なる → エラー発生
- **エッジケース**: senderEmailが未設定の場合 → フォールバックで 'tenant@ifoo-oita.com' が使用される → 送信成功

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- tomoko~アカウント（tenant@ifoo-oita.com）からのGmail送信は引き続き正常に動作する
- 送信成功後にemail_historyテーブルへの履歴記録が正しく行われる
- 送信成功後にactivity_logsテーブルへのログ記録が正しく行われる
- 買主詳細画面のGmail送信以外の操作（情報閲覧・編集など）は影響を受けない

**Scope:**
senderEmailが会社アカウントのメールアドレスと一致する場合（tomoko~など）は、修正によって動作が変わってはいけない。また、Gmail送信機能以外のすべての機能は完全に影響を受けない。

## Hypothesized Root Cause

コードの調査から、以下の根本原因が特定された：

1. **senderEmailがFromヘッダーに設定される問題**: `EmailService.ts`の`sendBuyerEmail`は`params.from`（= senderEmail）をGmailの`From`ヘッダーに設定する。Gmail APIは認証アカウント以外のアドレスをFromに設定することを、Send As設定がない限り許可しない。

2. **認証は常に会社アカウント固定**: `getAuthenticatedClient()`は`google_calendar_tokens`テーブルから会社アカウント（tenant@ifoo-oita.com）のトークンのみを取得する。yurine~のトークンは使用されない。

3. **tomoko~が成功する理由**: tomoko~のメールアドレスが会社アカウント（tenant@ifoo-oita.com）と一致するか、またはGmail APIがそのアドレスのSend As権限を持っているため成功する可能性がある。

4. **フロントエンドのsenderEmail設定**: `BuyerGmailSendButton.tsx`は`employee.email`を`senderEmail`として送信する。これはログインアカウントによって異なる値になる。

## Correctness Properties

Property 1: Bug Condition - senderEmailに関わらずGmail送信が成功する

_For any_ ログインアカウントのメールアドレス（senderEmail）が会社アカウントと異なる場合でも、固定された修正後の`sendBuyerEmail`関数は、Gmail APIの認証アカウントと一致するFromアドレスを使用してメールを正常に送信する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の送信動作が維持される

_For any_ senderEmailが会社アカウントのメールアドレスと一致する入力（tomoko~など）に対して、修正後のコードは修正前と同じ動作（送信成功・履歴記録）を維持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の修正が必要：

**File**: `backend/src/services/EmailService.ts`

**Function**: `sendBuyerEmail`

**Specific Changes**:
1. **Fromアドレスの修正**: `params.from`（senderEmail）をGmailの`From`ヘッダーに設定するのをやめ、常に会社アカウントのメールアドレス（`tenant@ifoo-oita.com`）を使用する。または、`Reply-To`ヘッダーにsenderEmailを設定して、返信先として機能させる。

2. **Reply-Toヘッダーの追加（推奨）**: senderEmailを`Reply-To`ヘッダーに設定することで、受信者が返信する際にyurine~のアドレスに返信できるようにする。これにより送信者情報を保持しつつ、認証エラーを回避できる。

**File**: `backend/src/routes/gmail.ts`

**Specific Changes**:
3. **senderEmailの扱いの変更**: `emailService.sendBuyerEmail`に渡す`from`パラメータを会社アカウントのメールアドレスに固定し、`senderEmail`は`replyTo`として渡す。

**代替案（より根本的な修正）**:
4. **アカウント別トークン使用**: 各従業員のGoogleトークンを`google_calendar_tokens`テーブルに保存し、`getAuthenticatedClientForEmployee(employeeId)`を使用してログインアカウントのトークンで送信する。ただし、各従業員がGoogle OAuth認証を完了している必要がある。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ：まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードで正常動作と既存動作の保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因（senderEmailがFromヘッダーに設定されることによるGmail API認証エラー）を確認する。

**Test Plan**: `sendBuyerEmail`に会社アカウント以外のメールアドレスを`from`として渡した場合にエラーが発生することを確認する。未修正コードで実行してエラーを観察する。

**Test Cases**:
1. **yurine~アカウントでの送信テスト**: senderEmail = 'yurine@ifoo-oita.com' でGmail送信を実行 → エラーが発生することを確認（未修正コードで失敗）
2. **会社アカウント以外での送信テスト**: 任意の非会社アカウントメールアドレスをFromに設定 → Gmail APIエラーを確認
3. **tomoko~アカウントでの送信テスト**: senderEmail = 'tenant@ifoo-oita.com' で送信 → 成功することを確認（バグ条件に該当しない）
4. **senderEmail未設定テスト**: senderEmailなしで送信 → フォールバックで成功することを確認

**Expected Counterexamples**:
- yurine~のメールアドレスをFromに設定した場合、Gmail APIが「Sender not allowed」または「insufficientPermissions」エラーを返す
- 可能性のある原因: Gmail APIのSend As権限なし、認証アカウントとFromアドレスの不一致

### Fix Checking

**Goal**: 修正後のコードで、senderEmailに関わらずGmail送信が成功することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sendBuyerEmail_fixed(input)
  ASSERT result.success = true
  ASSERT result.error IS NULL
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、会社アカウント（tomoko~）からの送信が引き続き成功することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sendBuyerEmail_original(input) = sendBuyerEmail_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- 様々なsenderEmailの値に対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正後も既存動作が保全されることを強く保証できる

**Test Plan**: 未修正コードでtomoko~アカウントからの送信動作を観察し、修正後も同じ動作が維持されることをテストで確認する。

**Test Cases**:
1. **tomoko~アカウント保全テスト**: 修正前後でtomoko~からの送信が成功することを確認
2. **送信履歴記録保全テスト**: 送信成功後にemail_historyが正しく記録されることを確認
3. **activity_log記録保全テスト**: 送信成功後にactivity_logsが正しく記録されることを確認
4. **Reply-Toヘッダーテスト**: 修正後、senderEmailがReply-Toヘッダーに正しく設定されることを確認

### Unit Tests

- `sendBuyerEmail`に異なるsenderEmailを渡した場合のFromヘッダーの値を確認
- `sendBuyerEmail`にyurine~のメールアドレスを渡した場合に送信が成功することを確認
- Reply-Toヘッダーが正しく設定されることを確認

### Property-Based Tests

- ランダムなメールアドレスをsenderEmailとして渡した場合でも送信が成功することを確認
- 任意のsenderEmailに対してFromヘッダーが常に会社アカウントのアドレスであることを確認
- 任意の有効な入力に対して送信履歴が正しく記録されることを確認

### Integration Tests

- yurine~アカウントでログインした状態でGmail送信ボタンを押下し、送信が成功することを確認
- tomoko~アカウントでログインした状態でGmail送信ボタンを押下し、引き続き成功することを確認
- 送信後に買主詳細画面の送信履歴に正しく表示されることを確認
