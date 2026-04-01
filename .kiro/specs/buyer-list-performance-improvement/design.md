# 買主リスト表示パフォーマンス改善 デザインドキュメント

## Overview

買主リストページの表示パフォーマンスが売主リストページと比較して著しく遅い問題を修正します。現在、買主リストの初回ロードに10秒以上かかっていますが、これを売主リストと同程度の4秒程度に改善します。

**根本原因**: サイドバーカウント取得時に全買主データ + property_listings全件を並列取得しているため、初回ロード時に10秒以上かかっている。

**解決策**: 売主リストと同じアプローチを採用し、`buyer_sidebar_counts` テーブルを新規作成してGASで10分ごとに更新します。APIは事前計算されたテーブルから高速に取得します。

## Glossary

- **Bug_Condition (C)**: サイドバーカウント取得時に全件取得を実行する条件 - 買主リストページを開いたとき
- **Property (P)**: サイドバーカウントを1秒以内に表示する - 事前計算されたテーブルから取得
- **Preservation**: 既存のテーブルデータ取得、ページネーション、フィルタリング機能は変更しない
- **`getStatusCategoriesWithBuyers`**: `BuyerService.ts`の全件取得メソッド（遅い）
- **`buyer_sidebar_counts`**: サイドバーカウントを事前計算して保存するテーブル（新規作成）
- **`updateBuyerSidebarCounts_`**: GASで10分ごとにサイドバーカウントを計算・更新する関数（新規作成）

## Bug Details

### Bug Condition

バグは買主リストページを開いたときに発生します。`/api/buyers/status-categories-with-buyers` エンドポイントが全買主データ + property_listings全件を並列取得するため、初回ロード時に10秒以上かかります。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageLoadEvent
  OUTPUT: boolean
  
  RETURN input.page == '/buyers'
         AND input.action == 'load'
         AND sidebarCountsNotCached()
END FUNCTION
```

### Examples

- **例1**: 買主リストページを開く → サイドバーが10秒以上「くるくる」（ローディング状態）で表示される
- **例2**: 売主リストページを開く → サイドバーが1秒以内に表示される（期待される動作）
- **例3**: 買主リストページでテーブルデータを取得 → 2秒程度で表示される（比較的早い）
- **Edge Case**: 買主データが0件の場合 → サイドバーカウントは全て0で即座に表示される（期待される動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- テーブルデータの取得（`/api/buyers`）は変更しない
- ページネーション、検索、フィルタリングは従来通り動作する
- サイドバーカテゴリの定義は変更しない

**Scope:**
サイドバーカウント取得以外の全ての機能は完全に変更されません。これには以下が含まれます:
- テーブルデータの取得とページネーション
- 検索機能（買主番号、名前、電話番号、物件番号）
- フィルタリング機能（ステータス、担当者、日付範囲）
- ソート機能

## Hypothesized Root Cause

バグ説明に基づいて、最も可能性の高い原因は以下の通りです:

1. **全件取得の実行**: `getStatusCategoriesWithBuyers` メソッドが全買主データ + property_listings全件を並列取得している
   - `fetchAllBuyersWithStatus()` が全買主データを取得
   - 各買主の `property_number` から property_listings を取得
   - 買主数が多い場合、取得時間が長くなる

2. **ステータス計算の重さ**: 全買主のステータスを計算するため、CPU時間がかかる
   - `calculateBuyerStatus` 関数を全買主に対して実行
   - 複雑な条件分岐が多い

3. **キャッシュの不足**: ステータス計算結果がキャッシュされていない
   - 毎回全件取得 + 全件計算を実行
   - キャッシュTTLが短い（30分）

4. **並列取得の限界**: property_listings の取得が並列化されていない
   - 各買主の property_number を順次取得
   - ネットワークレイテンシが累積

## Correctness Properties

Property 1: Bug Condition - サイドバーカウント高速取得

_For any_ 買主リストページのロード時、固定されたサイドバーカウント取得エンドポイント（`/api/buyers/sidebar-counts`）は、事前計算された `buyer_sidebar_counts` テーブルから1秒以内にカウントを返す SHALL。

**Validates: Requirements 2.1**

Property 2: Preservation - テーブルデータ取得の保持

_For any_ 買主リストページでのテーブルデータ取得、ページネーション、検索、フィルタリング操作、固定されたコードは従来通りの動作を保持し、`/api/buyers` エンドポイントを使用して同じデータを返す SHALL。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定して、以下の変更が必要です:

**Phase 1: データベーススキーマ**

**File**: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_buyer_sidebar_counts.sql`

**Specific Changes**:
1. **`buyer_sidebar_counts` テーブルの作成**:
   - `category` (TEXT): カテゴリ名（例: 'todayCall', 'visitDayBefore'）
   - `count` (INTEGER): カウント数
   - `label` (TEXT, nullable): ラベル（例: 当日TEL（内容）の場合）
   - `assignee` (TEXT, nullable): 担当者イニシャル（例: 当日TEL(Y)の場合）
   - `updated_at` (TIMESTAMP): 更新日時
   - 主キー: `(category, COALESCE(label, ''), COALESCE(assignee, ''))`

2. **インデックスの作成**:
   - `category` カラムにインデックス（高速検索用）

**Phase 2: GAS実装**

**File**: `gas_complete_code.js`

**Specific Changes**:
1. **`updateBuyerSidebarCounts_()` 関数の追加**:
   - スプレッドシートから全買主データを取得
   - 各カテゴリのカウントを計算（売主リストと同じロジック）
   - `buyer_sidebar_counts` テーブルに保存（DELETE + INSERT）

2. **`syncBuyerList()` 関数の修正**:
   - 同期完了後に `updateBuyerSidebarCounts_()` を呼び出す

3. **カテゴリ計算ロジック**:
   - 当日TEL分（担当なし）
   - 当日TEL（担当別）
   - 担当（担当別）
   - その他のカテゴリ（STATUS_DEFINITIONS に基づく）

**Phase 3: バックエンドAPI**

**File**: `backend/src/services/BuyerService.ts`

**Specific Changes**:
1. **`getSidebarCounts()` メソッドの追加**:
   - `buyer_sidebar_counts` テーブルから全行取得
   - カテゴリ別に集計して返す
   - エラー時は `getSidebarCountsFallback()` にフォールバック

2. **`getSidebarCountsFallback()` メソッドの追加**:
   - 従来の `getStatusCategoriesWithBuyers()` と同じロジック
   - `buyer_sidebar_counts` テーブルが空またはエラー時に使用

**File**: `backend/src/routes/buyers.ts`

**Specific Changes**:
1. **`/api/buyers/sidebar-counts` エンドポイントの追加**:
   - `BuyerService.getSidebarCounts()` を呼び出す
   - レスポンス形式: `{ categories: [...], normalStaffInitials: [...] }`

**Phase 4: フロントエンド**

**File**: `frontend/frontend/src/pages/BuyersPage.tsx`

**Specific Changes**:
1. **サイドバーカウント取得の変更**:
   - `/api/buyers/status-categories-with-buyers` → `/api/buyers/sidebar-counts` に変更
   - テーブルデータ取得と並列実行（`Promise.all`）

2. **`/api/buyers/status-categories-with-buyers` の削除**:
   - 使用箇所を全て削除
   - エンドポイント自体は削除しない（後方互換性のため）

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います: まず、バグ条件を満たす入力で修正前のコードをテストし、次に修正後のコードが正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを実証します。根本原因分析を確認または反証します。反証された場合は、再仮説を立てる必要があります。

**Test Plan**: 買主リストページを開いて、サイドバーカウント取得時間を測定するテストを作成します。未修正コードでこれらのテストを実行して、失敗を観察し、根本原因を理解します。

**Test Cases**:
1. **初回ロードテスト**: 買主リストページを開く → サイドバーカウント取得に10秒以上かかる（未修正コードで失敗）
2. **全件取得テスト**: `/api/buyers/status-categories-with-buyers` を呼び出す → 全買主データ + property_listings全件を取得（未修正コードで確認）
3. **ステータス計算テスト**: 全買主のステータスを計算 → CPU時間がかかる（未修正コードで確認）
4. **Edge Case**: 買主データが0件の場合 → サイドバーカウントは全て0で即座に表示される（未修正コードでも成功）

**Expected Counterexamples**:
- サイドバーカウント取得に10秒以上かかる
- 可能な原因: 全件取得、ステータス計算の重さ、キャッシュの不足

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := loadBuyersPageWithSidebarCounts_fixed(input)
  ASSERT sidebarCountsLoadedWithin1Second(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT loadBuyersPageWithTableData_original(input) = loadBuyersPageWithTableData_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは、保存チェックに推奨されます。理由:
- 入力ドメイン全体で多くのテストケースを自動的に生成
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチ
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証

**Test Plan**: 未修正コードでテーブルデータ取得、ページネーション、検索、フィルタリングの動作を観察し、その動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **テーブルデータ取得の保持**: 未修正コードでテーブルデータ取得が正常に動作することを観察し、修正後も同じ動作を検証するテストを作成
2. **ページネーションの保持**: 未修正コードでページネーションが正常に動作することを観察し、修正後も同じ動作を検証するテストを作成
3. **検索の保持**: 未修正コードで検索が正常に動作することを観察し、修正後も同じ動作を検証するテストを作成
4. **フィルタリングの保持**: 未修正コードでフィルタリングが正常に動作することを観察し、修正後も同じ動作を検証するテストを作成

### Unit Tests

- 買主リストページの初回ロード時間を測定
- サイドバーカウント取得時間を測定（1秒以内）
- テーブルデータ取得時間を測定（2秒以内）
- Edge Case: 買主データが0件の場合のサイドバーカウント表示

### Property-Based Tests

- ランダムな買主データを生成して、サイドバーカウントが正しく計算されることを検証
- ランダムなページネーション、検索、フィルタリングパラメータを生成して、テーブルデータ取得が正常に動作することを検証
- 多くのシナリオで全ての非サイドバーカウント入力が引き続き動作することをテスト

### Integration Tests

- 買主リストページの完全なフローをテスト（初回ロード → サイドバーカウント表示 → テーブルデータ表示）
- GASの `updateBuyerSidebarCounts_()` 関数を手動実行して、`buyer_sidebar_counts` テーブルが正しく更新されることを検証
- バックエンドの `/api/buyers/sidebar-counts` エンドポイントをテストして、正しいレスポンスが返されることを検証
