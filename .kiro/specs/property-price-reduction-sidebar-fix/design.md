# Property Price Reduction Sidebar Fix - Bugfix Design

## Overview

物件リスト詳細画面（`PropertyListingDetailPage`）で値下げ予約日（`price_reduction_scheduled_date`）を
削除して保存した後、サイドバーの「要値下げ」カテゴリーから該当物件が即座に消えないバグの修正設計。

**バグの影響**: ユーザーが日付を削除・保存しても、`PropertyListingsPage` の `allListings` ステートが
即座に更新されないため、サイドバーのカウントとフィルタリングに古い状態が残り続ける。

**修正方針**: `propertyConfirmationUpdated` カスタムイベントと同様のパターンで、
`propertyPriceReductionUpdated` カスタムイベントを `price_reduction_scheduled_date` の保存時に発火させ、
`PropertyListingsPage` 側でリッスンして `allListings` ステートを即座に更新する。

## Glossary

- **Bug_Condition (C)**: `price_reduction_scheduled_date` が null に変更されて保存されたにもかかわらず、
  `PropertyListingsPage` の `allListings` ステートが即座に更新されていない状態
- **Property (P)**: 保存後に `allListings` 内の該当物件の `price_reduction_scheduled_date` が null になり、
  `calculatePropertyStatus()` が `price_reduction_due` を返さなくなること
- **Preservation**: `confirmation` フィールドの即時更新（`propertyConfirmationUpdated` イベント）など、
  既存の他のフィールドの動作が変わらないこと
- **handleSavePrice**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` 内の関数。
  価格セクション（`price_reduction_scheduled_date` を含む）の保存を担当する
- **calculatePropertyStatus**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts` 内の関数。
  `price_reduction_scheduled_date` が今日以前の場合に `price_reduction_due` を返す
- **allListings**: `PropertyListingsPage` が保持するステート。サイドバーのカウントとフィルタリングの
  計算元となる物件リスト
- **pageDataCache**: `PropertyListingsPage` が使用するキャッシュ。`allListings` と同期して無効化が必要

## Bug Details

### Bug Condition

`handleSavePrice` が `price_reduction_scheduled_date` を含むデータを保存した後、
`PropertyListingsPage` の `allListings` ステートを即座に更新する仕組みが存在しない。
`confirmation` フィールドには `propertyConfirmationUpdated` カスタムイベントによる即時更新の仕組みが
実装されているが、`price_reduction_scheduled_date` には同様の仕組みがない。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListingUpdate
  OUTPUT: boolean

  RETURN X.price_reduction_scheduled_date が null に変更された
    AND PropertyListingsPage の allListings[X.property_number].price_reduction_scheduled_date が
        まだ今日以前の日付のまま（即時更新されていない）
END FUNCTION
```

### Examples

- **例1（バグ発現）**: 物件AA1234の `price_reduction_scheduled_date` が昨日の日付 → null に変更して保存。
  サイドバーの「要値下げ」カウントが減らず、AA1234が「要値下げ」リストに残り続ける
- **例2（バグ発現）**: 物件BB5678の `price_reduction_scheduled_date` が今日の日付 → null に変更して保存。
  ページを再読み込みするまで「要値下げ」から消えない
- **例3（正常動作）**: 物件CC9012の `confirmation` を「未」→「済」に変更して保存。
  `propertyConfirmationUpdated` イベントにより即座にサイドバーから消える（修正対象外）
- **エッジケース**: `price_reduction_scheduled_date` を未来の日付に変更した場合も、
  `allListings` が更新されないため「要値下げ」から消えない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `confirmation` フィールドの更新時に `propertyConfirmationUpdated` イベントによる即時更新が正常に動作すること
- `price_reduction_scheduled_date` に今日以前の日付を設定して保存した場合、
  その物件が「要値下げ」カテゴリーに表示されること
- `price_reduction_scheduled_date` が null の物件は「要値下げ」カテゴリーに表示されないこと
- 価格情報以外のフィールドを保存した場合、他のサイドバーカテゴリーの表示に影響を与えないこと
- マウスクリックによるボタン操作など、キーボード以外の操作が引き続き正常に動作すること

**Scope:**
`price_reduction_scheduled_date` の変更を伴わない保存操作（価格変更のみ、他フィールドの変更など）は
このバグ修正の影響を受けない。具体的には：
- `price_reduction_scheduled_date` が変更されていない場合のイベント発火は不要
- 他のセクション（基本情報、物件詳細、売主・買主情報など）の保存処理は変更しない

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **カスタムイベントの未実装**: `handleSavePrice` 関数に `propertyPriceReductionUpdated` カスタムイベントの
   発火処理が存在しない。`confirmation` フィールドには同様の仕組みが実装済みだが、
   `price_reduction_scheduled_date` には実装されていない

2. **PropertyListingsPage のイベントリスナー未実装**: `PropertyListingsPage` に
   `propertyPriceReductionUpdated` イベントをリッスンして `allListings` を更新する
   `useEffect` フックが存在しない

3. **キャッシュ無効化の欠如**: `price_reduction_scheduled_date` 変更時に `pageDataCache` が
   無効化されないため、次回のデータ取得でも古いデータが返される可能性がある

4. **設計の非対称性**: `confirmation` フィールドの即時更新パターンが他のフィールドに
   適用されていない。同様のパターンが必要なフィールドに対して一貫して実装されていない

## Correctness Properties

Property 1: Bug Condition - 値下げ予約日削除後のサイドバー即時更新

_For any_ 物件更新操作において `price_reduction_scheduled_date` が null または未来日付に変更されて
保存された場合、固定後の `handleSavePrice` 関数は `propertyPriceReductionUpdated` カスタムイベントを
発火させ、`PropertyListingsPage` の `allListings` ステートを即座に更新して、
`calculatePropertyStatus()` が `price_reduction_due` を返さなくなること。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存動作の保持

_For any_ 操作において `price_reduction_scheduled_date` の変更を伴わない場合（他フィールドの保存、
`confirmation` の更新など）、固定後のコードは元のコードと同一の動作を行い、
既存のサイドバーカテゴリー表示・カウント・フィルタリングが変わらないこと。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File 1**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSavePrice`

**Specific Changes**:
1. **イベント発火の追加**: `api.put()` 成功後、`editedData` に `price_reduction_scheduled_date` が
   含まれている場合に `propertyPriceReductionUpdated` カスタムイベントを発火する
   ```typescript
   if (editedData.price_reduction_scheduled_date !== undefined) {
     window.dispatchEvent(new CustomEvent('propertyPriceReductionUpdated', {
       detail: {
         propertyNumber,
         priceReductionScheduledDate: editedData.price_reduction_scheduled_date
       }
     }));
   }
   ```

2. **発火タイミング**: `await fetchPropertyData()` の前に発火することで、
   `PropertyListingsPage` が即座に更新される

---

**File 2**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Function**: 新規 `useEffect` フックの追加

**Specific Changes**:
1. **イベントリスナーの追加**: `propertyConfirmationUpdated` のリスナーと同様のパターンで、
   `propertyPriceReductionUpdated` イベントをリッスンする `useEffect` を追加する
   ```typescript
   useEffect(() => {
     const handlePriceReductionUpdate = (event: CustomEvent) => {
       const { propertyNumber, priceReductionScheduledDate } = event.detail;
       setAllListings(prevListings =>
         prevListings.map(listing =>
           listing.property_number === propertyNumber
             ? { ...listing, price_reduction_scheduled_date: priceReductionScheduledDate }
             : listing
         )
       );
       pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
     };

     window.addEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
     return () => {
       window.removeEventListener('propertyPriceReductionUpdated', handlePriceReductionUpdate as EventListener);
     };
   }, []);
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを実証するカウンターサンプルを収集し、
次に修正後のコードが正しく動作し既存の動作を保持することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを実証するカウンターサンプルを収集する。根本原因分析を確認または反証する。
反証された場合は再仮説が必要。

**Test Plan**: `handleSavePrice` の保存後に `PropertyListingsPage` の `allListings` が更新されないことを
テストで確認する。未修正コードでテストを実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **値下げ予約日削除テスト**: `price_reduction_scheduled_date` が昨日の日付の物件に対して、
   null に変更して保存した後、`allListings` の該当物件の `price_reduction_scheduled_date` が
   即座に null になっていないことを確認（未修正コードで FAIL）
2. **サイドバーカウントテスト**: 上記操作後、`calculateStatusCounts()` の `price_reduction_due` カウントが
   減少していないことを確認（未修正コードで FAIL）
3. **イベント発火テスト**: `handleSavePrice` 実行後に `propertyPriceReductionUpdated` イベントが
   発火されないことを確認（未修正コードで FAIL）

**Expected Counterexamples**:
- `allListings` の `price_reduction_scheduled_date` が保存後も古い値のまま
- 考えられる原因: イベント発火処理の欠如、イベントリスナーの未実装

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleSavePrice_fixed(X) 後の allListings[X.property_number]
  ASSERT result.price_reduction_scheduled_date = null
    AND calculatePropertyStatus(result).key ≠ 'price_reduction_due'
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同一の動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleSavePrice_original(X) = handleSavePrice_fixed(X)
END FOR
```

**Testing Approach**: 保存検証にプロパティベーステストを推奨する理由：
- 入力ドメイン全体で多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- 非バグ入力に対して動作が変わらないことを強く保証できる

**Test Plan**: まず未修正コードで `confirmation` 更新など他のフィールドの動作を観察し、
その動作を保持するプロパティベーステストを作成する。

**Test Cases**:
1. **confirmation更新の保持**: `propertyConfirmationUpdated` イベントによる即時更新が
   修正後も正常に動作することを確認
2. **price_reduction_scheduled_date 未変更時の保持**: `price_reduction_scheduled_date` を
   変更しない保存操作（価格のみ変更など）で `propertyPriceReductionUpdated` イベントが
   発火されないことを確認
3. **他カテゴリーへの影響なし**: 修正後も `unreported`、`incomplete` などの他のサイドバー
   カテゴリーのカウントが変わらないことを確認

### Unit Tests

- `handleSavePrice` が `price_reduction_scheduled_date` を含む変更を保存した後に
  `propertyPriceReductionUpdated` イベントを発火することをテスト
- `handleSavePrice` が `price_reduction_scheduled_date` を含まない変更を保存した場合に
  イベントを発火しないことをテスト
- `PropertyListingsPage` の `handlePriceReductionUpdate` が `allListings` を正しく更新することをテスト
- `pageDataCache.invalidate` が呼ばれることをテスト

### Property-Based Tests

- ランダムな物件ステートを生成し、`price_reduction_scheduled_date` を null に変更した後に
  `calculatePropertyStatus()` が `price_reduction_due` を返さないことを検証
- ランダムな物件リストを生成し、`propertyPriceReductionUpdated` イベント受信後に
  対象物件のみが更新されることを検証（他の物件は変わらない）
- `price_reduction_scheduled_date` が変更されない多数のシナリオで、
  既存の `confirmation` 更新動作が保持されることを検証

### Integration Tests

- 詳細画面で `price_reduction_scheduled_date` を削除して保存した後、
  サイドバーの「要値下げ」カウントが即座に減少することをテスト
- 詳細画面で `price_reduction_scheduled_date` に今日以前の日付を設定して保存した後、
  サイドバーの「要値下げ」カウントが即座に増加することをテスト
- `confirmation` の更新と `price_reduction_scheduled_date` の更新を組み合わせた場合に
  両方のイベントが正しく動作することをテスト
