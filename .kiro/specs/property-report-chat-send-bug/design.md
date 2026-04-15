# property-report-chat-send-bug バグ修正デザイン

## Overview

`PUT /api/property-listings/:propertyNumber` エンドポイントは、リクエストボディの内容に関わらず
無条件に `notifyGoogleChatOfferSaved` を呼び出している。
その結果、報告書ページ（`PropertyReportPage`）で特記事項・報告日・担当者などの
買付情報以外のフィールドを保存した場合でも、Google Chat へ買付チャット通知が誤送信される。

修正方針は最小限の変更で対応する。既存の `hasOfferUpdate` フラグ（買付フィールドの有無を判定済み）を
活用し、`notifyGoogleChatOfferSaved` の呼び出しを `if (hasOfferUpdate)` ブロック内に移動するだけでよい。

## Glossary

- **Bug_Condition (C)**: 買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）を
  一切含まないリクエストでも `notifyGoogleChatOfferSaved` が呼び出される状態
- **Property (P)**: 買付フィールドを含むリクエストの場合のみ `notifyGoogleChatOfferSaved` が呼び出されること
- **Preservation**: 買付フィールドを含む更新リクエストでは引き続き Google Chat 通知が送信されること
- **hasOfferUpdate**: `OFFER_FIELDS`（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）の
  いずれかが `updates` に含まれる場合に `true` となる既存フラグ（`backend/src/routes/propertyListings.ts` 内）
- **notifyGoogleChatOfferSaved**: Google Chat Webhook へ買付情報通知を送信するヘルパー関数
- **OFFER_FIELDS**: `['offer_date', 'offer_status', 'offer_amount', 'offer_comment']` の定数配列

## Bug Details

### Bug Condition

買付フィールドを含まないリクエスト（例：報告書ページからの保存）でも
`notifyGoogleChatOfferSaved` が無条件に呼び出される。
`hasOfferUpdate` フラグは既に正しく計算されているが、通知呼び出しがそのフラグの条件外に置かれている。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListingUpdateRequest
  OUTPUT: boolean

  // 買付フィールドが一切含まれないリクエストでも通知が送信される
  RETURN NOT (X.updates contains any of ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'])
END FUNCTION
```

### Examples

- 報告書ページで `special_notes`（特記事項）のみ更新 → 買付チャットが誤送信される（バグ）
- 報告書ページで `report_date`（報告日）のみ更新 → 買付チャットが誤送信される（バグ）
- 物件詳細ページで `offer_status` を更新 → 買付チャットが送信される（正常）
- 物件詳細ページで `offer_date` と `offer_amount` を同時更新 → 買付チャットが送信される（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）を含む更新リクエストでは
  引き続き Google Chat へ買付情報通知が送信される
- 買付フィールドを含む更新成功時に `offer_status_updated_at` が現在時刻で記録される
- 買付フィールドに空文字列が含まれる場合、null に変換してから保存される

**Scope:**
買付フィールドを含まない全てのリクエストは `notifyGoogleChatOfferSaved` の呼び出しから除外される。
これには以下が含まれる：
- 報告書ページからの保存（`special_notes`, `report_date`, `sales_assignee` など）
- ステータス変更のみの更新
- 価格・住所などの基本情報のみの更新

## Hypothesized Root Cause

コードレビューにより根本原因は明確に特定されている：

1. **条件ガードの欠落**: `notifyGoogleChatOfferSaved` の呼び出しが `if (hasOfferUpdate)` ブロックの外側に
   記述されている。`hasOfferUpdate` フラグ自体は正しく計算されているが、通知呼び出しがそれを参照していない。

2. **実装時の見落とし**: `offer_status_updated_at` の記録は `if (hasOfferUpdate)` で正しくガードされているが、
   通知呼び出しは同じガードが適用されなかった。

3. **他の根本原因の可能性**: なし。コードを直接確認した結果、問題箇所は一箇所のみ。

## Correctness Properties

Property 1: Bug Condition - 買付フィールド不在時は通知を送信しない

_For any_ リクエストで買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）が
一切含まれない場合（isBugCondition が true を返す場合）、修正後の PUT ハンドラーは
`notifyGoogleChatOfferSaved` を呼び出してはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 買付フィールド存在時は通知を送信する

_For any_ リクエストで買付フィールドのいずれかが含まれる場合（isBugCondition が false を返す場合）、
修正後の PUT ハンドラーは修正前と同様に `notifyGoogleChatOfferSaved` を呼び出し、
Google Chat へ買付情報通知を送信する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/routes/propertyListings.ts`

**Function**: `router.put('/:propertyNumber', ...)` ハンドラー内

**Specific Changes**:

1. **通知呼び出しを条件ブロック内に移動**: `notifyGoogleChatOfferSaved(...)` の呼び出し全体を
   `if (hasOfferUpdate) { ... }` ブロックで囲む

**修正前:**
```typescript
const data = await propertyListingService.update(propertyNumber, updates);

// 買付情報保存成功後、非同期で Google Chat に通知する（await しない）
notifyGoogleChatOfferSaved(propertyNumber, {
  offer_date: data?.offer_date ?? updates.offer_date,
  offer_status: data?.offer_status ?? updates.offer_status,
  offer_comment: data?.offer_comment ?? updates.offer_comment,
  offer_amount: data?.offer_amount ?? updates.offer_amount,
  address: data?.address,
  display_address: data?.display_address,
  property_type: data?.property_type,
  sales_assignee: data?.sales_assignee,
});
```

**修正後:**
```typescript
const data = await propertyListingService.update(propertyNumber, updates);

// 買付フィールドが含まれる場合のみ Google Chat に通知する
if (hasOfferUpdate) {
  notifyGoogleChatOfferSaved(propertyNumber, {
    offer_date: data?.offer_date ?? updates.offer_date,
    offer_status: data?.offer_status ?? updates.offer_status,
    offer_comment: data?.offer_comment ?? updates.offer_comment,
    offer_amount: data?.offer_amount ?? updates.offer_amount,
    address: data?.address,
    display_address: data?.display_address,
    property_type: data?.property_type,
    sales_assignee: data?.sales_assignee,
  });
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチで検証する。まず未修正コードでバグを再現するテストを実行し、
次に修正後のコードで正しい動作と既存動作の保持を確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `PUT /:propertyNumber` ハンドラーをモックし、買付フィールドを含まないリクエストを送信して
`notifyGoogleChatOfferSaved` が呼び出されることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **特記事項のみ更新**: `{ special_notes: "テスト" }` を送信 → 未修正コードでは通知が呼ばれる（バグ確認）
2. **報告日のみ更新**: `{ report_date: "2026-01-01" }` を送信 → 未修正コードでは通知が呼ばれる（バグ確認）
3. **ステータスのみ更新**: `{ status: "販売中" }` を送信 → 未修正コードでは通知が呼ばれる（バグ確認）
4. **空のボディ**: `{}` を送信 → 未修正コードでは通知が呼ばれる（バグ確認）

**Expected Counterexamples**:
- 買付フィールドを含まないリクエストで `notifyGoogleChatOfferSaved` が呼び出される
- 原因: `notifyGoogleChatOfferSaved` の呼び出しが `if (hasOfferUpdate)` の外側にある

### Fix Checking

**Goal**: 修正後のコードで、買付フィールドを含まないリクエストでは通知が呼ばれないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← PUT_handler_fixed(X)
  ASSERT notifyGoogleChatOfferSaved was NOT called
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、買付フィールドを含むリクエストでは引き続き通知が送信されることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT PUT_handler_original(X) calls notifyGoogleChatOfferSaved
  ASSERT PUT_handler_fixed(X) calls notifyGoogleChatOfferSaved
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 買付フィールドの組み合わせ（4フィールド × 有無）を網羅的に生成できる
- 手動テストでは見落としやすいエッジケース（一部フィールドのみ含む場合など）を自動検出できる
- 修正後も全ての買付フィールド組み合わせで通知が送信されることを保証できる

**Test Cases**:
1. **買付日のみ更新**: `{ offer_date: "2026-01-01" }` → 通知が送信されること
2. **買付状況のみ更新**: `{ offer_status: "交渉中" }` → 通知が送信されること
3. **全買付フィールド更新**: 4フィールド全て含む → 通知が送信されること
4. **買付フィールド＋他フィールド混在**: `{ offer_date: "...", special_notes: "..." }` → 通知が送信されること

### Unit Tests

- 買付フィールドを含まないリクエストで `notifyGoogleChatOfferSaved` が呼ばれないことを確認
- 買付フィールドを含むリクエストで `notifyGoogleChatOfferSaved` が呼ばれることを確認
- 空文字列の買付フィールドが null に変換されることを確認
- `offer_status_updated_at` が買付フィールド更新時のみ記録されることを確認

### Property-Based Tests

- ランダムな非買付フィールドの組み合わせを生成し、通知が呼ばれないことを検証（Fix Checking）
- ランダムな買付フィールドの組み合わせ（少なくとも1つ含む）を生成し、通知が呼ばれることを検証（Preservation Checking）
- 買付フィールドと非買付フィールドの混在パターンを生成し、買付フィールドが含まれる場合は通知が送信されることを検証

### Integration Tests

- 報告書ページからの保存フロー全体で Google Chat 通知が送信されないことを確認
- 物件詳細ページの買付情報セクションからの保存フロー全体で Google Chat 通知が送信されることを確認
- 買付フィールドと非買付フィールドを同時に更新した場合に通知が送信されることを確認
