# 特記・備忘録保存機能追加 バグフィックス設計

## Overview

物件詳細画面（`PropertyListingDetailPage.tsx`）の「特記・備忘録」セクションに保存ボタンが存在しないため、ユーザーが入力した内容がデータベースに保存されない。

バックエンドの `PUT /api/property-listings/:propertyNumber` および `syncToSpreadsheet()` は実装済みであり、カラムマッピング（`●特記` → `special_notes`、`備忘録` → `memo`）も設定済み。フロントエンドに保存ボタンと保存ハンドラーを追加するだけで修正できる。

## Glossary

- **Bug_Condition (C)**: ユーザーが「特記」または「備忘録」テキストエリアを編集した状態（`editedData.special_notes` または `editedData.memo` が存在する）にもかかわらず、保存ボタンが存在しないため保存できない状態
- **Property (P)**: 保存ボタンクリック時に `PUT /api/property-listings/:propertyNumber` が呼ばれ、DBへの保存とスプレッドシート同期が完了し、スナックバー通知が表示される
- **Preservation**: 他のセクション（価格情報、基本情報、内覧情報など）の保存処理が変更されないこと
- **handleSaveNotes**: `PropertyListingDetailPage.tsx` に追加する保存ハンドラー関数
- **editedData**: 各セクションの編集中データを保持する `Record<string, any>` 型の state
- **syncToSpreadsheet**: `PropertyListingService.ts` 内の private メソッド。`updatePropertyListing()` 呼び出し後に自動実行される

## Bug Details

### Bug Condition

「特記・備忘録」セクションのテキストエリアは `handleFieldChange` で `editedData` に値を保持するが、保存ボタンが存在しないため `PUT /api/property-listings/:propertyNumber` が呼ばれない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { field: 'special_notes' | 'memo', value: string }
  OUTPUT: boolean

  RETURN (input.field IN ['special_notes', 'memo'])
         AND editedData[input.field] IS NOT undefined
         AND saveButtonExists() = false
END FUNCTION
```

### Examples

- ユーザーが「特記」に「南向き・日当たり良好」と入力 → 保存ボタンがないため保存不可（バグ）
- ユーザーが「備忘録」に「鍵は管理会社に預けてある」と入力 → 保存ボタンがないため保存不可（バグ）
- ユーザーが画面を離れる → 入力内容が破棄される（バグ）
- ユーザーが「価格情報」セクションを保存する → 正常に動作する（バグ対象外）

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- 価格情報セクションの保存処理（`handleSavePrice`）は変更されない
- 基本情報セクションの保存処理（`handleSaveBasicInfo`）は変更されない
- 内覧情報セクションの保存処理（`handleSaveViewingInfo`）は変更されない
- 売主買主情報セクションの保存処理（`handleSaveSellerBuyer`）は変更されない
- 他のセクションの `editedData` は特記・備忘録の保存操作で変更されない

**Scope:**
特記（`special_notes`）と備忘録（`memo`）フィールド以外の全ての操作は、この修正によって影響を受けない。

## Hypothesized Root Cause

フロントエンドの実装漏れ。他のセクション（価格情報、基本情報など）には `EditableSection` コンポーネントまたは独自の保存ボタンが実装されているが、「特記・備忘録」セクションには保存ボタンが追加されていない。

1. **保存ボタンの欠落**: `PropertyListingDetailPage.tsx` の特記・備忘録セクションに保存ボタンが存在しない
2. **保存ハンドラーの欠落**: `handleSaveNotes` 関数が実装されていない
3. **バックエンドは正常**: `PUT /api/property-listings/:propertyNumber` は実装済みで、`syncToSpreadsheet()` も自動実行される

## Correctness Properties

Property 1: Bug Condition - 特記・備忘録の保存ボタンが機能する

_For any_ 入力において `isBugCondition` が true（ユーザーが `special_notes` または `memo` を編集した状態）の場合、修正後の `handleSaveNotes` 関数は `PUT /api/property-listings/:propertyNumber` を `{ special_notes, memo }` を含むペイロードで呼び出し、成功時に「特記・備忘録を保存しました」スナックバーを表示しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他セクションの保存処理が変更されない

_For any_ 入力において `isBugCondition` が false（特記・備忘録以外のフィールド操作）の場合、修正後のコードは修正前のコードと同じ動作を維持し、既存の保存ハンドラー（`handleSavePrice`、`handleSaveBasicInfo` 等）の動作を変更してはならない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Specific Changes**:

1. **保存ハンドラーの追加**: 既存の `handleSaveSellerBuyer` の後に `handleSaveNotes` を追加

```typescript
const handleSaveNotes = async () => {
  if (!propertyNumber) return;
  const notesData: Record<string, any> = {};
  if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
  if (editedData.memo !== undefined) notesData.memo = editedData.memo;
  if (Object.keys(notesData).length === 0) return;
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, notesData);
    setSnackbar({ open: true, message: '特記・備忘録を保存しました', severity: 'success' });
    await fetchPropertyData();
    setEditedData({});
  } catch (error) {
    setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    throw error;
  }
};
```

2. **保存ボタンの追加**: 特記・備忘録セクションの `<Paper>` 内、テキストエリアの下に保存ボタンを追加

```tsx
<Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
  <Button
    variant="contained"
    size="small"
    onClick={handleSaveNotes}
    disabled={editedData.special_notes === undefined && editedData.memo === undefined}
    sx={{ bgcolor: SECTION_COLORS.property.main }}
  >
    保存
  </Button>
</Box>
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後のコードで正しい動作とリグレッションなしを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを確認する。

**Test Plan**: 特記・備忘録セクションに保存ボタンが存在しないことを確認し、`handleSaveNotes` 関数が存在しないことを確認する。

**Test Cases**:
1. **保存ボタン不在テスト**: 特記・備忘録セクションのDOMに保存ボタンが存在しないことを確認（未修正コードで失敗）
2. **ハンドラー不在テスト**: `handleSaveNotes` が定義されていないことを確認（未修正コードで失敗）
3. **データ消失テスト**: テキストエリアに入力後、画面遷移するとデータが消えることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- 保存ボタンが見つからない
- `handleSaveNotes` が undefined

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSaveNotes_fixed(input)
  ASSERT PUT /api/property-listings/:propertyNumber was called
  ASSERT snackbar message = '特記・備忘録を保存しました'
  ASSERT editedData is cleared after save
END FOR
```

### Preservation Checking

**Goal**: 修正後、バグ条件が成立しない入力（他セクションの操作）で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSavePrice_original(input) = handleSavePrice_fixed(input)
  ASSERT handleSaveBasicInfo_original(input) = handleSaveBasicInfo_fixed(input)
  ASSERT handleSaveViewingInfo_original(input) = handleSaveViewingInfo_fixed(input)
END FOR
```

**Testing Approach**: 既存の保存ハンドラーのシグネチャと動作が変更されていないことを確認する。

**Test Cases**:
1. **価格情報保存の保持**: `handleSavePrice` が修正前後で同じ動作をすることを確認
2. **基本情報保存の保持**: `handleSaveBasicInfo` が修正前後で同じ動作をすることを確認
3. **内覧情報保存の保持**: `handleSaveViewingInfo` が修正前後で同じ動作をすることを確認

### Unit Tests

- `handleSaveNotes` が `special_notes` のみ変更時に正しいペイロードで PUT を呼ぶ
- `handleSaveNotes` が `memo` のみ変更時に正しいペイロードで PUT を呼ぶ
- `handleSaveNotes` が両フィールド変更時に両方を含むペイロードで PUT を呼ぶ
- `handleSaveNotes` が未変更時（editedData に該当フィールドなし）は PUT を呼ばない
- 保存失敗時にエラースナックバーが表示される

### Property-Based Tests

- 任意の `special_notes` 文字列に対して、保存後に `fetchPropertyData` が呼ばれ `editedData` がクリアされる
- 任意の `memo` 文字列に対して、保存後に `fetchPropertyData` が呼ばれ `editedData` がクリアされる
- 他セクションの保存ハンドラーは `handleSaveNotes` の追加後も同じシグネチャを持つ

### Integration Tests

- 特記テキストエリアに入力 → 保存ボタンクリック → DBに保存される → スナックバー表示
- 備忘録テキストエリアに入力 → 保存ボタンクリック → スプレッドシートのDG列に同期される
- 保存ボタンは未編集時に disabled になる
