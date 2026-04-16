# 買主件数表示バグ 修正設計

## Overview

物件一覧画面（PropertyListingsPage）の「買主」列に表示される買主件数が、物件詳細画面の「買主リスト」の件数と一致しないバグの修正設計。

**バグの概要**: 物件番号 AA9729 の場合、一覧では「👥 2」と表示されるが、詳細画面では「買主リスト (8件)」として8名が表示される。

**修正方針**: バックエンドの `getBuyerCountsForProperties` のクエリロジックを、`getBuyersForProperty` と同じ `.eq('property_number', propertyNumber)` による完全一致 + `deleted_at IS NULL` フィルタに統一する。また、キャッシュの TTL 管理を見直し、古い値が返されないようにする。

---

## Glossary

- **Bug_Condition (C)**: `getBuyerCountsForProperties` が返す件数と `getBuyersForProperty` が返す件数が異なる状態
- **Property (P)**: 一覧用カウントと詳細用カウントが一致すること
- **Preservation**: 詳細画面の買主リスト取得・0件表示・削除済み除外・ページネーションなど既存の正常動作が変わらないこと
- **BuyerLinkageService**: `backend/src/services/BuyerLinkageService.ts` に定義された買主データ取得サービス
- **getBuyerCountsForProperties**: 複数物件の買主カウントを一括取得するメソッド（バグのある側）
- **getBuyersForProperty**: 特定物件の買主リストを取得するメソッド（正しい側）
- **BuyerLinkageCache**: `backend/src/services/BuyerLinkageCache.ts` に定義された Redis ベースのキャッシュサービス（TTL: 3600秒）
- **buyer-counts/batch エンドポイント**: `GET /api/property-listings/buyer-counts/batch` — 一覧画面が呼び出すバックエンド API
- **property_number**: `buyers` テーブルのカラム。単一の物件番号を格納する（例: `AA9729`）

---

## Bug Details

### Bug Condition

バグは、物件一覧画面が `GET /api/property-listings/buyer-counts/batch` を呼び出したとき、または `BuyerLinkageCache` にキャッシュされた古い値が存在するときに発生する。

バックエンドの `getBuyerCountsForProperties` は全 `buyers` レコードを取得してフロントエンド側でカンマ区切り分割・集計するが、`property_number` フィールドが単一値（例: `AA9729`）であるにもかかわらず、全件取得後の集計ロジックが正しく機能していない可能性がある。一方、`getBuyersForProperty` は `.eq('property_number', propertyNumber)` で直接フィルタリングするため正確な件数を返す。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyBuyerCountRequest
         X.propertyNumber: string (例: "AA9729")
  OUTPUT: boolean

  countFromList   ← getBuyerCountsForProperties([X.propertyNumber])[X.propertyNumber]
  countFromDetail ← getBuyersForProperty(X.propertyNumber).length

  RETURN countFromList ≠ countFromDetail
END FUNCTION
```

### Examples

- **AA9729（再現例）**: 一覧では「👥 2」と表示されるが、詳細画面では「買主リスト (8件)」→ `isBugCondition` = true
- **0件の物件**: 一覧・詳細ともに 0 件 → `isBugCondition` = false（正常）
- **キャッシュ古い値**: 買主が追加された後もキャッシュが 1 時間有効なため、古い件数が返される → `isBugCondition` = true
- **削除済み買主のみの物件**: `deleted_at IS NULL` フィルタが `getBuyerCountsForProperties` に存在するため、削除済みは除外される（ただし全件取得後の集計ロジックに依存）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 物件詳細画面の `getBuyersForProperty` による買主リスト取得は変更しない
- 買主件数が 0 件の物件は引き続き 0 件として正しく表示する
- `deleted_at IS NOT NULL` の削除済み買主は件数に含めない
- 物件一覧のページネーションで別ページに移動しても、表示中の物件の買主件数を正しく取得・表示する

**Scope:**
`getBuyerCountsForProperties` のクエリロジック変更のみを対象とする。以下は変更しない：
- `getBuyersForProperty` の実装
- `BuyerLinkageCache` のキャッシュ構造（TTL の見直しは別途検討）
- フロントエンドの表示ロジック
- その他の `BuyerLinkageService` メソッド

---

## Hypothesized Root Cause

コード調査の結果、根本原因は以下の2点と特定された：

### 根本原因 1: getBuyerCountsForProperties の非効率なクエリロジック

**ファイル**: `backend/src/services/BuyerLinkageService.ts`

**問題のコード**:
```typescript
// 全レコードを取得してフロントエンド側で集計
const { data, error } = await this.supabase
  .from('buyers')
  .select('property_number')
  .is('deleted_at', null)
  .not('property_number', 'is', null);

// 各買主のproperty_numberを解析してカウント
for (const row of data || []) {
  const parts = row.property_number.split(',').map((p: string) => p.trim());
  for (const part of parts) {
    if (propertyNumberSet.has(part)) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
  }
}
```

**問題点**: 全 `buyers` レコードを取得してアプリケーション側で集計している。`property_number` フィールドが単一値（`AA9729`）であれば正しく動作するはずだが、実際のデータで件数が一致しないことから、何らかの不整合が生じている。`getBuyersForProperty` が `.eq('property_number', propertyNumber)` で直接フィルタリングするのに対し、全件取得後の集計は非効率かつ誤差が生じやすい。

### 根本原因 2: BuyerLinkageCache の古い値

**ファイル**: `backend/src/services/BuyerLinkageCache.ts`

**問題のコード**:
```typescript
const CACHE_TTL = 3600; // 1 hour
```

**問題点**: キャッシュの TTL が 1 時間に設定されており、買主が追加・削除された後も最大 1 時間古い件数が返される。`/buyer-counts/batch` エンドポイントはキャッシュヒット時にそのまま返すため、古い値が表示される。

### 根本原因 3: フロントエンド側 BuyerLinkageService との不整合

**ファイル**: `frontend/frontend/src/backend/services/BuyerLinkageService.ts`

**問題点**: フロントエンド側の `getBuyerCountsForProperties` は `.ilike('property_number', '%propNum%')` で部分一致を使用しており、`deleted_at` フィルタも存在しない。ただし、実際の呼び出しフローは `backend/src/routes/propertyListings.ts` 経由のバックエンド API であるため、フロントエンド側の実装は直接の原因ではない可能性が高い。

---

## Correctness Properties

Property 1: Bug Condition - 買主件数の一覧・詳細一致

_For any_ 物件番号 `X.propertyNumber` において、バグ条件が成立する（`isBugCondition(X)` が true を返す）場合、修正後の `getBuyerCountsForProperties'([X.propertyNumber])[X.propertyNumber]` は `getBuyersForProperty(X.propertyNumber).length` と等しい値を返す SHALL。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 非バグ条件入力の動作保持

_For any_ 物件番号 `X.propertyNumber` において、バグ条件が成立しない（`isBugCondition(X)` が false を返す）場合、修正後の `getBuyerCountsForProperties'` は修正前の `getBuyerCountsForProperties` と同じ結果を返す SHALL。具体的には、0件の物件・削除済み買主の除外・ページネーション対象物件の件数が変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を行う：

**File**: `backend/src/services/BuyerLinkageService.ts`

**Function**: `getBuyerCountsForProperties`

**Specific Changes**:

1. **クエリロジックの変更**: 全件取得 + アプリケーション側集計から、各物件番号に対して `.eq('property_number', propNum)` + `.is('deleted_at', null)` + `count: 'exact'` を使用した直接カウントに変更する。

   **変更前**:
   ```typescript
   // 全レコードを取得してフロントエンドで集計
   const { data, error } = await this.supabase
     .from('buyers')
     .select('property_number')
     .is('deleted_at', null)
     .not('property_number', 'is', null);
   
   for (const row of data || []) {
     const parts = row.property_number.split(',').map((p: string) => p.trim());
     for (const part of parts) {
       if (propertyNumberSet.has(part)) {
         counts.set(part, (counts.get(part) || 0) + 1);
       }
     }
   }
   ```

   **変更後**:
   ```typescript
   // 各物件番号に対して getBuyersForProperty と同じロジックで直接カウント
   await Promise.all(
     propertyNumbers.map(async (propNum) => {
       const { count, error } = await this.supabase
         .from('buyers')
         .select('*', { count: 'exact', head: true })
         .eq('property_number', propNum)
         .is('deleted_at', null);
   
       if (error) {
         console.error(`Failed to count buyers for property ${propNum}:`, error);
         counts.set(propNum, 0);
       } else {
         counts.set(propNum, count || 0);
       }
     })
   );
   ```

2. **削除済み買主の除外を保証**: `.is('deleted_at', null)` フィルタを明示的に維持する（要件 3.3）。

3. **キャッシュ無効化の検討**: `BuyerLinkageCache` の TTL を短縮するか、買主追加・削除時にキャッシュを無効化する処理を追加することを検討する。ただし、本修正の主目的はクエリロジックの修正であり、キャッシュ TTL の変更は別タスクとして扱う。

**File**: `backend/src/routes/propertyListings.ts`

**Function**: `/buyer-counts/batch` エンドポイント

**Specific Changes**:
4. **変更なし**: ルートの実装は変更しない。`BuyerLinkageService.getBuyerCountsForProperties` の修正により、正確な件数が返されるようになる。

**File**: `frontend/frontend/src/backend/services/BuyerLinkageService.ts`

**Function**: `getBuyerCountsForProperties`

**Specific Changes**:
5. **フロントエンド側の修正（任意）**: フロントエンド側の `BuyerLinkageService` も `.eq('property_number', propNum)` + `.is('deleted_at', null)` に統一することを検討する。ただし、実際の呼び出しフローがバックエンド API 経由であれば、この変更は不要な可能性がある。

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず未修正コードでバグを再現するテストを実行し、次に修正後のコードで正確な件数が返されることと既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。反証された場合は根本原因を再仮説する。

**Test Plan**: `getBuyerCountsForProperties` と `getBuyersForProperty` を同じ物件番号で呼び出し、件数が異なることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **AA9729 再現テスト**: `getBuyerCountsForProperties(['AA9729'])` が 2 を返し、`getBuyersForProperty('AA9729').length` が 8 を返すことを確認（未修正コードで失敗するはず）
2. **複数物件一括テスト**: 複数の物件番号を渡したとき、各物件の件数が `getBuyersForProperty` の結果と一致しないことを確認（未修正コードで失敗するはず）
3. **キャッシュ古い値テスト**: キャッシュに古い値を設定した後、`/buyer-counts/batch` エンドポイントが古い値を返すことを確認（未修正コードで失敗するはず）
4. **削除済み買主テスト**: `deleted_at IS NOT NULL` の買主が存在する物件で、件数に含まれないことを確認（未修正コードで正常に動作する可能性あり）

**Expected Counterexamples**:
- `getBuyerCountsForProperties(['AA9729'])` が `getBuyersForProperty('AA9729').length` より少ない値を返す
- 考えられる原因: 全件取得後の集計ロジックの不具合、キャッシュの古い値

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  countFromList'  ← getBuyerCountsForProperties'([X.propertyNumber])[X.propertyNumber]
  countFromDetail ← getBuyersForProperty(X.propertyNumber).length
  ASSERT countFromList' = countFromDetail
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getBuyerCountsForProperties(X) = getBuyerCountsForProperties'(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多数のテストケースを自動生成できる
- 手動テストでは見落としやすいエッジケースを検出できる
- 非バグ入力全体にわたって動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードでマウスクリック（詳細画面）や 0 件物件の動作を観察し、その動作を保持するプロパティベーステストを作成する。

**Test Cases**:
1. **0件物件の保持**: 買主が存在しない物件で、修正前後ともに 0 件を返すことを確認
2. **削除済み買主の除外保持**: `deleted_at IS NOT NULL` の買主が存在する物件で、修正前後ともに削除済みを除外した件数を返すことを確認
3. **詳細画面の保持**: `getBuyersForProperty` の動作が修正前後で変わらないことを確認
4. **ページネーション保持**: 複数ページにわたる物件リストで、各ページの買主件数が正しく取得されることを確認

### Unit Tests

- `getBuyerCountsForProperties` が `.eq('property_number', propNum)` + `.is('deleted_at', null)` を使用することを確認
- 複数物件番号を渡したとき、各物件の件数が正しく返されることを確認
- 空配列を渡したとき、空の Map が返されることを確認
- Supabase エラー時に 0 件が返されることを確認

### Property-Based Tests

- ランダムな物件番号リストを生成し、`getBuyerCountsForProperties` の結果が各物件の `getBuyersForProperty` の結果と一致することを検証
- ランダムな買主データ（削除済み含む）を生成し、削除済みが常に除外されることを検証
- 多数の物件番号を渡したとき、全物件の件数が正しく返されることを検証

### Integration Tests

- `GET /api/property-listings/buyer-counts/batch?propertyNumbers=AA9729` が正確な件数を返すことを確認
- キャッシュなし・キャッシュあり両方のシナリオで正確な件数が返されることを確認
- 物件詳細画面の `GET /api/property-listings/AA9729/buyers` と件数が一致することを確認
