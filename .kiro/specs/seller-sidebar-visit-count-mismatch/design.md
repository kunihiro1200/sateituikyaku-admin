# seller-sidebar-visit-count-mismatch Bugfix Design

## Overview

売主リストのサイドバーカウントで「訪問日前日」が **2件** と表示されるのに、クリックすると **3件** が表示されるバグを修正します。

根本原因は、「訪問日前日」の判定ロジックが3箇所に実装されており、タイムゾーン処理が統一されていないことです。

- `getSidebarCountsFallback()` → `new Date(year, month, day)` → ローカルタイムゾーン依存 ❌
- `listSellers()` の `visitDayBefore` → `new Date(year, month, day)` → ローカルタイムゾーン依存 ❌
- `SellerSidebarCountsUpdateService` → `Date.UTC(year, month, day)` → UTC基準（正しい）✅

Vercel はUTC環境で動作するため、`new Date(year, month, day)` はUTC基準で解釈されます。
JST（UTC+9）との9時間差により、日付境界付近（特に深夜0時〜9時）で曜日・前日計算が誤った結果を返します。

修正方針：`getSidebarCountsFallback()` と `listSellers()` の `visitDayBefore` フィルタで使用している
`new Date(year, month, day)` を `Date.UTC(year, month, day)` に統一し、`SellerSidebarCountsUpdateService` と同じロジックに揃えます。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `getSidebarCountsFallback()` または `listSellers('visitDayBefore')` が `new Date(year, month, day)` を使用してローカルタイムゾーン依存の曜日計算を行っている状態
- **Property (P)**: 期待される正しい動作 — サイドバーカウントと一覧件数が常に一致する
- **Preservation**: 修正によって変えてはいけない既存の動作 — 訪問日前日以外のサイドバーカテゴリのカウントと一覧件数
- **getSidebarCountsFallback()**: `backend/src/services/SellerService.supabase.ts` 内のメソッド。`seller_sidebar_counts` テーブルが空の場合にフォールバックとしてサイドバーカウントをリアルタイム計算する
- **listSellers()**: `backend/src/services/SellerService.supabase.ts` 内のメソッド。サイドバーカテゴリをクリックした際に一覧表示する売主を返す
- **SellerSidebarCountsUpdateService**: `backend/src/services/SellerSidebarCountsUpdateService.ts`。定期的に `seller_sidebar_counts` テーブルを更新するサービス。`Date.UTC()` を使用しており正しい実装
- **todayJST**: JST（UTC+9）での今日の日付文字列（`YYYY-MM-DD` 形式）
- **visitDayBefore**: 訪問日前日カテゴリ。木曜訪問の場合は2日前（火曜）、それ以外は1日前に通知対象となる

## Bug Details

### Bug Condition

バグは、`getSidebarCountsFallback()` または `listSellers()` の `visitDayBefore` フィルタが
`new Date(year, month, day)` を使用して曜日を計算する際に発生します。
Vercel（UTC環境）では、この呼び出しがUTC基準で解釈されるため、
JST（UTC+9）との9時間差により日付境界付近で誤った曜日が返されます。

**Formal Specification:**
```
FUNCTION isBugCondition(context)
  INPUT: context of type { location: 'getSidebarCountsFallback' | 'listSellers_visitDayBefore' }
  OUTPUT: boolean

  RETURN context.location IN ['getSidebarCountsFallback', 'listSellers_visitDayBefore']
    AND usesLocalTimezoneDate(context)  // new Date(year, month, day) を使用している
    AND NOT usesUTCDate(context)        // Date.UTC(year, month, day) を使用していない
END FUNCTION
```

### Examples

- **例1（バグあり）**: 訪問日が木曜日（例: 2026-05-07）の場合、正しい通知日は火曜日（2026-05-05）。
  しかし `new Date(2026, 4, 7)` はVercel UTC環境で `2026-05-07T00:00:00.000Z` となり、
  `.getDay()` は `4`（木曜）を返す。一方、`Date.UTC(2026, 4, 7)` も同じ値を返すため、
  この例では一致する。問題は日付境界付近（JST深夜0時〜9時）で顕在化する。

- **例2（バグ顕在化）**: 訪問日が `2026-05-07T00:00:00+09:00`（JST）として保存されている場合、
  DBからは `2026-05-06T15:00:00.000Z`（UTC）として取得される。
  `split('T')[0]` で `2026-05-06` を取得し、`new Date(2026, 4, 6)` は水曜日を返す。
  しかし実際の訪問日はJSTで木曜日（2026-05-07）であるため、曜日計算が1日ずれる。

- **例3（カウント不一致）**: `SellerSidebarCountsUpdateService` は `Date.UTC()` を使用するため
  正しく3件を計算してDBに保存。しかし `getSidebarCountsFallback()` は `new Date()` を使用するため
  2件を返す。サイドバーに「2」と表示されるが、クリックすると `listSellers()` も同様に
  `new Date()` を使用するため、結果が異なる場合がある。

- **エッジケース**: `visit_reminder_assignee` に値がある売主は除外される。この動作は修正後も維持される。

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 訪問日前日以外のサイドバーカテゴリ（当日TEL、未査定、訪問済み等）のカウントと一覧件数は変わらない
- `visit_reminder_assignee` に値がある売主が訪問日前日カテゴリから除外される動作は維持される
- `visit_assignee` が空または「外す」の売主が訪問日前日カテゴリから除外される動作は維持される
- 訪問日が空欄の売主が訪問日前日カテゴリから除外される動作は維持される
- 木曜訪問の場合に2日前（火曜）を通知日とするロジックは維持される

**スコープ:**
訪問日前日の判定ロジック（曜日計算部分）のみを変更します。
`new Date(year, month, day)` を `Date.UTC(year, month, day)` に置き換え、
`.getDay()` を `.getUTCDay()`、`.getDate()` を `.getUTCDate()` に変更します。
それ以外のフィルタ条件（`visit_assignee`、`visit_reminder_assignee`、`visit_date` の存在確認）は変更しません。

## Hypothesized Root Cause

バグの説明に基づき、最も可能性の高い原因は以下の通りです：

1. **ローカルタイムゾーン依存の `new Date(year, month, day)` 使用**: `getSidebarCountsFallback()` と `listSellers()` の `visitDayBefore` フィルタが `new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))` を使用している。Vercel（UTC環境）ではこれがUTC基準で解釈されるため、JST（UTC+9）との9時間差で日付境界付近に誤りが生じる。

2. **3箇所の実装間での不統一**: `SellerSidebarCountsUpdateService` は既に `Date.UTC()` を使用して正しく実装されているが、`getSidebarCountsFallback()` と `listSellers()` は古い実装のまま残っている。過去の修正が一部にしか適用されなかった可能性がある。

3. **`.getDay()` と `.getUTCDay()` の混在**: `new Date(year, month, day)` で作成したオブジェクトに対して `.getDay()` を呼ぶと、ローカルタイムゾーンの曜日を返す。UTC環境では問題ないように見えるが、タイムスタンプ型のデータ（`2026-05-07T00:00:00+09:00`）を処理する際に日付部分の抽出でずれが生じる。

4. **再発パターン**: コミット `b3ce2524` で「未査定」カテゴリの類似バグが修正されたが、「訪問日前日」カテゴリには同様の修正が適用されなかった。タイムゾーン処理の統一が部分的にしか行われていないことが再発の原因。

## Correctness Properties

Property 1: Bug Condition - 訪問日前日カウントと一覧件数の一致

_For any_ 売主レコードの集合において、`getSidebarCountsFallback()` が返す `visitDayBefore` カウントと、`listSellers({ statusCategory: 'visitDayBefore' })` が返す件数は、`SellerSidebarCountsUpdateService` が計算する件数と常に一致しなければならない。修正後の関数は `Date.UTC(year, month, day)` を使用して曜日を計算し、タイムゾーンに依存しない正しい結果を返す。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 訪問日前日以外のカテゴリへの影響なし

_For any_ 訪問日前日カテゴリ以外のサイドバーカテゴリ（当日TEL、未査定、訪問済み等）において、修正後のコードは修正前のコードと同じカウントおよび一覧件数を返す。訪問日前日の判定ロジック以外の変更は行わない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File**: `backend/src/services/SellerService.supabase.ts`

---

**変更箇所1: `getSidebarCountsFallback()` の `visitDayBeforeCount` 計算**

**Function**: `getSidebarCountsFallback` (Line ~2551)

**Specific Changes**:

1. **`new Date()` を `Date.UTC()` に変更**:
   ```typescript
   // ❌ 修正前
   const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
   const visitDayOfWeek = visitDate.getDay();
   const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
   const expectedNotifyDate = new Date(visitDate);
   expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
   const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
   ```
   ```typescript
   // ✅ 修正後（SellerSidebarCountsUpdateService と同じロジック）
   const year = parseInt(parts[0]);
   const month = parseInt(parts[1]) - 1; // 0-indexed
   const day = parseInt(parts[2]);
   const visitDateUTC = new Date(Date.UTC(year, month, day));
   const visitDayOfWeek = visitDateUTC.getUTCDay();
   const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
   const expectedNotifyUTC = new Date(visitDateUTC);
   expectedNotifyUTC.setUTCDate(visitDateUTC.getUTCDate() - daysBeforeVisit);
   const expectedNotifyStr = `${expectedNotifyUTC.getUTCFullYear()}-${String(expectedNotifyUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(expectedNotifyUTC.getUTCDate()).padStart(2, '0')}`;
   ```

---

**変更箇所2: `listSellers()` の `case 'visitDayBefore'` フィルタ**

**Function**: `listSellers` (Line ~1169)

**Specific Changes**:

2. **`new Date()` を `Date.UTC()` に変更**:
   ```typescript
   // ❌ 修正前
   const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
   const dow = visitDate.getDay();
   const days = dow === 4 ? 2 : 1;
   const notify = new Date(visitDate);
   notify.setDate(visitDate.getDate() - days);
   const notifyStr = `${notify.getFullYear()}-${String(notify.getMonth() + 1).padStart(2, '0')}-${String(notify.getDate()).padStart(2, '0')}`;
   ```
   ```typescript
   // ✅ 修正後（SellerSidebarCountsUpdateService と同じロジック）
   const year = parseInt(parts[0]);
   const month = parseInt(parts[1]) - 1; // 0-indexed
   const day = parseInt(parts[2]);
   const visitDateUTC = new Date(Date.UTC(year, month, day));
   const dow = visitDateUTC.getUTCDay();
   const days = dow === 4 ? 2 : 1;
   const notify = new Date(visitDateUTC);
   notify.setUTCDate(visitDateUTC.getUTCDate() - days);
   const notifyStr = `${notify.getUTCFullYear()}-${String(notify.getUTCMonth() + 1).padStart(2, '0')}-${String(notify.getUTCDate()).padStart(2, '0')}`;
   ```

---

**変更しないファイル:**
- `backend/src/services/SellerSidebarCountsUpdateService.ts` — 既に `Date.UTC()` を使用しており正しい
- `backend/api/` 配下のファイル — 公開物件サイト用のため対象外

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成されます。まず修正前のコードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は根本原因を再仮説する。

**Test Plan**: 訪問日が設定された売主データを用意し、`getSidebarCountsFallback()` と `listSellers('visitDayBefore')` の結果を比較するテストを作成する。修正前のコードで実行してカウント不一致を観察する。

**Test Cases**:
1. **木曜訪問テスト**: 訪問日が木曜日の売主で `getSidebarCountsFallback()` のカウントと `listSellers()` の件数が一致するか確認（修正前は不一致になる可能性がある）
2. **通常訪問テスト**: 訪問日が木曜以外の売主で同様の確認（修正前は不一致になる可能性がある）
3. **タイムスタンプ型テスト**: `visit_date` が `YYYY-MM-DDTHH:MM:SS+09:00` 形式で保存されている場合の動作確認
4. **`SellerSidebarCountsUpdateService` との比較テスト**: 同じ売主データに対して3つの実装が同じ結果を返すか確認

**Expected Counterexamples**:
- `getSidebarCountsFallback()` が返すカウントと `SellerSidebarCountsUpdateService` が計算するカウントが異なる
- 原因: `new Date(year, month, day)` と `Date.UTC(year, month, day)` の曜日計算結果が日付境界付近で異なる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  sidebarCount ← getSidebarCountsFallback_fixed().visitDayBefore
  listCount ← listSellers_fixed({ statusCategory: 'visitDayBefore' }).total
  serviceCount ← SellerSidebarCountsUpdateService.calculateVisitDayBefore()
  ASSERT sidebarCount = listCount
  ASSERT sidebarCount = serviceCount
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力（訪問日前日以外のカテゴリ）に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL category WHERE category ≠ 'visitDayBefore' DO
  ASSERT getSidebarCountsFallback_original()[category] = getSidebarCountsFallback_fixed()[category]
  ASSERT listSellers_original({ statusCategory: category }) = listSellers_fixed({ statusCategory: category })
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な訪問日パターン（曜日、タイムスタンプ形式）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正が他カテゴリに影響しないことを強く保証できる

**Test Plan**: 修正前のコードで各カテゴリの動作を観察し、修正後も同じ結果が返ることをプロパティベーステストで検証する。

**Test Cases**:
1. **当日TELカウント保持**: 修正前後で `todayCall` カウントが変わらないことを確認
2. **未査定カウント保持**: 修正前後で `unvaluated` カウントが変わらないことを確認
3. **訪問済みカウント保持**: 修正前後で `visitCompleted` カウントが変わらないことを確認
4. **除外条件保持**: `visit_reminder_assignee` がある売主が引き続き除外されることを確認

### Unit Tests

- `getSidebarCountsFallback()` の `visitDayBeforeCount` 計算で `Date.UTC()` が使用されていることを確認
- `listSellers()` の `visitDayBefore` フィルタで `Date.UTC()` が使用されていることを確認
- 木曜訪問（2日前）と木曜以外（1日前）の両パターンで正しい通知日が計算されることを確認
- `visit_reminder_assignee` がある売主が除外されることを確認
- `visit_assignee` が空または「外す」の売主が除外されることを確認

### Property-Based Tests

- ランダムな訪問日（各曜日）を生成し、`getSidebarCountsFallback()`、`listSellers()`、`SellerSidebarCountsUpdateService` の3つが同じ結果を返すことを検証
- ランダムな売主データを生成し、訪問日前日以外のカテゴリのカウントが修正前後で変わらないことを検証
- タイムスタンプ形式（`YYYY-MM-DDTHH:MM:SS+09:00`、`YYYY-MM-DD HH:MM:SS`、`YYYY-MM-DD`）のバリエーションで正しく動作することを検証

### Integration Tests

- 実際のDBデータを使用して、サイドバーカウントと一覧件数が一致することを確認
- 訪問日が木曜日の売主が存在する状態で、火曜日に3つの実装が同じカウントを返すことを確認
- 修正デプロイ後、サイドバーの「訪問日前日」をクリックして表示件数がカウントと一致することを確認
