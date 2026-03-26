# seller-copy-field-missing-data Bugfix Design

## Overview

売主新規登録画面（NewSellerPage）の「売主コピー」フィールドで既存の売主を選択した際、
`name` はコピーされるが `address`・`phone_number`・`email` がコピーされないバグを修正する。

根本原因は `/api/sellers/by-number/:sellerNumber` エンドポイントのレスポンスに
`name` と `propertyAddress` しか含まれておらず、`address`・`phone_number`・`email` が
欠落していることにある。

修正は最小限の変更で行う：
1. バックエンド（`backend/src/routes/sellers.ts`）のレスポンスに3フィールドを追加
2. フロントエンド（`frontend/frontend/src/pages/NewSellerPage.tsx`）のコピー処理は
   既に `seller.address`・`seller.phoneNumber`・`seller.email` を参照しているため変更不要

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 売主コピーフィールドで既存売主を選択したとき
- **Property (P)**: 期待される正しい動作 — `address`・`phone_number`・`email` がフォームにセットされること
- **Preservation**: 修正によって変えてはならない既存の動作
- **handleSellerCopySelect**: `NewSellerPage.tsx` 内の関数。売主コピー選択時に `/api/sellers/by-number/:sellerNumber` を呼び出してフォームにセットする
- **by-number エンドポイント**: `backend/src/routes/sellers.ts` の `GET /api/sellers/by-number/:sellerNumber`。`sellerService.getSeller()` 経由で売主データを取得し、レスポンスを返す
- **sellerService.getSeller()**: `SellerService.supabase.ts` のメソッド。暗号化フィールド（`name`・`phone_number`・`email`）を復号して返す

## Bug Details

### Bug Condition

バグは売主コピーフィールドで既存の売主を選択したときに発現する。
`/api/sellers/by-number/:sellerNumber` エンドポイントが `name` と `propertyAddress` のみを
レスポンスに含め、`address`・`phone_number`・`email` を含まないため、
フロントエンドの `handleSellerCopySelect` がこれらのフィールドをセットできない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sellerNumber: string }
  OUTPUT: boolean

  apiResponse := GET /api/sellers/by-number/{input.sellerNumber}

  RETURN apiResponse.address IS UNDEFINED
         AND apiResponse.phoneNumber IS UNDEFINED
         AND apiResponse.email IS UNDEFINED
END FUNCTION
```

### Examples

- 売主番号 AA13501 を選択 → `name` はセットされるが `address`・`phone_number`・`email` は空のまま（バグあり）
- 売主番号 AA13501 を選択 → 全フィールドがセットされる（修正後の期待動作）
- 売主コピーフィールドに2文字未満を入力 → 検索が実行されない（バグ条件に該当しない）
- 存在しない売主番号を選択 → エラーメッセージが表示される（バグ条件に該当しない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主コピーフィールドで売主を選択したとき、`name` は引き続き正しくコピーされる
- `propertyAddress`（物件住所）はコピーされない（依頼者住所 `address` のみをコピーする）
- 売主コピーフィールドに2文字未満の文字列を入力したとき、検索は実行されない
- 存在しない売主番号を選択しようとしたとき、エラーメッセージが表示される
- 買主コピーフィールドで既存の買主を選択したとき、買主の `name`・`phone_number`・`email` は正しくコピーされる

**Scope:**
売主コピー選択以外の全ての操作（フォームの手動入力、買主コピー、売主番号自動採番など）は
この修正によって一切影響を受けない。

## Hypothesized Root Cause

`backend/src/routes/sellers.ts` の `/by-number/:sellerNumber` エンドポイントが
`sellerService.getSeller()` を呼び出して完全な売主データを取得しているにもかかわらず、
レスポンスの構築時に `name` と `propertyAddress` の2フィールドしか含めていない。

```typescript
// 現在の実装（バグあり）
res.json({
  id: seller.id,
  sellerNumber: seller.sellerNumber,
  name: seller.name,
  propertyAddress: seller.propertyAddress,
  // address, phoneNumber, email が欠落している
});
```

`sellerService.getSeller()` は `address`・`phoneNumber`・`email` を復号済みで返しているため、
レスポンスに追加するだけで修正できる。

フロントエンドの `handleSellerCopySelect` は既に以下のように実装されており、
バックエンドが正しいフィールドを返せば即座に動作する：

```typescript
if (seller.address) setRequestorAddress(seller.address);
if (seller.phoneNumber) setPhoneNumber(seller.phoneNumber);
if (seller.email) setEmail(seller.email);
```

## Correctness Properties

Property 1: Bug Condition - 売主コピー選択時に全フィールドがコピーされる

_For any_ 売主番号の入力において、バグ条件が成立する（`isBugCondition` が true を返す）場合、
修正後の `/api/sellers/by-number/:sellerNumber` エンドポイントは `address`・`phoneNumber`・`email`
を含むレスポンスを返し、フォームの依頼者住所・電話番号・メールアドレスフィールドに
正しい値がセットされる。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の動作が変わらない

_For any_ 入力においてバグ条件が成立しない場合（売主コピー以外の操作、`name` のコピー、
買主コピー選択など）、修正後のコードは修正前のコードと同一の結果を返し、
既存の全ての動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/routes/sellers.ts`

**Function**: `GET /by-number/:sellerNumber` ルートハンドラ

**Specific Changes**:

1. **レスポンスに3フィールドを追加**: `res.json()` の返却オブジェクトに `address`・`phoneNumber`・`email` を追加する

```typescript
// 修正前
res.json({
  id: seller.id,
  sellerNumber: seller.sellerNumber,
  name: seller.name,
  propertyAddress: seller.propertyAddress,
});

// 修正後
res.json({
  id: seller.id,
  sellerNumber: seller.sellerNumber,
  name: seller.name,
  propertyAddress: seller.propertyAddress,
  address: seller.address,
  phoneNumber: seller.phoneNumber,
  email: seller.email,
});
```

**File**: `frontend/frontend/src/pages/NewSellerPage.tsx`

**変更不要**: `handleSellerCopySelect` は既に `seller.address`・`seller.phoneNumber`・`seller.email`
を参照しているため、バックエンドの修正のみで動作する。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、
次に修正後のコードで全フィールドがコピーされることと既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `/api/sellers/by-number/:sellerNumber` が `address`・`phoneNumber`・`email`
を返さないことを確認し、根本原因分析を裏付ける。

**Test Plan**: エンドポイントのレスポンスを直接検査するテストを書き、未修正コードで実行して
フィールドの欠落を観察する。

**Test Cases**:
1. **レスポンスフィールド確認テスト**: 実在する売主番号で `/api/sellers/by-number/:sellerNumber` を呼び出し、レスポンスに `address`・`phoneNumber`・`email` が含まれないことを確認（未修正コードで失敗する）
2. **フォームセットテスト**: `handleSellerCopySelect` を呼び出し、`requestorAddress`・`phoneNumber`・`email` の state が更新されないことを確認（未修正コードで失敗する）

**Expected Counterexamples**:
- レスポンスに `address`・`phoneNumber`・`email` が含まれない
- 原因: `res.json()` の返却オブジェクトにこれらのフィールドが含まれていない

### Fix Checking

**Goal**: 修正後のエンドポイントが全フィールドを返し、フォームに正しくセットされることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  response := GET /api/sellers/by-number/{input.sellerNumber}
  ASSERT response.address IS NOT UNDEFINED
  ASSERT response.phoneNumber IS NOT UNDEFINED
  ASSERT response.email IS NOT UNDEFINED
  ASSERT formState.requestorAddress = response.address
  ASSERT formState.phoneNumber = response.phoneNumber
  ASSERT formState.email = response.email
END FOR
```

### Preservation Checking

**Goal**: 修正によって `name` のコピー、`propertyAddress` の非コピー、
買主コピー動作などが変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な売主データに対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が保持されることを強く保証できる

**Test Cases**:
1. **name コピー保持テスト**: 修正後も `name` が正しくコピーされることを確認
2. **propertyAddress 非コピー保持テスト**: `propertyAddress` がフォームにセットされないことを確認
3. **買主コピー動作保持テスト**: 買主コピー選択時の動作が変わらないことを確認
4. **検索最小文字数保持テスト**: 2文字未満の入力で検索が実行されないことを確認

### Unit Tests

- `/api/sellers/by-number/:sellerNumber` のレスポンスに `address`・`phoneNumber`・`email` が含まれることをテスト
- `address`・`phone_number`・`email` が null/空の売主に対するエッジケースをテスト
- `handleSellerCopySelect` が全フィールドを正しく state にセットすることをテスト

### Property-Based Tests

- ランダムな売主データを生成し、`address`・`phoneNumber`・`email` が常にレスポンスに含まれることを検証
- ランダムな入力に対して `name` のコピー動作が保持されることを検証
- 売主コピー以外の操作（買主コピー、手動入力）が影響を受けないことを多数のシナリオで検証

### Integration Tests

- 売主コピーフィールドで売主を選択し、フォームの全フィールド（`name`・`address`・`phone_number`・`email`）が正しくセットされることをエンドツーエンドでテスト
- 売主コピー後にフォームを送信し、全フィールドが正しく保存されることをテスト
- 買主コピーと売主コピーを両方使用した場合の動作をテスト
