# サイドバーカテゴリ表示バグ修正設計

## Overview

売主リストのサイドバーで「専任」「一般」「未訪問他決」「訪問後他決」の4つのカテゴリが表示されない問題を修正します。根本原因は`/api/sellers/sidebar-counts`エンドポイントが401エラー（認証エラー）を返していることです。

`backend/src/routes/sellers.ts`では`/sidebar-counts`エンドポイントを認証ミドルウェアの前に定義していますが、`backend/src/index.ts`で複数のルーターが同じ`/api/sellers`パスに登録されており、その中のいずれかが認証ミドルウェアを先に適用している可能性があります。

## Glossary

- **Bug_Condition (C)**: `/api/sellers/sidebar-counts`エンドポイントへのリクエストが401エラーを返す条件
- **Property (P)**: `/api/sellers/sidebar-counts`エンドポイントが認証なしで200 OKレスポンスを返し、全カテゴリのカウントが含まれる
- **Preservation**: 他の認証が必要なエンドポイントは引き続き認証を要求し、他のサイドバーカテゴリ（訪問日前日、当日TEL分など）は正常に表示される
- **sellerRoutes**: `backend/src/routes/sellers.ts`で定義されたルーター（`/sidebar-counts`エンドポイントを含む）
- **sellersManagementRoutes**: `backend/src/routes/sellersManagement.ts`で定義されたルーター
- **valuationRoutes**: `backend/src/routes/valuation.ts`で定義されたルーター
- **emailRoutes**: `backend/src/routes/email.ts`で定義されたルーター
- **followUpRoutes**: `backend/src/routes/followUp.ts`で定義されたルーター
- **sellerRecoveryRoutes**: `backend/src/routes/sellerRecovery.ts`で定義されたルーター

## Bug Details

### Bug Condition

バグは、ユーザーが売主一覧ページ（/sellers）を開き、フロントエンドが`/api/sellers/sidebar-counts`エンドポイントにリクエストを送信したときに発生します。エンドポイントは401エラーを返し、サイドバーに「専任」「一般」「未訪問他決」「訪問後他決」の4つのカテゴリが表示されません。

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  RETURN request.url = '/api/sellers/sidebar-counts'
         AND request.method = 'GET'
         AND response.status = 401
         AND sidebarCategories NOT includes ['専任', '一般', '未訪問他決', '訪問後他決']
END FUNCTION
```

### Examples

- **例1**: ユーザーが売主一覧ページを開く → ブラウザコンソールに「GET /api/sellers/sidebar-counts 401 (Unauthorized)」エラーが表示される → サイドバーに「専任」「一般」「未訪問他決」「訪問後他決」が表示されない
- **例2**: データベースに専任媒介の売主が存在する → サイドバーに「専任」カテゴリが表示されない（カウントも0）
- **例3**: 他のカテゴリ（訪問日前日、当日TEL分など）は正常に表示される → 4つのカテゴリのみが表示されない
- **エッジケース**: 認証トークンを含むリクエストを送信した場合 → 200 OKレスポンスが返され、4つのカテゴリが正しく表示される（期待される動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他の認証が必要なエンドポイント（`POST /api/sellers`, `PUT /api/sellers/:id`など）は引き続き認証を要求する
- 他のサイドバーカテゴリ（訪問日前日、当日TEL分など）は正常に表示される
- サイドバーのカウントロジック（`getSidebarCountsFallback()`）は変更されない

**Scope:**
`/api/sellers/sidebar-counts`エンドポイント以外の全てのエンドポイントは、この修正の影響を受けません。これには以下が含まれます：
- 認証が必要な売主管理エンドポイント（作成、更新、削除）
- 他の認証不要のエンドポイント（`/api/buyers/sidebar-counts`など）
- フロントエンドのAPIクライアント

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い問題は以下の通りです：

1. **ルーター登録順序の問題**: `backend/src/index.ts`で複数のルーターが同じ`/api/sellers`パスに登録されており、その中のいずれかが認証ミドルウェアを先に適用している
   - `app.use('/api/sellers', sellerRoutes)` - `/sidebar-counts`を含む
   - `app.use('/api/sellers', sellersManagementRoutes)` - 認証ミドルウェアを含む可能性
   - `app.use('/api/sellers', valuationRoutes)` - 認証ミドルウェアを含む可能性
   - `app.use('/api/sellers', emailRoutes)` - 認証ミドルウェアを含む可能性
   - `app.use('/api/sellers', followUpRoutes)` - 認証ミドルウェアを含む可能性
   - `app.use('/api/sellers', sellerRecoveryRoutes)` - 認証ミドルウェアを含む可能性

2. **他のルーターでの認証ミドルウェアの早期適用**: いずれかのルーターが`router.use(authenticate)`を先頭で呼び出している場合、そのルーターに登録された全てのエンドポイントが認証を要求する

3. **ルーター内での定義順序の問題**: `sellers.ts`内で`/sidebar-counts`エンドポイントが`router.use(authenticate)`の後に定義されている（現在のコードでは正しく配置されているが、最近の変更で順序が変わった可能性）

4. **Expressのルーティングマッチング**: 複数のルーターが同じパスに登録されている場合、Expressは登録順にマッチングを試みる。最初にマッチしたルーターが認証を要求する場合、後続のルーターは実行されない

## Correctness Properties

Property 1: Bug Condition - サイドバーカウントエンドポイントの認証不要化

_For any_ HTTPリクエストで`/api/sellers/sidebar-counts`エンドポイントにGETリクエストが送信された場合、修正後のシステムSHALL認証なしで200 OKレスポンスを返し、全カテゴリ（専任、一般、未訪問他決、訪問後他決を含む）のカウントを含むJSONレスポンスを返す。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他のエンドポイントの認証要求

_For any_ HTTPリクエストで`/api/sellers/sidebar-counts`以外のエンドポイント（`POST /api/sellers`, `PUT /api/sellers/:id`など）にリクエストが送信された場合、修正後のシステムSHALL元のシステムと同じ認証動作を保持し、認証が必要なエンドポイントは引き続き認証を要求する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `backend/src/index.ts`

**Function**: ルーター登録部分（387-413行目付近）

**Specific Changes**:
1. **ルーター登録順序の変更**: `/sidebar-counts`エンドポイントを含む`sellerRoutes`を最初に登録し、他のルーターを後に登録する
   - 現在: `app.use('/api/sellers', sellerRoutes)` → `app.use('/api/sellers', sellersManagementRoutes)` → ...
   - 修正後: `app.use('/api/sellers', sellerRoutes)` を最初に配置し、`/sidebar-counts`が最初にマッチするようにする

2. **他のルーターの認証ミドルウェア配置を確認**: `sellersManagementRoutes`, `valuationRoutes`, `emailRoutes`, `followUpRoutes`, `sellerRecoveryRoutes`の各ルーターで`router.use(authenticate)`が先頭で呼び出されていないか確認
   - 先頭で呼び出されている場合、認証不要のエンドポイントの後に移動する

3. **`sellers.ts`の定義順序を再確認**: `/sidebar-counts`エンドポイントが`router.use(authenticate)`の前に定義されていることを確認（現在は正しく配置されている）

4. **Expressのルーティングマッチングを考慮**: 複数のルーターが同じパスに登録されている場合、最初にマッチしたルーターが実行される。`/sidebar-counts`が最初にマッチするように、`sellerRoutes`を最初に登録する

5. **代替案（より安全）**: `/sidebar-counts`エンドポイントを別のルーターに分離し、`/api/sellers-public/sidebar-counts`のような別のパスに登録する
   - これにより、他のルーターの影響を完全に回避できる
   - ただし、フロントエンドのAPIクライアントも変更が必要

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正のコードでバグを再現し、根本原因分析を確認または反証します。次に、修正が正しく機能し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正のコードでバグを再現します。根本原因分析を確認または反証します。反証した場合、再仮説を立てる必要があります。

**Test Plan**: 各ルーターの認証ミドルウェア配置を確認し、`/api/sellers/sidebar-counts`エンドポイントにリクエストを送信してレスポンスを観察するテストを作成します。未修正のコードでテストを実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **ルーター登録順序の確認**: `backend/src/index.ts`で`/api/sellers`に登録されている全てのルーターを確認し、登録順序を記録する（未修正のコードで失敗）
2. **各ルーターの認証ミドルウェア配置の確認**: `sellersManagementRoutes`, `valuationRoutes`, `emailRoutes`, `followUpRoutes`, `sellerRecoveryRoutes`の各ルーターで`router.use(authenticate)`の配置を確認する（未修正のコードで失敗）
3. **`/sidebar-counts`エンドポイントへのリクエスト**: 認証トークンなしで`GET /api/sellers/sidebar-counts`リクエストを送信し、401エラーが返されることを確認する（未修正のコードで失敗）
4. **認証トークン付きリクエスト**: 認証トークンを含む`GET /api/sellers/sidebar-counts`リクエストを送信し、200 OKレスポンスが返されることを確認する（未修正のコードで成功する可能性）

**Expected Counterexamples**:
- `/api/sellers/sidebar-counts`エンドポイントが401エラーを返す
- 可能性のある原因: ルーター登録順序の問題、他のルーターでの認証ミドルウェアの早期適用、Expressのルーティングマッチング

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := handleRequest_fixed(request)
  ASSERT response.status = 200
  ASSERT response.body includes ['専任', '一般', '未訪問他決', '訪問後他決']
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT handleRequest_original(request) = handleRequest_fixed(request)
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず未修正のコードで他のエンドポイント（`POST /api/sellers`, `PUT /api/sellers/:id`など）の動作を観察し、その動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **認証が必要なエンドポイントの保存**: 認証トークンなしで`POST /api/sellers`リクエストを送信し、401エラーが返されることを確認する
2. **他の認証不要のエンドポイントの保存**: 認証トークンなしで`GET /api/buyers/sidebar-counts`リクエストを送信し、200 OKレスポンスが返されることを確認する
3. **サイドバーカウントロジックの保存**: 修正後も`getSidebarCountsFallback()`が同じ結果を返すことを確認する
4. **フロントエンドAPIクライアントの保存**: フロントエンドの`api.get('/api/sellers/sidebar-counts')`が修正後も正しく動作することを確認する

### Unit Tests

- ルーター登録順序のテスト（`/api/sellers`に登録されている全てのルーターの順序を確認）
- 各ルーターの認証ミドルウェア配置のテスト（`router.use(authenticate)`の配置を確認）
- `/sidebar-counts`エンドポイントへのリクエストテスト（認証なしで200 OKレスポンスが返されることを確認）
- 認証が必要なエンドポイントへのリクエストテスト（認証なしで401エラーが返されることを確認）

### Property-Based Tests

- ランダムなHTTPリクエストを生成し、`/sidebar-counts`エンドポイントが認証なしで正しく動作することを検証
- ランダムな認証が必要なエンドポイントを生成し、認証なしで401エラーが返されることを検証
- 多くのシナリオで他のエンドポイントの動作が変更されていないことをテスト

### Integration Tests

- 売主一覧ページの完全なフローをテスト（ページを開く → サイドバーカウントを取得 → 4つのカテゴリが表示される）
- 認証が必要なエンドポイントの完全なフローをテスト（ログイン → 売主を作成 → 売主を更新）
- 他のサイドバーカテゴリ（訪問日前日、当日TEL分など）が正常に表示されることをテスト
