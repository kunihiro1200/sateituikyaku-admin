# 買付ステータスバッジ表示優先順位バグ 設計書

## Overview

物件詳細ヘッダー（PropertyListingDetailPage）に表示される買付ステータスバッジが、2つのデータソース（`offer_status` と買主の `latest_status`）のうち「更新日時が新しい方」を表示すべきところ、常に買主の `latest_status`（「買」を含む）を固定優先してしまっている。

物件AA9406において「買付外れました」という古い買主ステータスがヘッダーに表示されたまま、後から更新した「一般他決」の `offer_status` が反映されない問題が発生している。

修正方針：
1. `property_listings` テーブルに `offer_status_updated_at` カラムを追加し、`offer_status` 保存時に記録する
2. `buyers` テーブルに `latest_status_updated_at` カラムを追加し、`latest_status` 更新時に記録する
3. フロントエンドの `getPurchaseStatusText` 関数を「更新日時が新しい方を優先」するロジックに変更する
4. バックエンドの `/buyers` エンドポイントで `latest_status_updated_at` を返す

## Glossary

- **Bug_Condition (C)**: `offer_status` の更新日時が買主 `latest_status` の更新日時より新しいにもかかわらず、買主 `latest_status` が優先表示される状態
- **Property (P)**: 更新日時が新しい方のステータスがヘッダーバッジに表示されること
- **Preservation**: `offer_status` のみ存在する場合・買主 `latest_status` のみ存在する場合・両方なしの場合の既存動作が変わらないこと
- **getPurchaseStatusText**: `frontend/frontend/src/utils/purchaseStatusUtils.ts` 内の関数。2つのデータソースからバッジ表示テキストを決定する
- **offer_status_updated_at**: `property_listings` テーブルに追加する新カラム。`offer_status` が最後に更新された日時
- **latest_status_updated_at**: `buyers` テーブルに追加する新カラム。`latest_status` が最後に更新された日時

## Bug Details

### Bug Condition

`offer_status` の更新日時が買主 `latest_status` の更新日時より新しい場合でも、`getPurchaseStatusText` 関数が常に買主 `latest_status`（「買」を含む）を優先して返してしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(offerStatus, offerStatusUpdatedAt, buyerLatestStatus, buyerLatestStatusUpdatedAt)
  INPUT:
    offerStatus: string | null
    offerStatusUpdatedAt: string | null  -- ISO8601 タイムスタンプ
    buyerLatestStatus: string | null
    buyerLatestStatusUpdatedAt: string | null  -- ISO8601 タイムスタンプ
  OUTPUT: boolean

  RETURN offerStatus IS NOT NULL
         AND offerStatus != ""
         AND buyerLatestStatus IS NOT NULL
         AND buyerLatestStatus INCLUDES "買"
         AND offerStatusUpdatedAt > buyerLatestStatusUpdatedAt
         AND getPurchaseStatusText_current(buyerLatestStatus, offerStatus) != offerStatus
END FUNCTION
```

### Examples

- **バグあり**: `offer_status = "一般他決"` (2025-06-10更新)、`latest_status = "買付外れました"` (2025-06-01更新) → 現在: "買付外れました" 表示（誤）、期待: "一般他決" 表示
- **正常**: `offer_status = "一般他決"` (2025-06-01更新)、`latest_status = "買付外れました"` (2025-06-10更新) → 現在: "買付外れました" 表示（正）
- **エッジケース**: `offer_status` のみ存在 → "offer_status" を表示（変更なし）
- **エッジケース**: 買主 `latest_status`（「買」含む）のみ存在 → 買主 `latest_status` を表示（変更なし）

## Expected Behavior

### Preservation Requirements

**変更しない動作:**
- `offer_status` のみ存在し、買主 `latest_status` に「買」が含まれない場合は `offer_status` を表示し続ける
- 買主 `latest_status`（「買」含む）のみ存在し、`offer_status` が存在しない場合は買主 `latest_status` を表示し続ける
- `offer_status` も買主 `latest_status`（「買」含む）も存在しない場合はバッジを非表示にし続ける
- 買付情報の保存処理（バリデーション、保存API呼び出し）は変更しない
- バッジのスタイル・アニメーションは変更しない

**Scope:**
更新日時タイムスタンプの比較ロジックのみを変更する。両方のステータスが存在する場合の優先順位決定ロジックのみが影響を受ける。

## Hypothesized Root Cause

現在の `getPurchaseStatusText` 関数（`frontend/frontend/src/utils/purchaseStatusUtils.ts`）の実装：

```typescript
export function getPurchaseStatusText(
  latestStatus: string | null | undefined,
  offerStatus: string | null | undefined
): string | null {
  // 条件1: latest_status に「買」が含まれる場合 → 常に優先（バグの原因）
  if (hasBuyerPurchaseStatus(latestStatus)) {
    return latestStatus as string;
  }
  // 条件2: offer_status に空でない値がある場合
  if (hasPropertyOfferStatus(offerStatus)) {
    return offerStatus as string;
  }
  return null;
}
```

**根本原因**: 更新日時を考慮せず、`latest_status` に「買」が含まれれば無条件に優先する固定優先順位ロジックになっている。

**副次的原因**: 
1. `property_listings` テーブルに `offer_status_updated_at` カラムが存在しない
2. `buyers` テーブルに `latest_status_updated_at` カラムが存在しない
3. バックエンドの `/buyers` エンドポイントが `latest_status_updated_at` を返していない
4. フロントエンドの `Buyer` インターフェースに `latest_status_updated_at` フィールドがない

## Correctness Properties

Property 1: Bug Condition - 更新日時が新しい方のステータスを表示

_For any_ 入力において `offer_status` と買主 `latest_status`（「買」含む）の両方が存在し、かつ `offer_status_updated_at > latest_status_updated_at` の場合、修正後の `getPurchaseStatusText` 関数は `offer_status` を返す。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 片方のみ存在する場合の動作保持

_For any_ 入力において `offer_status` のみ存在する場合、または買主 `latest_status`（「買」含む）のみ存在する場合、修正後の関数は修正前と同じ結果を返し、既存の表示動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**変更1: DBマイグレーション（新カラム追加）**

`property_listings` テーブルに `offer_status_updated_at` カラムを追加：
```sql
ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS offer_status_updated_at TIMESTAMPTZ;
```

`buyers` テーブルに `latest_status_updated_at` カラムを追加：
```sql
ALTER TABLE public.buyers
ADD COLUMN IF NOT EXISTS latest_status_updated_at TIMESTAMPTZ;
```

---

**変更2: バックエンド - offer_status保存時にタイムスタンプを記録**

ファイル: `backend/src/routes/propertyListings.ts`

`offer_status` を含む更新リクエスト時に `offer_status_updated_at` を自動セット：
```typescript
// OFFER_FIELDSのいずれかが更新される場合、offer_status_updated_atを記録
const OFFER_FIELDS = ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'];
const hasOfferUpdate = OFFER_FIELDS.some(f => updates[f] !== undefined);
if (hasOfferUpdate) {
  updates.offer_status_updated_at = new Date().toISOString();
}
```

---

**変更3: バックエンド - latest_status更新時にタイムスタンプを記録**

ファイル: `backend/src/services/BuyerService.ts`

`latest_status` 更新時に `latest_status_updated_at` を自動セット：
```typescript
if (allowedData.latest_status !== undefined) {
  allowedData.latest_status_updated_at = new Date().toISOString();
}
```

---

**変更4: バックエンド - /buyersエンドポイントでlatest_status_updated_atを返す**

ファイル: `backend/src/services/BuyerLinkageService.ts`

`getBuyersForProperty` のSELECTクエリに `latest_status_updated_at` を追加：
```typescript
.select(`
  buyer_id,
  buyer_number,
  name,
  phone_number,
  email,
  latest_status,
  latest_status_updated_at,  // 追加
  inquiry_confidence,
  reception_date,
  latest_viewing_date,
  viewing_time,
  next_call_date
`)
```

---

**変更5: フロントエンド - Buyerインターフェースにlatest_status_updated_atを追加**

ファイル: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

```typescript
interface Buyer {
  // ... 既存フィールド
  latest_status_updated_at?: string;  // 追加
}
```

---

**変更6: フロントエンド - getPurchaseStatusTextを更新日時比較ロジックに変更**

ファイル: `frontend/frontend/src/utils/purchaseStatusUtils.ts`

```typescript
export function getPurchaseStatusText(
  latestStatus: string | null | undefined,
  offerStatus: string | null | undefined,
  latestStatusUpdatedAt?: string | null,
  offerStatusUpdatedAt?: string | null
): string | null {
  const hasBuyer = hasBuyerPurchaseStatus(latestStatus);
  const hasOffer = hasPropertyOfferStatus(offerStatus);

  // 両方存在する場合: 更新日時が新しい方を優先
  if (hasBuyer && hasOffer) {
    if (latestStatusUpdatedAt && offerStatusUpdatedAt) {
      return latestStatusUpdatedAt > offerStatusUpdatedAt
        ? (latestStatus as string)
        : (offerStatus as string);
    }
    // タイムスタンプがない場合はoffer_statusを優先（より最近の操作と推定）
    return offerStatus as string;
  }

  // 片方のみ存在する場合
  if (hasBuyer) return latestStatus as string;
  if (hasOffer) return offerStatus as string;
  return null;
}
```

---

**変更7: フロントエンド - PropertyListingDetailPageの呼び出し箇所を更新**

ファイル: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

```typescript
<PurchaseStatusBadge
  statusText={getPurchaseStatusText(
    buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
    data.offer_status,
    buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status_updated_at,
    data.offer_status_updated_at
  )}
/>
```

また `PropertyListing` インターフェースに `offer_status_updated_at` を追加：
```typescript
interface PropertyListing {
  // ... 既存フィールド
  offer_status_updated_at?: string;  // 追加
}
```

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず修正前コードでバグを再現するカウンターエグザンプルを記録し、次に修正後コードで正しい動作を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `getPurchaseStatusText` 関数に対して、`offer_status` の方が新しいシナリオを入力し、現在の実装が誤った結果を返すことを確認する。

**Test Cases**:
1. **優先順位逆転テスト**: `offer_status = "一般他決"` (新)、`latest_status = "買付外れました"` (旧) → 現在の実装は "買付外れました" を返す（バグ）
2. **タイムスタンプなしテスト**: タイムスタンプが両方nullの場合の動作確認
3. **片方のみテスト**: `offer_status` のみ存在する場合（修正前後で同じ動作であることを確認）
4. **両方なしテスト**: 両方nullの場合（修正前後で同じ動作であることを確認）

**Expected Counterexamples**:
- `getPurchaseStatusText("買付外れました", "一般他決")` が `"買付外れました"` を返す（期待値: `"一般他決"`）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getPurchaseStatusText_fixed(
    input.latestStatus,
    input.offerStatus,
    input.latestStatusUpdatedAt,
    input.offerStatusUpdatedAt
  )
  ASSERT result == input.offerStatus  -- offer_statusの方が新しいので優先
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正前後で同じ結果を返すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getPurchaseStatusText_original(input) == getPurchaseStatusText_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多数のランダム入力で保存動作が変わらないことを確認する。

**Test Cases**:
1. **offer_statusのみ存在**: `latest_status = null` → 修正前後で `offer_status` を返す
2. **latest_statusのみ存在**: `offer_status = null` → 修正前後で `latest_status` を返す
3. **両方なし**: 両方 `null` → 修正前後で `null` を返す
4. **latest_statusが新しい場合**: `latest_status_updated_at > offer_status_updated_at` → 修正前後で `latest_status` を返す

### Unit Tests

- `getPurchaseStatusText` の全分岐をカバーするユニットテスト
- タイムスタンプあり・なしの両パターン
- 境界値（同一タイムスタンプ）のテスト

### Property-Based Tests

- ランダムなタイムスタンプペアを生成し、常に新しい方が選ばれることを確認
- ランダムなステータス値で片方のみ存在する場合の保存動作を確認
- 多数のシナリオで `null` 返却条件が正しいことを確認

### Integration Tests

- AA9406の実データを使った動作確認（`offer_status` 更新後にバッジが切り替わること）
- `offer_status` 保存時に `offer_status_updated_at` が記録されること
- `latest_status` 更新時に `latest_status_updated_at` が記録されること
