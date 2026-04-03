# 買主リスト「内覧日前日」カテゴリ未表示問題 - 設計書

## Overview

買主リストページのサイドバーに「内覧日前日」カテゴリが表示されない問題を修正します。根本原因は、GASの `updateBuyerSidebarCounts_()` 関数は実装されているものの、`buyer_sidebar_counts` テーブルにデータが存在しない可能性が高いことです。この設計書では、GASの実装確認、時間トリガーの設定、データベースの確認を行い、問題を解決します。

## Glossary

- **Bug_Condition (C)**: サイドバーに「内覧日前日」カテゴリが表示されない条件
- **Property (P)**: サイドバーに「内覧日前日」カテゴリが正しく表示される状態
- **Preservation**: 既存の他のカテゴリ（当日TEL分、担当等）の表示が変わらないこと
- **`updateBuyerSidebarCounts_()`**: GASの関数で、`buyer_sidebar_counts` テーブルにカテゴリカウントを保存する
- **`buyer_sidebar_counts`**: Supabaseのテーブルで、サイドバーカテゴリのカウントをキャッシュする
- **`viewingDayBefore`**: 内覧日前日カテゴリのデータベース識別子
- **内覧日前日**: 内覧日の前営業日（木曜内覧のみ2日前、それ以外は1日前）

## Bug Details

### Bug Condition

サイドバーに「内覧日前日」カテゴリが表示されない。`buyer_sidebar_counts` テーブルに `viewingDayBefore` カテゴリのデータが存在しないため、APIレスポンスに含まれず、フロントエンドで表示されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerListPageState
  OUTPUT: boolean
  
  RETURN input.sidebarCategories.find(c => c.status === '内覧日前日') === undefined
         AND input.buyersTable.some(b => isViewingDayBefore(b))
END FUNCTION

FUNCTION isViewingDayBefore(buyer)
  INPUT: buyer of type Buyer
  OUTPUT: boolean
  
  IF buyer.assignee === null OR buyer.viewingDate === null THEN
    RETURN false
  END IF
  
  viewingDate := parseDate(buyer.viewingDate)
  viewingDay := viewingDate.getDay()
  daysBeforeViewing := (viewingDay === 4) ? 2 : 1  // 木曜内覧のみ2日前
  notifyDate := viewingDate - daysBeforeViewing days
  today := getCurrentDate()
  
  RETURN notifyDate === today
END FUNCTION
```

### Examples

- **例1**: 買主7277（内覧日: 2026/04/04 金曜日、担当: Y）
  - 今日: 2026/04/03（木曜日）
  - 内覧日の前日 → サイドバーに表示されるべき
  - 実際: 表示されない（`buyer_sidebar_counts` にデータなし）

- **例2**: 買主7278（内覧日: 2026/04/03 木曜日、担当: I）
  - 今日: 2026/04/01（火曜日）
  - 木曜内覧の2日前 → サイドバーに表示されるべき
  - 実際: 表示されない（`buyer_sidebar_counts` にデータなし）

- **例3**: 買主7254（内覧日: 2026/04/05 土曜日、担当: U）
  - 今日: 2026/04/04（金曜日）
  - 内覧日の前日 → サイドバーに表示されるべき
  - 実際: 表示されない（`buyer_sidebar_counts` にデータなし）

- **エッジケース**: 担当が空の買主
  - 内覧日があっても担当がない → 表示されない（正しい動作）


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリ（当日TEL分、担当(イニシャル)、問合せメール未対応等）は正常に表示され続ける
- 買主一覧のフィルタリング機能は変わらない
- GASの10分ごとの自動同期は継続して動作する

**Scope:**
「内覧日前日」カテゴリ以外のサイドバー表示は完全に影響を受けない。この修正は以下のみに影響する：
- `buyer_sidebar_counts` テーブルの `viewingDayBefore` カテゴリ
- GASの `updateBuyerSidebarCounts_()` 関数の実行
- サイドバーUIの「内覧日前日」カテゴリ表示

## Hypothesized Root Cause

調査結果に基づき、最も可能性が高い原因は以下の通り：

1. **GASの時間トリガーが設定されていない**
   - `setupBuyerSyncTrigger()` 関数が実行されていない
   - `syncBuyerList` 関数が10分ごとに実行されていない
   - 結果: `updateBuyerSidebarCounts_()` が呼ばれず、`buyer_sidebar_counts` テーブルが空のまま

2. **GASの実行でエラーが発生している**
   - `updateBuyerSidebarCounts_()` 関数内でエラーが発生
   - Supabaseへの接続エラー
   - スプレッドシートの読み取りエラー

3. **`buyer_sidebar_counts` テーブルが存在しない**
   - マイグレーションが実行されていない
   - テーブル構造が間違っている

4. **バックエンドの `getSidebarCounts()` メソッドが正しく動作していない**
   - ✅ **確認済み**: コードは正しく実装されている（`viewingDayBefore` → 「内覧日前日」のマッピング）
   - この可能性は低い

## Correctness Properties

Property 1: Bug Condition - 内覧日前日カテゴリの表示

_For any_ 買主リストページの状態において、内覧日の前営業日（木曜内覧のみ2日前、それ以外は1日前）に該当する買主が存在する場合、サイドバーに「内覧日前日」カテゴリが表示され、正しいカウント数が表示される。

**Validates: Requirements FR-1, FR-2, AC-2, AC-3**

Property 2: Preservation - 他のカテゴリの表示

_For any_ 買主リストページの状態において、「内覧日前日」カテゴリ以外のサイドバーカテゴリ（当日TEL分、担当(イニシャル)、問合せメール未対応等）は、修正前と同じカウント数で表示され続ける。

**Validates: Requirements NFR-2, NFR-3**


## Fix Implementation

### Changes Required

修正は以下の3つのステップで行います：

**ステップ1: GASの実装確認**

**ファイル**: `gas_buyer_complete_code.js`

**確認事項**:
1. ✅ **確認済み**: `updateBuyerSidebarCounts_()` 関数は実装されている
2. ✅ **確認済み**: `viewingDayBefore` カテゴリの計算ロジックは正しい
3. ✅ **確認済み**: Supabaseへの保存処理は実装されている

**結論**: GASのコード自体は正しく実装されている。問題は実行されていないこと。

---

**ステップ2: GASの時間トリガー設定**

**ファイル**: `gas_buyer_complete_code.js`

**関数**: `setupBuyerSyncTrigger()`

**実行方法**:
1. Google スプレッドシート（買主リスト）を開く
2. 「拡張機能」→「Apps Script」を選択
3. GASエディタで `setupBuyerSyncTrigger` 関数を選択
4. 「実行」ボタンをクリック
5. 権限を承認（初回のみ）

**期待される結果**:
- ログに「✅ トリガーを設定しました: 10分ごと」と表示される
- GASのトリガー管理画面で `syncBuyerList` の10分トリガーが表示される

---

**ステップ3: 手動実行してテスト**

**ファイル**: `gas_buyer_complete_code.js`

**関数**: `testBuyerSync()`

**実行方法**:
1. GASエディタで `testBuyerSync` 関数を選択
2. 「実行」ボタンをクリック
3. 実行ログを確認

**期待されるログ**:
```
=== テスト同期開始 ===
=== 買主リスト同期開始: 2026-04-03T12:00:00.000Z ===
📊 スプレッドシート行数: 1234
✅ 追加同期成功: 0件追加
📊 Phase 2完了: 更新 0件 / エラー 0件
✅ 削除同期成功: 0件削除
📊 買主サイドバーカウント更新開始...
📊 スプレッドシート行数: 1234
  ✅ 7277: 内覧日前日カテゴリに追加
  ✅ 7278: 内覧日前日カテゴリに追加
✅ buyer_sidebar_counts INSERT成功: XX件
📊 買主サイドバーカウント更新完了: 合計 XX行
  所要時間: 12.34秒
=== 同期完了 ===
=== テスト同期完了 ===
```

---

**ステップ4: データベース確認**

**テーブル**: `buyer_sidebar_counts`

**確認SQL**:
```sql
SELECT * FROM buyer_sidebar_counts WHERE category = 'viewingDayBefore';
```

**期待される結果**:
```
category          | count | label | assignee | updated_at
------------------|-------|-------|----------|-------------------
viewingDayBefore  | 2     |       |          | 2026-04-03 12:00:00
```

---

**ステップ5: フロントエンド確認**

**ページ**: 買主リストページ（`/buyers`）

**確認事項**:
1. サイドバーに「内覧日前日」カテゴリが表示される
2. カウント数が正しい（例: 2件）
3. クリックすると、該当する買主のみが表示される


## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを取ります：まず、GASの実装とトリガー設定を確認し、次に、データベースとフロントエンドで正しく表示されることを確認します。

### Exploratory Bug Condition Checking

**Goal**: GASの `updateBuyerSidebarCounts_()` 関数が正しく実行され、`buyer_sidebar_counts` テーブルにデータが保存されることを確認する。

**Test Plan**: GASエディタで `testBuyerSync()` 関数を手動実行し、実行ログとデータベースを確認する。

**Test Cases**:
1. **GAS実装確認**: `updateBuyerSidebarCounts_()` 関数が存在し、`viewingDayBefore` カテゴリの計算ロジックが含まれているか確認（✅ 確認済み）
2. **トリガー設定確認**: `setupBuyerSyncTrigger()` を実行し、10分トリガーが設定されるか確認
3. **手動実行テスト**: `testBuyerSync()` を実行し、実行ログに「内覧日前日カテゴリに追加」が表示されるか確認
4. **データベース確認**: `buyer_sidebar_counts` テーブルに `viewingDayBefore` カテゴリのデータが保存されているか確認

**Expected Counterexamples**:
- トリガーが設定されていない → `setupBuyerSyncTrigger()` を実行
- `buyer_sidebar_counts` テーブルが空 → `testBuyerSync()` を実行してデータを挿入
- GAS実行でエラー → 実行ログでエラー内容を確認し、修正

### Fix Checking

**Goal**: 修正後、サイドバーに「内覧日前日」カテゴリが正しく表示されることを確認する。

**Pseudocode:**
```
FOR ALL buyerListPageState WHERE hasBuyersWithViewingDayBefore(buyerListPageState) DO
  result := renderSidebar(buyerListPageState)
  ASSERT result.categories.find(c => c.status === '内覧日前日') !== undefined
  ASSERT result.categories.find(c => c.status === '内覧日前日').count > 0
END FOR
```

**Test Plan**:
1. GASの `testBuyerSync()` を実行
2. `buyer_sidebar_counts` テーブルを確認
3. ブラウザで買主リストページを開く
4. サイドバーに「内覧日前日」カテゴリが表示されることを確認
5. カウント数が正しいことを確認

### Preservation Checking

**Goal**: 修正後、他のサイドバーカテゴリ（当日TEL分、担当(イニシャル)等）が正常に表示され続けることを確認する。

**Pseudocode:**
```
FOR ALL buyerListPageState DO
  resultBefore := renderSidebar_before(buyerListPageState)
  resultAfter := renderSidebar_after(buyerListPageState)
  
  FOR ALL category IN resultBefore.categories WHERE category.status !== '内覧日前日' DO
    ASSERT resultAfter.categories.find(c => c.status === category.status).count === category.count
  END FOR
END FOR
```

**Testing Approach**: 修正前後でサイドバーのスクリーンショットを比較し、「内覧日前日」以外のカテゴリのカウント数が変わっていないことを確認する。

**Test Plan**:
1. 修正前のサイドバーのスクリーンショットを撮る
2. GASの `testBuyerSync()` を実行
3. 修正後のサイドバーのスクリーンショットを撮る
4. 「内覧日前日」以外のカテゴリのカウント数が同じことを確認

**Test Cases**:
1. **当日TEL分カテゴリ**: 修正前後でカウント数が同じ
2. **担当(イニシャル)カテゴリ**: 修正前後でカウント数が同じ
3. **問合せメール未対応カテゴリ**: 修正前後でカウント数が同じ

### Unit Tests

- GASの `updateBuyerSidebarCounts_()` 関数を手動実行し、実行ログを確認
- `buyer_sidebar_counts` テーブルに正しいデータが保存されているか確認
- バックエンドの `getSidebarCounts()` メソッドが正しく `viewingDayBefore` を「内覧日前日」にマッピングしているか確認（✅ 確認済み）

### Property-Based Tests

- 様々な内覧日（月曜〜日曜）で、前営業日の計算が正しいか確認
- 木曜内覧の場合、2日前（火曜）に通知されるか確認
- 金曜内覧の場合、1日前（木曜）に通知されるか確認
- 担当が空の買主は「内覧日前日」カテゴリに含まれないことを確認

### Integration Tests

- GASの10分トリガーが正常に動作し、`buyer_sidebar_counts` テーブルが定期的に更新されることを確認
- ブラウザで買主リストページを開き、サイドバーに「内覧日前日」カテゴリが表示されることを確認
- 「内覧日前日」カテゴリをクリックし、該当する買主のみが表示されることを確認

