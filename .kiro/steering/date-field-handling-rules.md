# 日付フィールドの扱い方（重要ルール）

## ⚠️ 絶対に守るべきルール

日付フィールドで空文字（`""`）を扱うと、PostgreSQLで`invalid input syntax for type timestamp with time zone: ""`エラーが発生します。

**解決策：空文字の代わりに`null`を使用する**

---

## ✅ 正しい実装方法

### フロントエンド（InlineEditableField.tsx）

日付入力フィールドで空文字を入力した瞬間に`null`に変換：

```typescript
case 'date':
  const dateValue = editValue ? String(editValue).split('T')[0] : '';
  return (
    <TextField
      {...commonProps}
      value={dateValue}
      type="date"
      InputLabelProps={{ shrink: true }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        // ✅ 空文字の場合はnullを設定（timestampエラーを防ぐ）
        const newValue = e.target.value === '' ? null : e.target.value;
        handleChange(newValue);
      }}
    />
  );
```

### バックエンド

フロントエンドから`null`が送信されるため、特別な処理は不要：

```typescript
// ✅ シンプル（変換処理不要）
const result = await buyerApi.update(
  buyer_number!,
  { [fieldName]: newValue },  // newValueはnullまたは日付文字列
  { sync: true, force: true }
);
```

---

## ❌ 間違った実装方法

### 間違い1: 空文字をそのまま送信

```typescript
// ❌ 間違い（空文字がバックエンドに送信される）
<TextField
  type="date"
  onChange={(e) => handleChange(e.target.value)}  // 空文字がそのまま送信される
/>
```

**結果**: `invalid input syntax for type timestamp with time zone: ""`エラー

### 間違い2: バックエンドで変換

```typescript
// ❌ 複雑（フロントエンドで変換すべき）
const DATE_FIELDS = ['next_call_date', 'reception_date', 'visit_date', 'contract_date'];
const sanitizedValue = DATE_FIELDS.includes(fieldName) && newValue === '' ? null : newValue;
```

**問題**: 
- コードが複雑になる
- フロントエンドとバックエンドの両方で変換処理が必要
- 空文字がネットワークを通過する

---

## 📋 対象フィールド

以下の日付フィールドは全て`null`を使用：

- `next_call_date`（次電日）
- `reception_date`（受付日）
- `visit_date`（訪問日）
- `contract_date`（契約日）
- `viewing_date`（内覧日）

---

## 🎯 まとめ

**原則**: 日付フィールドは空文字（`""`）を使わず、常に`null`を使用する

**実装場所**: フロントエンドの入力フィールドで変換（バックエンドでは変換不要）

**メリット**:
- PostgreSQLのtimestampエラーを防ぐ
- コードがシンプルになる
- フロントエンドとバックエンドの責任が明確になる

---

**最終更新日**: 2026年4月6日  
**作成理由**: 次電日削除時のtimestampエラーを解決した知見を記録
