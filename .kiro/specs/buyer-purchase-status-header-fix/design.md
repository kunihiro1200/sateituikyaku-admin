# buyer-purchase-status-header-fix バグ修正デザイン

## Overview

AA18の物件詳細画面（売主管理システム）において、買付が削除された後もヘッダーに「買（専任　両手）」の表示が消えない問題を修正する。

現在の仕組みでは、買付削除後のDB更新はGAS（Google Apps Script）経由でスプレッドシートを通じて行われるため、ヘッダー表示の更新に5分以上かかる。

修正方針：買付削除時（`DELETE /api/buyers/:id`）に、バックエンドが直接DBを更新することで、ヘッダー表示をリアルタイムに反映させる。

## Glossary

- **Bug_Condition (C)**: 買付削除操作が実行されたにもかかわらず、対象買主の `latest_status` に「買」が含まれたままDBに残っている状態
- **Property (P)**: 買付削除後、対象買主の `latest_status` から「買」を含む値が即座にクリアされ、ヘッダーに「買（専任　両手）」等が表示されなくなること
- **Preservation**: 買付削除以外の操作（新規登録、物件情報更新、マウスクリック等）でヘッダー表示が正しく維持されること
- **softDelete**: `BuyerService.softDelete()` - `buyers` テーブルの `deleted_at` を設定する論理削除メソッド（`backend/src/services/BuyerService.ts`）
- **latest_status**: 買主の最新状況を示すフィールド。「買（専任　両手）」等の値を持つ場合、物件詳細ヘッダーに買付バッジが表示される
- **offer_status**: `property_listings` テーブルの買付フィールド。GAS経由で更新される
- **PurchaseStatusBadge**: ヘッダーに「買（専任　両手）」等を表示するコンポーネント（`frontend/frontend/src/components/PurchaseStatusBadge.tsx`）
- **hasBuyerPurchaseStatus**: `latest_status` に「買」が含まれるか判定するユーティリティ関数（`frontend/frontend/src/utils/purchaseStatusUtils.ts`）

## Bug Details

### Bug Condition

買付削除時、`BuyerService.softDelete()` は `buyers.deleted_at` を設定するだけで `buyers.latest_status` はそのまま残る。`PropertyListingDetailPage` は `/api/property-listings/:propertyNumber/buyers` を呼び出して買主一覧を取得し、`latest_status` に「買」を含む買主がいればヘッダーにバッジを表示する。

論理削除された買主（`deleted_at` が設定済み）がAPIレスポンスから除外されるまでの間、またはGASが `offer_status` を更新するまでの間（5分以上）、ヘッダーの表示が消えない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, buyerId: string, buyerLatestStatus: string }
  OUTPUT: boolean

  RETURN input.action == "delete_buyer"
         AND input.buyerLatestStatus INCLUDES "買"
         AND buyerStillAppearsInPropertyBuyersAPI(input.buyerId)
END FUNCTION
```

### Examples

- **例1（バグ発生）**: 買主7205の `latest_status` が「買（専任　両手）」の状態で削除 → ヘッダーに「買（専任　両手）」が5分以上表示され続ける
- **例2（バグ発生）**: 買主8001の `latest_status` が「買（一般　両手）」の状態で削除 → 同様に遅延が発生
- **例3（バグなし）**: 買主9000の `latest_status` が「内覧済み」の状態で削除 → ヘッダーに買付バッジは表示されていないため影響なし
- **エッジケース**: 同一物件に複数の「買」ステータス買主がいる場合、1件削除しても残りの買主がいればヘッダーは表示されたまま（正常動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買付申し込みが存在する物件を表示した際、ヘッダーに「買（専任　両手）」等が引き続き正しく表示される
- 買付申し込みが新規登録された際、ヘッダーの「買（専任　両手）」表示が引き続き正しく更新される
- 買付以外の物件情報（価格、住所、SUUMO登録状況等）が変更された際、ヘッダー表示が引き続き正しく維持される

**Scope:**
買付削除操作（`DELETE /api/buyers/:id`）以外の全ての操作は、このバグ修正の影響を受けない。具体的には：
- 買主の新規登録・更新
- 物件情報の更新
- GAS経由のスプレッドシート同期（引き続き動作する）
- 他の買主の削除（`latest_status` に「買」を含まない場合）

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **softDeleteが latest_status をクリアしない**: `BuyerService.softDelete()` は `deleted_at` を設定するだけで、`latest_status` を変更しない。論理削除後も `latest_status` に「買」が残る。

2. **APIが論理削除済み買主を除外するタイミング**: `/api/property-listings/:propertyNumber/buyers` エンドポイントが `deleted_at IS NULL` でフィルタリングしているかどうかによって、削除直後にAPIレスポンスから除外されるかが決まる。除外されていない場合、ヘッダーは即座に消えない。

3. **GAS依存の offer_status 更新**: `property_listings.offer_status` はGAS経由でスプレッドシートから同期されるため、買付削除後の反映に5分以上かかる。

4. **フロントエンドのキャッシュ**: `PropertyListingDetailPage` は初回ロード時に `fetchBuyers()` を呼び出すが、買付削除後に自動的に再フェッチしない。

## Correctness Properties

Property 1: Bug Condition - 買付削除後のヘッダー即時消去

_For any_ 買主削除操作において、削除対象買主の `latest_status` に「買」が含まれる場合（isBugCondition returns true）、修正後の削除処理は対象買主の `latest_status` を即座にクリア（または空文字列に更新）し、`/api/property-listings/:propertyNumber/buyers` のレスポンスから当該買主の「買」ステータスが消えることで、ヘッダーの「買（専任　両手）」表示がリアルタイムに消去される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非削除操作でのヘッダー表示維持

_For any_ 買付削除以外の操作（買主新規登録、物件情報更新、GAS同期等）において（isBugCondition returns false）、修正後のコードは修正前のコードと同一の結果を返し、ヘッダーの「買（専任　両手）」表示ロジックが変更されないことを保証する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を実施する：

**File**: `backend/src/services/BuyerService.ts`

**Function**: `softDelete(buyerId: string)`

**Specific Changes**:

1. **latest_status のクリア**: `softDelete` メソッドで `deleted_at` を設定する際、同時に `latest_status` を空文字列または `null` に更新する。これにより、論理削除後に `/api/property-listings/:propertyNumber/buyers` が当該買主を返しても、`hasBuyerPurchaseStatus` が `false` を返すようになる。

2. **削除後の property_listings.offer_status 更新（オプション）**: 削除対象買主に紐づく物件の `offer_status` を直接クリアする。ただし、同一物件に他の「買」ステータス買主が存在する場合はクリアしない。

**File**: `backend/src/routes/buyers.ts`

**Function**: `router.delete('/:id', ...)`

**Specific Changes**:

3. **削除後の物件ステータス更新**: 削除対象買主の `latest_status` に「買」が含まれる場合、紐づく物件の `property_listings.offer_status` を直接DBで更新する処理を追加する（他に「買」ステータスの買主がいない場合のみ）。

**実装優先度**:
- 変更1（`latest_status` クリア）が最小限の修正で最大の効果を得られる
- 変更3は `offer_status` の整合性を保つための追加対応

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず修正前のコードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `BuyerService.softDelete()` を呼び出した後、`/api/property-listings/:propertyNumber/buyers` のレスポンスを確認し、削除した買主の `latest_status` が「買」を含んだまま返されることを確認する。修正前のコードで実行してバグを観察する。

**Test Cases**:
1. **買付ステータス買主の削除テスト**: `latest_status` が「買（専任　両手）」の買主を削除後、`/api/property-listings/:propertyNumber/buyers` が当該買主を返すか確認（修正前は返す）
2. **softDelete後のlatest_status確認**: `softDelete` 実行後、DBの `latest_status` が「買」を含んだままか確認（修正前は含んだまま）
3. **ヘッダー表示の遅延確認**: 削除直後にフロントエンドのヘッダーが更新されないことを確認（修正前は5分以上かかる）
4. **エッジケース - 複数買主**: 同一物件に2人の「買」ステータス買主がいる場合、1人削除後もヘッダーが表示されることを確認（正常動作）

**Expected Counterexamples**:
- `softDelete` 後も `buyers` テーブルの `latest_status` に「買」が残っている
- 可能性のある原因: `softDelete` が `latest_status` を更新しない、APIが論理削除済み買主を除外しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := softDelete_fixed(input.buyerId)
  ASSERT buyer.latest_status NOT INCLUDES "買"
  ASSERT propertyBuyersAPI(propertyNumber) DOES NOT INCLUDE buyer WITH "買" status
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して修正前と同一の結果が返されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT softDelete_original(input) = softDelete_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な `latest_status` 値（「買」を含まないもの）を自動生成して検証できる
- 手動テストでは見落としがちなエッジケースを網羅できる
- 修正が非削除操作に影響しないことを強く保証できる

**Test Plan**: 修正前のコードで「買」を含まない `latest_status` を持つ買主の削除動作を観察し、修正後も同一動作であることをプロパティベーステストで検証する。

**Test Cases**:
1. **非買付ステータス買主の削除保存テスト**: `latest_status` が「内覧済み」「追客中」等の買主を削除しても、ヘッダー表示に影響がないことを確認
2. **買付新規登録の保存テスト**: 新規買主登録後にヘッダーが正しく更新されることを確認
3. **物件情報更新の保存テスト**: 物件の価格・住所等を更新してもヘッダー表示が変わらないことを確認
4. **GAS同期の保存テスト**: GAS経由の同期が引き続き動作することを確認

### Unit Tests

- `BuyerService.softDelete()` が `latest_status` をクリアすることを確認
- `latest_status` に「買」を含む買主の削除後、`hasBuyerPurchaseStatus` が `false` を返すことを確認
- 「買」を含まない `latest_status` の買主削除では `latest_status` が変更されないことを確認（または変更されても問題ないことを確認）

### Property-Based Tests

- ランダムな `latest_status` 値（「買」を含む）を持つ買主を削除した場合、削除後の `latest_status` が「買」を含まないことを検証
- ランダムな `latest_status` 値（「買」を含まない）を持つ買主の削除が、ヘッダー表示に影響しないことを検証
- 複数買主が存在する物件で、「買」ステータス買主が1人残っている場合はヘッダーが表示されたままであることを検証

### Integration Tests

- 買付削除後、`/api/property-listings/:propertyNumber/buyers` のレスポンスから「買」ステータスが即座に消えることを確認
- 買付削除後、フロントエンドのヘッダーが即座に更新されることを確認（E2Eテスト）
- 複数の買付削除シナリオで、物件詳細ページのヘッダー表示が正しく動作することを確認
