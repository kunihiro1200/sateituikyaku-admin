# buyer-viewing-notification-sender-fix バグ修正デザイン

## Overview

買主詳細ページ（`BuyerDetailPage.tsx`）の内覧セクションに「通知送信者」（`notification_sender`）と「内覧形態」（`viewing_type`）の2フィールドが表示されていない。また、`BuyerStatusCalculator.ts` の Priority 3（内覧日前日）の判定条件に `notification_sender` の入力済みチェックが欠けており、通知送信者が入力済みの買主でも「内覧日前日」サイドバーカテゴリーに表示され続けるという不具合がある。

**バグ1**: `BUYER_FIELD_SECTIONS` の内覧セクションに `notification_sender`（通知送信者）と `viewing_type`（内覧形態）フィールドが定義されていないため、買主詳細ページに表示されない。

**バグ2**: `BuyerStatusCalculator.ts` の Priority 3 判定条件に `isBlank(buyer.notification_sender)` の条件が欠けており、通知送信者が入力済みの買主が「内覧日前日」カテゴリーに表示され続ける。

**確認事項**: `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` には `notification_sender`、`viewing_type`、`viewing_type_general` の3フィールドがすでにマッピング済みであるため、カラムマッピングの変更は不要。

## Glossary

- **notification_sender**: 通知送信者フィールド（スプレッドシートBS列）。内覧前日通知を送信した担当者名が入力される
- **viewing_type**: 内覧形態フィールド（スプレッドシートBI列）。内覧の形態（例：一般媒介、専任など）が入力される
- **viewing_type_general**: 内覧形態_一般媒介フィールド（スプレッドシートFQ列）。Priority 8（一般媒介_内覧後売主連絡未）ですでに使用中
- **Priority 3**: `BuyerStatusCalculator.ts` の「内覧日前日」ステータス判定。内覧日が翌日（木曜日の場合は2日後）かつ業者問合せでない場合に適用される
- **BUYER_FIELD_SECTIONS**: `BuyerDetailPage.tsx` 内の定数。買主詳細ページに表示するフィールドをセクションごとに定義する
- **isBlank**: `fieldHelpers.ts` のユーティリティ関数。フィールドが空欄（null/undefined/空文字）かどうかを判定する

## Bug Details

### Bug Condition

**バグ1**: `BUYER_FIELD_SECTIONS` の内覧セクション（「内覧結果・後続対応」または類似セクション）に `notification_sender` と `viewing_type` フィールドが含まれていない。

**バグ2**: `calculateBuyerStatus` 関数の Priority 3 判定において、`notification_sender` が入力済みの場合でも「内覧日前日」ステータスに分類される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerData
  OUTPUT: boolean

  // バグ2の条件
  BUG2 = (input.notification_sender IS NOT NULL AND NOT EMPTY)
         AND (input.broker_inquiry != '業者問合せ')
         AND (input.latest_viewing_date IS NOT NULL)
         AND (
           (isTomorrow(input.latest_viewing_date) AND getDayOfWeek(input.latest_viewing_date) != '木曜日')
           OR
           (isDaysFromToday(input.latest_viewing_date, 2) AND getDayOfWeek(input.latest_viewing_date) = '木曜日')
         )
         AND (calculateBuyerStatus(input).status = '内覧日前日')

  RETURN BUG2
END FUNCTION
```

### Examples

- **バグ2の例（買主番号7240）**: `notification_sender = '山田'`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」になる（期待: 「内覧日前日」にならない）
- **バグ2の例（木曜）**: `notification_sender = '山田'`、`latest_viewing_date = 木曜日（2日後）` → ステータスが「内覧日前日」になる（期待: 「内覧日前日」にならない）
- **正常ケース**: `notification_sender = null`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」になる（期待通り）

## Architecture

本バグ修正は以下の3ファイルに対する最小限の変更で対応する。

```
frontend/frontend/src/pages/BuyerDetailPage.tsx
  └── BUYER_FIELD_SECTIONS に内覧セクションを追加
      ├── notification_sender（通知送信者）
      └── viewing_type（内覧形態）

backend/src/services/BuyerStatusCalculator.ts
  └── Priority 3 の条件に isBlank(buyer.notification_sender) を追加

backend/src/config/buyer-column-mapping.json
  └── 変更不要（3フィールドともすでにマッピング済み）
```

## Components and Interfaces

### BuyerDetailPage.tsx の変更

`BUYER_FIELD_SECTIONS` に内覧セクションを追加する。既存の内覧関連フィールド（`latest_viewing_date`、`viewing_result_follow_up` 等）が別途レンダリングされている場合は、それらと同じセクションに追加する。

追加するフィールド定義:
```typescript
{ key: 'notification_sender', label: '通知送信者', inlineEditable: true },
{ key: 'viewing_type', label: '内覧形態', inlineEditable: true },
```

### BuyerStatusCalculator.ts の変更

Priority 3 の条件に `isBlank(buyer.notification_sender)` を追加する。

**修正前:**
```typescript
// Priority 3: 内覧日前日（業者問合せは除外）
if (
  and(
    isNotBlank(buyer.latest_viewing_date),
    not(equals(buyer.broker_inquiry, '業者問合せ')),
    or(
      and(isTomorrow(buyer.latest_viewing_date), not(equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))),
      and(isDaysFromToday(buyer.latest_viewing_date, 2), equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))
    )
  )
)
```

**修正後:**
```typescript
// Priority 3: 内覧日前日（業者問合せは除外、通知送信者が入力済みの場合も除外）
if (
  and(
    isNotBlank(buyer.latest_viewing_date),
    not(equals(buyer.broker_inquiry, '業者問合せ')),
    isBlank(buyer.notification_sender),  // ← 追加
    or(
      and(isTomorrow(buyer.latest_viewing_date), not(equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))),
      and(isDaysFromToday(buyer.latest_viewing_date, 2), equals(getDayOfWeek(buyer.latest_viewing_date), '木曜日'))
    )
  )
)
```

## Data Models

### BuyerData インターフェース（確認済み）

`BuyerStatusCalculator.ts` の `BuyerData` インターフェースには `notification_sender` フィールドがすでに定義されている:

```typescript
export interface BuyerData {
  // ...
  notification_sender?: string | null;
  viewing_type_general?: string | null;
  // ...
}
```

`viewing_type` フィールドは `BuyerData` インターフェースに含まれていないが、これはステータス計算に使用しないため問題ない。フロントエンドの `Buyer` インターフェースは `[key: string]: any` の動的型定義を使用しているため、追加の型定義変更は不要。

### buyer-column-mapping.json（変更不要）

`spreadsheetToDatabaseExtended` に以下がすでに定義済み:
- `"通知送信者": "notification_sender"` （BS列）
- `"内覧形態": "viewing_type"` （BI列）
- `"内覧形態_一般媒介": "viewing_type_general"` （FQ列）

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される

*For any* 買主データ where `notification_sender` が入力済み（非空欄）かつ `broker_inquiry` が「業者問合せ」以外かつ `latest_viewing_date` が翌日（木曜日の場合は2日後）である場合、`calculateBuyerStatus` 関数は `status = '内覧日前日'` を返さないものとする。

**Validates: Requirements 2.3**

### Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける

*For any* 買主データ where `notification_sender` が空欄かつ `broker_inquiry` が「業者問合せ」以外かつ `latest_viewing_date` が翌日（木曜日の場合は2日後）である場合、`calculateBuyerStatus` 関数は `status = '内覧日前日'` を返し続けるものとする。

**Validates: Requirements 3.1, 3.2**

### Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける

*For any* 買主データ where `broker_inquiry = '業者問合せ'` かつ `latest_viewing_date` が翌日（木曜日の場合は2日後）である場合、`calculateBuyerStatus` 関数は `status = '内覧日前日'` を返さないものとする。

**Validates: Requirements 3.3**

## Error Handling

本修正はフィールド表示の追加とステータス計算条件の追加であり、新たなエラーパスは発生しない。

- `notification_sender` が `null` または `undefined` の場合、`isBlank()` は `true` を返すため、既存の動作（内覧日前日カテゴリーに表示）が維持される
- `viewing_type` が `null` または `undefined` の場合、フロントエンドは空欄として表示する（既存の `InlineEditableField` の動作に準拠）

## Testing Strategy

### ユニットテスト（BuyerStatusCalculator）

`backend/src/services/__tests__/BuyerStatusCalculator.bugfix.test.ts` に以下のテストケースを追加する。

**バグ修正確認テスト:**
1. `notification_sender = '山田'`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」以外であることを確認
2. `notification_sender = '山田'`、`latest_viewing_date = 木曜日（2日後）` → ステータスが「内覧日前日」以外であることを確認

**リグレッション防止テスト:**
3. `notification_sender = null`、`latest_viewing_date = 明日`、`broker_inquiry = null` → ステータスが「内覧日前日」であることを確認
4. `notification_sender = ''`（空文字）、`latest_viewing_date = 明日` → ステータスが「内覧日前日」であることを確認
5. `broker_inquiry = '業者問合せ'`、`notification_sender = null`、`latest_viewing_date = 明日` → ステータスが「内覧日前日」以外であることを確認（既存の業者問合せ除外ロジックの保持）

### プロパティベーステスト

**ライブラリ**: `fast-check`（既存プロジェクトで使用中）

**最小実行回数**: 100回

各プロパティテストには以下のタグコメントを付与する:
- `// Feature: buyer-viewing-notification-sender-fix, Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される`
- `// Feature: buyer-viewing-notification-sender-fix, Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける`
- `// Feature: buyer-viewing-notification-sender-fix, Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける`

**Property 1 テスト（通知送信者入力済みで除外）:**
```typescript
// Feature: buyer-viewing-notification-sender-fix, Property 1: 通知送信者入力済みの場合は内覧日前日カテゴリーから除外される
fc.assert(fc.property(
  fc.string({ minLength: 1 }),  // 非空の notification_sender
  fc.constantFrom(null, '', undefined, '個人', 'SUUMO'),  // broker_inquiry（業者問合せ以外）
  (notificationSender, brokerInquiry) => {
    const buyer = makeTomorrowViewingBuyer({ notification_sender: notificationSender, broker_inquiry: brokerInquiry });
    const result = calculateBuyerStatus(buyer);
    return result.status !== '内覧日前日';
  }
), { numRuns: 100 });
```

**Property 2 テスト（通知送信者空欄で表示継続）:**
```typescript
// Feature: buyer-viewing-notification-sender-fix, Property 2: 通知送信者が空欄の場合は内覧日前日カテゴリーに表示され続ける
fc.assert(fc.property(
  fc.constantFrom(null, '', undefined),  // 空欄の notification_sender
  fc.constantFrom(null, '', undefined, '個人', 'SUUMO'),  // broker_inquiry（業者問合せ以外）
  (notificationSender, brokerInquiry) => {
    const buyer = makeTomorrowViewingBuyer({ notification_sender: notificationSender, broker_inquiry: brokerInquiry });
    const result = calculateBuyerStatus(buyer);
    return result.status === '内覧日前日';
  }
), { numRuns: 100 });
```

**Property 3 テスト（業者問合せ除外の保持）:**
```typescript
// Feature: buyer-viewing-notification-sender-fix, Property 3: 業者問合せの場合は内覧日前日カテゴリーから除外され続ける
fc.assert(fc.property(
  fc.constantFrom(null, '', '山田', '鈴木'),  // 任意の notification_sender
  (notificationSender) => {
    const buyer = makeTomorrowViewingBuyer({ notification_sender: notificationSender, broker_inquiry: '業者問合せ' });
    const result = calculateBuyerStatus(buyer);
    return result.status !== '内覧日前日';
  }
), { numRuns: 100 });
```

### フロントエンドテスト

`BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に `notification_sender` と `viewing_type` が含まれていることを確認するスナップショットテストまたはユニットテストを追加する。

**確認内容:**
- `BUYER_FIELD_SECTIONS` のいずれかのセクションに `key: 'notification_sender'` のフィールドが存在すること
- `BUYER_FIELD_SECTIONS` のいずれかのセクションに `key: 'viewing_type'` のフィールドが存在すること
- 既存フィールド（`latest_viewing_date`、`viewing_result_follow_up` 等）が引き続き存在すること

### 手動確認

1. 買主番号 7240 の詳細ページを開き、「通知送信者」と「内覧形態」フィールドが表示されることを確認
2. 買主番号 7240 がサイドバーの「内覧日前日」カテゴリーに表示されなくなることを確認
3. `notification_sender` が空欄の別の買主が、内覧日前日条件を満たす場合に「内覧日前日」カテゴリーに引き続き表示されることを確認
