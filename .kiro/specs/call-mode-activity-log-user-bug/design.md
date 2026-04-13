# 通話モードアクティビティログ・ユーザーバグ修正設計

## Overview

通話モードページ（売主・買主・物件リスト）でメール送信・SMS送信・電話発信などのアクションを実行すると、アクティビティログ・通話履歴に記録されるログインユーザーのイニシャルが全員間違っている。

根本原因は **`/api/employees/initials-by-email` エンドポイント内での `validateSession` 呼び出し** にある。このエンドポイントは `AuthService.validateSession()` を動的インポートして呼び出すが、`validateSession` はインメモリキャッシュ（5分TTL）を使用しており、Vercel サーバーレス環境では同一プロセス内のリクエスト間でキャッシュが共有される。その結果、**別ユーザーのキャッシュが返される可能性**がある。

また、フロントエンドの `CallModePage.tsx` では `myInitials` ステートを使用してイニシャルを管理しているが、このステートは `loadAllData()` 内でバックグラウンド並列処理として `/api/employees/initials-by-email` を呼び出して設定される。この呼び出しが失敗した場合や、キャッシュが古い場合に誤ったイニシャルが使用される。

修正方針：
1. `/api/employees/initials-by-email` エンドポイントで `validateSession` キャッシュをバイパスし、JWTトークンから直接ユーザーを特定する
2. `send-template-email` エンドポイントの `senderInitials` 解決ロジックを強化する
3. フロントエンドの `myInitials` 取得ロジックを `authStore` の `employee` オブジェクトと統合する

## Glossary

- **Bug_Condition (C)**: ログインユーザーAがアクションを実行したとき、アクティビティログ・通話履歴にユーザーAとは異なるイニシャルが記録される条件
- **Property (P)**: アクションを実行したログインユーザーの正しいイニシャルがログに記録されるべき動作
- **Preservation**: メール送信・SMS送信・電話機能自体、およびアクティビティログの内容（件名・テンプレート名など）は変更しない
- **validateSession**: `backend/src/services/AuthService.supabase.ts` の `AuthService.validateSession()` メソッド。JWTトークンを検証してemployeeオブジェクトを返す。インメモリキャッシュ（5分TTL）を使用
- **_sessionCache**: `AuthService.supabase.ts` のモジュールレベルで定義されたインメモリキャッシュ。キーはトークンの先頭32文字
- **initials-by-email**: `backend/src/routes/employees.ts` の `GET /api/employees/initials-by-email` エンドポイント。ログインユーザーのイニシャルを返す
- **myInitials**: `CallModePage.tsx` のステート。ログインユーザーのイニシャルを保持し、SMS送信・メール送信時の担当フィールド自動セットに使用
- **senderInitials**: `send-template-email` エンドポイントのリクエストボディパラメータ。フロントエンドから送信者イニシャルを渡す

## Bug Details

### Bug Condition

バグは以下の条件で発生する：

1. ユーザーAがログインしてアクションを実行する
2. `/api/employees/initials-by-email` エンドポイントが呼ばれる
3. エンドポイント内で `authService.validateSession(token)` が呼ばれる
4. `_sessionCache` にユーザーBのキャッシュが存在する場合、ユーザーBのemployeeオブジェクトが返される
5. ユーザーBのイニシャルがログに記録される

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest with Authorization header
  OUTPUT: boolean

  token := extractBearerToken(request.headers.authorization)
  cacheKey := token.substring(0, 32)
  cachedEmployee := _sessionCache.get(cacheKey)

  RETURN cachedEmployee IS NOT NULL
         AND cachedEmployee.email != getActualUserEmail(token)
         AND initialsRecordedInLog != getInitialsForEmail(getActualUserEmail(token))
END FUNCTION
```

### Examples

- ユーザー「yurine〜」がメール送信 → キャッシュにユーザー「U（裏〜）」のエントリが存在 → 「U」のイニシャルが記録される（期待: 「Y」）
- ユーザーAがSMS送信 → `initials-by-email` がキャッシュされた別ユーザーのemployeeを返す → 別ユーザーのイニシャルが記録される
- 全ユーザーで発生 → キャッシュキー（トークン先頭32文字）の衝突、またはVercelサーバーレスの同一インスタンス再利用による別ユーザーキャッシュの混入
- `send-template-email` で `req.employee.initials` が `undefined` → フォールバックロジックが `employeeUtils` → `StaffManagementService` の順で試みるが、いずれも誤ったユーザーを返す可能性がある

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- メール送信自体（Gmail API経由の送信）は正常に完了させる
- SMSアプリを正常に開く動作は変更しない
- 電話アプリを正常に起動させる動作は変更しない
- アクティビティログの内容（メール件名・テンプレート名・送信先メールアドレスなど）は正しく記録する
- employeesテーブルのデータ（initials、name、email）は変更しない
- DBにinitialsが存在する場合はDBの値を優先し、存在しない場合はスプレッドシートにフォールバックする既存の優先順位ロジックを維持する
- 各リストの既存機能（一覧表示・詳細表示・検索など）は正常に動作する
- 認証・セッション管理の動作は変更しない

**Scope:**
イニシャル解決ロジックのみを修正する。メール送信・SMS送信・電話機能のコアロジックには一切変更を加えない。

## Hypothesized Root Cause

コードベースの調査に基づき、以下の根本原因を特定した：

1. **`validateSession` インメモリキャッシュの問題（最有力）**
   - `AuthService.supabase.ts` の `_sessionCache` はモジュールレベルで定義されたインメモリキャッシュ
   - キーはトークンの先頭32文字（`accessToken.substring(0, 32)`）
   - Vercel サーバーレス環境では同一プロセスが複数リクエストを処理するため、異なるユーザーのトークンが同じ先頭32文字を持つ場合にキャッシュが混入する
   - `/api/employees/initials-by-email` エンドポイントは `authenticate` ミドルウェアを通過した後に `validateSession` を再度呼び出しており、この二重呼び出しが問題を引き起こす可能性がある

2. **`initials-by-email` エンドポイントの二重認証問題**
   - このエンドポイントは `router.use(authenticate)` の後に定義されているため、`authenticate` ミドルウェアで既に `req.employee` が設定されている
   - しかし、エンドポイント内で再度 `authService.validateSession(token)` を呼び出している（不要な二重呼び出し）
   - `req.employee` を直接使用すれば、キャッシュ問題を回避できる

3. **`send-template-email` の `req.employee.initials` が `undefined`**
   - `validateSession` が返す `employee` オブジェクトに `initials` カラムが含まれていない場合がある
   - `employees` テーブルの `initials` カラムが `NULL` のユーザーが存在する可能性
   - フォールバックロジックが複数あるが、いずれも誤ったユーザーを参照する可能性がある

4. **フロントエンドの `myInitials` ステートの初期化タイミング問題**
   - `myInitials` は `loadAllData()` のバックグラウンド並列処理で設定される
   - SMS送信・メール送信が `myInitials` の設定前に実行された場合、空文字列になる
   - その場合、`initials-by-email` エンドポイントへの再呼び出しが行われるが、キャッシュ問題により誤ったイニシャルが返される

## Correctness Properties

Property 1: Bug Condition - ログインユーザーの正しいイニシャルが記録される

_For any_ リクエストにおいて、JWTトークンで特定されたログインユーザーAがアクション（メール送信・SMS送信・電話発信）を実行した場合、修正後のシステムはアクティビティログ・通話履歴にユーザーAの正しいイニシャルを記録する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - 非イニシャル関連の動作は変更されない

_For any_ アクション（メール送信・SMS送信・電話発信）において、イニシャル解決ロジック以外の動作（メール送信の成否・SMS起動・電話起動・ログの内容・認証・セッション管理）は修正前後で同一の結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正：

**File 1**: `backend/src/routes/employees.ts`

**Function**: `GET /api/employees/initials-by-email`

**Specific Changes**:
1. **二重認証の排除**: エンドポイント内での `authService.validateSession(token)` 呼び出しを削除し、`authenticate` ミドルウェアが設定した `req.employee` を直接使用する
   - 変更前: `const employee = await authService.validateSession(token)` → `email = employee?.email`
   - 変更後: `email = req.employee?.email`
2. **不要なAuthorizationヘッダー解析の削除**: `authHeader` の解析ロジックを削除（`authenticate` ミドルウェアが既に処理済み）

**File 2**: `backend/src/routes/emails.ts`

**Function**: `POST /:sellerId/send-template-email`

**Specific Changes**:
1. **`senderInitials` 解決の強化**: `req.employee` から直接 `email` を取得し、DBから `initials` を検索する処理を最優先にする
   - `req.employee.email` を使用して `employees` テーブルから `initials` を直接取得
   - キャッシュを使用せず、常に最新のDBデータを参照する

**File 3**: `backend/src/services/AuthService.supabase.ts`（オプション）

**Function**: `validateSession`

**Specific Changes**:
1. **キャッシュキーの改善**: トークンの先頭32文字ではなく、トークン全体のハッシュをキャッシュキーとして使用する（衝突リスクの排除）
   - または、キャッシュTTLを短縮する（5分 → 1分）

**File 4**: `frontend/frontend/src/pages/CallModePage.tsx`（オプション）

**Function**: `handleSmsTemplateSelect`, `handleConfirmSend`

**Specific Changes**:
1. **`myInitials` の取得を `authStore.employee` と統合**: `employee?.initials` を最優先で使用し、`initials-by-email` エンドポイントへの呼び出しをフォールバックとして使用する
   - `authStore` の `employee` オブジェクトは `/auth/me` から取得されており、DBの最新データを含む

## Testing Strategy

### Validation Approach

テスト戦略は二段階アプローチを採用する：まず修正前のコードでバグを再現するテストを作成し（探索的バグ条件チェック）、次に修正後のコードで正しい動作を検証する（修正チェック・保存チェック）。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は根本原因を再仮説する。

**Test Plan**: ユーザーAとユーザーBのJWTトークンをシミュレートし、`validateSession` キャッシュに別ユーザーのエントリが存在する状態で `/api/employees/initials-by-email` を呼び出す。修正前のコードでは誤ったイニシャルが返されることを確認する。

**Test Cases**:
1. **キャッシュ混入テスト**: ユーザーBのキャッシュが存在する状態でユーザーAのトークンで `initials-by-email` を呼び出す（修正前のコードで失敗するはず）
2. **二重認証テスト**: `authenticate` ミドルウェアが設定した `req.employee` と、エンドポイント内の `validateSession` が返す `employee` が異なることを確認する
3. **`send-template-email` イニシャルテスト**: `req.employee.initials` が `undefined` の場合に誤ったイニシャルが使用されることを確認する
4. **フロントエンド `myInitials` タイミングテスト**: `myInitials` が設定前に SMS 送信が実行された場合の動作を確認する

**Expected Counterexamples**:
- `initials-by-email` が別ユーザーのイニシャルを返す
- 原因: `validateSession` キャッシュキーの衝突、または同一プロセスでの別ユーザーキャッシュの混入

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := initialsEndpoint_fixed(request)
  ASSERT result.initials == getCorrectInitialsForToken(request.token)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT emailSend_original(request) == emailSend_fixed(request)
  ASSERT smsSend_original(request) == smsSend_fixed(request)
  ASSERT activityLogContent_original(request) == activityLogContent_fixed(request)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多数のユーザー・トークンの組み合わせを自動生成できる
- キャッシュ状態のエッジケースを網羅できる
- 修正前後の動作が一致することを強力に保証できる

**Test Plan**: 修正前のコードでメール送信・SMS送信の動作を観察し、その動作を保存するプロパティベーステストを作成する。

**Test Cases**:
1. **メール送信保存テスト**: メール送信自体（Gmail API呼び出し）が修正前後で同じ動作をすることを確認する
2. **SMS起動保存テスト**: SMSアプリ起動のURLが修正前後で同じであることを確認する
3. **アクティビティログ内容保存テスト**: ログの内容（件名・テンプレート名・送信先）が修正前後で同じであることを確認する
4. **認証動作保存テスト**: `authenticate` ミドルウェアの動作が修正前後で変わらないことを確認する

### Unit Tests

- `initials-by-email` エンドポイントが `req.employee.email` を使用してDBからイニシャルを取得することをテスト
- `send-template-email` エンドポイントが正しいユーザーのイニシャルを解決することをテスト
- `validateSession` キャッシュキーの衝突が発生しないことをテスト
- フロントエンドの `myInitials` が `authStore.employee.initials` から正しく初期化されることをテスト

### Property-Based Tests

- ランダムなユーザー・トークンの組み合わせを生成し、`initials-by-email` が常に正しいユーザーのイニシャルを返すことを検証する
- ランダムなキャッシュ状態を生成し、キャッシュ混入が発生しないことを検証する
- 複数ユーザーが並列でアクションを実行した場合に、各ユーザーのイニシャルが正しく記録されることを検証する

### Integration Tests

- ユーザーAとユーザーBが交互にメール送信を実行し、それぞれのイニシャルが正しく記録されることを確認する
- 売主・買主・物件リストの各通話モードページでアクションを実行し、イニシャルが正しく記録されることを確認する
- `send-template-email` → アクティビティログ記録 → ログ表示の一連のフローをテストする
