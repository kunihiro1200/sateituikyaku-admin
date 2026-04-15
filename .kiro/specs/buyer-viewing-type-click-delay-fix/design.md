# 買主リスト内覧形態クリック遅延バグ修正 デザインドキュメント

## Overview

買主リスト（BuyerViewingResultPage）の「内覧形態」フィールドをクリックすると約5秒の遅延が発生するバグを修正する。

根本原因は `BuyerService.updateWithSync()` が呼ばれるたびに `initSyncServices()` が Google Sheets JWT 認証（`auth.authorize()`）を実行していること。Vercel サーバーレス環境ではリクエストごとにコールドスタートが発生しやすく、`this.writeService` がキャッシュされていないため毎回認証処理が走り、約5秒の遅延を引き起こしている。

修正方針は **DB 更新を先行させ、スプレッドシート同期を非同期（fire-and-forget）で実行する**こと。これにより UI のレスポンスをブロックせず、同期処理は引き続きバックグラウンドで実行される。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `viewing_mobile` または `viewing_type_general` フィールドの更新時に `initSyncServices()` が Google Sheets 認証をブロッキングで実行すること
- **Property (P)**: 期待される動作 — DB 更新が認証待機なしに即座に完了し、1秒以内にレスポンスが返ること
- **Preservation**: 修正によって変更してはいけない既存動作 — スプレッドシート同期の継続実行、DB 保存の正常完了、他フィールドの動作維持
- **BuyerService**: `backend/src/services/BuyerService.ts` の買主データ管理サービス
- **updateWithSync**: `BuyerService` 内の DB 更新とスプレッドシート同期を行うメソッド（`PUT /api/buyers/:id` から呼ばれる）
- **initSyncServices**: `BuyerService` 内の Google Sheets クライアント初期化・認証メソッド（`this.writeService` が null の場合に認証を実行）
- **this.writeService**: `BuyerWriteService` インスタンス。null の場合に `initSyncServices()` が認証処理を実行する
- **コールドスタート**: Vercel サーバーレス環境でリクエストごとにインスタンスが再生成される現象

## Bug Details

### Bug Condition

バグは `PUT /api/buyers/:id?sync=true` が呼ばれるたびに発生する。`updateWithSync()` の冒頭で `await this.initSyncServices()` が呼ばれ、Vercel コールドスタート時は `this.writeService` が null のため `sheetsClient.authenticate()` → `auth.authorize()` が実行される。この JWT 認証処理が約5秒かかり、UI がフリーズする。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, buyerId: string }
  OUTPUT: boolean

  RETURN input.fieldName IN ['viewing_mobile', 'viewing_type_general']
         AND updateWithSync が呼ばれた
         AND initSyncServices() が await でブロッキング実行される
         AND this.writeService IS NULL（コールドスタート後の初回リクエスト）
END FUNCTION
```

### Examples

- `viewing_mobile` を「訪問」に変更 → クリックから約5秒後にようやく選択状態が反映される（期待: 1秒以内）
- `viewing_type_general` を「オンライン」に変更 → 同様に約5秒の遅延が発生する（期待: 1秒以内）
- 2回目以降のクリック（同一インスタンスが生存している場合）→ `this.writeService` がキャッシュされているため遅延なし
- Vercel の別インスタンスにルーティングされた場合 → 再びコールドスタートが発生し5秒遅延

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `viewing_mobile` / `viewing_type_general` フィールドの更新後、スプレッドシートへの同期は引き続き実行される（同期自体は維持）
- スプレッドシート同期が失敗した場合、引き続きリトライキューに追加してエラーをユーザーに通知する
- `viewing_date`、`latest_status` など他のフィールドを更新した場合、従来と同じ動作を維持する
- DB への保存（`buyers` テーブルの更新）は引き続き正常に完了する
- 競合チェック（`conflictResolver.checkConflict`）は引き続き実行される

**Scope:**
内覧形態フィールド以外の全ての操作（他フィールドの更新、マウスクリック以外の操作）はこの修正の影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り：

1. **ブロッキング認証**: `updateWithSync()` の冒頭で `await this.initSyncServices()` を呼んでいる。これは DB 更新の前に実行されるため、認証が完了するまで DB 更新もレスポンスも返せない

2. **毎回の認証実行**: `initSyncServices()` は `this.writeService` が null の場合のみ認証を実行するガード節があるが、Vercel サーバーレス環境ではリクエストごとに新しいインスタンスが生成されるため、常に null になる

3. **JWT 認証の遅延**: `auth.authorize()` は Google の認証サーバーへのネットワークリクエストを含み、コールドスタート時に約5秒かかる

4. **設計上の問題**: DB 更新とスプレッドシート同期が直列に実行されており、同期の準備（認証）が UI レスポンスをブロックしている

## Correctness Properties

Property 1: Bug Condition - 内覧形態更新時の即時レスポンス

_For any_ `viewing_mobile` または `viewing_type_general` フィールドの更新リクエストにおいて（isBugCondition が true を返す場合）、修正後の `updateWithSync` は Google Sheets 認証の完了を待たずに DB 更新を完了し、1秒以内にレスポンスを返す SHALL。スプレッドシート同期はバックグラウンドで非同期実行される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - スプレッドシート同期の継続実行

_For any_ フィールド更新において（isBugCondition が true/false に関わらず）、修正後のコードは引き続きスプレッドシートへの同期を実行する SHALL。同期が失敗した場合はリトライキューに追加される。

**Validates: Requirements 3.1, 3.4**

Property 3: Preservation - 他フィールドの動作維持

_For any_ `viewing_mobile` / `viewing_type_general` 以外のフィールド更新（isBugCondition が false を返す場合）において、修正後の `updateWithSync` は修正前と同一の動作を維持する SHALL。DB 保存、競合チェック、監査ログ記録が引き続き正常に実行される。

**Validates: Requirements 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Function**: `updateWithSync`

**Specific Changes**:

1. **initSyncServices の呼び出しタイミングを変更**: `updateWithSync()` の冒頭にある `await this.initSyncServices()` を削除し、スプレッドシート同期処理の直前（DB 更新後）に移動する

2. **スプレッドシート同期を非同期化**: DB 更新完了後、スプレッドシート同期処理全体を `setImmediate()` または Promise チェーン（`.then().catch()`）でラップし、fire-and-forget で実行する。レスポンスは DB 更新完了後に即座に返す

3. **syncResult の初期値設定**: 非同期化により `syncResult` が確定する前にレスポンスを返すため、初期値として `{ success: true, syncStatus: 'pending' }` を設定する

4. **エラーハンドリングの維持**: 非同期化後も同期失敗時のリトライキュー追加処理は維持する

5. **監査ログの移動**: 監査ログ記録は DB 更新直後（同期処理の前）に実行するよう移動する

**変更のイメージ（疑似コード）:**
```
async updateWithSync(...) {
  // 1. 存在確認・競合チェック（変更なし）
  // 2. DB更新（変更なし）
  
  // 3. 監査ログ記録（DB更新直後に移動）
  
  // 4. スプレッドシート同期を非同期で実行（ここが変更点）
  setImmediate(async () => {
    await this.initSyncServices();  // ← ここに移動
    // ... 同期処理 ...
  });
  
  // 5. DB更新結果を即座に返す
  return { buyer: data, syncResult: { success: true, syncStatus: 'pending' } };
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず修正前のコードでバグを再現するテストを書いてカウンターエグザンプルを確認し、次に修正後のコードでバグが解消され既存動作が保たれることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は根本原因を再仮説する。

**Test Plan**: `initSyncServices()` の `sheetsClient.authenticate()` をモックして実行時間を計測するテストを書く。修正前のコードでは `updateWithSync()` の開始から DB 更新完了まで認証時間分の遅延が発生することを確認する。

**Test Cases**:
1. **認証ブロッキングテスト**: `authenticate()` を5秒遅延するモックに差し替え、`updateWithSync()` の応答時間が5秒以上かかることを確認（修正前コードで失敗することを期待）
2. **コールドスタート再現テスト**: `this.writeService = null` の状態で `updateWithSync()` を呼び、認証が実行されることを確認
3. **viewing_mobile 更新テスト**: `viewing_mobile` フィールドの更新リクエストで遅延が発生することを確認
4. **viewing_type_general 更新テスト**: `viewing_type_general` フィールドの更新リクエストで遅延が発生することを確認

**Expected Counterexamples**:
- `updateWithSync()` の応答時間が `authenticate()` のモック遅延時間（5秒）以上になる
- DB 更新が認証完了まで実行されない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待される動作（即時レスポンス）が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  startTime := now()
  result := updateWithSync_fixed(input)
  elapsed := now() - startTime
  ASSERT elapsed < 1000ms  // 1秒以内
  ASSERT result.buyer IS NOT NULL  // DB更新完了
  ASSERT result.syncResult.syncStatus IN ['pending', 'synced']
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正前後で同一の動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateWithSync_original(input) ≈ updateWithSync_fixed(input)
  // DB更新結果、スプレッドシート同期実行、監査ログ記録が同一
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様なフィールド名・値の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 「修正前後で同一動作」という保存性を強く保証できる

**Test Plan**: 修正前のコードで他フィールド（`viewing_date`、`latest_status` など）の更新動作を観察し、修正後も同一動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **スプレッドシート同期継続テスト**: 修正後も `writeService.updateFields()` が呼ばれることを確認
2. **リトライキュー追加テスト**: 同期失敗時に `retryHandler.queueFailedChange()` が呼ばれることを確認
3. **他フィールド更新テスト**: `viewing_date`、`latest_status` など他フィールドの更新が正常に完了することを確認
4. **競合チェック継続テスト**: `conflictResolver.checkConflict()` が引き続き実行されることを確認

### Unit Tests

- `updateWithSync()` が DB 更新後に即座にレスポンスを返すことをテスト
- `initSyncServices()` がスプレッドシート同期処理の直前に呼ばれることをテスト
- `viewing_mobile` / `viewing_type_general` 以外のフィールド更新で動作が変わらないことをテスト
- 同期失敗時にリトライキューへの追加が実行されることをテスト

### Property-Based Tests

- ランダムなフィールド名・値の組み合わせで `updateWithSync()` を呼び、DB 更新が常に1秒以内に完了することを検証
- `isBugCondition` が false の全入力に対して、修正前後で DB 更新結果が同一であることを検証
- スプレッドシート同期の成功・失敗パターンを多数生成し、リトライキューの動作が保たれることを検証

### Integration Tests

- フロントエンドから内覧形態ボタンをクリックして、1秒以内に選択状態が反映されることを確認
- 修正後もスプレッドシートに同期されることを確認（バックグラウンド実行）
- 複数フィールドを連続更新した場合に全て正常に保存されることを確認
