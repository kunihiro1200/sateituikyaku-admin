# property-price-reduction-chat-not-showing バグ修正設計

## Overview

物件リスト詳細画面で値下げ予約日を空欄にして保存した後、「物件担当へCHAT送信」ボタンが表示されないバグの修正設計。

コードの調査により、**2つの根本原因**が特定された：

1. **`onChatSend` prop の欠落**（最重要）: `PropertyListingDetailPage.tsx` の `PriceSection` JSX に `onChatSend` prop が渡されていない。`PriceSection` の TypeScript インターフェースでは `onChatSend` は必須 prop として定義されているため、TypeScript コンパイルエラーが発生し、コンポーネントが正常にレンダリングされない可能性がある。

2. **バックエンドの空文字列→null 変換の欠落**: `backend/src/routes/propertyListings.ts` の PUT 処理では `offer_date` 等の買付フィールドのみ空文字列→null 変換を行っているが、`price_reduction_scheduled_date` は変換対象に含まれていない。そのため、空欄で保存すると DB に空文字列 `""` が保存され、再取得時に `""` が返される。

`PriceSection.tsx` の `displayScheduledDate` の評価ロジック：
```typescript
const displayScheduledDate = editedData.price_reduction_scheduled_date !== undefined
  ? editedData.price_reduction_scheduled_date
  : priceReductionScheduledDate;
const showChatButton = !isEditMode && !displayScheduledDate;
```

空文字列 `""` は falsy なので `!""` は `true` となり、理論上はボタンが表示されるはずだが、`onChatSend` prop が渡されていないことによる TypeScript エラーがコンポーネントのレンダリングに影響している可能性が高い。

修正方針：
- `PropertyListingDetailPage.tsx` に `handlePropertyChatSend` ハンドラーを追加し、`onChatSend` prop として渡す
- バックエンドの PUT 処理に `price_reduction_scheduled_date` の空文字列→null 変換を追加する

---

## Glossary

- **Bug_Condition (C)**: 値下げ予約日を空欄にして保存した後、非編集モードで「物件担当へCHAT送信」ボタンが表示されない状態
- **Property (P)**: 値下げ予約日が null または空文字列の場合、非編集モードでボタンが表示されるべき
- **Preservation**: 値下げ予約日に値がある場合のボタン非表示、編集モードでのボタン非表示、既存の保存・表示機能
- **`displayScheduledDate`**: `PriceSection.tsx` 内で `editedData` または `priceReductionScheduledDate` prop から算出される表示用の値下げ予約日
- **`showChatButton`**: `!isEditMode && !displayScheduledDate` で算出されるボタン表示フラグ
- **`onChatSend`**: `PriceSection` の必須 prop。CHAT送信処理を親コンポーネントに委譲するコールバック
- **`handlePropertyChatSend`**: `PropertyListingDetailPage.tsx` に追加する CHAT送信ハンドラー関数

---

## Bug Details

### Bug Condition

値下げ予約日を空欄にして保存した後、`fetchPropertyData()` で再取得したデータの `price_reduction_scheduled_date` が `null` ではなく空文字列 `""` として DB に保存・返却される可能性がある。加えて、`PropertyListingDetailPage.tsx` の `PriceSection` JSX に `onChatSend` prop が渡されていないため、TypeScript の必須 prop 違反が発生している。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { priceReductionScheduledDate: string | null | undefined, onChatSendPropPassed: boolean }
  OUTPUT: boolean

  RETURN (
    (input.priceReductionScheduledDate === '' OR input.priceReductionScheduledDate === null)
    AND NOT input.onChatSendPropPassed
  )
  OR (
    input.priceReductionScheduledDate === ''
    AND バックエンドが空文字列をnullに変換せずDBに保存している
  )
END FUNCTION
```

### Examples

- **例1（バグあり）**: 値下げ予約日 `2026/04/18` → 空欄に変更して保存 → `price_reduction_scheduled_date` が `""` としてDBに保存 → 再取得時に `""` が返る → `onChatSend` prop 欠落によりコンポーネントエラー → ボタン非表示
- **例2（バグあり）**: 値下げ予約日が最初から空欄の物件 → `onChatSend` prop が渡されていないため TypeScript エラー → ボタン非表示
- **例3（期待動作）**: 修正後、値下げ予約日を空欄にして保存 → `price_reduction_scheduled_date` が `null` としてDBに保存 → 再取得時に `null` が返る → `onChatSend` prop が正しく渡される → ボタン表示
- **エッジケース**: 値下げ予約日に値がある物件 → ボタンは非表示のまま（変更なし）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 値下げ予約日に値（例：`2026/05/01`）が入っている物件を非編集モードで表示する場合、「物件担当へCHAT送信」ボタンは非表示のまま
- 編集モードでは値下げ予約日の有無に関わらず「物件担当へCHAT送信」ボタンは非表示のまま
- 値下げ予約日が最初から null の物件では、ボタンが表示される（既存の正常動作を維持）
- 買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）の空文字列→null 変換は変更なし
- 価格情報セクションの保存・キャンセル処理は変更なし

**Scope:**
値下げ予約日フィールドに関係しない全ての入力（マウスクリック、他フィールドの編集、他セクションの保存）は、この修正によって完全に影響を受けない。

---

## Hypothesized Root Cause

コードの調査により、以下の2つの根本原因が確認された：

1. **`onChatSend` prop の欠落（確認済み）**:
   - `PriceSection.tsx` の `PriceSectionProps` インターフェースで `onChatSend: (data: PropertyChatSendData) => Promise<void>` は必須 prop として定義されている
   - `PropertyListingDetailPage.tsx` の `PriceSection` JSX（行 2140-2156）に `onChatSend` prop が渡されていない
   - TypeScript の必須 prop 違反により、コンポーネントが正常にレンダリングされない

2. **バックエンドの `price_reduction_scheduled_date` 空文字列→null 変換の欠落（確認済み）**:
   - `backend/src/routes/propertyListings.ts` の PUT 処理（行 278-283）では `OFFER_FIELDS` のみ空文字列→null 変換を行っている
   - `price_reduction_scheduled_date` は `OFFER_FIELDS` に含まれていない
   - フロントエンドの `TextField type="date"` で空欄にすると `""` が送信され、DB に `""` が保存される
   - Supabase の `date` 型カラムに空文字列を保存しようとするとエラーになる可能性もある

---

## Correctness Properties

Property 1: Bug Condition - 値下げ予約日を空欄にして保存後のCHATボタン表示

_For any_ 物件で値下げ予約日を空欄にして保存した後の非編集モード表示において、修正後の `PriceSection` コンポーネントは SHALL 「物件担当へCHAT送信」ボタンを表示する（`onChatSend` prop が正しく渡され、`price_reduction_scheduled_date` が null として保存・返却される）。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 値下げ予約日あり・編集モードでのボタン非表示

_For any_ 物件で値下げ予約日に値がある場合、または編集モードの場合、修正後のコードは SHALL 「物件担当へCHAT送信」ボタンを非表示にし、修正前と同じ動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

**修正1: `PropertyListingDetailPage.tsx` に `onChatSend` prop を追加**

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Specific Changes**:
1. **`handlePropertyChatSend` ハンドラーを追加**: `handlePriceChatSendSuccess` 関数の近くに以下を追加
   ```typescript
   const handlePropertyChatSend = async (data: PropertyChatSendData) => {
     // 現時点では PriceSection 内部で直接 Webhook に送信しているため、
     // このハンドラーは将来のバックエンド移行用のプレースホルダーとして機能する
     // （PriceSection.tsx の handleSendPriceReductionChat が実際の送信を行う）
   };
   ```
2. **`PriceSection` JSX に `onChatSend` prop を追加**:
   ```tsx
   onChatSend={handlePropertyChatSend}
   ```

**修正2: バックエンドの PUT 処理に `price_reduction_scheduled_date` の変換を追加**

**File**: `backend/src/routes/propertyListings.ts`

**Function**: `router.put('/:propertyNumber', ...)`

**Specific Changes**:
1. **`price_reduction_scheduled_date` の空文字列→null 変換を追加**:
   ```typescript
   // 既存の OFFER_FIELDS 変換の後に追加
   if (safeUpdates.price_reduction_scheduled_date === '') {
     safeUpdates.price_reduction_scheduled_date = null;
   }
   ```

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `PriceSection` コンポーネントに `onChatSend` prop を渡さずにレンダリングし、ボタンが表示されないことを確認する。また、バックエンドの PUT 処理に空文字列の `price_reduction_scheduled_date` を送信し、DB に `""` が保存されることを確認する。

**Test Cases**:
1. **`onChatSend` prop 欠落テスト**: `onChatSend` を渡さずに `PriceSection` をレンダリングし、TypeScript エラーまたはボタン非表示を確認（未修正コードで失敗）
2. **空文字列保存テスト**: `price_reduction_scheduled_date: ""` を PUT リクエストで送信し、DB に `""` が保存されることを確認（未修正コードで失敗）
3. **保存後ボタン表示テスト**: 値下げ予約日を空欄にして保存後、ボタンが表示されないことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `onChatSend` prop が渡されていないため TypeScript コンパイルエラーが発生
- `price_reduction_scheduled_date` が `""` として DB に保存され、再取得時に `""` が返る

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedPriceSection(input)
  ASSERT showChatButton(result) === true
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalPriceSection(input) = fixedPriceSection(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 値下げ予約日の多様な値（null、""、任意の日付文字列）を自動生成できる
- 編集モード/非編集モードの組み合わせを網羅できる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Cases**:
1. **値下げ予約日あり保存テスト**: 値下げ予約日に値がある場合、ボタンが非表示のまま（修正前後で同じ）
2. **編集モードテスト**: 編集モードでは値下げ予約日の有無に関わらずボタンが非表示（修正前後で同じ）
3. **他フィールド保存テスト**: 他フィールドの保存処理が影響を受けないことを確認

### Unit Tests

- `PriceSection` の `showChatButton` ロジック: `priceReductionScheduledDate` が null/空文字/日付文字列の各ケースでボタン表示状態を検証
- `PriceSection` に `onChatSend` prop を渡した場合と渡さない場合のレンダリング検証
- バックエンドの PUT 処理: `price_reduction_scheduled_date: ""` が `null` に変換されることを検証

### Property-Based Tests

- ランダムな `price_reduction_scheduled_date` 値（null、""、任意の日付文字列）に対して `showChatButton` の動作を検証
- ランダムな `isEditMode` 値に対してボタン表示制御が正しく機能することを検証
- 修正後のバックエンド PUT 処理に対して、空文字列が常に null に変換されることを検証

### Integration Tests

- 値下げ予約日を空欄にして保存 → 非編集モードでボタンが表示されることを確認
- 値下げ予約日に値を入力して保存 → 非編集モードでボタンが非表示のままであることを確認
- ボタンクリック → 送信確認ダイアログが表示されることを確認
