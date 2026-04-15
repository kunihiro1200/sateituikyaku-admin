# 物件買主リスト内覧日表示バグ修正 デザインドキュメント

## Overview

物件詳細ページ（`/property-listings/:propertyNumber`）の買主リストにおいて、内覧日が常に `-` として表示されるバグを修正する。

バックエンドAPI（`GET /api/property-listings/:propertyNumber/buyers`）は `latest_viewing_date` フィールドとして内覧日を返しているが、フロントエンドの `Buyer` インターフェース（`PropertyListingDetailPage.tsx`）は `viewing_date` フィールドを期待しているため、フィールド名の不一致により内覧日が常に `undefined` → `-` として表示される。

修正方針は最小限の変更とし、フロントエンドの `Buyer` インターフェースのフィールド名を `viewing_date` から `latest_viewing_date` に変更し、関連する参照箇所を更新する。

- 物件番号: AA278
- チケット番号: 7344

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 買主に `latest_viewing_date` が登録されているにもかかわらず、フロントエンドが `viewing_date` フィールドを参照するため内覧日が `undefined` になる状態
- **Property (P)**: 期待される正しい動作 — `latest_viewing_date` が正しくマッピングされ、内覧日が `YYYY/MM/DD` 形式で表示される
- **Preservation**: 修正によって変更してはならない既存の動作 — マウスクリック、他の列の表示、行クリックによる詳細ページ遷移など
- **Buyer インターフェース**: `PropertyListingDetailPage.tsx` 内で定義される買主データの型定義
- **latest_viewing_date**: バックエンドの `BuyerLinkageService.getBuyersForProperty()` が返す内覧日フィールド名
- **viewing_date**: 修正前のフロントエンド `Buyer` インターフェースで定義されていた（誤った）フィールド名
- **CompactBuyerListForProperty**: 買主リストを表示するコンポーネント（`BuyerWithDetails` インターフェースで `viewing_date` を参照）

## Bug Details

### Bug Condition

バックエンドが `latest_viewing_date` として返す内覧日フィールドを、フロントエンドが `viewing_date` として参照しているため、フィールド名の不一致により内覧日が常に `undefined` となる。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type Buyer (APIレスポンスから取得した買主データ)
  OUTPUT: boolean

  RETURN buyer.latest_viewing_date IS NOT NULL
         AND buyer.latest_viewing_date IS NOT UNDEFINED
         AND buyer.viewing_date IS UNDEFINED
END FUNCTION
```

### Examples

- **例1（バグあり）**: 買主に内覧日 `2025-03-15` が登録されている場合
  - APIレスポンス: `{ "latest_viewing_date": "2025-03-15", ... }`
  - フロントエンドの参照: `buyer.viewing_date` → `undefined`
  - 表示結果: `-`（期待値: `2025/03/15`）

- **例2（バグあり）**: 買主に内覧日 `2025-01-01` が登録されている場合
  - APIレスポンス: `{ "latest_viewing_date": "2025-01-01", ... }`
  - フロントエンドの参照: `buyer.viewing_date` → `undefined`
  - 表示結果: `-`（期待値: `2025/01/01`）

- **例3（バグなし）**: 買主に内覧日が登録されていない場合
  - APIレスポンス: `{ "latest_viewing_date": null, ... }`
  - 表示結果: `-`（期待値: `-`）← 偶然正しく表示される

- **エッジケース**: 内覧日が `null` の場合は修正前後ともに `-` が表示される（正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 買主に内覧日が登録されていない場合、内覧日列は引き続き `-` として表示される
- 氏名・受付日・時間・最新状況の各列は引き続き正しく表示される
- 買主リストの行をクリックすると、引き続き買主詳細ページが新しいタブで開く
- `CompactBuyerListForProperty` コンポーネントが他の画面で使用される場合も引き続き正常に動作する

**スコープ:**
内覧日フィールド名の変更以外の動作は一切変更しない。具体的には以下は影響を受けない:
- マウスクリックによるボタン操作
- 他のフィールド（氏名、受付日、時間、最新状況）の表示
- 買主リストのソート順（受付日の新しい順）
- 新規作成ボタンの動作

## Hypothesized Root Cause

バグの根本原因は以下の通り確定している（推測ではなく、コード確認済み）:

1. **フィールド名の不一致（確定）**: バックエンドの `BuyerLinkageService.getBuyersForProperty()` は `BuyerSummary` インターフェースで `latest_viewing_date` を定義し、APIレスポンスとして返している。一方、フロントエンドの `PropertyListingDetailPage.tsx` の `Buyer` インターフェースは `viewing_date?: string` を定義しており、`latest_viewing_date` フィールドを受け取れない。

2. **コンポーネントへの伝播**: `PropertyListingDetailPage.tsx` が `CompactBuyerListForProperty` に `buyers` を渡す際、`Buyer` 型の `viewing_date` は `undefined` のまま渡される。`CompactBuyerListForProperty` の `BuyerWithDetails` インターフェースも `viewing_date?: string` を定義しており、`formatDate(buyer.viewing_date)` が常に `-` を返す。

3. **影響範囲**: `CompactBuyerListForProperty` の `BuyerWithDetails` インターフェースも同様に `viewing_date` を参照しているため、こちらも合わせて修正が必要。

## Correctness Properties

Property 1: Bug Condition - 内覧日の正しい表示

_For any_ 買主データにおいて `latest_viewing_date` が非 null・非 undefined の値を持つ場合（isBugCondition が true を返す場合）、修正後のフロントエンドは `latest_viewing_date` の値を `YYYY/MM/DD` 形式に変換して内覧日列に表示しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非バグ入力の動作保持

_For any_ 買主データにおいて `latest_viewing_date` が null または undefined の場合（isBugCondition が false を返す場合）、修正後のフロントエンドは修正前と同じ動作（`-` を表示）を維持しなければならない。また、内覧日以外のすべてのフィールド（氏名・受付日・時間・最新状況）の表示も変更してはならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更箇所**: `Buyer` インターフェース

**具体的な変更:**
1. **フィールド名の変更**: `viewing_date?: string` を `latest_viewing_date?: string` に変更する
   - 変更前: `viewing_date?: string;`
   - 変更後: `latest_viewing_date?: string;`

---

**File 2**: `frontend/frontend/src/components/CompactBuyerListForProperty.tsx`

**変更箇所**: `BuyerWithDetails` インターフェースおよびテーブル表示部分

**具体的な変更:**
1. **インターフェースのフィールド名変更**: `viewing_date?: string` を `latest_viewing_date?: string` に変更する
   - 変更前: `viewing_date?: string;`
   - 変更後: `latest_viewing_date?: string;`

2. **テーブルセルの参照変更**: `buyer.viewing_date` を `buyer.latest_viewing_date` に変更する
   - 変更前: `<TableCell>{formatDate(buyer.viewing_date)}</TableCell>`
   - 変更後: `<TableCell>{formatDate(buyer.latest_viewing_date)}</TableCell>`

---

**バックエンドの変更**: 不要（`BuyerLinkageService.ts` は正しく `latest_viewing_date` を返している）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `PropertyListingDetailPage.tsx` の `Buyer` インターフェースが `viewing_date` を参照しているため、`latest_viewing_date` を持つAPIレスポンスを渡した場合に内覧日が `undefined` になることを確認する。

**Test Cases**:
1. **内覧日あり買主テスト**: `latest_viewing_date: "2025-03-15"` を持つ買主データを `CompactBuyerListForProperty` に渡し、内覧日列が `-` と表示されることを確認（修正前のコードで失敗するはず）
2. **複数買主テスト**: 内覧日あり・なしの買主が混在する場合、全員の内覧日が `-` になることを確認（修正前のコードで失敗するはず）
3. **フィールドマッピングテスト**: APIレスポンスの `latest_viewing_date` が `Buyer` インターフェースの `viewing_date` にマッピングされないことを確認

**Expected Counterexamples**:
- `latest_viewing_date: "2025-03-15"` を持つ買主の内覧日列が `2025/03/15` ではなく `-` と表示される
- 原因: `Buyer` インターフェースが `viewing_date` を参照しているが、APIは `latest_viewing_date` を返すため

### Fix Checking

**Goal**: 修正後のコードで、内覧日が登録されている買主の内覧日が正しく表示されることを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := renderBuyerRow_fixed(buyer)
  ASSERT result.viewingDateCell != '-'
  ASSERT result.viewingDateCell == formatDate(buyer.latest_viewing_date)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、内覧日が null の買主や他のフィールドの表示が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT renderBuyerRow_original(buyer) == renderBuyerRow_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由:
- 様々な買主データパターンを自動生成して検証できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Cases**:
1. **内覧日なし保持テスト**: `latest_viewing_date: null` の買主の内覧日列が引き続き `-` と表示されることを確認
2. **他フィールド保持テスト**: 氏名・受付日・時間・最新状況の各列が修正前後で同じ値を表示することを確認
3. **クリック動作保持テスト**: 行クリックで買主詳細ページが新しいタブで開くことを確認
4. **ソート順保持テスト**: 受付日の新しい順でソートされることを確認

### Unit Tests

- `CompactBuyerListForProperty` に `latest_viewing_date` を持つ買主データを渡した場合、内覧日列に正しい日付が表示されることをテスト
- `latest_viewing_date: null` の場合に `-` が表示されることをテスト
- `formatDate` 関数が `YYYY-MM-DD` 形式を `YYYY/MM/DD` 形式に変換することをテスト

### Property-Based Tests

- ランダムな日付文字列（`YYYY-MM-DD` 形式）を `latest_viewing_date` として渡した場合、常に `YYYY/MM/DD` 形式で表示されることを検証
- `latest_viewing_date` が null/undefined の場合、常に `-` が表示されることを検証
- 内覧日以外のフィールド（氏名・受付日・時間・最新状況）がランダムな値でも正しく表示されることを検証

### Integration Tests

- 物件詳細ページ（`/property-listings/AA278`）を開き、買主リストの内覧日列に正しい日付が表示されることを確認
- 内覧日あり・なしの買主が混在する場合の表示を確認
- 買主リストの行クリックで買主詳細ページが新しいタブで開くことを確認
