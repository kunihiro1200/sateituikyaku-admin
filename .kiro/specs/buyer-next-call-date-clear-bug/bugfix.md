# バグ修正要件ドキュメント

## Introduction

買主詳細ページ（BuyerDetailPage）の次電日フィールドで、日付を削除しても保存されず、DBが空欄にならないバグを修正します。このバグにより、ユーザーが次電日をクリアしたい場合に、意図した操作ができない状態になっています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 次電日フィールドに日付が入力されている状態で、日付を削除してフィールド外をクリックした THEN システムは保存処理を実行せず、DBの値も変更されない

1.2 WHEN 次電日フィールドの日付を削除した THEN 保存ボタンが光らず、変更が検知されない

### Expected Behavior (Correct)

2.1 WHEN 次電日フィールドに日付が入力されている状態で、日付を削除してフィールド外をクリックした THEN システムは即座にDBに保存し、次電日フィールドをnullに更新する

2.2 WHEN 次電日フィールドの日付を削除した THEN システムは変更を検知し、保存処理を実行する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 次電日フィールドに新しい日付を入力した THEN システムは引き続き即座にDBに保存し、正しく更新される

3.2 WHEN 他の日付フィールド（reception_date等）の日付を削除した THEN システムは引き続き正しく保存処理を実行する

3.3 WHEN 次電日フィールド以外のインライン編集可能フィールドを編集した THEN システムは引き続き正しく保存処理を実行する

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FieldEditInput
  OUTPUT: boolean
  
  // 次電日フィールドで、元の値がnullまたは空文字で、
  // 新しい値も空文字の場合にバグが発生する
  RETURN X.fieldName = "next_call_date" 
    AND (X.originalValue = null OR X.originalValue = "")
    AND X.newValue = ""
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 次電日削除時の保存処理
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleBlur'(X)
  ASSERT result.saved = true 
    AND result.dbValue = null
    AND no_cancel_edit_called(result)
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 他のフィールドの動作は変更しない
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleBlur(X) = handleBlur'(X)
END FOR
```

## Root Cause Analysis

### 問題箇所

`frontend/frontend/src/components/InlineEditableField.tsx` の `handleBlur` 関数（lines 138-149）

```typescript
// Handle blur to save (値が変わっていない場合はキャンセル)
const handleBlur = async () => {
  if (isEditing && !isSaving) {
    // 値が変わっていない場合は保存せずキャンセル（空文字エラー防止）
    const currentVal = editValue ?? '';
    const originalVal = value ?? '';
    if (String(currentVal) === String(originalVal)) {
      cancelEdit();
      return;
    }
    await saveValue();
  }
};
```

### 根本原因

1. **日付フィールドで空文字を入力した場合**、`editValue` は空文字 `''` になる
2. **元の値が `null` の場合**、`originalVal` も空文字 `''` になる（`value ?? ''`）
3. **`String('') === String('')` が `true` になる**ため、保存されずに `cancelEdit()` が呼ばれる
4. 結果として、日付を削除しても変更が検知されず、DBに保存されない

### 具体例

```typescript
// 元の値: null（次電日が未設定）
// ユーザー操作: 日付フィールドをクリアして空文字にする
// editValue: ''
// originalVal: null ?? '' = ''
// String('') === String('') → true
// → cancelEdit() が呼ばれ、保存されない
```

## Counterexample

**入力**:
- フィールド名: `next_call_date`
- 元の値: `null`（または空文字）
- 新しい値: `''`（空文字）

**期待される動作**:
- DBに保存される
- `next_call_date` が `null` に更新される

**実際の動作**:
- 保存されない
- `cancelEdit()` が呼ばれる
- DBの値は変更されない
