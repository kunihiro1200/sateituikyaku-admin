# reins-sidebar-category-not-clearing Bugfix Design

## Overview

物件リスト画面のサイドバー「レインズ登録＋SUUMO登録」カテゴリーに表示されている物件が、
SUUMO URLを登録して対応済みにしたにもかかわらず、カテゴリーから消えないバグを修正する。

**根本原因**: `PUT /api/property-listings/:propertyNumber` が呼ばれた際、
`PropertyListingService.update()` は `suumo_url` フィールドを更新するが、
`sidebar_status` の再計算をトリガーしない。
その結果、古い `sidebar_status = 'レインズ登録＋SUUMO登録'` がDBに残り続ける。

**修正方針**: `PropertyListingService.update()` 内で `suumo_url` が更新される場合に、
`calculateSidebarStatus()` を呼び出して `sidebar_status` を再計算・保存する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `sidebar_status === 'レインズ登録＋SUUMO登録'` かつ `suumo_url` が登録済みにもかかわらず `sidebar_status` が再計算されていない状態
- **Property (P)**: 修正後の期待動作 — `suumo_url` が登録済みの物件は `sidebar_status` が「レインズ登録＋SUUMO登録」以外の値に更新される
- **Preservation**: 修正によって変えてはいけない既存の動作 — `suumo_url` 以外のフィールド更新時の `sidebar_status` 計算、マウスクリック操作、他のサイドバーカテゴリーの表示
- **calculateSidebarStatus()**: `backend/src/services/PropertyListingSyncService.ts` 内のメソッド。スプレッドシート行データと `gyomuListData` を受け取り、`sidebar_status` 文字列を返す
- **PropertyListingService.update()**: `backend/src/services/PropertyListingService.ts` 内のメソッド。`PUT /api/property-listings/:propertyNumber` から呼ばれ、DBを更新する
- **gyomuListData**: `work_tasks` テーブルから取得した公開予定日データ。`calculateSidebarStatus()` の条件⑤⑥で参照される
- **sidebar_status**: `property_listings` テーブルのカラム。サイドバーのカテゴリーフィルターに使用される

## Bug Details

### Bug Condition

`PUT /api/property-listings/:propertyNumber` で `suumo_url` が更新される際、
`PropertyListingService.update()` は `sidebar_status` の再計算を行わない。
`calculateSidebarStatus()` の条件⑥は「SUUMO URLが空」を必須条件としているため、
URL登録後も古い `sidebar_status = 'レインズ登録＋SUUMO登録'` がDBに残り続ける。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListing (DB record)
  OUTPUT: boolean

  RETURN X.sidebar_status = 'レインズ登録＋SUUMO登録'
         AND (X.suumo_url IS NOT NULL AND X.suumo_url != '')
         // suumo_urlが登録済みにもかかわらずsidebar_statusが古い値のまま
END FUNCTION
```

### Examples

- **例1（バグ発現）**: AA13600 の `suumo_url` が空の状態で `sidebar_status = 'レインズ登録＋SUUMO登録'` → レインズ登録ページで SUUMO URL を入力して保存 → `suumo_url` は更新されるが `sidebar_status` は「レインズ登録＋SUUMO登録」のまま → サイドバーから消えない
- **例2（バグ発現）**: `atbb_status = '専任・公開中'`、`publish_scheduled_date` が昨日以前、`suumo_url` が空 → `sidebar_status = 'レインズ登録＋SUUMO登録'` → SUUMO URL を登録 → `sidebar_status` が再計算されず古い値が残る
- **例3（正常ケース）**: `report_date` を更新 → `sidebar_status` が「未報告」に再計算される（既存の再計算ロジックは動作している）
- **例4（エッジケース）**: `suumo_url` を空文字列 `''` に更新 → `sidebar_status` は「レインズ登録＋SUUMO登録」のままであるべき（バグ条件に該当しない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `suumo_url` 以外のフィールド（`special_notes`、`report_date`、`offer_date` など）を更新した場合の `sidebar_status` 計算は変わらない
- `report_date` / `report_assignee` 更新時の「未報告」ステータス再計算ロジックは変わらない
- `suumo_url` が空のまま更新された場合、`sidebar_status` は「レインズ登録＋SUUMO登録」のままであるべき
- `suumo_registered = 'S不要'` の物件は「レインズ登録＋SUUMO登録」に表示されない動作は変わらない
- マウスクリックによるボタン操作・フォーム保存は変わらない
- スプレッドシートへの書き戻し処理は変わらない

**Scope:**
`suumo_url` フィールドが更新されない全てのリクエストは、この修正の影響を受けない。

## Hypothesized Root Cause

`PropertyListingService.update()` には、特定フィールド更新時に `sidebar_status` を再計算するロジックが部分的に実装されている（`report_date` / `report_assignee` の場合）。しかし `suumo_url` 更新時の再計算が実装されていない。

1. **`suumo_url` 更新時の再計算欠落**: `PropertyListingService.update()` の `report_date` 再計算ブロック（L235〜L258）と同様のブロックが `suumo_url` に対して存在しない
   - `backend/src/services/PropertyListingService.ts` の `update()` メソッド

2. **`calculateSidebarStatus()` の呼び出し方の複雑さ**: `calculateSidebarStatus()` はスプレッドシート行形式（`row['Suumo URL']` など）を受け取るが、`PropertyListingService.update()` はDB形式（`suumo_url` など）を扱う。呼び出し時にフォーマット変換が必要

3. **`gyomuListData` の取得コスト**: `calculateSidebarStatus()` の条件⑤⑥には `gyomuListData`（`work_tasks` テーブルから取得）が必要。`PropertyListingService.update()` はこのデータを持っていないため、追加のDB取得が必要

4. **スプレッドシート同期との二重更新リスク**: `PropertyListingService.update()` はスプレッドシートへの書き戻しも行う。`sidebar_status` の再計算結果をDBに保存する際、スプレッドシートとの整合性を保つ必要がある

## Correctness Properties

Property 1: Bug Condition - SUUMO URL登録後のsidebar_status再計算

_For any_ `PropertyListing` において `suumo_url` が空でない値に更新される場合（isBugCondition が true になりうる状態）、修正後の `PropertyListingService.update()` は `calculateSidebarStatus()` を再実行し、`sidebar_status` を正しい値（「レインズ登録＋SUUMO登録」以外）に更新する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - suumo_url非更新時のsidebar_status動作不変

_For any_ リクエストにおいて `suumo_url` フィールドが含まれない場合（isBugCondition が false）、修正後の `PropertyListingService.update()` は修正前と同一の `sidebar_status` 計算結果を返し、既存の全ての動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/PropertyListingService.ts`

**Function**: `update(propertyNumber: string, updates: Record<string, any>)`

**Specific Changes**:

1. **`suumo_url` 更新検出ブロックの追加**: `report_date` 再計算ブロックの直後に、`'suumo_url' in updates` を検出するブロックを追加する

2. **現在の物件データ取得**: `suumo_url` が更新される場合、`getByPropertyNumber(propertyNumber)` で現在のDB値を取得する（`report_date` ブロックと同様のパターン）

3. **`gyomuListData` の取得**: `PropertyListingSyncService.fetchGyomuListDataFromWorkTasks()` を呼び出して公開予定日データを取得する。または `work_tasks` テーブルから直接取得する

4. **スプレッドシート行形式への変換**: `calculateSidebarStatus()` が期待するスプレッドシート行形式（`row['Suumo URL']`、`row['atbb成約済み/非公開']` など）に現在のDB値をマッピングする

5. **`sidebar_status` の再計算と更新**: `calculateSidebarStatus()` を呼び出し、結果を `updates.sidebar_status` に設定する（DBへの保存は既存の `supabase.update()` 呼び出しで行われる）

**実装イメージ（擬似コード）**:
```typescript
// suumo_url が更新される場合、sidebar_status を再計算
if ('suumo_url' in updates) {
  try {
    const current = await this.getByPropertyNumber(propertyNumber);
    if (current) {
      // work_tasks から gyomuListData を取得
      const syncService = new PropertyListingSyncService();
      const gyomuListData = await syncService.fetchGyomuListDataFromWorkTasks();

      // DB形式 → スプレッドシート行形式に変換
      const row = mapDbToSpreadsheetRow(current, updates);

      // sidebar_status を再計算
      const newSidebarStatus = syncService.calculateSidebarStatus(row, gyomuListData);
      updates.sidebar_status = newSidebarStatus;
    }
  } catch (e) {
    // 再計算失敗は無視（既存パターンと同様）
  }
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書いてバグを確認し、
次に修正後のコードでバグが解消され、かつ既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `PropertyListingService.update()` に `suumo_url` を含むリクエストを送り、
`sidebar_status` が再計算されないことを確認する。未修正コードで FAIL することを期待する。

**Test Cases**:
1. **SUUMO URL登録テスト**: `sidebar_status = 'レインズ登録＋SUUMO登録'` の物件に `suumo_url` を登録 → `sidebar_status` が変わらないことを確認（未修正コードで FAIL）
2. **DB直接確認テスト**: AA13600 など実際のバグ物件の `sidebar_status` と `suumo_url` を確認し、バグ条件が成立していることを確認
3. **`calculateSidebarStatus()` 単体テスト**: `suumo_url` が空でない行データを渡した場合、「レインズ登録＋SUUMO登録」が返らないことを確認（この関数自体は正しく動作しているはず）
4. **エッジケーステスト**: `suumo_url` を空文字列 `''` に更新した場合、`sidebar_status` が「レインズ登録＋SUUMO登録」のままであることを確認

**Expected Counterexamples**:
- `suumo_url` を登録しても `sidebar_status` が「レインズ登録＋SUUMO登録」のまま
- 原因: `PropertyListingService.update()` に `suumo_url` 更新時の `sidebar_status` 再計算ロジックが存在しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := PropertyListingService.update(X.propertyNumber, { suumo_url: 'https://...' })
  ASSERT result.sidebar_status != 'レインズ登録＋SUUMO登録'
END FOR
```

### Preservation Checking

**Goal**: `suumo_url` が更新されない全ての入力に対して、修正前後で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT PropertyListingService_original.update(X) = PropertyListingService_fixed.update(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- `suumo_url` を含まない多様なフィールド組み合わせを自動生成できる
- `report_date`、`special_notes`、`offer_date` など多数のフィールドのエッジケースを網羅できる
- 修正が意図しないフィールドに影響していないことを強く保証できる

**Test Cases**:
1. **`report_date` 更新の保存テスト**: `report_date` のみ更新した場合、`sidebar_status` が「未報告」に再計算される動作が変わらないことを確認
2. **`special_notes` 更新の保存テスト**: `special_notes` のみ更新した場合、`sidebar_status` が変わらないことを確認
3. **`suumo_url` 空文字更新テスト**: `suumo_url = ''` で更新した場合、`sidebar_status` が「レインズ登録＋SUUMO登録」のままであることを確認
4. **`suumo_registered = 'S不要'` テスト**: `suumo_registered = 'S不要'` の物件に `suumo_url` を登録しても、「レインズ登録＋SUUMO登録」に表示されない動作が変わらないことを確認

### Unit Tests

- `calculateSidebarStatus()` に `suumo_url` が空でない行データを渡した場合、「レインズ登録＋SUUMO登録」が返らないことを確認
- `PropertyListingService.update()` に `suumo_url` を含むリクエストを送った場合、`sidebar_status` が再計算されることを確認
- `suumo_url` が空文字列 `''` または `null` の場合、`sidebar_status` が再計算されないことを確認

### Property-Based Tests

- ランダムな物件データと `suumo_url` の組み合わせを生成し、`suumo_url` が空でない場合は「レインズ登録＋SUUMO登録」が返らないことを確認
- `suumo_url` を含まないランダムなフィールド更新を生成し、修正前後で `sidebar_status` の計算結果が同一であることを確認
- 多様な `atbb_status` 値と `suumo_url` の組み合わせで、`calculateSidebarStatus()` の出力が一貫していることを確認

### Integration Tests

- レインズ登録ページから SUUMO URL を保存するフロー全体をテスト（フロントエンド → `PUT /api/property-listings/:propertyNumber` → DB更新 → サイドバー再表示）
- SUUMO URL 登録後にサイドバーを再読み込みし、「レインズ登録＋SUUMO登録」カテゴリーから物件が消えることを確認
- `suumo_url` 以外のフィールドを更新した場合、サイドバーカテゴリーが変わらないことを確認
