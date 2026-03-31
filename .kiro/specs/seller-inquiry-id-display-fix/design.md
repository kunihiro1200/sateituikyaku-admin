# AA13175 inquiry_id表示バグ修正 設計ドキュメント

## Overview

AA13175の「ID」フィールド（`inquiry_id`）がスプレッドシートのD列に`CO2511-94507`と入力されており、データベースにも正しく保存されているにもかかわらず、通話モードページの除外申請セクションで「－」と表示される問題を修正します。

データベースには正しく保存されているが、APIレスポンスに含まれていない、またはフロントエンドで正しく受け取られていない可能性があります。

## Glossary

- **Bug_Condition (C)**: `inquiry_id`がデータベースに存在するが、通話モードページで「－」と表示される条件
- **Property (P)**: `inquiry_id`がデータベースに存在する場合、通話モードページで正しく表示される
- **Preservation**: `inquiry_id`が空の売主、サイトが「す」「L」以外の売主の表示は変更されない
- **inquiry_id**: スプレッドシートD列「ID」に対応するデータベースカラム（例: `CO2511-94507`）
- **SellerService.decryptSeller()**: `backend/src/services/SellerService.supabase.ts`の売主データ復号メソッド
- **CallModePage**: `frontend/frontend/src/pages/CallModePage.tsx`の通話モードページ

## Bug Details

### Bug Condition

バグは、`inquiry_id`がデータベースに存在するにもかかわらず、通話モードページで「－」と表示される場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sellerId: string, site: string }
  OUTPUT: boolean
  
  seller := getSeller(input.sellerId)
  dbInquiryId := database.sellers.inquiry_id WHERE id = input.sellerId
  
  RETURN (input.site IN ['す', 'L'])
         AND (dbInquiryId IS NOT NULL AND dbInquiryId != '')
         AND (seller.inquiryId IS NULL OR seller.inquiryId == '')
END FUNCTION
```

### Examples

- **AA13175**: スプレッドシートD列に`CO2511-94507`が入力されている、データベースに`inquiry_id = 'CO2511-94507'`が保存されている、サイトが「す」または「L」、通話モードページで「－」と表示される
- **AA13176**: スプレッドシートD列に`CO2511-94508`が入力されている、データベースに`inquiry_id = 'CO2511-94508'`が保存されている、サイトが「す」、通話モードページで正しく`CO2511-94508`が表示される（期待される動作）
- **AA13177**: スプレッドシートD列が空、データベースに`inquiry_id = NULL`、サイトが「す」、通話モードページで「－」と表示される（正常な動作）
- **AA13178**: スプレッドシートD列に`CO2511-94509`が入力されている、データベースに`inquiry_id = 'CO2511-94509'`が保存されている、サイトが「H」、通話モードページで「ID」フィールド自体が表示されない（正常な動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `inquiry_id`が空（NULL または空文字列）の売主データを表示する場合、「ID」フィールドは引き続き「－」と表示される
- サイトが「す」または「L」以外の売主データを表示する場合、「ID」フィールドは引き続き表示されない
- 他のフィールド（名前、電話番号、反響詳細日時など）の表示は引き続き正しく表示される

**Scope:**
`inquiry_id`がデータベースに存在しない売主、またはサイトが「す」「L」以外の売主は、この修正の影響を受けません。

## Hypothesized Root Cause

バグ説明と確認済みの事実から、最も可能性の高い原因は以下の通りです：

1. **APIルーティングの問題**: `backend/src/routes/sellers.ts`の`GET /:id`エンドポイントが`inquiry_id`を含めずにレスポンスを返している
   - `SellerService.getSeller()`は正しく`inquiry_id`を含めて返しているが、ルーティング層で除外されている可能性

2. **SellerServiceのSELECT句の問題**: `backend/src/services/SellerService.supabase.ts`の`getSeller()`メソッドがSupabaseから`inquiry_id`を取得していない
   - `select('*')`を使用していない場合、明示的に`inquiry_id`を指定する必要がある

3. **フロントエンドの型定義の問題**: `frontend/frontend/src/types/index.ts`の`Seller`型に`inquiryId`が定義されていない
   - APIレスポンスに含まれていても、TypeScriptの型定義がないため、フロントエンドで受け取れない

4. **キャッシュの問題**: 古いAPIレスポンスがキャッシュされている
   - ブラウザまたはサーバー側のキャッシュが原因で、最新のデータが取得できていない

## Correctness Properties

Property 1: Bug Condition - inquiry_id表示

_For any_ 売主データで`inquiry_id`がデータベースに存在し（NULL でも空文字列でもない）、サイトが「す」または「L」の場合、通話モードページの「ID」フィールドに`inquiry_id`の値が表示される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - inquiry_id空欄時の表示

_For any_ 売主データで`inquiry_id`がデータベースに存在しない（NULL または空文字列）場合、通話モードページの「ID」フィールドは「－」と表示される。

**Validates: Requirements 3.1**

Property 3: Preservation - サイト条件外の非表示

_For any_ 売主データでサイトが「す」または「L」以外の場合、通話モードページで「ID」フィールド自体が表示されない。

**Validates: Requirements 3.2**

Property 4: Preservation - 他フィールドの表示

_For any_ 売主データで、名前、電話番号、反響詳細日時などの他のフィールドは、この修正の影響を受けず、引き続き正しく表示される。

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の3箇所を確認・修正します：

**File 1**: `backend/src/services/SellerService.supabase.ts`

**Method**: `getSeller(id: string)`

**Specific Changes**:
1. **Supabase SELECT句の確認**: `select('*')`を使用しているか、または明示的に`inquiry_id`を含めているか確認
   - 現在: `select('*')`を使用している場合は問題なし
   - 修正: 明示的なカラム指定を使用している場合は、`inquiry_id`を追加

2. **decryptSeller()の確認**: `inquiry_id`が正しくマッピングされているか確認
   - 現在: `inquiryId: seller.inquiry_id`が含まれている（確認済み）
   - 修正: 不要（既に正しい）

**File 2**: `backend/src/routes/sellers.ts`

**Endpoint**: `GET /api/sellers/:id`

**Specific Changes**:
1. **レスポンスの確認**: `SellerService.getSeller()`の戻り値をそのまま返しているか確認
   - 現在: `res.json(seller)`でそのまま返している（確認済み）
   - 修正: 不要（既に正しい）

2. **ログ追加**: デバッグ用に`inquiry_id`の値をログ出力
   - 追加: `console.log('inquiry_id:', seller.inquiryId)`

**File 3**: `frontend/frontend/src/types/index.ts`

**Type**: `Seller`

**Specific Changes**:
1. **型定義の確認**: `inquiryId`プロパティが定義されているか確認
   - 現在: 定義されていない可能性
   - 修正: `inquiryId?: string;`を追加

**File 4**: `frontend/frontend/src/pages/CallModePage.tsx`

**Section**: 除外申請セクション

**Specific Changes**:
1. **デバッグログ追加**: `seller.inquiryId`の値を確認
   - 追加: `console.log('seller.inquiryId:', seller.inquiryId)`

2. **表示ロジックの確認**: `seller.inquiryId || '－'`が正しく動作しているか確認
   - 現在: 正しい（確認済み）
   - 修正: 不要

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正コードでバグを再現し、根本原因を特定します。次に、修正後のコードで正しく動作することを確認し、既存の動作が保持されていることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認または反証します。反証された場合は、再仮説を立てます。

**Test Plan**: AA13175の売主データを通話モードページで表示し、以下を確認します：
1. データベースに`inquiry_id = 'CO2511-94507'`が保存されているか
2. `SellerService.getSeller()`が`inquiry_id`を含めて返しているか
3. APIレスポンス（`GET /api/sellers/:id`）に`inquiryId`が含まれているか
4. フロントエンドで`seller.inquiryId`が受け取られているか

未修正コードで実行し、どの段階で`inquiry_id`が失われるかを特定します。

**Test Cases**:
1. **データベース確認テスト**: Supabaseダッシュボードで`SELECT inquiry_id FROM sellers WHERE seller_number = 'AA13175'`を実行（期待: `CO2511-94507`が返される）
2. **SellerService確認テスト**: `backend/test-aa13175-seller-service.ts`を作成し、`SellerService.getSeller()`の戻り値を確認（期待: `inquiryId`が含まれる）
3. **APIレスポンス確認テスト**: `curl http://localhost:3000/api/sellers/:id`を実行し、レスポンスに`inquiryId`が含まれるか確認（期待: 含まれない場合、ここが問題）
4. **フロントエンド確認テスト**: ブラウザのDevToolsで`seller`オブジェクトを確認（期待: `inquiryId`が`undefined`の場合、APIレスポンスまたは型定義が問題）

**Expected Counterexamples**:
- APIレスポンスに`inquiryId`が含まれていない → ルーティング層またはSellerServiceが問題
- APIレスポンスに`inquiryId`が含まれているが、フロントエンドで`undefined` → 型定義が問題

### Fix Checking

**Goal**: 修正後のコードで、`inquiry_id`がデータベースに存在する全ての売主データに対して、通話モードページで正しく表示されることを確認します。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := displayInquiryId(seller)
  ASSERT result == seller.inquiry_id
END FOR
```

**Test Cases**:
1. **AA13175表示テスト**: 通話モードページで「ID」フィールドに`CO2511-94507`が表示されることを確認
2. **他の売主表示テスト**: `inquiry_id`が存在する他の売主（サイトが「す」または「L」）で正しく表示されることを確認
3. **APIレスポンステスト**: `GET /api/sellers/:id`のレスポンスに`inquiryId`が含まれることを確認

### Preservation Checking

**Goal**: 修正後のコードで、`inquiry_id`が空の売主、サイトが「す」「L」以外の売主の表示が変更されていないことを確認します。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT displayInquiryId_original(seller) = displayInquiryId_fixed(seller)
END FOR
```

**Testing Approach**: Property-based testingは、多くのテストケースを自動生成し、入力ドメイン全体で動作が変更されていないことを保証するため、preservation checkingに推奨されます。

**Test Plan**: 未修正コードで以下の動作を観察し、修正後も同じ動作をすることを確認します。

**Test Cases**:
1. **inquiry_id空欄テスト**: `inquiry_id`が空（NULL または空文字列）の売主で「－」と表示されることを確認
2. **サイト条件外テスト**: サイトが「H」「ウ」などの売主で「ID」フィールドが表示されないことを確認
3. **他フィールド表示テスト**: 名前、電話番号、反響詳細日時などが引き続き正しく表示されることを確認

### Unit Tests

- データベースに`inquiry_id`が存在する売主のAPIレスポンステスト
- `inquiry_id`が空の売主のAPIレスポンステスト
- サイトが「す」「L」の売主の表示テスト
- サイトが「す」「L」以外の売主の非表示テスト

### Property-Based Tests

- ランダムな売主データを生成し、`inquiry_id`が存在する場合は正しく表示されることを確認
- ランダムな売主データを生成し、`inquiry_id`が空の場合は「－」と表示されることを確認
- ランダムなサイト値を生成し、「す」「L」以外の場合は「ID」フィールドが表示されないことを確認

### Integration Tests

- AA13175の通話モードページで「ID」フィールドに`CO2511-94507`が表示されることを確認
- 複数の売主データで通話モードページを表示し、`inquiry_id`の表示が正しいことを確認
- ブラウザのDevToolsでAPIレスポンスを確認し、`inquiryId`が含まれることを確認
