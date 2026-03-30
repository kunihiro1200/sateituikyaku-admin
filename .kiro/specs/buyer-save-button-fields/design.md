# デザインドキュメント：買主詳細画面 問合せ内容フィールド 保存ボタン化

## 概要

買主詳細画面（`BuyerDetailPage.tsx`）の「問合せ内容」セクションにある10個のフィールドについて、保存タイミングを**自動保存（フィールド変更と同時）**から**保存ボタン押下時のまとめ保存**に変更する。

### 対象フィールド

| フィールドキー | ラベル | fieldType |
|---|---|---|
| `inquiry_email_phone` | 【問合メール】電話対応 | `dropdown` |
| `distribution_type` | 配信メール | `buttonSelect` |
| `pinrich` | Pinrich | `dropdown` |
| `broker_survey` | 業者向けアンケート | `buttonSelect` |
| `three_calls_confirmed` | 3回架電確認済み | `buttonSelect` |
| `initial_assignee` | 初動担当 | カスタム（イニシャル選択） |
| `owned_home_hearing_inquiry` | 問合時持家ヒアリング | `staffSelect` |
| `owned_home_hearing_result` | 持家ヒアリング結果 | `homeHearingResult` |
| `valuation_required` | 要査定 | `valuationRequired` |
| `broker_inquiry` | 業者問合せ | `boxSelect` |

### 変更しないフィールド（対象外）

`inquiry_source`、`latest_status`、`reception_date`、`next_call_date`、`inquiry_hearing`、`pinrich_link`、`confirmation_to_assignee`、`notification_sender`、`viewing_mobile` など。

---

## アーキテクチャ

### 現在の保存フロー（変更前）

```
フィールド変更
  ↓
setBuyer（楽観的更新）
handleFieldChange（sectionChangedFields記録）
handleInlineFieldSave（即座にDB保存 + スプシ同期）
```

### 変更後の保存フロー

```
フィールド変更（対象フィールド）
  ↓
setBuyer（楽観的更新）
handleFieldChange（sectionChangedFields記録）
sectionDirtyStates = true
※ handleInlineFieldSave は呼ばない

保存ボタン押下
  ↓
handleSectionSave（sectionChangedFields の全フィールドをまとめてDB保存 + スプシ同期）
sectionDirtyStates = false
```

### 対象外フィールドの保存フロー（変更なし）

```
フィールド変更（対象外フィールド）
  ↓
setBuyer（楽観的更新）
handleFieldChange（sectionChangedFields記録）
handleInlineFieldSave（即座にDB保存 + スプシ同期）  ← 変更なし
```

---

## コンポーネントとインターフェース

### 既存コンポーネント（変更なし）

- **`SectionSaveButton`** (`frontend/frontend/src/components/SectionSaveButton.tsx`)
  - `isDirty: boolean` — 未保存変更の有無
  - `isSaving: boolean` — 保存中フラグ
  - `onSave: () => void` — 保存ハンドラー
  - 「問合せ内容」セクションの初動担当ラベル右横に既に配置済み

### 既存ハンドラー（変更なし）

- **`handleFieldChange(sectionTitle, fieldName, newValue)`** — フィールド変更をローカルstateに記録
- **`handleSectionSave(sectionTitle)`** — セクション内の変更フィールドをまとめてDB保存
- **`handleInlineFieldSave(fieldName, newValue)`** — 単一フィールドを即座にDB保存

### 変更箇所

**`BuyerDetailPage.tsx` 内の各対象フィールドのonClick/onChange ハンドラー**

対象フィールドの変更ハンドラーから `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す。

```typescript
// 変更前（対象フィールド）
const newValue = isSelected ? '' : opt;
setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
handleFieldChange(section.title, field.key, newValue);
setMissingRequiredFields(...);
handleInlineFieldSave(field.key, newValue).catch(console.error); // ← 削除

// 変更後（対象フィールド）
const newValue = isSelected ? '' : opt;
setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
handleFieldChange(section.title, field.key, newValue);
setMissingRequiredFields(...);
// handleInlineFieldSave は呼ばない
```

---

## データモデル

### 既存stateの利用（新規stateは不要）

| state | 型 | 役割 |
|---|---|---|
| `sectionDirtyStates` | `Record<string, boolean>` | セクションに未保存変更があるかを管理 |
| `sectionChangedFields` | `Record<string, Record<string, any>>` | セクションごとの変更フィールドと新しい値 |
| `sectionSavingStates` | `Record<string, boolean>` | セクションの保存中フラグ |
| `missingRequiredFields` | `Set<string>` | 必須フィールド未入力ハイライト用 |

これらのstateは既に実装済みであり、新規追加は不要。

### 対象フィールドの判定

対象フィールドを定数として定義し、ハンドラー内で判定する。

```typescript
// 保存ボタン押下時にまとめて保存するフィールドのセット
const SAVE_BUTTON_FIELDS = new Set([
  'inquiry_email_phone',
  'distribution_type',
  'pinrich',
  'broker_survey',
  'three_calls_confirmed',
  'initial_assignee',
  'owned_home_hearing_inquiry',
  'owned_home_hearing_result',
  'valuation_required',
  'broker_inquiry',
]);
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。形式的に「何をすべきか」を述べるものであり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 対象フィールド変更時はDB保存が呼ばれない

*任意の* 対象フィールドと任意の新しい値に対して、フィールドを変更したとき、`handleInlineFieldSave`（DB保存API呼び出し）は実行されず、`sectionChangedFields` に変更が記録され、`sectionDirtyStates` が `true` になる。

**Validates: Requirements 1.1, 1.2**

### Property 2: 保存ボタン押下時に全変更フィールドがまとめて保存される

*任意の* 変更フィールドセット（1件以上）に対して、保存ボタンを押したとき、`buyerApi.update` が1回だけ呼ばれ、その引数に全変更フィールドが含まれ、`sync: true` が渡される。

**Validates: Requirements 1.3, 5.1**

### Property 3: 保存成功後にdirtyStateがリセットされる

*任意の* 変更フィールドセットに対して、保存ボタンを押して保存が成功したとき、`sectionDirtyStates` が `false` になり、`sectionChangedFields` が空になる。

**Validates: Requirements 1.4, 4.1, 4.3**

### Property 4: 対象外フィールドは変更と同時に保存される

*任意の* 対象外フィールドと任意の新しい値に対して、フィールドを変更したとき、`handleInlineFieldSave` が即座に呼ばれる。

**Validates: Requirements 2.1, 2.2**

### Property 5: 必須チェックはフィールド変更のたびに実行される

*任意の* 対象フィールドの変更に対して、変更後に `missingRequiredFields` が正しく更新される（必須フィールドが空なら追加、入力済みなら削除）。

**Validates: Requirements 3.1, 3.2**

---

## エラーハンドリング

### 保存失敗時

`handleSectionSave` 内の `try/catch` で捕捉し、スナックバーでエラーメッセージを表示する。`sectionDirtyStates` は `true` のまま維持し、ユーザーが再度保存を試みられるようにする。

```typescript
// 既存の handleSectionSave の catch ブロック（変更なし）
} catch (error: any) {
  setSnackbar({
    open: true,
    message: error.response?.data?.error || '保存に失敗しました',
    severity: 'error',
  });
}
// sectionDirtyStates は finally でリセットしないため true のまま維持される
```

### スプレッドシート同期失敗時

`handleSectionSave` 内で `result.syncStatus` を確認し、`'pending'` または `'failed'` の場合は警告スナックバーを表示する。

```typescript
if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
  setSnackbar({
    open: true,
    message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
    severity: 'warning',
  });
}
```

### ページ離脱時の未保存変更

現時点では未保存変更がある状態でのページ離脱に対する警告は実装しない（要件外）。将来的な拡張として `beforeunload` イベントの利用を検討できる。

---

## テスト戦略

### ユニットテスト

特定の例・エッジケース・エラー条件を検証する。

- **エラーケース**: 保存失敗時にスナックバーが表示され、`sectionDirtyStates` が `true` のままであること
- **エラーケース**: スプシ同期失敗時（`syncStatus === 'failed'`）に警告スナックバーが表示されること
- **エッジケース**: 対象フィールドを変更後に元の値に戻した場合、`sectionChangedFields` から削除されること（`handleFieldChange` の既存ロジック）
- **エッジケース**: 変更フィールドが0件の場合、保存ボタンが非アクティブで `handleSectionSave` が早期リターンすること

### プロパティベーステスト

全入力に対して成立する普遍的プロパティを検証する。プロパティベーステストライブラリとして **fast-check**（TypeScript/JavaScript向け）を使用する。各テストは最低100回のイテレーションで実行する。

#### Property 1 のテスト

```typescript
// Feature: buyer-save-button-fields, Property 1: 対象フィールド変更時はDB保存が呼ばれない
it('対象フィールドを変更してもhandleInlineFieldSaveが呼ばれない', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...SAVE_BUTTON_FIELDS),
      fc.string(),
      (fieldKey, newValue) => {
        const mockInlineSave = jest.fn();
        // フィールド変更をシミュレート
        simulateFieldChange(fieldKey, newValue, { handleInlineFieldSave: mockInlineSave });
        expect(mockInlineSave).not.toHaveBeenCalled();
        expect(getSectionChangedFields('問合せ内容')[fieldKey]).toBe(newValue);
        expect(getSectionDirtyState('問合せ内容')).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 2 のテスト

```typescript
// Feature: buyer-save-button-fields, Property 2: 保存ボタン押下時に全変更フィールドがまとめて保存される
it('保存ボタン押下時にbuyerApi.updateが1回だけ呼ばれ全変更フィールドが含まれる', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom(...SAVE_BUTTON_FIELDS), { minLength: 1, maxLength: 10 }),
      (fieldKeys) => {
        const mockUpdate = jest.fn().mockResolvedValue({ buyer: {}, syncStatus: 'synced' });
        const changedFields = Object.fromEntries(fieldKeys.map(k => [k, 'test']));
        // 保存ボタン押下をシミュレート
        handleSectionSave('問合せ内容', changedFields, { buyerApiUpdate: mockUpdate });
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const callArgs = mockUpdate.mock.calls[0];
        fieldKeys.forEach(k => expect(callArgs[1]).toHaveProperty(k));
        expect(callArgs[2]).toMatchObject({ sync: true });
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 3 のテスト

```typescript
// Feature: buyer-save-button-fields, Property 3: 保存成功後にdirtyStateがリセットされる
it('保存成功後にsectionDirtyStatesがfalseになりsectionChangedFieldsが空になる', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom(...SAVE_BUTTON_FIELDS), { minLength: 1 }),
      async (fieldKeys) => {
        const changedFields = Object.fromEntries(fieldKeys.map(k => [k, 'test']));
        await handleSectionSave('問合せ内容', changedFields, { mockSuccess: true });
        expect(getSectionDirtyState('問合せ内容')).toBe(false);
        expect(getSectionChangedFields('問合せ内容')).toEqual({});
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 4 のテスト

```typescript
// Feature: buyer-save-button-fields, Property 4: 対象外フィールドは変更と同時に保存される
it('対象外フィールドを変更するとhandleInlineFieldSaveが即座に呼ばれる', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('inquiry_source', 'latest_status', 'reception_date', 'next_call_date'),
      fc.string(),
      (fieldKey, newValue) => {
        const mockInlineSave = jest.fn();
        simulateFieldChange(fieldKey, newValue, { handleInlineFieldSave: mockInlineSave });
        expect(mockInlineSave).toHaveBeenCalledWith(fieldKey, newValue);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 5 のテスト

```typescript
// Feature: buyer-save-button-fields, Property 5: 必須チェックはフィールド変更のたびに実行される
it('対象フィールドを空にすると必須フィールドがmissingRequiredFieldsに追加される', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('distribution_type', 'inquiry_email_phone', 'initial_assignee'),
      (fieldKey) => {
        simulateFieldChange(fieldKey, '');
        expect(getMissingRequiredFields()).toContain(fieldKey);
      }
    ),
    { numRuns: 100 }
  );
});
```
