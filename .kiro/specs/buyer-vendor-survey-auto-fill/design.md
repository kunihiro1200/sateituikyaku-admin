# 設計ドキュメント: buyer-vendor-survey-auto-fill

## Overview

買主詳細画面（`BuyerDetailPage.tsx`）において、「業者向けアンケート」（`vendor_survey`）フィールドに値が入力されたとき、「３回架電確認済み」（`three_calls_confirmed`）フィールドを自動的に"他"にセットする機能を追加する。

フロントエンドのみの変更で完結する。バックエンドへの変更は不要。

## Architecture

変更対象は1ファイルのみ：

```
frontend/frontend/src/pages/BuyerDetailPage.tsx
```

既存の `vendor_survey` フィールドの `onClick` ハンドラー内に、`three_calls_confirmed` の自動セットロジックを追加する。

```
vendor_survey ボタンクリック
  └─ 既存: setBuyer / handleFieldChange (vendor_survey)
  └─ 追加: 新値が非空の場合
           ├─ setBuyer (three_calls_confirmed = '他')
           └─ handleFieldChange (three_calls_confirmed = '他')
```

## Components and Interfaces

### 変更対象コンポーネント

**`BuyerDetailPage`** (`frontend/frontend/src/pages/BuyerDetailPage.tsx`)

変更箇所は `vendor_survey` フィールドの特別処理ブロック（`if (field.key === 'vendor_survey')` の中）。

現在の `onClick` ハンドラー：

```tsx
onClick={async () => {
  const newValue = isSelected ? '' : opt;
  setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
  handleFieldChange(section.title, field.key, newValue);
  // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
}}
```

変更後の `onClick` ハンドラー：

```tsx
onClick={async () => {
  const newValue = isSelected ? '' : opt;
  setBuyer((prev: any) => prev ? { ...prev, [field.key]: newValue } : prev);
  handleFieldChange(section.title, field.key, newValue);
  // vendor_surveyに非空値が入力された場合、three_calls_confirmedを"他"に自動セット
  if (newValue && String(newValue).trim()) {
    setBuyer((prev: any) => prev ? { ...prev, three_calls_confirmed: '他' } : prev);
    handleFieldChange(section.title, 'three_calls_confirmed', '他');
  }
  // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない
}}
```

### 既存インターフェースとの関係

- `handleFieldChange(sectionTitle, fieldName, newValue)`: 既存関数をそのまま利用。`sectionChangedFields` への追加と `sectionDirtyStates` の更新を担う。
- `setBuyer`: 既存のstate更新関数をそのまま利用。画面への即時反映を担う。
- `SAVE_BUTTON_FIELDS`: `three_calls_confirmed` は既にこのSetに含まれているため、保存ボタン押下時にまとめて保存される。追加変更不要。

## Data Models

新規データモデルの追加なし。既存フィールドを利用する。

| フィールド | DBカラム | 型 | 自動セット値 |
|-----------|---------|-----|------------|
| 業者向けアンケート | `vendor_survey` | TEXT | トリガー側（変更なし） |
| ３回架電確認済み | `three_calls_confirmed` | TEXT | `'他'` |

`three_calls_confirmed` の選択肢（`THREE_CALLS_CONFIRMED_OPTIONS`）：
- `'3回架電OK'`
- `'3回架電未'`
- `'他'` ← 自動セット対象

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: vendor_survey非空入力時にthree_calls_confirmedが"他"にセットされる

*For any* 非空の `vendor_survey` 値（既存の `three_calls_confirmed` 値の有無に関わらず）、`vendor_survey` ボタンをクリックした後、`buyer` ステートの `three_calls_confirmed` は必ず `'他'` になる。

**Validates: Requirements 1.1, 1.4, 2.1**

### Property 2: vendor_survey非空入力時にsectionChangedFieldsにthree_calls_confirmedが含まれる

*For any* 非空の `vendor_survey` 値が入力されたとき、対象セクションの `sectionChangedFields` に `three_calls_confirmed: '他'` が含まれ、セクションがdirty状態になる。

**Validates: Requirements 1.3, 2.2**

## Error Handling

- `buyer` が `null` の場合: `handleFieldChange` の先頭で `if (!buyer) return;` によりガードされているため、追加対応不要。
- `vendor_survey` が空文字にクリアされた場合: `if (newValue && String(newValue).trim())` の条件により自動セットをスキップ。既存の `three_calls_confirmed` 値は維持される。

## Testing Strategy

### 単体テスト（example-based）

- `vendor_survey` に `'確認済み'` を入力 → `three_calls_confirmed` が `'他'` になること
- `vendor_survey` に `'未'` を入力 → `three_calls_confirmed` が `'他'` になること
- `vendor_survey` をクリア（空文字）→ `three_calls_confirmed` が変化しないこと
- `three_calls_confirmed` に既存値 `'3回架電OK'` がある状態で `vendor_survey` に値を入力 → `'他'` に上書きされること

### プロパティテスト（property-based）

プロパティテストライブラリ: **fast-check**（TypeScript/React環境に適合）

各テストは最低100回のイテレーションで実行する。

**Property 1 のテスト実装方針**:
```
// Feature: buyer-vendor-survey-auto-fill, Property 1: vendor_survey非空入力時にthree_calls_confirmedが"他"にセットされる
fc.assert(fc.property(
  fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // 非空文字列
  fc.option(fc.constantFrom('3回架電OK', '3回架電未', '他', '')), // 既存値
  (vendorSurveyValue, existingThreeCalls) => {
    // vendor_surveyに非空値を設定した後、three_calls_confirmedが'他'になることを検証
    const result = applyVendorSurveyAutoFill(vendorSurveyValue, existingThreeCalls);
    return result.three_calls_confirmed === '他';
  }
));
```

**Property 2 のテスト実装方針**:
```
// Feature: buyer-vendor-survey-auto-fill, Property 2: sectionChangedFieldsにthree_calls_confirmedが含まれる
fc.assert(fc.property(
  fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  (vendorSurveyValue) => {
    const changedFields = applyVendorSurveyChangedFields(vendorSurveyValue);
    return 'three_calls_confirmed' in changedFields && changedFields.three_calls_confirmed === '他';
  }
));
```

### 手動確認項目

- 画面上で `vendor_survey` ボタンをクリックした直後、`three_calls_confirmed` ボタンの表示が"他"に切り替わること
- 保存ボタンがアクティブ（dirty状態）になること
- 保存ボタンを押下後、DBに `three_calls_confirmed = '他'` が保存されること
