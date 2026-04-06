# 次電日フィールド削除時の保存バグ修正設計

## Overview

買主詳細ページの次電日フィールドで、日付を削除してもDBに保存されないバグを修正します。このバグは、`InlineEditableField`コンポーネントの`handleBlur`関数が、日付フィールドで空文字と`null`を同一視してしまうことが原因です。修正により、日付フィールドの削除操作が正しく保存されるようになります。

## Glossary

- **Bug_Condition (C)**: 次電日フィールドで元の値が`null`または空文字で、新しい値が空文字の場合に保存処理がスキップされる条件
- **Property (P)**: 日付フィールドで空文字を入力した場合、DBに`null`として保存される期待動作
- **Preservation**: 日付フィールド以外のフィールドや、日付フィールドでも実際に変更がない場合の既存動作を維持すること
- **handleBlur**: `InlineEditableField.tsx`の`handleBlur`関数（lines 138-149）。フィールドのフォーカスが外れた際に値の変更を検知して保存処理を実行する
- **next_call_date**: 買主テーブルの次電日フィールド。次回電話をかける予定日を格納する

## Bug Details

### Bug Condition

バグは、次電日フィールドで日付を削除した際に発生します。`handleBlur`関数は、元の値（`null`）と新しい値（空文字`''`）を比較する際、両方を空文字に変換してしまうため、「変更なし」と判断して保存処理をスキップします。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type FieldEditInput
  OUTPUT: boolean
  
  RETURN input.fieldName = "next_call_date"
         AND input.fieldType = "date"
         AND (input.originalValue = null OR input.originalValue = "")
         AND input.newValue = ""
         AND userIntendedToDelete = true
END FUNCTION
```

### Examples

- **例1**: 次電日に「2026-04-15」が入力されている状態で、日付を削除してフィールド外をクリック
  - 期待: DBに`null`が保存される
  - 実際: 保存処理がスキップされ、DBは「2026-04-15」のまま

- **例2**: 次電日が未設定（`null`）の状態で、日付を入力してから削除してフィールド外をクリック
  - 期待: DBに`null`が保存される
  - 実際: 保存処理がスキップされ、DBは`null`のまま（結果的に正しいが、保存処理が実行されていない）

- **例3**: 次電日に「2026-04-15」が入力されている状態で、「2026-04-20」に変更してフィールド外をクリック
  - 期待: DBに「2026-04-20」が保存される
  - 実際: 正しく保存される（バグなし）

- **エッジケース**: 次電日が空文字（`''`）の状態で、空文字のままフィールド外をクリック
  - 期待: 保存処理がスキップされる（変更なし）
  - 実際: 正しくスキップされる（バグなし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 日付フィールド以外のフィールド（テキスト、ドロップダウン等）では、空文字と`null`を同一視する既存動作を維持
- 日付フィールドでも、実際に変更がない場合（元の値が空文字で新しい値も空文字）は保存処理をスキップ
- 日付フィールドで新しい日付を入力した場合は、引き続き正しく保存される

**Scope:**
日付フィールド以外のフィールドタイプ（`text`, `email`, `phone`, `dropdown`, `textarea`, `number`, `time`）は、この修正の影響を受けません。これらのフィールドでは、空文字と`null`を同一視する既存動作が維持されます。

## Hypothesized Root Cause

bugfix.mdの根本原因分析に基づき、以下の問題が特定されています：

1. **空文字とnullの同一視**: `handleBlur`関数（lines 138-149）で、`value ?? ''`により`null`が空文字に変換される
   - `const originalVal = value ?? '';` により、元の値が`null`の場合も空文字になる
   - `const currentVal = editValue ?? '';` により、新しい値が空文字の場合もそのまま空文字

2. **文字列比較の問題**: `String(currentVal) === String(originalVal)`により、両方が空文字の場合に`true`になる
   - 元の値: `null` → `''` → `String('')` = `''`
   - 新しい値: `''` → `String('')` = `''`
   - 結果: `'' === ''` → `true` → `cancelEdit()`が呼ばれる

3. **日付フィールド特有の問題**: 日付フィールドでは、空文字は「日付を削除する」という明確な意図を持つが、現在の実装ではこれを検知できない

4. **フィールドタイプの考慮不足**: 現在の実装は全フィールドタイプで同じロジックを使用しており、日付フィールドの特性を考慮していない

## Correctness Properties

Property 1: Bug Condition - 日付フィールド削除時の保存処理

_For any_ 日付フィールドの入力で、元の値が`null`または有効な日付で、新しい値が空文字の場合、修正後の`handleBlur`関数は保存処理を実行し、DBに`null`を保存する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非日付フィールドの動作維持

_For any_ 日付フィールド以外のフィールド入力、または日付フィールドでも実際に変更がない入力（元の値が空文字で新しい値も空文字）の場合、修正後の`handleBlur`関数は元の関数と同じ動作を行い、既存の保存/スキップロジックを維持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

修正は`frontend/frontend/src/components/InlineEditableField.tsx`の`handleBlur`関数のみに適用します。

**File**: `frontend/frontend/src/components/InlineEditableField.tsx`

**Function**: `handleBlur` (lines 138-149)

**Specific Changes**:
1. **日付フィールドの特別処理を追加**: 日付フィールドの場合、空文字と`null`を区別して比較する
   - 元の値が`null`または有効な日付で、新しい値が空文字の場合は「変更あり」として保存処理を実行
   - 元の値が空文字で新しい値も空文字の場合は「変更なし」として保存処理をスキップ

2. **比較ロジックの改善**: 日付フィールド専用の比較ロジックを実装
   ```typescript
   // 日付フィールドの場合の特別処理
   if (fieldType === 'date') {
     // 元の値がnullまたは有効な日付で、新しい値が空文字の場合は「削除」として保存
     if ((value === null || value !== '') && currentVal === '') {
       await saveValue();
       return;
     }
     // 元の値が空文字で新しい値も空文字の場合は「変更なし」
     if (value === '' && currentVal === '') {
       cancelEdit();
       return;
     }
   }
   ```

3. **既存ロジックの維持**: 日付フィールド以外のフィールドでは、既存の比較ロジックをそのまま使用
   ```typescript
   // 日付フィールド以外は既存のロジック
   const currentVal = editValue ?? '';
   const originalVal = value ?? '';
   if (String(currentVal) === String(originalVal)) {
     cancelEdit();
     return;
   }
   ```

4. **コメントの追加**: 修正の意図を明確にするコメントを追加

5. **エッジケースの考慮**: 元の値が空文字の場合も正しく処理されることを確認

### Modified Code

```typescript
// Handle blur to save (値が変わっていない場合はキャンセル)
const handleBlur = async () => {
  if (isEditing && !isSaving) {
    // 日付フィールドの場合、空文字とnullを区別して比較
    if (fieldType === 'date') {
      const currentVal = editValue ?? '';
      // 元の値がnullまたは有効な日付で、新しい値が空文字の場合は「削除」として保存
      if ((value === null || value !== '') && currentVal === '') {
        await saveValue();
        return;
      }
      // 元の値が空文字で新しい値も空文字の場合は「変更なし」
      if (value === '' && currentVal === '') {
        cancelEdit();
        return;
      }
    }
    
    // 日付フィールド以外、または日付フィールドで通常の変更の場合は既存のロジック
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

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチを採用します。まず、未修正のコードで反例を収集してバグを確認し、次に修正後のコードで修正検証と保存検証を実行します。

### Exploratory Bug Condition Checking

**Goal**: 未修正のコードでバグを実証する反例を収集し、根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる必要があります。

**Test Plan**: 買主詳細ページで次電日フィールドの削除操作をシミュレートし、保存処理が実行されないことを確認します。未修正のコードで実行してバグを観察します。

**Test Cases**:
1. **日付削除テスト**: 次電日に「2026-04-15」が入力されている状態で、日付を削除してフィールド外をクリック（未修正コードで失敗）
2. **null状態での削除テスト**: 次電日が未設定（`null`）の状態で、日付を入力してから削除してフィールド外をクリック（未修正コードで保存処理がスキップされる）
3. **空文字状態での削除テスト**: 次電日が空文字（`''`）の状態で、空文字のままフィールド外をクリック（未修正コードで正しくスキップされる）
4. **日付変更テスト**: 次電日に「2026-04-15」が入力されている状態で、「2026-04-20」に変更してフィールド外をクリック（未修正コードで正しく保存される）

**Expected Counterexamples**:
- 日付削除時に保存処理が実行されない
- 可能な原因: 空文字と`null`の同一視、文字列比較の問題、日付フィールド特有の処理不足

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待動作を行うことを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleBlur_fixed(input)
  ASSERT result.saved = true
    AND result.dbValue = null
    AND no_cancel_edit_called(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を返すことを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleBlur_original(input) = handleBlur_fixed(input)
END FOR
```

**Testing Approach**: 保存検証にはプロパティベーステストが推奨されます。理由：
- 入力ドメイン全体で多数のテストケースを自動生成
- 手動ユニットテストでは見逃しがちなエッジケースを検出
- 非バグ入力に対して動作が変更されていないことを強力に保証

**Test Plan**: まず未修正のコードで日付フィールド以外のフィールドや、日付フィールドでも実際に変更がない場合の動作を観察し、次にその動作を保持するプロパティベーステストを作成します。

**Test Cases**:
1. **テキストフィールドの保存検証**: テキストフィールドで空文字と`null`を同一視する動作が維持されることを確認
2. **ドロップダウンフィールドの保存検証**: ドロップダウンフィールドで空文字と`null`を同一視する動作が維持されることを確認
3. **日付フィールドの通常変更の保存検証**: 日付フィールドで新しい日付を入力した場合、正しく保存されることを確認
4. **日付フィールドの変更なしの保存検証**: 日付フィールドで元の値が空文字で新しい値も空文字の場合、保存処理がスキップされることを確認

### Unit Tests

- 日付フィールドで元の値が`null`で新しい値が空文字の場合、保存処理が実行されることをテスト
- 日付フィールドで元の値が有効な日付で新しい値が空文字の場合、保存処理が実行されることをテスト
- 日付フィールドで元の値が空文字で新しい値も空文字の場合、保存処理がスキップされることをテスト
- 日付フィールド以外のフィールドで空文字と`null`を同一視する動作が維持されることをテスト
- エッジケース（元の値が空文字、新しい値が`null`等）をテスト

### Property-Based Tests

- ランダムなフィールドタイプと値を生成し、日付フィールドで削除操作が正しく保存されることを検証
- ランダムなフィールドタイプと値を生成し、日付フィールド以外のフィールドで既存動作が維持されることを検証
- 多数のシナリオで日付フィールドの削除操作と通常変更が正しく処理されることをテスト

### Integration Tests

- 買主詳細ページで次電日フィールドの削除操作を実行し、DBに`null`が保存されることを確認
- 買主詳細ページで次電日フィールドに新しい日付を入力し、DBに正しく保存されることを確認
- 買主詳細ページで他のフィールド（reception_date等）の削除操作が正しく動作することを確認
