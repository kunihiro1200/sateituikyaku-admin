# seller-exclusion-date-save-bug Bugfix Design

## Overview

売主リスト通話モードページ（`/sellers/:id/call`）の「除外日にすること」フィールドに値を保存後、別ページに移動して戻ると値が消えて見える（約30秒後に遅延表示される）バグ、および値を解除（空に戻す）して保存しても解除が反映されないバグを修正する。

根本原因は2つある：
1. **キャッシュ問題（主因）**: `SellerService.supabase.ts` のインメモリキャッシュ（30秒TTL）がVercelサーバーレス環境で別インスタンスに伝播しない。`updateSeller` 実行後にキャッシュ無効化を行っているが、別インスタンスのキャッシュは無効化されないため、ページ遷移後に古いデータが返される。
2. **空文字列除外問題**: `CallModePage.tsx` の保存処理で `exclusionAction` が空文字列の場合にスプレッド構文 `...(exclusionAction ? { exclusionAction } : {})` によりリクエストペイロードから除外される。バックエンドの `updateSeller` は `undefined` チェックで動作するため、値が送信されなければ更新されない。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 「除外日にすること」フィールドの保存後に別インスタンスで古いキャッシュが返される、または空文字列で解除保存した際に値が送信されない
- **Property (P)**: 期待される正しい動作 — 保存後に即座に正しい値が返され、解除操作もDBに反映される
- **Preservation**: 修正によって変更してはならない既存の動作 — 他フィールドの保存・表示、初回ページ表示、同一インスタンスでのキャッシュ動作
- **`getSellerCache` / `setSellerCache`**: `backend/src/services/SellerService.supabase.ts` のモジュールレベルのインメモリキャッシュ関数（30秒TTL）
- **`invalidateSellerCache`**: 同ファイルのキャッシュ無効化関数（同一インスタンスのみ有効）
- **`exclusionAction`**: 「除外日にすること」フィールドの値（例: `'exclude_if_unreachable'`, `'exclude_without_action'`）。空文字列は「解除」を意味する
- **Vercelサーバーレス環境**: 各リクエストが独立したインスタンスで処理されるため、インメモリキャッシュはインスタンス間で共有されない

## Bug Details

### Bug Condition

バグは以下の2つの条件のいずれかで発生する：

**条件A（キャッシュ問題）**: ユーザーが `exclusionAction` を保存した後、別ページに移動してから戻ると、Vercelの別インスタンスが古いインメモリキャッシュを返す。

**条件B（空文字列除外問題）**: ユーザーが `exclusionAction` を空文字列（解除）にして保存すると、フロントエンドのスプレッド構文がペイロードから `exclusionAction` を除外し、バックエンドに値が届かない。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SellerUpdateRequest
  OUTPUT: boolean

  // 条件A: 保存後に別Vercelインスタンスがリクエストを処理する場合（キャッシュ問題）
  conditionA ← X.exclusionAction IS NOT NULL
               AND X.exclusionAction <> ''
               AND requestHandledByDifferentVercelInstance(X) = true

  // 条件B: 値を解除（空文字列）して保存する場合（空文字列除外問題）
  conditionB ← X.exclusionAction = ''

  RETURN conditionA OR conditionB
END FUNCTION
```

### Examples

- **条件A の例**: ユーザーが `exclusionAction = 'exclude_if_unreachable'` を保存 → 別ページへ移動 → 通話モードページに戻る → 別Vercelインスタンスが古いキャッシュ（`exclusionAction = null`）を返す → フィールドが空で表示される（約30秒後に正しい値が表示される）
- **条件B の例**: ユーザーが `exclusionAction` を選択済みの状態から解除（空に戻す）して保存 → フロントエンドが `exclusionAction` をペイロードに含めない → バックエンドが `exclusion_action` を更新しない → 次回表示時も古い値が残る
- **正常ケース**: ユーザーが `exclusionAction = 'exclude_without_action'` を保存 → 同一Vercelインスタンスで再取得 → キャッシュが無効化されているため正しい値が返る（バグなし）
- **エッジケース**: `exclusionAction` が `null` の場合 → 条件Bには該当しない（`null` は `undefined` として扱われ、バックエンドで更新されない）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- ステータス、信頼度、次電日など他フィールドの保存・表示は従来通り動作すること
- 通話モードページの初回表示時はDBから正しいデータを取得して全フィールドを表示すること
- 同一Vercelインスタンス内での30秒TTLキャッシュによるパフォーマンス最適化は維持すること（ただし、`exclusionAction` 保存後のキャッシュ無効化は確実に行うこと）
- `exclusionAction` 以外のフィールドの保存ロジックは変更しないこと

**スコープ:**
`exclusionAction` フィールドの保存・取得に関係しない全ての操作は、この修正によって影響を受けてはならない。

## Hypothesized Root Cause

コードの調査により、以下の根本原因を特定した：

1. **インメモリキャッシュのインスタンス分離（主因）**: `SellerService.supabase.ts` の `_sellerCache`（`Map<string, ...>`）はモジュールレベルの変数であり、Vercelサーバーレス環境では各インスタンスが独立したメモリ空間を持つ。`updateSeller` 実行後に `invalidateSellerCache(sellerId)` を呼び出しているが、これは同一インスタンスのキャッシュのみを無効化する。別インスタンスが次のリクエストを処理する場合、そのインスタンスのキャッシュは無効化されておらず、古いデータを返す。

2. **空文字列のスプレッド除外（副因）**: `CallModePage.tsx` の保存処理（行2308）:
   ```typescript
   ...(exclusionAction ? { exclusionAction } : {}),
   ```
   `exclusionAction` が空文字列 `''` の場合、JavaScriptの falsy 評価により `{}` が展開される。結果として `exclusionAction` キーがリクエストボディに含まれない。バックエンドの `updateSeller` は `(data as any).exclusionAction !== undefined` チェックで動作するため、キーが存在しない場合は `exclusion_action` カラムを更新しない。

3. **Redisキャッシュの補完的役割**: `CacheHelper.del(CacheHelper.generateKey('seller', sellerId))` でRedisキャッシュも無効化しているが、インメモリキャッシュが先に参照されるため（`getSeller` の冒頭でインメモリキャッシュをチェック）、Redisの無効化だけでは問題を解決できない。

## Correctness Properties

Property 1: Bug Condition - 除外アクション保存後の即時反映

_For any_ リクエストで `exclusionAction`（空文字列を含む）が保存された場合、修正後の `getSeller` 関数は次のリクエストで（どのVercelインスタンスが処理しても）DBから最新の `exclusionAction` 値を返し、保存した値と一致すること。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他フィールドの保存動作の不変性

_For any_ リクエストで `exclusionAction` 以外のフィールド（ステータス、信頼度、次電日など）を保存する場合、修正後の `updateSeller` 関数は修正前と同じ動作を保持し、それらのフィールドを正しく保存・返却すること。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更を行う：

**修正1: フロントエンド — 空文字列の除外問題を修正**

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: 保存処理（`handleSaveStatus` 相当、行2308付近）

**Specific Changes**:
1. **空文字列を含む `exclusionAction` を常にペイロードに含める**: スプレッド構文を変更し、`exclusionAction` が `undefined` でない限り（空文字列を含む）ペイロードに含める
   ```typescript
   // 修正前
   ...(exclusionAction ? { exclusionAction } : {}),
   
   // 修正後
   ...(exclusionAction !== undefined ? { exclusionAction } : {}),
   // または明示的に
   exclusionAction: exclusionAction,
   ```

**修正2: バックエンド — インメモリキャッシュのTTL短縮またはキャッシュ無効化戦略の改善**

**File**: `backend/src/services/SellerService.supabase.ts`

**Specific Changes**:
1. **`getSeller` のキャッシュTTLを短縮**: `SELLER_CACHE_TTL_MS` を 30秒 から 0秒（無効化）または大幅に短縮する。Vercelサーバーレス環境ではインスタンスが頻繁に再起動されるため、インメモリキャッシュの恩恵が限定的である一方、古いデータを返すリスクが高い。
   ```typescript
   // 修正前
   const SELLER_CACHE_TTL_MS = 30 * 1000; // 30秒
   
   // 修正後（オプション1: キャッシュ無効化）
   const SELLER_CACHE_TTL_MS = 0; // キャッシュ無効化
   
   // 修正後（オプション2: TTL短縮）
   const SELLER_CACHE_TTL_MS = 5 * 1000; // 5秒
   ```
   
   または、`getSeller` でインメモリキャッシュを使用しないようにする（Redisキャッシュのみ使用）。

2. **代替案: `exclusionAction` 更新時にキャッシュをスキップ**: `getSeller` でインメモリキャッシュをチェックする前に、Redisキャッシュの状態を確認する（ただし、これはパフォーマンスに影響する可能性がある）。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず修正前のコードでバグを再現するテストを書き（探索的テスト）、次に修正後のコードで正しい動作を検証する（修正確認テスト・保全確認テスト）。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `SellerService.getSeller` と `updateSeller` をモックして、別インスタンスのキャッシュ状態をシミュレートする。また、フロントエンドの保存処理で空文字列が除外されることを確認する。

**Test Cases**:
1. **キャッシュ問題の再現**: `updateSeller` でキャッシュを無効化した後、新しいキャッシュインスタンス（別Vercelインスタンスをシミュレート）で `getSeller` を呼び出すと古いデータが返ることを確認（修正前のコードで失敗することを期待）
2. **空文字列除外の再現**: `exclusionAction = ''` でフロントエンドの保存処理を実行すると、リクエストペイロードに `exclusionAction` が含まれないことを確認（修正前のコードで失敗することを期待）
3. **解除操作の非反映**: `exclusionAction = ''` で保存後に `getSeller` を呼び出すと、古い `exclusionAction` 値が返ることを確認（修正前のコードで失敗することを期待）
4. **エッジケース**: `exclusionAction = null` の場合にペイロードから除外されることを確認（これは正常動作）

**Expected Counterexamples**:
- 別インスタンスのキャッシュが無効化されず、古い `exclusionAction` 値が返される
- 空文字列の `exclusionAction` がペイロードから除外され、DBが更新されない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する全ての入力に対して期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateSeller_fixed(X)
  ASSERT result.exclusionAction = X.exclusionAction  // 保存した値が返される
  
  // 別インスタンスをシミュレート（新しいキャッシュインスタンス）
  freshInstance ← createFreshSellerServiceInstance()
  fetchedSeller ← freshInstance.getSeller(X.sellerId)
  ASSERT fetchedSeller.exclusionAction = X.exclusionAction  // 再取得でも正しい値
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件に該当しない全ての入力に対して修正前と同じ動作が保持されることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateSeller_original(X) = updateSeller_fixed(X)  // 他フィールドの動作は変わらない
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な入力パターン（様々なフィールドの組み合わせ）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強力に保証できる

**Test Cases**:
1. **他フィールドの保存保全**: `exclusionAction` を含まないリクエスト（ステータス、信頼度、次電日など）で `updateSeller` を呼び出すと、修正前後で同じ結果が返ることを確認
2. **初回表示の保全**: `getSeller` を初回呼び出し（キャッシュなし）で実行すると、修正前後で同じデータが返ることを確認
3. **同一インスタンスキャッシュの保全**: 修正後もキャッシュが有効な場合（TTLが0でない場合）、同一インスタンスでの再取得でキャッシュが使用されることを確認

### Unit Tests

- `exclusionAction = ''` でフロントエンドの保存処理を実行した場合、リクエストペイロードに `exclusionAction: ''` が含まれることをテスト
- `exclusionAction = 'exclude_if_unreachable'` で保存後、新しいキャッシュインスタンスで `getSeller` を呼び出すとDBから最新データが返ることをテスト
- `updateSeller` で `exclusionAction = ''` を渡した場合、`exclusion_action` カラムが空文字列で更新されることをテスト
- キャッシュTTL修正後、`SELLER_CACHE_TTL_MS` が期待値以下であることをテスト

### Property-Based Tests

- ランダムな `exclusionAction` 値（空文字列、有効な値、null）で保存・取得を繰り返し、保存した値と取得した値が一致することを検証
- `exclusionAction` 以外のランダムなフィールドの組み合わせで `updateSeller` を呼び出し、修正前後で同じ結果が返ることを検証（保全確認）
- 複数の保存・取得サイクルを経ても、最後に保存した `exclusionAction` 値が常に返されることを検証

### Integration Tests

- 通話モードページで `exclusionAction` を選択して保存 → 別ページへ移動 → 通話モードページに戻る → 保存した値が即座に表示されることを確認
- `exclusionAction` を解除（空に戻す）して保存 → ページをリロード → フィールドが空で表示されることを確認
- `exclusionAction` 以外のフィールド（ステータスなど）の保存・表示が修正後も正常に動作することを確認
