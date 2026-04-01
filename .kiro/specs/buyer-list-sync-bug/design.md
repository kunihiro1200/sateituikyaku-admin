# 買主リスト同期未実装バグ修正設計

## Overview

買主番号7272がスプレッドシートには存在するが、データベース（buyers テーブル）には存在しない問題を修正します。根本原因は、gas_buyer_complete_code.js の `syncBuyerList()` 関数に買主データの同期処理が未実装（TODOコメントのみ）であることです。売主リストと同じ実装パターンを適用し、完全な同期処理を実装します。

## Glossary

- **Bug_Condition (C)**: GASの10分トリガーが実行されても、買主データがデータベースに同期されない状態
- **Property (P)**: GASの10分トリガーが実行されたとき、スプレッドシートの買主データがデータベースに正しく同期される
- **Preservation**: 既存の買主サイドバーカウント更新処理（`updateBuyerSidebarCounts_`）は変更せず、そのまま動作し続ける
- **syncBuyerList()**: gas_buyer_complete_code.js のメイン同期関数（10分トリガーで実行）
- **syncSellerList()**: gas_complete_code.js の売主同期関数（参考実装）
- **Phase 1**: 追加同期（スプレッドシートにあってDBにない買主を追加）
- **Phase 2**: 更新同期（Supabase直接更新）
- **Phase 3**: 削除同期（DBにあってスプレッドシートにない買主を削除）

## Bug Details

### Bug Condition

バグは、GASの10分トリガーが実行されても、買主データがデータベースに同期されない状態で発生します。`syncBuyerList()` 関数にTODOコメントのみが存在し、実際の同期処理が未実装です。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type GASトリガー実行イベント
  OUTPUT: boolean
  
  RETURN input.triggerType == '10分トリガー'
         AND input.targetFunction == 'syncBuyerList'
         AND syncBuyerList関数内にTODOコメントのみ存在
         AND 買主データの同期処理が未実装
END FUNCTION
```

### Examples

- **買主番号7272**: スプレッドシートに存在するが、DBには存在しない（昨日追加）
- **買主番号7271**: スプレッドシートに存在し、DBにも存在する（手動操作で同期された可能性）
- **全ての買主データ**: GASトリガーが実行されても、DBに同期されない
- **サイドバーカウント**: 正常に更新される（`updateBuyerSidebarCounts_` は実装済み）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買主サイドバーカウント更新処理（`updateBuyerSidebarCounts_`）は引き続き正常に動作する
- GASの10分トリガー設定は変更されない
- 買主リストスプレッドシートの構造は変更されない

**Scope:**
買主データの同期処理以外の全ての機能は、完全に変更されずに動作し続ける必要があります。これには以下が含まれます：
- サイドバーカウント更新
- トリガー設定関数
- テスト・デバッグ用関数

## Hypothesized Root Cause

バグ説明に基づくと、最も可能性の高い原因は以下の通りです：

1. **同期処理の未実装**: `syncBuyerList()` 関数にTODOコメントのみが存在し、実際の同期ロジックが実装されていない
   - Phase 1（追加同期）が未実装
   - Phase 2（更新同期）が未実装
   - Phase 3（削除同期）が未実装

2. **バックエンドAPIエンドポイントの不足**: 買主追加同期用のエンドポイントパラメータ（`additionOnly=true&buyerAddition=true`）が存在しない
   - `/api/sync/trigger?additionOnly=true` は売主専用
   - 買主用のパラメータが未定義

3. **売主リストとの実装差異**: 売主リスト用GASは完全実装済みだが、買主リスト用GASは未実装
   - `gas_complete_code.js`（売主）: 完全実装
   - `gas_buyer_complete_code.js`（買主）: 未実装

4. **手動同期の依存**: 7271がDBに存在するのは、手動操作で同期された可能性が高い
   - 自動同期が動作していない証拠

## Correctness Properties

Property 1: Bug Condition - 買主データの自動同期

_For any_ GASの10分トリガー実行において、`syncBuyerList()` 関数が呼び出されたとき、スプレッドシートの買主データがデータベースに正しく同期され、スプレッドシートにあってDBにない買主が追加され、既存買主のデータが更新され、DBにあってスプレッドシートにない買主が削除される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - サイドバーカウント更新の継続

_For any_ GASの10分トリガー実行において、買主データの同期処理が実装された後も、`updateBuyerSidebarCounts_()` 関数は引き続き正常に動作し、buyer_sidebar_counts テーブルを正しく更新する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**File 1**: `gas_buyer_complete_code.js`

**Function**: `syncBuyerList()`

**Specific Changes**:
1. **Phase 1: 追加同期の実装**
   - バックエンドAPI `/api/sync/trigger?additionOnly=true&buyerAddition=true` を呼び出す
   - スプレッドシートにあってDBにない買主を検出して追加
   - 売主リストの `postToBackend('/api/sync/trigger?additionOnly=true', {})` と同じパターン

2. **Phase 2: 更新同期の実装（Supabase直接更新）**
   - `syncUpdatesToSupabase_()` 関数を実装（売主リストと同じパターン）
   - スプレッドシートの買主データを読み取る
   - DBの買主データと比較
   - 変更があった買主をSupabaseに直接PATCH
   - 反響日付の降順にソート

3. **Phase 3: 削除同期の実装**
   - バックエンドAPI `/api/sync/trigger?deletionOnly=true&buyerDeletion=true` を呼び出す
   - DBにあってスプレッドシートにない買主を検出して削除
   - 売主リストの `postToBackend('/api/sync/trigger?deletionOnly=true', {})` と同じパターン

4. **ユーティリティ関数の追加**
   - `patchBuyerToSupabase_(buyerNumber, updateData)`: Supabase直接更新
   - `fetchAllBuyersFromSupabase_()`: DB買主データ取得
   - `syncUpdatesToSupabase_(sheetRows)`: Phase 2のメイン処理

5. **エラーハンドリングの追加**
   - try-catch でエラーをキャッチ
   - Logger.log でエラーを記録
   - 次回の同期で再試行

**File 2**: `backend/src/routes/sync.ts`

**Endpoint**: `POST /api/sync/trigger`

**Specific Changes**:
1. **買主追加同期パラメータの追加**
   - `buyerAddition=true` パラメータを追加
   - `additionOnly=true&buyerAddition=true` の組み合わせで買主追加同期を実行

2. **買主削除同期パラメータの追加**
   - `buyerDeletion=true` パラメータを追加
   - `deletionOnly=true&buyerDeletion=true` の組み合わせで買主削除同期を実行

3. **条件分岐の追加**
   ```typescript
   const buyerAddition = req.query.buyerAddition === 'true';
   const buyerDeletion = req.query.buyerDeletion === 'true';
   
   if (buyerAddition && additionOnly) {
     // 買主追加同期のみ
     const missingBuyers = await syncService.detectMissingBuyers();
     // ...
   } else if (buyerDeletion && deletionOnly) {
     // 買主削除同期のみ
     const deletedBuyers = await syncService.detectDeletedBuyers();
     // ...
   }
   ```

**File 3**: `backend/src/services/EnhancedAutoSyncService.ts`

**Functions**: 買主同期関連の関数（既に実装済み）

**Verification**:
- `detectMissingBuyers()`: 実装済み（Line 2720）
- `syncMissingBuyers()`: 実装済み（Line 2943）
- `detectDeletedBuyers()`: 実装済み（Line 3226）
- `syncDeletedBuyers()`: 実装済み（Line 3426）
- `syncSingleBuyer()`: 実装済み（Line 3072）
- `updateSingleBuyer()`: 実装済み（Line 3131）

**Note**: バックエンドの買主同期処理は完全実装済みのため、変更不要

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従います：まず、未修正コードで反例を表面化させてバグを確認し、次に修正が正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを実証する反例を表面化させます。根本原因分析を確認または反証します。反証した場合は、再仮説が必要です。

**Test Plan**: GASの `syncBuyerList()` 関数を手動実行し、買主データがDBに同期されないことを確認します。未修正コードでこれらのテストを実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **買主番号7272の同期テスト**: スプレッドシートに存在するが、DBには存在しない（未修正コードで失敗）
2. **新規買主の追加テスト**: スプレッドシートに新規買主を追加し、GASトリガーを実行（未修正コードで失敗）
3. **既存買主の更新テスト**: スプレッドシートで既存買主のデータを変更し、GASトリガーを実行（未修正コードで失敗）
4. **削除買主の同期テスト**: スプレッドシートから買主を削除し、GASトリガーを実行（未修正コードで失敗）

**Expected Counterexamples**:
- 買主データがDBに同期されない
- 可能性のある原因: 同期処理が未実装、バックエンドAPIエンドポイントが不足、GASトリガーが正しく設定されていない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正された関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncBuyerList_fixed()
  ASSERT expectedBehavior(result)
END FOR
```

**Test Plan**: 
1. GASの `syncBuyerList()` 関数を修正
2. 手動実行して、買主データがDBに同期されることを確認
3. バックエンドAPIエンドポイントを追加
4. GASから正しく呼び出されることを確認

**Test Cases**:
1. **買主番号7272の同期**: スプレッドシートに存在し、DBにも追加される
2. **新規買主の追加**: スプレッドシートに新規買主を追加し、DBに追加される
3. **既存買主の更新**: スプレッドシートで既存買主のデータを変更し、DBが更新される
4. **削除買主の同期**: スプレッドシートから買主を削除し、DBからも削除される

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正された関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncBuyerList_original(input) = syncBuyerList_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成します
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチします
- 全ての非バグ入力に対して動作が変更されていないという強力な保証を提供します

**Test Plan**: まず、未修正コードでサイドバーカウント更新やその他の機能の動作を観察し、次にその動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **サイドバーカウント更新の保存**: 未修正コードでサイドバーカウント更新が正しく動作することを観察し、修正後も継続することを検証するテストを作成
2. **トリガー設定の保存**: 未修正コードでトリガー設定が正しく動作することを観察し、修正後も継続することを検証するテストを作成
3. **テスト関数の保存**: 未修正コードでテスト関数が正しく動作することを観察し、修正後も継続することを検証するテストを作成

### Unit Tests

- GASの `syncBuyerList()` 関数の各フェーズ（Phase 1-3）をテスト
- バックエンドAPIエンドポイントのパラメータをテスト
- エッジケース（買主番号が不正、スプレッドシートが空、DBが空）をテスト

### Property-Based Tests

- ランダムな買主データを生成し、同期が正しく動作することを検証
- ランダムなスプレッドシート状態を生成し、サイドバーカウント更新の保存を検証
- 多くのシナリオで全ての非買主同期入力が継続して動作することをテスト

### Integration Tests

- GASトリガーから完全な同期フローをテスト
- スプレッドシート → GAS → バックエンドAPI → DB の全体フローをテスト
- 複数の買主データの同期をテスト
