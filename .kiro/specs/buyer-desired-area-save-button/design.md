# デザインドキュメント: buyer-desired-area-save-button

## Overview

買主希望条件ページ（`BuyerDesiredConditionsPage`）に明示的な「保存」ボタンを追加する。

現在の実装では、エリア選択ドロップダウンを閉じた際に `handleInlineFieldSave()` を自動呼び出しして保存しているが、ページ遷移のタイミングや競合状態によって保存が失敗するケースがある。

本設計では、フロントエンドのみを変更し、ユーザーが明示的に「保存」ボタンを押すことで全希望条件フィールドを一括保存する仕組みを導入する。バックエンドは既存の `PUT /api/buyers/:id?sync=true` APIをそのまま利用する。

### 設計方針

- **フロントエンドのみ変更**（バックエンドAPIは変更なし）
- 変更があった場合にボタンを強調表示（色変化）
- 保存中はボタンを無効化（二重送信防止）
- 保存成功/失敗をスナックバーで表示
- 既存の `InlineEditableField` の `onSave` は引き続き動作させる（他フィールドとの互換性維持）

---

## Architecture

### 変更対象

```
frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx
```

バックエンドは変更なし。既存の `PUT /api/buyers/:id?sync=true` エンドポイントを利用する。

### 状態管理フロー

```
ユーザーがフィールドを変更
  ↓
pendingChanges に変更を蓄積（setStateのみ、API呼び出しなし）
  ↓
hasChanges = true → 保存ボタンが強調表示される
  ↓
ユーザーが「保存」ボタンを押す
  ↓
isSaving = true → ボタンが無効化される
  ↓
buyerApi.update(buyer_number, pendingChanges, { sync: true }) を呼び出す
  ↓
成功: スナックバー表示 → hasChanges = false, pendingChanges = {}
失敗: エラースナックバー表示
  ↓
isSaving = false → ボタンが再び有効化される
```

### 希望エリア（desired_area）の扱い

`desired_area` は `InlineEditableField` を使わず独自の `Select` コンポーネントで実装されている。
現在は `onClose` で自動保存しているが、本設計では `pendingChanges` に蓄積するだけに変更する。

---

## Components and Interfaces

### 新規 State

```typescript
// 未保存の変更を蓄積するオブジェクト
const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});

// 変更があるかどうか
const [hasChanges, setHasChanges] = useState(false);

// 保存処理中かどうか
const [isSaving, setIsSaving] = useState(false);
```

### handleFieldChange（新規）

フィールドの変更を `pendingChanges` に蓄積する関数。

```typescript
const handleFieldChange = (fieldName: string, newValue: any) => {
  setPendingChanges(prev => ({ ...prev, [fieldName]: newValue }));
  setHasChanges(true);
};
```

### handleSaveAll（新規）

保存ボタン押下時に `pendingChanges` を一括保存する関数。

```typescript
const handleSaveAll = async () => {
  if (!buyer || Object.keys(pendingChanges).length === 0) return;
  setIsSaving(true);
  try {
    const result = await buyerApi.update(buyer_number!, pendingChanges, { sync: true });
    // 成功処理
    setBuyer(result.buyer);
    setPendingChanges({});
    setHasChanges(false);
    // syncStatus に応じたスナックバー表示
  } catch (error) {
    // エラースナックバー表示
  } finally {
    setIsSaving(false);
  }
};
```

### 保存ボタン UI

```tsx
<Button
  variant="contained"
  color={hasChanges ? "warning" : "primary"}
  disabled={isSaving || !hasChanges}
  onClick={handleSaveAll}
  startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
>
  {isSaving ? '保存中...' : '保存'}
</Button>
```

### 既存 handleInlineFieldSave の変更

`InlineEditableField` の `onSave` コールバックは引き続き動作させる（他フィールドとの互換性）。
ただし、`desired_area` の `onClose` による自動保存は廃止し、`handleFieldChange` に置き換える。

---

## Data Models

### pendingChanges の型

```typescript
type PendingChanges = Partial<{
  desired_timing: string;
  desired_area: string;           // '|' 区切りの文字列
  desired_property_type: string;
  desired_building_age: string;
  desired_floor_plan: string;
  budget: string;
  price_range_house: string;
  price_range_apartment: string;
  price_range_land: string;
  parking_spaces: string;
  monthly_parking_ok: string;
  hot_spring_required: string;
  garden_required: string;
  pet_allowed_required: string;
  good_view_required: string;
  high_floor_required: string;
  corner_room_required: string;
}>;
```

### API レスポンス（既存）

```typescript
interface BuyerUpdateResponse {
  buyer: Buyer;
  syncStatus?: 'synced' | 'pending' | 'failed';
  syncError?: string;
  conflicts?: Array<{ field: string; dbValue: any; sheetValue: any }>;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: フィールド変更後の hasChanges フラグ

*For any* 希望条件フィールド名と値の組み合わせに対して、`handleFieldChange(fieldName, value)` を呼び出した後、`hasChanges` state は `true` になる。

**Validates: Requirements 1.2**

### Property 2: 保存中のボタン無効化と完了後の再有効化

*For any* 保存操作において、`handleSaveAll()` の実行中は `isSaving` が `true`（ボタンが `disabled`）であり、処理完了後（成功・失敗問わず）は `isSaving` が `false` に戻る。

**Validates: Requirements 1.3, 4.1, 4.2**

### Property 3: 保存後のラウンドトリップ

*For any* 希望条件フィールドの値の組み合わせを変更して保存した場合、その後 API から再取得した値が保存した値と一致する。

**Validates: Requirements 2.2, 2.4**

### Property 4: 保存成功後の pendingChanges リセット

*For any* 保存処理が成功した場合、`hasChanges` は `false` に、`pendingChanges` は空オブジェクト（`{}`）にリセットされる。

**Validates: Requirements 1.4, 4.2**

### Property 5: syncStatus に応じたスナックバーメッセージ

*For any* 保存操作において、APIレスポンスの `syncStatus` の値（`'synced'`、`'pending'`、`'failed'`）に応じて、それぞれ対応するスナックバーメッセージが表示される。

**Validates: Requirements 3.2, 3.3, 3.4**

---

## Error Handling

### 保存失敗時

- `buyerApi.update()` が例外をスローした場合、`catch` ブロックでエラーを捕捉
- スナックバーに「DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました」または汎用エラーメッセージを表示
- `isSaving` を `false` に戻し、ボタンを再び有効化
- `pendingChanges` はリセットしない（ユーザーが再試行できるようにする）

### 競合検出時（409）

- `result.conflicts` が存在する場合、警告スナックバーを表示
- `buyer` state を最新値で更新

### バリデーションエラー

- 配信メール「要」時の必須チェックは保存ボタン押下時にも実行
- エラーがある場合はスナックバーでエラーメッセージを表示し、保存を中断

---

## Testing Strategy

### ユニットテスト

- `handleFieldChange` が `pendingChanges` を正しく蓄積するか
- `handleSaveAll` が `pendingChanges` を正しく API に渡すか
- `isSaving` が保存中に `true`、完了後に `false` になるか
- `hasChanges` が変更後に `true`、保存成功後に `false` になるか
- `syncStatus` に応じたスナックバーメッセージが正しく表示されるか

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript 向け PBT ライブラリ）を使用する。
各プロパティテストは最低 100 回のイテレーションを実行する。

各テストには以下のタグコメントを付与する：
`// Feature: buyer-desired-area-save-button, Property {N}: {property_text}`

#### Property 1: 変更後の保存ボタン強調表示
```typescript
// Feature: buyer-desired-area-save-button, Property 1: 変更後の保存ボタン強調表示
fc.assert(fc.property(
  fc.record({ fieldName: fc.string(), value: fc.string() }),
  ({ fieldName, value }) => {
    // handleFieldChange を呼び出した後、hasChanges が true になることを検証
  }
), { numRuns: 100 });
```

#### Property 3: 保存後のラウンドトリップ
```typescript
// Feature: buyer-desired-area-save-button, Property 3: 保存後のラウンドトリップ
fc.assert(fc.property(
  fc.record({ desired_area: fc.array(fc.string()).map(arr => arr.join('|')) }),
  async (changes) => {
    // 保存後に再取得した値が保存した値と一致することを検証
  }
), { numRuns: 100 });
```

#### Property 4: 保存完了後の状態リセット
```typescript
// Feature: buyer-desired-area-save-button, Property 4: 保存完了後の状態リセット
fc.assert(fc.property(
  fc.record({ fieldName: fc.string(), value: fc.string() }),
  async ({ fieldName, value }) => {
    // 保存成功後に hasChanges === false かつ pendingChanges が空であることを検証
  }
), { numRuns: 100 });
```

### 統合テスト

- 保存ボタン押下 → API 呼び出し → スナックバー表示の一連のフローを確認
- `sync=true` パラメータが正しく渡されているか確認
- ページ再訪問後に保存した値が表示されるか確認（E2E）
