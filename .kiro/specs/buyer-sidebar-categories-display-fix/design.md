# 買主リストサイドバーカテゴリー表示バグ修正 Design

## Overview

買主リストページ（`/buyers`）のサイドバーに「All: 4683」のみが表示され、他のカテゴリー（内覧日前日、当日TEL、担当(イニシャル)など）が全て表示されない問題を修正します。

根本原因は、GASの `updateBuyerSidebarCounts_()` 関数は実装されているものの、`buyer_sidebar_counts` テーブルにデータが正しく保存されていない、またはGASの時間トリガーが設定されていない可能性が高いことです。

修正方針は、以下の3つのステップで問題を解決します：
1. GASの実装状況を確認（`updateBuyerSidebarCounts_()` 関数の動作確認）
2. GASの時間トリガーを設定（10分ごとの自動実行）
3. `buyer_sidebar_counts` テーブルのデータを確認・修正

## Glossary

- **Bug_Condition (C)**: 買主リストページでサイドバーカテゴリーを取得しようとした場合
- **Property (P)**: サイドバーに全てのカテゴリー（内覧日前日、当日TEL、担当等）が正しく表示される状態
- **Preservation**: 売主リストのサイドバー表示と買主データの同期が変わらないこと
- **`updateBuyerSidebarCounts_()`**: GASの関数で、`buyer_sidebar_counts` テーブルにカテゴリカウントを保存する
- **`buyer_sidebar_counts`**: Supabaseのテーブルで、サイドバーカテゴリのカウントをキャッシュする
- **`viewingDayBefore`**: 内覧日前日カテゴリのデータベース識別子
- **`todayCall`**: 当日TELカテゴリのデータベース識別子
- **`assigned`**: 担当（担当別）カテゴリのデータベース識別子
- **`todayCallAssigned`**: 当日TEL（担当別）カテゴリのデータベース識別子

## Bug Details

### Bug Condition

バグは、買主リストページでサイドバーカテゴリーを取得しようとした場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerSidebarRequest
  OUTPUT: boolean
  
  // 買主リストページでサイドバーカテゴリーを取得しようとした場合
  RETURN input.endpoint = "/api/buyers/status-categories-with-buyers"
         OR input.endpoint = "/api/buyers/sidebar-counts"
END FUNCTION
```

### Examples

- **例1**: 買主リストページを開く → APIエンドポイント `/api/buyers/status-categories-with-buyers` を呼び出す → レスポンスの `statusCategoriesWithBuyers` が空の配列 `[]` → サイドバーに「All: 4683」のみが表示される
- **例2**: `buyer_sidebar_counts` テーブルを確認 → データが存在しない、または古いデータのまま → サイドバーに最新のカテゴリーが表示されない
- **例3**: GASの `updateBuyerSidebarCounts_()` 関数を手動実行 → 実行ログにエラーが出る、またはデータが保存されない → サイドバーに表示されない
- **エッジケース**: GASの時間トリガーが設定されていない → 10分ごとの自動実行がされない → `buyer_sidebar_counts` テーブルが更新されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主リストページのサイドバーに全てのカテゴリーが正常に表示される
- 買主リストページで「All」カテゴリーを選択すると全ての買主（4683件）が表示される
- 買主データをスプレッドシートで編集するとデータベースに正常に同期される
- 買主データをブラウザUIで編集するとスプレッドシートに正常に同期される

**Scope:**
買主リストページのサイドバー表示以外の機能は完全に影響を受けません。この修正は以下のみに影響します：
- `buyer_sidebar_counts` テーブルのデータ
- GASの `updateBuyerSidebarCounts_()` 関数の実行
- サイドバーUIのカテゴリー表示

## Hypothesized Root Cause

根本原因の仮説を以下の優先順位で調査します：

### 仮説1: GASの時間トリガーが設定されていない（最も可能性が高い）

**症状**:
- `buyer_sidebar_counts` テーブルにデータが存在しない、または古いデータのまま
- GASの実行ログに `updateBuyerSidebarCounts_()` の実行記録がない

**原因**:
- `setupBuyerSyncTrigger()` 関数が実行されていない
- `syncBuyerList` 関数が10分ごとに実行されていない
- 結果: `updateBuyerSidebarCounts_()` が呼ばれず、`buyer_sidebar_counts` テーブルが空のまま

**確認方法**:
1. GASのトリガー管理画面を開く
2. `syncBuyerList` の10分トリガーが存在するか確認
3. 存在しない場合は `setupBuyerSyncTrigger()` を実行

### 仮説2: GASの実行でエラーが発生している

**症状**:
- GASの実行ログにエラーメッセージが表示される
- `buyer_sidebar_counts` テーブルにデータが保存されない

**原因**:
- `updateBuyerSidebarCounts_()` 関数内でエラーが発生
- Supabaseへの接続エラー
- スプレッドシートの読み取りエラー

**確認方法**:
1. GASエディタで `testBuyerSync()` 関数を手動実行
2. 実行ログを確認してエラーメッセージを特定
3. エラーの原因を修正

### 仮説3: `buyer_sidebar_counts` テーブルのスキーマ問題

**症状**:
- GASの実行ログに「INSERT成功」と表示されるが、データが保存されていない
- テーブルの主キー制約違反エラーが発生

**原因**:
- `buyer_sidebar_counts` テーブルの主キーが `(category, label, assignee)` で NOT NULL 制約がある
- GASが `label` または `assignee` に `null` を挿入しようとしている

**確認方法**:
1. GASの実行ログで「INSERT失敗」メッセージを確認
2. `buyer_sidebar_counts` テーブルのスキーマを確認
3. GASのコードで `label` と `assignee` が空文字列 `''` に変換されているか確認

## Correctness Properties

Property 1: Bug Condition - サイドバーカテゴリーの表示

_For any_ APIリクエストで `/api/buyers/status-categories-with-buyers` または `/api/buyers/sidebar-counts` を呼び出した場合、レスポンスの `statusCategoriesWithBuyers` または `categories` に各カテゴリーのデータが含まれる SHALL。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 売主リストと買主データの同期

_For any_ 売主リストページまたは買主データの同期処理で、修正後のシステムは修正前と同じ動作をする SHALL、売主リストのサイドバー表示と買主データの同期を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

修正は以下の3つのステップで実施します：

#### ステップ1: GASの実装状況を確認

**確認事項**:
1. ✅ **確認済み**: `updateBuyerSidebarCounts_()` 関数は実装されている
2. ✅ **確認済み**: `viewingDayBefore` カテゴリの計算ロジックは正しい
3. ✅ **確認済み**: Supabaseへの保存処理は実装されている

**結論**: GASの実装は正しい。問題は時間トリガーの設定またはデータベースの状態にある。

#### ステップ2: GASの時間トリガーを設定

**File**: Google Apps Script エディタ（`gas_buyer_complete_code.js`）

**Function**: `setupBuyerSyncTrigger()`

**Specific Changes**:
1. **トリガー設定関数を実行**:
   - GASエディタで `setupBuyerSyncTrigger()` 関数を選択
   - 「実行」ボタンをクリック
   - 実行ログで「✅ 買主同期トリガー設定完了」が表示されることを確認

2. **トリガー管理画面で確認**:
   - GASエディタの「トリガー」タブを開く
   - `syncBuyerList` の10分トリガーが存在することを確認
   - トリガーの詳細:
     - 実行する関数: `syncBuyerList`
     - イベントのソース: 時間主導型
     - 時間ベースのトリガーのタイプ: 分ベースのタイマー
     - 時間の間隔: 10分ごと

3. **手動実行でテスト**:
   - GASエディタで `testBuyerSync()` 関数を選択
   - 「実行」ボタンをクリック
   - 実行ログで以下を確認:
     - `📊 買主サイドバーカウント更新開始...`
     - `✅ buyer_sidebar_counts INSERT成功: X件`
     - `📊 買主サイドバーカウント更新完了: 合計 X行`

#### ステップ3: `buyer_sidebar_counts` テーブルのデータを確認

**File**: Supabase SQL Editor

**Specific Changes**:
1. **テーブルのデータを確認**:
   ```sql
   SELECT * FROM buyer_sidebar_counts ORDER BY category, assignee;
   ```
   - 期待される結果: 各カテゴリーのデータが存在する
   - `viewingDayBefore`, `todayCall`, `assigned`, `todayCallAssigned` など

2. **データが存在しない場合**:
   - GASの `testBuyerSync()` 関数を手動実行
   - 実行ログでエラーメッセージを確認
   - エラーがある場合は修正

3. **データが古い場合**:
   - GASの時間トリガーが正しく設定されているか確認
   - 次回の自動実行を待つ（最大10分）

#### ステップ4: バックエンドAPIの確認（必要に応じて）

**File**: `backend/src/services/BuyerService.ts`

**Function**: `getSidebarCounts()`

**確認事項**:
- `buyer_sidebar_counts` テーブルからデータを取得している
- データが空の場合は `getSidebarCountsFallback()` にフォールバックしている
- カテゴリーのマッピングが正しい（`viewingDayBefore`, `todayCall`, `assigned`, `todayCallAssigned`）

**Specific Changes**（必要な場合のみ）:
- カテゴリーのマッピングが間違っている場合は修正
- 例: `visitDayBefore` → `viewingDayBefore`（買主用）

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、GASの実装とトリガー設定を確認し、次に `buyer_sidebar_counts` テーブルのデータとバックエンドAPIの動作を検証します。

### Exploratory Bug Condition Checking

**Goal**: GASの `updateBuyerSidebarCounts_()` 関数が正しく実行され、`buyer_sidebar_counts` テーブルにデータが保存されることを確認する。

**Test Plan**: GASエディタで `testBuyerSync()` 関数を手動実行し、実行ログとデータベースを確認する。

**Test Cases**:
1. **GAS実装確認**: `updateBuyerSidebarCounts_()` 関数が存在し、`viewingDayBefore` カテゴリの計算ロジックが含まれているか確認（✅ 確認済み）
2. **トリガー設定確認**: `setupBuyerSyncTrigger()` を実行し、10分トリガーが設定されるか確認
3. **手動実行テスト**: `testBuyerSync()` を実行し、実行ログに「内覧日前日カテゴリに追加」が表示されるか確認
4. **データベース確認**: `buyer_sidebar_counts` テーブルに `viewingDayBefore` カテゴリのデータが保存されているか確認

**Expected Counterexamples**:
- トリガーが設定されていない → `setupBuyerSyncTrigger()` を実行して設定
- データが保存されていない → GASの実行ログでエラーを確認して修正

### Fix Checking

**Goal**: 修正後、買主リストページのサイドバーに全てのカテゴリーが表示されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getBuyerStatusCategories'(input)
  ASSERT result.statusCategoriesWithBuyers.length > 0
  ASSERT result.statusCategoriesWithBuyers CONTAINS "viewingDayBefore"
  ASSERT result.statusCategoriesWithBuyers CONTAINS "todayCall"
  ASSERT result.statusCategoriesWithBuyers CONTAINS "assigned"
END FOR
```

### Preservation Checking

**Goal**: 修正後、売主リストのサイドバー表示と買主データの同期が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalSystem(input) = fixedSystem(input)
END FOR
```

**Testing Approach**: 手動テストで以下を確認：
- 売主リストページのサイドバーに全てのカテゴリーが表示される
- 買主データをスプレッドシートで編集するとデータベースに同期される
- 買主データをブラウザUIで編集するとスプレッドシートに同期される

**Test Cases**:
1. **売主リストサイドバー**: 売主リストページを開き、サイドバーに全てのカテゴリーが表示されることを確認
2. **買主データ同期（スプレッドシート→DB）**: スプレッドシートで買主データを編集し、10分後にデータベースに反映されることを確認
3. **買主データ同期（DB→スプレッドシート）**: ブラウザUIで買主データを編集し、即座にスプレッドシートに反映されることを確認

### Unit Tests

- GASの `updateBuyerSidebarCounts_()` 関数を手動実行し、実行ログを確認
- `buyer_sidebar_counts` テーブルに正しいデータが保存されているか確認
- バックエンドの `getSidebarCounts()` メソッドが正しく `viewingDayBefore` を「内覧日前日」にマッピングしているか確認（✅ 確認済み）

### Property-Based Tests

- 買主リストページを複数回リロードし、サイドバーに全てのカテゴリーが表示されることを確認
- GASの時間トリガーが10分ごとに実行され、`buyer_sidebar_counts` テーブルが更新されることを確認
- 買主データを編集し、サイドバーのカウントが正しく更新されることを確認

### Integration Tests

- 買主リストページを開き、サイドバーに全てのカテゴリーが表示されることを確認
- 各カテゴリーをクリックし、対応する買主が一覧に表示されることを確認
- 売主リストページを開き、サイドバーが引き続き正常に動作することを確認
