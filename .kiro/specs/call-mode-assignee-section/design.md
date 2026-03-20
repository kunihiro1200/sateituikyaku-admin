# Design Document: call-mode-assignee-section

## Overview

通話モードページ（CallModePage）の「追客の活動ログ」セクション（`FollowUpLogHistoryTable`）の直上に、「担当者設定」セクションを追加する。

このセクションでは、7つのフィールド（6つの担当者フィールド + 1つのテキスト入力フィールド）をスタッフのイニシャルボタンで選択・保存できる。担当者選択は即時保存、査定理由テキストは1秒デバウンス後に自動保存する。

---

## Architecture

### 全体フロー

```
[CallModePage]
  └─ [AssigneeSectionコンポーネント]
       ├─ GET /api/employees/active-initials  → スタッフイニシャル取得
       ├─ 初期値: seller.unreachableSmsAssignee 等
       ├─ PUT /api/sellers/:id  → 担当者選択時に即時保存
       └─ PUT /api/sellers/:id  → 査定理由テキスト変更後1秒デバウンス保存
```

### データフロー

```
スプレッドシート（CS/CT/DL/AO/AF/CX/CO列）
  ↕ 5分ごと定期同期（EnhancedAutoSyncService）
Supabase DB（sellersテーブル）
  ↕ PUT /api/sellers/:id（即時）
フロントエンド（CallModePage → AssigneeSection）
```

---

## Components and Interfaces

### 新規コンポーネント: `AssigneeSection`

**ファイルパス**: `frontend/frontend/src/components/AssigneeSection.tsx`

```typescript
interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
}
```

**内部状態**:
- `initials: string[]` — `/api/employees/active-initials` から取得したイニシャル一覧
- `localValues: AssigneeValues` — 各フィールドのローカル状態
- `valuationReason: string` — 査定理由テキスト（デバウンス用）

**フィールド定義**:

```typescript
interface AssigneeFieldConfig {
  label: string;           // 表示ラベル
  sellerKey: keyof Seller; // Seller型のフィールド名
  fieldType: 'assignee' | 'text'; // ボタン選択 or テキスト入力
}

const ASSIGNEE_FIELDS: AssigneeFieldConfig[] = [
  { label: '不通時Sメール担当',                    sellerKey: 'unreachableSmsAssignee',       fieldType: 'assignee' },
  { label: '査定Sメール担当',                      sellerKey: 'valuationSmsAssignee',         fieldType: 'assignee' },
  { label: '査定理由別３後Eメ担',                  sellerKey: 'valuationReasonEmailAssignee', fieldType: 'assignee' },
  { label: '査定理由（査定サイトから転記）',        sellerKey: 'valuationReason',              fieldType: 'text'     },
  { label: 'キャンセル案内担当',                   sellerKey: 'cancelNoticeAssignee',         fieldType: 'assignee' },
  { label: '除外前、長期客メール担当',              sellerKey: 'longTermEmailAssignee',        fieldType: 'assignee' },
  { label: '当社が電話したというリマインドメール担当', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },
];
```

### 既存コンポーネントへの変更: `CallModePage`

`FollowUpLogHistoryTable` の直上に `AssigneeSection` を追加する。

```tsx
{/* 担当者設定セクション */}
{seller && (
  <AssigneeSection
    seller={seller}
    onUpdate={(fields) => setSeller(prev => prev ? { ...prev, ...fields } : prev)}
  />
)}

{/* 追客ログ履歴（APPSHEET） */}
{seller?.sellerNumber && (
  <FollowUpLogHistoryTable sellerNumber={seller.sellerNumber} />
)}
```

### バックエンドAPI

既存の `PUT /api/sellers/:id` エンドポイントを使用する（新規エンドポイント不要）。

---

## Data Models

### DBマイグレーション（101番）

**ファイルパス**: `backend/migrations/101_add_assignee_fields_to_sellers.sql`

```sql
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS unreachable_sms_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_sms_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_reason_email_assignee TEXT,
  ADD COLUMN IF NOT EXISTS valuation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_notice_assignee TEXT,
  ADD COLUMN IF NOT EXISTS long_term_email_assignee TEXT,
  ADD COLUMN IF NOT EXISTS call_reminder_email_assignee TEXT;
```

### バックエンド型定義の更新

**ファイルパス**: `backend/src/types/index.ts` — `Seller` インターフェースに追加

```typescript
// 担当者設定フィールド（call-mode-assignee-section）
unreachableSmsAssignee?: string;       // 不通時Sメール担当
valuationSmsAssignee?: string;         // 査定Sメール担当
valuationReasonEmailAssignee?: string; // 査定理由別３後Eメ担
valuationReason?: string;              // 査定理由（AO列）
cancelNoticeAssignee?: string;         // キャンセル案内担当（既存フィールドを活用）
longTermEmailAssignee?: string;        // 除外前、長期客メール担当
callReminderEmailAssignee?: string;    // 当社が電話したというリマインドメール担当
```

> 注意: `cancelNoticeAssignee` はバックエンド型定義に既に存在する。DBカラムとマッピングを追加するのみ。

### `decryptSeller` メソッドへの追加

**ファイルパス**: `backend/src/services/SellerService.supabase.ts`

```typescript
// 担当者設定フィールド（call-mode-assignee-section）
unreachableSmsAssignee: seller.unreachable_sms_assignee,
valuationSmsAssignee: seller.valuation_sms_assignee,
valuationReasonEmailAssignee: seller.valuation_reason_email_assignee,
valuationReason: seller.valuation_reason,
cancelNoticeAssignee: seller.cancel_notice_assignee,
longTermEmailAssignee: seller.long_term_email_assignee,
callReminderEmailAssignee: seller.call_reminder_email_assignee,
```

### フロントエンド型定義の更新

**ファイルパス**: `frontend/frontend/src/types/index.ts` — `Seller` インターフェースに追加

```typescript
// 担当者設定フィールド（call-mode-assignee-section）
unreachableSmsAssignee?: string;
valuationSmsAssignee?: string;
valuationReasonEmailAssignee?: string;
valuationReason?: string;
cancelNoticeAssignee?: string;
longTermEmailAssignee?: string;
callReminderEmailAssignee?: string;
```

### スプレッドシートカラムマッピングの更新

**ファイルパス**: `backend/src/config/column-mapping.json`

`spreadsheetToDatabase` に追加:
```json
"不通時Sメール担当": "unreachable_sms_assignee",
"査定Sメール担当": "valuation_sms_assignee",
"査定理由別３後Eメ担": "valuation_reason_email_assignee",
"査定理由": "valuation_reason",
"キャンセル案内担当": "cancel_notice_assignee",
"除外前、長期客メール担当": "long_term_email_assignee",
"当社が電話したというリマインドメール担当": "call_reminder_email_assignee"
```

`databaseToSpreadsheet` に追加:
```json
"unreachable_sms_assignee": "不通時Sメール担当",
"valuation_sms_assignee": "査定Sメール担当",
"valuation_reason_email_assignee": "査定理由別３後Eメ担",
"valuation_reason": "査定理由",
"cancel_notice_assignee": "キャンセル案内担当",
"long_term_email_assignee": "除外前、長期客メール担当",
"call_reminder_email_assignee": "当社が電話したというリマインドメール担当"
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 担当者フィールドの保存ラウンドトリップ

*For any* 担当者フィールドキーと有効な値（イニシャル文字列、`"不要"`、または `null`）の組み合わせに対して、`PUT /api/sellers/:id` で保存した後に同じ売主を再取得した場合、保存した値と同じ値が返される。

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.2**

### Property 2: 査定理由テキストのラウンドトリップ

*For any* 任意の文字列（空文字・日本語・特殊文字を含む）を `valuation_reason` フィールドに保存した場合、再取得した売主データに同じ文字列が含まれる。

**Validates: Requirements 6.6, 7.1**

### Property 3: イニシャルボタンのハイライト整合性

*For any* 売主データの担当者フィールド値と、任意のイニシャル一覧に対して、フィールド値と一致するボタンのみが `error` カラー（選択状態）で表示され、それ以外の全てのボタンは `outlined` スタイル（未選択状態）で表示される。`"不要"` が設定されている場合は「不要」ボタンが選択状態になる（edge-case: 7.3）。

**Validates: Requirements 5.6, 5.7, 7.2, 7.3**

### Property 4: decryptSellerの新フィールドマッピング

*For any* `sellers` テーブルのレコードに対して、`decryptSeller` メソッドが返すオブジェクトには、7つの新フィールド（`unreachableSmsAssignee`、`valuationSmsAssignee`、`valuationReasonEmailAssignee`、`valuationReason`、`cancelNoticeAssignee`、`longTermEmailAssignee`、`callReminderEmailAssignee`）が含まれ、それぞれ対応するDBカラムの値と一致する。

**Validates: Requirements 2.2**

---

## Error Handling

### APIエラー（保存失敗）

- `PUT /api/sellers/:id` が失敗した場合、MUIの `Snackbar` でエラーメッセージを表示する
- ローカル状態は楽観的更新せず、保存成功後にのみ更新する
- エラー時はUIの選択状態を元に戻す

### イニシャル取得失敗

- `/api/employees/active-initials` が失敗した場合、空配列にフォールバックする
- ボタンが表示されない状態でも「不要」ボタンは常に表示する

### デバウンス中のページ離脱

- 査定理由テキストのデバウンスタイマーが発火する前にページを離脱した場合、保存されない可能性がある
- これは許容される動作とする（ユーザーへの警告は不要）

---

## Testing Strategy

### ユニットテスト

- `AssigneeSection` コンポーネントのレンダリングテスト
  - 7つのフィールドが正しく表示されること
  - 初期値が正しくハイライトされること
  - 「不要」ボタンが各フィールドに表示されること
  - 査定理由フィールドがテキスト入力として表示されること
- `decryptSeller` メソッドの新フィールドマッピングテスト

### プロパティベーステスト

各プロパティは最低100回のランダム入力で検証する。

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript向けプロパティベーステストライブラリ）

**タグ形式**: `Feature: call-mode-assignee-section, Property {番号}: {プロパティ名}`

#### Property 1 のテスト実装方針

```typescript
// Feature: call-mode-assignee-section, Property 1: 担当者フィールドの保存ラウンドトリップ
fc.assert(fc.asyncProperty(
  fc.constantFrom(...ASSIGNEE_FIELD_KEYS),
  fc.oneof(fc.constantFrom(...VALID_INITIALS, '不要'), fc.constant(null)),
  async (fieldKey, value) => {
    await updateSeller(testSellerId, { [fieldKey]: value });
    const seller = await getSeller(testSellerId);
    return seller[fieldKey] === value;
  }
), { numRuns: 100 });
```

#### Property 2 のテスト実装方針

```typescript
// Feature: call-mode-assignee-section, Property 2: 査定理由テキストのラウンドトリップ
fc.assert(fc.asyncProperty(
  fc.string(),
  async (text) => {
    await updateSeller(testSellerId, { valuation_reason: text });
    const seller = await getSeller(testSellerId);
    return seller.valuationReason === text;
  }
), { numRuns: 100 });
```

#### Property 3 のテスト実装方針

```typescript
// Feature: call-mode-assignee-section, Property 3: イニシャルボタンのハイライト整合性
fc.assert(fc.property(
  fc.constantFrom(...ASSIGNEE_FIELD_KEYS),
  fc.oneof(fc.constantFrom(...VALID_INITIALS, '不要'), fc.constant(null)),
  fc.array(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 20 }),
  (fieldKey, currentValue, initials) => {
    const { getByText, queryAllByRole } = render(
      <AssigneeSection seller={{ ...mockSeller, [fieldKey]: currentValue }} onUpdate={jest.fn()} />
    );
    const buttons = queryAllByRole('button');
    const selectedButtons = buttons.filter(b => b.classList.contains('MuiButton-containedError'));
    // 選択状態のボタンはcurrentValueと一致するものだけ
    return selectedButtons.every(b => b.textContent === currentValue);
  }
), { numRuns: 100 });
```

#### Property 4 のテスト実装方針

```typescript
// Feature: call-mode-assignee-section, Property 4: decryptSellerの新フィールドマッピング
fc.assert(fc.asyncProperty(
  fc.record({
    unreachable_sms_assignee: fc.option(fc.string()),
    valuation_sms_assignee: fc.option(fc.string()),
    valuation_reason_email_assignee: fc.option(fc.string()),
    valuation_reason: fc.option(fc.string()),
    cancel_notice_assignee: fc.option(fc.string()),
    long_term_email_assignee: fc.option(fc.string()),
    call_reminder_email_assignee: fc.option(fc.string()),
  }),
  async (dbRecord) => {
    const result = await sellerService.decryptSeller({ ...baseSellerRecord, ...dbRecord });
    return (
      result.unreachableSmsAssignee === dbRecord.unreachable_sms_assignee &&
      result.valuationSmsAssignee === dbRecord.valuation_sms_assignee &&
      result.valuationReasonEmailAssignee === dbRecord.valuation_reason_email_assignee &&
      result.valuationReason === dbRecord.valuation_reason &&
      result.cancelNoticeAssignee === dbRecord.cancel_notice_assignee &&
      result.longTermEmailAssignee === dbRecord.long_term_email_assignee &&
      result.callReminderEmailAssignee === dbRecord.call_reminder_email_assignee
    );
  }
), { numRuns: 100 });
```

### 統合テスト

- スプレッドシートのCS/CT/DL/AO/AF/CX/CO列からDBへの同期が正しく動作すること
- `column-mapping.json` の新規マッピングが `EnhancedAutoSyncService` で正しく処理されること
