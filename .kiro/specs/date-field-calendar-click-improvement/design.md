# 設計書: 日付フィールドカレンダークリック改善

## 概要

売主通話モードページ（CallModePage）、買主詳細画面（BuyerDetailPage）、買主内覧結果ページ（BuyerViewingResultPage）、業務一覧ページ（WorkTaskDetailModal）の日付フィールドにおいて、入力枠内のどこをクリックしてもカレンダーが表示されるようにする改善。

現状はブラウザのデフォルト動作として、カレンダーアイコン部分のみクリック可能。この改善では `showPicker()` APIを使用して、フィールド全体をクリック可能にする。UIの見た目は変更しない。

## アーキテクチャ

### 変更対象コンポーネント

```
frontend/frontend/src/
├── components/
│   ├── InlineEditableField.tsx     ← 主要変更（date型の自動showPicker）
│   └── WorkTaskDetailModal.tsx     ← EditableField内のdate/datetime-local型
└── pages/
    └── CallModePage.tsx            ← 次電日・訪問予定日時フィールド
```

### 変更方針

| 対象 | 変更箇所 | アプローチ |
|------|----------|-----------|
| InlineEditableField | `case 'date'` のTextField | `onClick` で `inputRef.current?.showPicker()` |
| WorkTaskDetailModal | `EditableField` の `type="date"` / `type="datetime-local"` | `inputRef` + `onClick` で `showPicker()` |
| CallModePage | 次電日・訪問予定日時の TextField | `inputRef` + `onClick` で `showPicker()` |

## コンポーネントと インターフェース

### 1. InlineEditableField の変更

`case 'date'` のレンダリング部分に `onClick` ハンドラーを追加する。

**変更前:**
```tsx
case 'date':
  const dateValue = editValue ? String(editValue).split('T')[0] : '';
  return (
    <TextField
      {...commonProps}
      value={dateValue}
      type="date"
      InputLabelProps={{ shrink: true }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value === '' ? null : e.target.value;
        handleChange(newValue);
      }}
    />
  );
```

**変更後:**
```tsx
case 'date':
  const dateValue = editValue ? String(editValue).split('T')[0] : '';
  return (
    <TextField
      {...commonProps}
      value={dateValue}
      type="date"
      InputLabelProps={{ shrink: true }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value === '' ? null : e.target.value;
        handleChange(newValue);
      }}
      onClick={() => {
        // 入力枠内のどこをクリックしてもカレンダーを開く
        (inputRef.current as HTMLInputElement | null)?.showPicker?.();
      }}
    />
  );
```

また、編集モードに切り替わった直後（`useEffect` の `isEditing` 依存）に `showPicker()` を呼び出す。

**変更前:**
```tsx
useEffect(() => {
  if (isEditing && inputRef.current) {
    inputRef.current.focus();
  }
}, [isEditing]);
```

**変更後:**
```tsx
useEffect(() => {
  if (isEditing && inputRef.current) {
    inputRef.current.focus();
    // date型の場合は編集モード切替時にカレンダーを自動表示
    if (fieldType === 'date') {
      // focusの後にshowPickerを呼ぶ（タイミング調整）
      setTimeout(() => {
        (inputRef.current as HTMLInputElement | null)?.showPicker?.();
      }, 0);
    }
  }
}, [isEditing]);
```

### 2. WorkTaskDetailModal の変更

`EditableField` コンポーネント内の `type="date"` と `type="datetime-local"` の TextField に `inputRef` と `onClick` を追加する。

**変更後（date型）:**
```tsx
const dateInputRef = useRef<HTMLInputElement>(null);

// type === 'date' の場合:
<TextField
  size="small"
  type="date"
  value={formatDateForInput(getValue(field))}
  onChange={(e) => handleFieldChange(field, e.target.value || null)}
  fullWidth
  InputLabelProps={{ shrink: true }}
  inputRef={dateInputRef}
  onClick={() => dateInputRef.current?.showPicker?.()}
/>
```

ただし `EditableField` は関数コンポーネント内のローカルコンポーネントであるため、各インスタンスで `useRef` を使うのではなく、`onClick` ハンドラー内で `e.currentTarget` から input 要素を取得する方法が適切。

**実装方針（WorkTaskDetailModal）:**
```tsx
// type === 'date' の場合:
<TextField
  size="small"
  type="date"
  value={formatDateForInput(getValue(field))}
  onChange={(e) => handleFieldChange(field, e.target.value || null)}
  fullWidth
  InputLabelProps={{ shrink: true }}
  onClick={(e) => {
    const input = (e.currentTarget as HTMLElement).querySelector('input');
    (input as HTMLInputElement | null)?.showPicker?.();
  }}
/>
```

### 3. CallModePage の変更

次電日フィールドと訪問予定日時フィールドの TextField に `inputRef` と `onClick` を追加する。

**次電日フィールド（type="date"）:**
```tsx
const nextCallDateRef = useRef<HTMLInputElement>(null);

<TextField
  size="small"
  label="次電日"
  type="date"
  inputRef={nextCallDateRef}
  value={editedNextCallDate}
  onChange={(e) => { setEditedNextCallDate(e.target.value); setStatusChanged(true); }}
  onClick={() => nextCallDateRef.current?.showPicker?.()}
  InputLabelProps={{ shrink: true }}
/>
```

**訪問予定日時フィールド（type="datetime-local"）:**
```tsx
const appointmentDateRef = useRef<HTMLInputElement>(null);

<TextField
  size="small"
  label="訪問予定日時"
  type="datetime-local"
  inputRef={appointmentDateRef}
  value={editedAppointmentDate}
  onChange={(e) => setEditedAppointmentDate(e.target.value)}
  onClick={() => appointmentDateRef.current?.showPicker?.()}
  InputLabelProps={{ shrink: true }}
/>
```

## データモデル

この改善はUIの動作変更のみであり、データモデルの変更はない。

- 保存される値の形式は変更なし（`YYYY-MM-DD` または `YYYY-MM-DDTHH:mm`）
- APIリクエスト・レスポンスの変更なし
- データベーススキーマの変更なし

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性または動作のことです。形式的な仕様として、機械的に検証可能な正確性の保証を提供します。*

### Property 1: date型InlineEditableFieldの編集モード切替でshowPickerが呼ばれる

*For any* `fieldType="date"` の InlineEditableField において、編集モードに切り替わったとき、`inputRef.current.showPicker()` が呼ばれること。

**Validates: Requirements 4.1**

### Property 2: date以外の型ではshowPickerが呼ばれない

*For any* `fieldType` が `"date"` 以外の InlineEditableField において、編集モードに切り替わっても `showPicker()` が呼ばれないこと。

**Validates: Requirements 4.3**

## エラーハンドリング

### showPicker() の互換性

`showPicker()` はモダンブラウザでサポートされているが、古いブラウザや特定の環境では未定義の場合がある。オプショナルチェーン（`?.`）を使用して安全に呼び出す。

```tsx
// 安全な呼び出し（showPickerが未定義でもエラーにならない）
inputRef.current?.showPicker?.();
```

### SecurityError の対処

`showPicker()` はユーザーのジェスチャー（クリックイベント）内でのみ呼び出し可能。`useEffect` 内での呼び出しは `setTimeout(..., 0)` でマイクロタスクキューに遅延させることで、ブラウザのセキュリティ制約を回避する。

```tsx
// useEffect内での安全な呼び出し
setTimeout(() => {
  (inputRef.current as HTMLInputElement | null)?.showPicker?.();
}, 0);
```

ただし、`setTimeout` を使用しても一部のブラウザ環境では SecurityError が発生する可能性がある。その場合は `try-catch` でエラーを無視する。

```tsx
setTimeout(() => {
  try {
    (inputRef.current as HTMLInputElement | null)?.showPicker?.();
  } catch {
    // SecurityError等は無視（フォールバックとしてフォーカスのみ）
  }
}, 0);
```

## テスト戦略

### PBT適用性の評価

この機能は主にUIインタラクション（クリックイベント → showPicker呼び出し）の変更であり、純粋関数やデータ変換ロジックを含まない。ほとんどの受け入れ基準はブラウザネイティブUIの動作確認であり、PBTよりもexampleベースのテストが適切。

ただし、InlineEditableFieldの `fieldType` による分岐（date型のみshowPickerを呼ぶ）はプロパティとして表現できる。

### ユニットテスト

**InlineEditableField のテスト:**

```tsx
// Property 1: date型でshowPickerが呼ばれる
it('date型の編集モード切替でshowPickerが呼ばれる', () => {
  const mockShowPicker = jest.fn();
  // inputRefのshowPickerをモック
  render(
    <InlineEditableField
      fieldType="date"
      value="2024-01-01"
      fieldName="test_date"
      onSave={jest.fn()}
    />
  );
  // フィールドをクリックして編集モードに切り替え
  // showPicker()が呼ばれることを確認
});

// Property 2: text型ではshowPickerが呼ばれない
it('text型の編集モード切替でshowPickerが呼ばれない', () => {
  // fieldType="text"でshowPickerが呼ばれないことを確認
});
```

**WorkTaskDetailModal のテスト:**

```tsx
// date型TextFieldのクリックでshowPickerが呼ばれる
it('date型フィールドのクリックでshowPickerが呼ばれる', () => {
  // EditableFieldのdate型TextFieldをクリック
  // showPicker()が呼ばれることを確認
});
```

### 統合テスト

- CallModePageの次電日フィールドをクリックしてカレンダーが開くことを手動確認
- BuyerViewingResultPageの内覧日フィールドをクリックして編集モードに切り替わり、カレンダーが開くことを手動確認
- BuyerDetailPageの次電日フィールドをクリックして編集モードに切り替わり、カレンダーが開くことを手動確認
- WorkTaskDetailModalの各日付フィールドをクリックしてカレンダーが開くことを手動確認

### ブラウザ互換性テスト

- Chrome（最新版）: showPicker() サポート確認
- Firefox（最新版）: showPicker() サポート確認
- Safari（最新版）: showPicker() サポート確認（一部バージョンで未サポートの可能性あり）
- モバイルブラウザ: タップ操作でカレンダーが開くことを確認
