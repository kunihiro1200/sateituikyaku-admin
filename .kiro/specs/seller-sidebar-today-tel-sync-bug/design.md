# seller-sidebar-today-tel-sync-bug バグ修正設計

## Overview

売主リストのサイドバーカテゴリー「当日TEL分」に、次電日が未来の売主（AA12674）が誤って含まれるバグの修正設計。

このバグには2つの独立した問題がある：

1. **GAS同期遅延問題**: `EnhancedAutoSyncService.detectUpdatedSellers()` の `next_call_date` 比較ロジックが、スプレッドシートで次電日を更新しても差分を正しく検出できないケースがある。その結果、`syncUpdatedSellers()` が呼ばれず、DBへの反映が遅延する。

2. **サイドバーキャッシュ問題**: `getSidebarCounts()` は `seller_sidebar_counts` テーブルのキャッシュデータを参照する。このテーブルはVercel Cronで10分ごとに更新されるため、DBを直接変更してもGASの次回同期タイミングまでサイドバーに反映されない。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — スプレッドシートで次電日が更新されたにもかかわらず、サイドバーの「当日TEL分」カウントに反映されない状態
- **Property (P)**: 期待される正しい動作 — DBの `next_call_date` が今日より未来の売主は「当日TEL分」に含まれない
- **Preservation**: 修正によって変更してはいけない既存動作 — 次電日が今日以前の売主は引き続き「当日TEL分」に含まれる
- **detectUpdatedSellers**: `EnhancedAutoSyncService.ts` 内の関数。スプレッドシートとDBを比較して更新が必要な売主番号を返す
- **updateSingleSeller**: `EnhancedAutoSyncService.ts` 内の関数。1件の売主データをスプレッドシートからDBに同期する
- **getSidebarCounts**: `SellerService.supabase.ts` 内の関数。`seller_sidebar_counts` テーブルからキャッシュデータを読み取る
- **getSidebarCountsFallback**: `SellerService.supabase.ts` 内の関数。DBを直接クエリしてサイドバーカウントを計算する（60秒インメモリキャッシュあり）
- **seller_sidebar_counts**: サイドバーカウントのキャッシュテーブル。Vercel Cronで10分ごとに更新される
- **next_call_date**: DBカラム。次回電話日（DATE型）
- **次電日**: スプレッドシートのカラム名。`next_call_date` にマッピングされる

## Bug Details

### Bug Condition

バグは以下の2つの経路で発生する：

**経路1（GAS同期遅延）**: スプレッドシートで次電日を更新した後、`detectUpdatedSellers()` が差分を検出できず、DBへの同期が行われない。

**経路2（サイドバーキャッシュ）**: DBの `next_call_date` が正しい値になっていても、`seller_sidebar_counts` テーブルが古いカウントを保持しているため、サイドバーに反映されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sellerNumber: string, spreadsheetNextCallDate: string | null, dbNextCallDate: string | null }
  OUTPUT: boolean

  -- 経路1: GAS同期遅延
  IF spreadsheetNextCallDate != dbNextCallDate
     AND detectUpdatedSellers() does NOT include input.sellerNumber
  THEN RETURN true

  -- 経路2: サイドバーキャッシュ
  IF dbNextCallDate > today
     AND seller_sidebar_counts.todayCall includes input.sellerNumber
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **例1（経路1）**: AA12674の次電日をスプレッドシートで2026/7/18に更新 → 1時間後もDBの `next_call_date` が古い値のまま → 「当日TEL分」に誤って含まれる
- **例2（経路2）**: DBで直接 `next_call_date` を2026/7/18に変更 → `seller_sidebar_counts` テーブルは古いカウントを保持 → 次回Cron実行（最大10分後）まで「当日TEL分」に誤って含まれる
- **例3（正常ケース）**: 次電日が昨日以前の売主 → 「当日TEL分」に正しく含まれる（変更なし）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 次電日が今日以前の売主（追客中・コミュニケーション情報が全て空・営担なし）は「当日TEL分」に引き続き含まれること
- GASの `syncSellerList` が10分トリガーで実行され、スプレッドシートの全売主データをDBに正常に同期し続けること
- 次電日以外のフィールド（状況、営担など）の同期が引き続き正常に動作すること
- `getSidebarCountsFallback()` の計算ロジックが変更されないこと

**スコープ:**
次電日フィールド以外の変更（状況、営担、コミュニケーション情報など）は、このバグ修正の影響を受けない。

## Hypothesized Root Cause

### 経路1: GAS同期遅延の根本原因

`detectUpdatedSellers()` の `next_call_date` 比較ロジック（Line 1032付近）を確認すると：

```typescript
const formattedNextCallDate = sheetNextCallDate ? this.formatVisitDate(sheetNextCallDate) : null;
const dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
if (formattedNextCallDate !== dbNextCallDate) {
  needsUpdate = true;
}
```

**仮説1: `formatVisitDate()` の変換結果とDBの日付フォーマットが一致しない**
- スプレッドシートの日付形式（例: `2026/7/18`）を `formatVisitDate()` で変換した結果が `2026-07-18` にならない場合、差分が検出されない
- `formatVisitDate()` が `null` を返す場合、DBに値があっても `null !== "2026-07-18"` で差分検出されるが、逆に `"2026-07-18" !== null` の場合は検出される

**仮説2: `updateSingleSeller()` での `next_call_date` の更新ロジック**
- `updateData.next_call_date = mappedData.next_call_date || null;` という実装で、`columnMapper.mapToDatabase()` が正しく変換できていない場合、DBが更新されない

**仮説3: スプレッドシートのキャッシュ**
- `getSpreadsheetData()` は5分間キャッシュされる。キャッシュが古い場合、最新の次電日が取得されない

### 経路2: サイドバーキャッシュの根本原因

`getSidebarCounts()` は `seller_sidebar_counts` テーブルを参照する。このテーブルは：
- Vercel Cronで10分ごとに `/api/sellers/sidebar-counts/update` エンドポイントが呼ばれて更新される
- DBを直接変更しても `seller_sidebar_counts` は更新されない
- フォールバック（`getSidebarCountsFallback()`）は60秒のインメモリキャッシュがある

## Correctness Properties

Property 1: Bug Condition - 次電日変更のサイドバー即時反映

_For any_ 売主において、DBの `next_call_date` が今日より未来の日付に変更された場合、次回 `getSidebarCounts()` が呼ばれた時点で、その売主は「当日TEL分」（`todayCall`）カウントに含まれないこと。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 既存の「当日TEL分」判定の維持

_For any_ 売主において、`next_call_date` が今日以前であり、かつ追客中・コミュニケーション情報が全て空・営担なしの条件を満たす場合、修正後も「当日TEL分」カウントに含まれること（修正前と同じ動作）。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

#### 修正1: `getSidebarCounts()` をDBの現在値から直接計算するように変更

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSidebarCounts()`

**Specific Changes**:
1. `seller_sidebar_counts` テーブルへの依存を排除し、常に `getSidebarCountsFallback()` を呼ぶように変更する
2. または、`seller_sidebar_counts` テーブルのデータが古い場合（例: 最終更新から10分以上経過）はフォールバックを使用する
3. `getSidebarCountsFallback()` の60秒インメモリキャッシュを短縮（例: 30秒）または削除する

**推奨アプローチ**: `getSidebarCounts()` を `getSidebarCountsFallback()` に直接委譲する。`seller_sidebar_counts` テーブルはパフォーマンス最適化のためのキャッシュだが、即時反映の要件を満たすためにはDBを直接クエリする必要がある。

```typescript
// 修正後のgetSidebarCounts()
async getSidebarCounts() {
  // seller_sidebar_countsテーブルへの依存を排除
  // 常にDBの現在値から計算する
  return this.getSidebarCountsFallback();
}
```

#### 修正2: `detectUpdatedSellers()` の `next_call_date` 比較ロジックの修正

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `detectUpdatedSellers()`

**Specific Changes**:
1. `formatVisitDate()` の変換結果を詳細にログ出力して、フォーマット不一致を特定する
2. スプレッドシートの次電日が空欄になった場合（DBに値がある場合）も差分として検出する
3. 比較ロジックを強化して、フォーマット差異（`2026/7/18` vs `2026-07-18`）を吸収する

**Specific Changes**:
```typescript
// 修正後のnext_call_date比較
const formattedNextCallDate = sheetNextCallDate ? this.formatVisitDate(sheetNextCallDate) : null;
const dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
// 空欄→値あり、値あり→空欄、値の変更、全てのケースを検出
if (formattedNextCallDate !== dbNextCallDate) {
  console.log(`[detectUpdated] ${sellerNumber}: next_call_date changed: sheet="${formattedNextCallDate}" db="${dbNextCallDate}"`);
  needsUpdate = true;
}
```

#### 修正3: `updateSingleSeller()` での `next_call_date` クリア処理の確認

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `updateSingleSeller()`

**Specific Changes**:
1. スプレッドシートの次電日が空欄の場合、DBの `next_call_date` を `null` でクリアすることを確認する
2. 現在の実装: `next_call_date: mappedData.next_call_date || null` — `columnMapper.mapToDatabase()` が空欄を `null` に変換しているか確認する

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現するテストを書き、次に修正後の動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: AA12674の実際のデータを使って、スプレッドシートの次電日変更がDBに反映されないことを確認する。

**Test Cases**:
1. **detectUpdatedSellers検出テスト**: スプレッドシートの次電日が `2026-07-18`、DBの `next_call_date` が古い値（例: `2026-01-01`）の場合、`detectUpdatedSellers()` がAA12674を検出するか確認（未修正コードで失敗する可能性）
2. **サイドバーキャッシュテスト**: DBの `next_call_date` を直接 `2026-07-18` に変更した後、`getSidebarCounts()` が即時に反映するか確認（未修正コードで失敗する）
3. **formatVisitDate変換テスト**: `formatVisitDate('2026/7/18')` が `'2026-07-18'` を返すか確認

**Expected Counterexamples**:
- `getSidebarCounts()` が `seller_sidebar_counts` テーブルの古いデータを返す
- `detectUpdatedSellers()` が特定のフォーマットの次電日変更を検出できない

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全ての入力で期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  -- DBのnext_call_dateを今日より未来に変更
  UPDATE sellers SET next_call_date = futureDate WHERE seller_number = seller.sellerNumber
  
  -- サイドバーカウントを取得
  result := getSidebarCounts()
  
  -- 「当日TEL分」に含まれないことを確認
  ASSERT seller NOT IN todayCallSellers(result)
END FOR
```

### Preservation Checking

**Goal**: 修正後、バグ条件を満たさない入力（次電日が今日以前の売主）の動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  result_before := getSidebarCounts_original(seller)
  result_after := getSidebarCounts_fixed(seller)
  ASSERT result_before.todayCall == result_after.todayCall
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。多様な `next_call_date` の値（今日、昨日、明日、null）に対して、修正前後で「当日TEL分」の判定が一致することを確認する。

**Test Cases**:
1. **次電日が今日の売主**: 修正前後で「当日TEL分」に含まれることを確認
2. **次電日が昨日の売主**: 修正前後で「当日TEL分」に含まれることを確認
3. **次電日がnullの売主**: 修正前後で「当日TEL分」に含まれないことを確認
4. **コミュニケーション情報ありの売主**: 修正前後で「当日TEL分」に含まれないことを確認

### Unit Tests

- `formatVisitDate()` が各種日付フォーマット（`2026/7/18`、`2026/07/18`、`2026-07-18`）を正しく `YYYY-MM-DD` に変換することを確認
- `detectUpdatedSellers()` が `next_call_date` の変更を正しく検出することを確認
- `getSidebarCounts()` がDBの現在値を使って計算することを確認（`seller_sidebar_counts` テーブルに依存しない）

### Property-Based Tests

- ランダムな `next_call_date` の値（今日以前・今日・今日以降・null）に対して、`isTodayCall()` の判定が正しいことを確認
- 任意の売主データに対して、`getSidebarCounts()` の結果が `getSidebarCountsFallback()` の結果と一致することを確認（修正後）
- 任意の次電日変更に対して、`detectUpdatedSellers()` が差分を正しく検出することを確認

### Integration Tests

- スプレッドシートで次電日を更新した後、10分以内にDBに反映されることを確認
- DBで `next_call_date` を直接変更した後、次回 `getSidebarCounts()` 呼び出しで即時反映されることを確認
- 修正後も他のサイドバーカテゴリー（訪問済み、未査定など）のカウントが正しいことを確認
