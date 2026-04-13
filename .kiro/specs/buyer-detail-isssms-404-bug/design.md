# 買主詳細画面 isSms未定義・404バグ修正 デザインドキュメント

## Overview

買主詳細画面（BuyerDetailPage）で通話履歴を持つ買主（例：買主番号7359）をクリックすると、2つのバグが同時に発生してエラー画面が表示される。

**バグ1**: `frontend/frontend/src/pages/BuyerDetailPage.tsx` の1550行目で `isSms` 変数が未定義のまま参照されるJavaScriptエラー。通話履歴セクション（`action === 'call'`）内では `isSms` は定義されておらず、メール・SMS履歴セクション（1604行目）でのみ定義されている。

**バグ2**: `backend/src/routes/buyers.ts` の682行目、`/:id/related` エンドポイントで `getByBuyerNumber(id)` が `deleted_at IS NULL` でフィルタするため、論理削除済み買主の場合にnullが返り404になる。

修正方針は最小限の変更で両バグを解消する：
- バグ1: `const hasBody = !isSms && !!metadata.body` → `const hasBody = !!metadata.body`（通話履歴セクションでは `isSms` は常に `false` のため等価）
- バグ2: `getByBuyerNumber(id)` → `getByBuyerNumber(id, true)`（削除済みも含めて検索）

## Glossary

- **Bug_Condition (C)**: バグを引き起こす入力条件
  - C1: 通話履歴（`action === 'call'` または `action === 'phone_call'`）が存在する買主の詳細画面を開く
  - C2: 論理削除済み（`deleted_at IS NOT NULL`）の買主番号で `/:id/related` エンドポイントを呼び出す
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作
- **Preservation**: 修正によって変更してはならない既存の動作
- **isSms**: `activity.action === 'sms'` の場合に `true` となるフラグ。メール・SMS履歴セクションで定義される
- **includeDeleted**: `getByBuyerNumber` の第2引数。`true` の場合、`deleted_at IS NOT NULL` の買主も取得対象に含める
- **fetchRelatedBuyersCount**: フロントエンドが `/:id/related` エンドポイントを呼び出して関連買主数を取得する関数

## Bug Details

### Bug Condition

**バグ1（isSms未定義）**: 通話履歴セクションのレンダリング中に `isSms` 変数が未定義のまま参照される。`isSms` はメール・SMS履歴セクションのスコープ内でのみ定義されており、通話履歴セクションのスコープには存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition_1(activity)
  INPUT: activity of type ActivityLog
  OUTPUT: boolean

  RETURN (activity.action === 'call' OR activity.action === 'phone_call')
         AND renderingCallHistorySection = true
         AND isSms_variable_is_not_defined_in_scope = true
END FUNCTION

FUNCTION isBugCondition_2(request)
  INPUT: request of type HTTP GET /:id/related
  OUTPUT: boolean

  RETURN isUUID(request.params.id) = false
         AND buyer.deleted_at IS NOT NULL
         AND getByBuyerNumber(id, includeDeleted=false) returns null
END FUNCTION
```

### Examples

**バグ1の例:**
- 買主番号7359（通話履歴あり）の詳細画面を開く → `isSms is not defined` エラーで画面クラッシュ
- 通話履歴が1件でも存在する買主の詳細画面を開く → 同様にクラッシュ
- 通話履歴が存在しない買主の詳細画面を開く → 正常表示（バグ条件不成立）

**バグ2の例:**
- 論理削除済み買主番号で詳細画面にアクセス → `fetchRelatedBuyersCount` が404を受け取りエラー
- アクティブな買主番号で詳細画面にアクセス → 正常に200を返す（バグ条件不成立）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- メール・SMS送信履歴セクションの `isSms` 変数は引き続き正しく定義・参照される
- 通話履歴が存在しない買主の詳細画面は引き続き正常に表示される
- アクティブな（論理削除されていない）買主番号での `/:id/related` エンドポイントは引き続き正常に動作する
- 通話履歴セクションで `metadata.body` が存在する場合、クリックでメール本文モーダルが開く動作が維持される
- 関連買主が存在する買主の詳細画面で `RelatedBuyerNotificationBadge` に正しい件数が表示される

**スコープ:**
バグ条件（C1, C2）が成立しない全ての入力は、この修正によって完全に影響を受けない。具体的には：
- 通話履歴が存在しない買主の詳細画面表示
- メール・SMS履歴セクションのレンダリング
- アクティブな買主番号での全APIエンドポイント
- マウスクリックやその他のUI操作

## Hypothesized Root Cause

**バグ1の根本原因:**

`isSms` 変数は `activities.filter(a => a.action === 'email' || a.action === 'sms').map(...)` のコールバック内（1604行目）でのみ定義されている。一方、通話履歴セクションの `activities.filter(a => a.action === 'call' || a.action === 'phone_call').map(...)` のコールバック内（1550行目）では定義されていない。

通話履歴セクションでは `isSms` は常に `false`（通話は SMS ではない）であるため、`!isSms && !!metadata.body` は `!!metadata.body` と等価。変数参照を削除することで修正できる。

**バグ2の根本原因:**

`BuyerService.getByBuyerNumber()` はデフォルト引数 `includeDeleted = false` を持ち、`deleted_at IS NULL` フィルタを適用する。`/:id/related` エンドポイントでは `getByBuyerNumber(id)` と呼び出しており、論理削除済み買主の場合にnullが返る。

他のエンドポイント（例: 1118行目）では既に `getByBuyerNumber(id, true)` を使用しており、同様の修正が必要。

## Correctness Properties

Property 1: Bug Condition - 通話履歴セクションが正常にレンダリングされる

_For any_ 通話履歴（`action === 'call'` または `action === 'phone_call'`）が存在する買主の詳細画面において、修正後の `BuyerDetailPage` は `isSms is not defined` エラーを発生させることなく通話履歴セクションを正常にレンダリングし、`hasBody` が `!!metadata.body` の評価結果と一致する SHALL。

**Validates: Requirements 2.1, 3.4**

Property 2: Bug Condition - 論理削除済み買主の/:id/relatedが200を返す

_For any_ 論理削除済み（`deleted_at IS NOT NULL`）の買主番号で `/:id/related` エンドポイントを呼び出した場合、修正後のエンドポイントは404ではなく200を返し、関連買主数を正常に返却する SHALL。

**Validates: Requirements 2.2, 3.5**

Property 3: Preservation - メール・SMS履歴セクションのisSms動作が維持される

_For any_ メール・SMS履歴（`action === 'email'` または `action === 'sms'`）が存在する買主の詳細画面において、修正後のコードは修正前と同一の `isSms` 評価結果を返し、SMS履歴とメール履歴の区別表示が変わらない SHALL。

**Validates: Requirements 3.1**

Property 4: Preservation - アクティブな買主の/:id/relatedが引き続き正常動作する

_For any_ アクティブな（`deleted_at IS NULL`）買主番号で `/:id/related` エンドポイントを呼び出した場合、修正後のエンドポイントは修正前と同一のレスポンスを返す SHALL。

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

**修正1:**

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Line**: 1550

**変更内容:**
```typescript
// 修正前
const hasBody = !isSms && !!metadata.body;

// 修正後
const hasBody = !!metadata.body;
```

**理由**: 通話履歴セクション（`action === 'call'` または `action === 'phone_call'`）では `isSms` は常に `false` であるため、`!isSms` は常に `true`。`!isSms && !!metadata.body` は `!!metadata.body` と等価。`isSms` 変数はこのスコープに存在しないため、参照を削除する。

---

**修正2:**

**File**: `backend/src/routes/buyers.ts`

**Line**: 682

**変更内容:**
```typescript
// 修正前
const buyer = await buyerService.getByBuyerNumber(id);

// 修正後
const buyer = await buyerService.getByBuyerNumber(id, true);
```

**理由**: `/:id/related` エンドポイントは論理削除済み買主の詳細画面からも呼び出される。`includeDeleted = true` を渡すことで、`deleted_at IS NOT NULL` の買主も取得対象に含め、404エラーを防ぐ。`BuyerService.getByBuyerNumber()` は既に `includeDeleted` 引数をサポートしており（デフォルト `false`）、他のエンドポイント（1118行目）でも同様のパターンが使用されている。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず修正前のコードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: 通話履歴を持つ買主の詳細画面レンダリングをシミュレートし、`isSms is not defined` エラーが発生することを確認する。また、論理削除済み買主番号で `/:id/related` を呼び出し、404が返ることを確認する。

**Test Cases**:
1. **通話履歴レンダリングテスト**: `action === 'call'` のアクティビティを含む買主データでコンポーネントをレンダリング → `isSms is not defined` エラーが発生することを確認（修正前コードで失敗）
2. **phone_callレンダリングテスト**: `action === 'phone_call'` のアクティビティを含む買主データでコンポーネントをレンダリング → 同様のエラーが発生することを確認（修正前コードで失敗）
3. **論理削除済み買主の/:id/relatedテスト**: `deleted_at IS NOT NULL` の買主番号で `GET /buyers/:id/related` を呼び出す → 404が返ることを確認（修正前コードで失敗）
4. **エッジケース**: `metadata.body` が存在する通話履歴 → `hasBody` が正しく評価されることを確認

**Expected Counterexamples**:
- `isSms is not defined` ReferenceError が通話履歴セクションのレンダリング中に発生
- `GET /buyers/7359/related` が `{"error": "Not Found", "code": "BUYER_NOT_FOUND"}` を返す

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL activity WHERE isBugCondition_1(activity) DO
  result := renderCallHistorySection_fixed(activity)
  ASSERT no ReferenceError thrown
  ASSERT hasBody === !!activity.metadata.body
END FOR

FOR ALL request WHERE isBugCondition_2(request) DO
  result := relatedEndpoint_fixed(request)
  ASSERT result.status === 200
  ASSERT result.body contains relatedBuyers data
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL activity WHERE NOT isBugCondition_1(activity) DO
  ASSERT renderSection_original(activity) = renderSection_fixed(activity)
END FOR

FOR ALL request WHERE NOT isBugCondition_2(request) DO
  ASSERT relatedEndpoint_original(request) = relatedEndpoint_fixed(request)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- メール・SMS履歴セクションの多様な入力パターンを自動生成できる
- アクティブな買主番号の多様なパターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Cases**:
1. **メール・SMS履歴保持テスト**: `action === 'email'` および `action === 'sms'` のアクティビティで `isSms` が正しく評価されることを確認
2. **アクティブ買主/:id/related保持テスト**: `deleted_at IS NULL` の買主番号で `/:id/related` が引き続き200を返すことを確認
3. **通話履歴なし買主テスト**: 通話履歴が存在しない買主の詳細画面が正常にレンダリングされることを確認
4. **metadata.bodyモーダルテスト**: `metadata.body` が存在する通話履歴でクリック時にモーダルが開くことを確認

### Unit Tests

- 通話履歴セクションのレンダリングテスト（`action === 'call'`、`action === 'phone_call'`）
- `metadata.body` の有無による `hasBody` 評価テスト
- `getByBuyerNumber(id, true)` が論理削除済み買主を返すことのテスト
- `/:id/related` エンドポイントが論理削除済み買主番号で200を返すことのテスト

### Property-Based Tests

- ランダムなアクティビティデータを生成し、通話履歴セクションのレンダリングが常に成功することを検証（Property 1）
- ランダムなメール・SMS履歴データを生成し、`isSms` 評価が修正前後で一致することを検証（Property 3）
- ランダムなアクティブ買主番号を生成し、`/:id/related` が修正前後で同一レスポンスを返すことを検証（Property 4）

### Integration Tests

- 通話履歴を持つ買主（例：買主番号7359）の詳細画面を開き、エラーなく表示されることを確認
- 論理削除済み買主の詳細画面を開き、`RelatedBuyerNotificationBadge` が正しく表示されることを確認
- メール・SMS履歴と通話履歴の両方が存在する買主の詳細画面で、全セクションが正常に表示されることを確認
