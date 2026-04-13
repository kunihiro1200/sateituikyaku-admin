# 値下げ配信メール プレースホルダー未置換バグ 修正設計

## Overview

`GmailDistributionButton` が `sendEmailsDirectly()` を呼び出す際、`propertyData` に `{ propertyNumber, address }` の2フィールドしか渡していない。
`gmailDistributionService.sendEmailsDirectly()` 内部では `replacePlaceholders(template.body, propertyData)` を呼ぶが、`propertyData` に `publicUrl`、`priceChangeText`、`signature`、`buyerName` が含まれないため、これらのプレースホルダーがそのまま送信される。

修正方針：`sendEmailsDirectly()` に渡す `propertyData` に不足フィールドをすべて追加する。

## Glossary

- **Bug_Condition (C)**: `sendEmailsDirectly()` に渡す `propertyData` に必要なプレースホルダーキーが欠落している状態
- **Property (P)**: 送信されるメール本文・件名のすべてのプレースホルダーが実際の値に置換されていること
- **Preservation**: 買主フィルタリング・個別差し込み・一括送信・ログ記録・フォールバック処理が変わらないこと
- **replacePlaceholders**: `gmailDistributionTemplates.ts` 内の関数。`Record<string, string>` を受け取り `{key}` 形式のプレースホルダーを置換する
- **sendEmailsDirectly**: `gmailDistributionService.ts` 内のメソッド。`propertyData` を受け取り `replacePlaceholders` を呼び出してからAPIに送信する
- **propertyData**: `sendEmailsDirectly()` の第2引数。`Record<string, string>` 型

## Bug Details

### Bug Condition

`GmailDistributionButton.handleConfirmationConfirm()` が `sendEmailsDirectly()` を呼ぶ際、`propertyData` に `publicUrl`、`priceChangeText`、`signature`、`buyerName` が含まれていない。
`sendEmailsDirectly()` 内部の `replacePlaceholders(template.body, propertyData)` はこれらのキーを持たないため、`{publicUrl}` 等がそのまま本文に残る。

**Formal Specification:**
```
FUNCTION isBugCondition(propertyData)
  INPUT: propertyData of type Record<string, string>
  OUTPUT: boolean

  RETURN NOT ('publicUrl' IN keys(propertyData))
      OR NOT ('priceChangeText' IN keys(propertyData))
      OR NOT ('signature' IN keys(propertyData))
      OR NOT ('buyerName' IN keys(propertyData))
END FUNCTION
```

### Examples

- `propertyData = { propertyNumber: 'AA1234', address: '大分市中央町1-1-1' }` の場合
  - 実際: 本文に `{publicUrl}`、`{priceChangeText}`、`{signature}`、`{buyerName}` がそのまま残る
  - 期待: すべて実際の値に置換される
- `publicUrl = 'https://example.com/property/AA1234'` が props に渡されているが `propertyData` に含まれない
  - 実際: `{publicUrl}` がそのまま送信される
  - 期待: `https://example.com/property/AA1234` に置換される
- `salesPrice = 13500000`、`previousSalesPrice = 18500000` が props に渡されているが `propertyData` に含まれない
  - 実際: `{priceChangeText}` がそのまま送信される
  - 期待: `1850万円 → 1350万円（500万円値下げ）` に置換される
- 買主名が `null` の場合
  - 期待: `{buyerName}` が `お客様` に置換される（エッジケース）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買主フィルタリング処理（配信対象買主の絞り込みロジック）は変更しない
- 1人の買主への個別名前差し込み（`{buyerName}` → 買主名）は変更しない
- 複数買主への一括送信処理は変更しない
- アクティビティログへの記録処理は変更しない
- Gmail Web UI へのフォールバック処理（`fallbackToGmailWebUI`）は変更しない

**Scope:**
`sendEmailsDirectly()` に渡す `propertyData` の内容のみを変更する。
買主フィルタリング、送信先選択、ログ記録、フォールバック処理には一切手を加えない。

## Hypothesized Root Cause

`handleConfirmationConfirm()` 内で `sendEmailsDirectly()` を呼ぶ箇所（`GmailDistributionButton.tsx` 約253行目）：

```typescript
const result = await gmailDistributionService.sendEmailsDirectly(
  selectedTemplate,
  {
    propertyNumber: propertyNumber,
    address: propertyAddress || ''
  },  // ← ここに publicUrl, priceChangeText, signature, buyerName が欠落
  selectedBuyers.map(b => b.email),
  senderAddress,
  buyers
);
```

一方、`sendEmailsDirectly()` 内部では：

```typescript
const subject = replacePlaceholders(template.subject, propertyData);
const body = replacePlaceholders(template.body, propertyData);
```

`propertyData` に必要なキーがないため、`replacePlaceholders` が置換できない。

コンポーネント内には `replacePlaceholders()` というローカル関数があり、こちらは `publicUrl`、`priceChangeText`、`signature` を正しく置換できる。しかし `sendEmailsDirectly()` はサービス層の `replacePlaceholders` を使うため、`propertyData` に全フィールドを渡す必要がある。

## Correctness Properties

Property 1: Bug Condition - プレースホルダーが実際の値に置換される

_For any_ `propertyData` where the bug condition holds (isBugCondition returns true)、すなわち `publicUrl`、`priceChangeText`、`signature`、`buyerName` のいずれかが欠落している場合、修正後の `sendEmailsDirectly()` は送信メール本文・件名のすべてのプレースホルダーを実際の値に置換した状態で送信 SHALL する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 既存の送信フロー・フィルタリングが変わらない

_For any_ 入力において bug condition が成立しない場合（買主フィルタリング、ログ記録、フォールバック処理など）、修正後のコードは修正前と同一の動作を SHALL 維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/GmailDistributionButton.tsx`

**Function**: `handleConfirmationConfirm`

**Specific Changes**:

1. **propertyData の拡充**: `sendEmailsDirectly()` の第2引数に不足フィールドを追加する

   ```typescript
   // 修正前
   const result = await gmailDistributionService.sendEmailsDirectly(
     selectedTemplate,
     {
       propertyNumber: propertyNumber,
       address: propertyAddress || ''
     },
     ...
   );

   // 修正後
   const result = await gmailDistributionService.sendEmailsDirectly(
     selectedTemplate,
     {
       propertyNumber: propertyNumber,
       address: propertyAddress || '',
       publicUrl: publicUrl || '',
       priceChangeText: generatePriceChangeText(),
       signature: SIGNATURE,
       buyerName: buyerName,
       propertyType: propertyType || '',
       price: getPriceText()
     },
     ...
   );
   ```

2. **buyerName の決定ロジック**: 既存の `buyerName` 変数（`handleConfirmationConfirm` 内で既に定義済み）をそのまま使用する。変更不要。

3. **その他のフィールド**: `propertyType`、`price` も `new-listing`・`pre-listing` テンプレートで使用されるため、合わせて追加する。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：
1. 未修正コードでバグを再現するテストを書き、失敗を確認する（探索的バグ条件チェック）
2. 修正後にすべてのプレースホルダーが置換されることと、既存動作が保全されることを確認する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `sendEmailsDirectly()` に `{ propertyNumber, address }` のみを渡した場合、`replacePlaceholders` が `{publicUrl}` 等を置換できないことを確認する。

**Test Cases**:
1. **publicUrl未置換テスト**: `propertyData = { propertyNumber: 'AA1234', address: '大分市' }` で `replacePlaceholders` を呼ぶと `{publicUrl}` が残る（未修正コードで FAIL）
2. **priceChangeText未置換テスト**: 同様に `{priceChangeText}` が残る（未修正コードで FAIL）
3. **signature未置換テスト**: 同様に `{signature}` が残る（未修正コードで FAIL）
4. **buyerName未置換テスト**: 同様に `{buyerName}` が残る（未修正コードで FAIL）

**Expected Counterexamples**:
- `replacePlaceholders(template.body, { propertyNumber: 'AA1234', address: '大分市' })` の結果に `{publicUrl}` が含まれる
- 原因: `propertyData` に `publicUrl` キーが存在しないため置換されない

### Fix Checking

**Goal**: 修正後、すべてのプレースホルダーが置換されることを確認する。

**Pseudocode:**
```
FOR ALL propertyData WHERE isBugCondition(propertyData) DO
  result := replacePlaceholders(template.body, fixedPropertyData)
  ASSERT NOT ('{publicUrl}' IN result)
  ASSERT NOT ('{priceChangeText}' IN result)
  ASSERT NOT ('{signature}' IN result)
  ASSERT NOT ('{buyerName}' IN result)
END FOR
```

### Preservation Checking

**Goal**: 修正前後で、バグ条件が成立しない入力に対して動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original_behavior(input) = fixed_behavior(input)
END FOR
```

**Testing Approach**: プロパティベーステストにより多様な入力パターンを自動生成し、既存動作の保全を確認する。

**Test Cases**:
1. **買主フィルタリング保全**: フィルタリングロジックが変わらないことを確認
2. **個別名前差し込み保全**: 1人送信時に買主名が正しく差し込まれることを確認
3. **フォールバック処理保全**: Gmail Web UI フォールバック時の `replacePlaceholders` が変わらないことを確認

### Unit Tests

- `replacePlaceholders` に完全な `propertyData` を渡した場合、すべてのプレースホルダーが置換されること
- `buyerName` が `null` の場合、`お客様` に置換されること
- `publicUrl` が空文字の場合、`{publicUrl}` が空文字に置換されること（プレースホルダーが残らない）
- `generatePriceChangeText()` が正しい価格変更テキストを返すこと

### Property-Based Tests

- ランダムな `publicUrl`、`priceChangeText`、`signature`、`buyerName` を生成し、`replacePlaceholders` 後に `{...}` 形式のプレースホルダーが残らないことを確認
- ランダムな買主名（null含む）で `buyerName` が正しく置換されることを確認
- 既存の買主フィルタリング動作が修正前後で変わらないことを確認

### Integration Tests

- 値下げメールテンプレートを選択し、送信確認まで進んだ際に本文プレビューにプレースホルダーが残らないこと
- `sendEmailsDirectly()` が呼ばれる際の `propertyData` に全フィールドが含まれること
- フォールバック処理（Gmail Web UI）でも正しく置換されること
