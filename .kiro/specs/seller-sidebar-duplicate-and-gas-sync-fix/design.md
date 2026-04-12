# seller-sidebar-duplicate-and-gas-sync-fix バグ修正デザイン

## Overview

売主リストのサイドバーに関する2つのバグを修正する。

**バグ1（サイドバー重複）**: `SellerSidebarCountsUpdateService` において、「未着手（todayCallNotStarted）」カテゴリーの条件を満たす売主が「当日TEL（todayCall）」カテゴリーにも重複してカウントされている。「未着手」は全カテゴリーの中で最高優先順位を持ち、いかなる条件の組み合わせでも1人の売主は1つのカテゴリーにのみカウントされなければならない。

**バグ2（GAS次電日未反映）**: スプレッドシートで更新された次電日（例：AA13950の4/14）がDBに反映されない。`_seller_hashes` シートのハッシュキャッシュが古いまま残り差分なしと誤判定しているか、`buildRowHash_()` 関数が `次電日` フィールドの変更を正しく検知できていない可能性がある。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件。バグ1は「未着手」条件を満たす売主が `todayCall` にも重複カウントされる状態。バグ2はスプレッドシートの次電日変更がDBに反映されない状態
- **Property (P)**: 修正後の期待動作。バグ1は「未着手」売主が `todayCallNotStarted` のみにカウントされること。バグ2は次電日変更が次回10分トリガーでDBに反映されること
- **Preservation**: 既存の正常動作。「未着手」条件を満たさない売主の `todayCall` カウント、差分なし時のスキップ動作など
- **todayCallNotStarted（未着手）**: `status === '追客中'` かつ `next_call_date <= today` かつ連絡先情報なし（`phone_contact_person`, `preferred_contact_time`, `contact_method` が全て空）かつ `unreachable_status` なし かつ `confidence_level` が「ダブり」「D」「AI査定」でない かつ `inquiry_date >= '2026-01-01'` を全て満たすカテゴリー
- **todayCall（当日TEL）**: `filteredTodayCallSellers`（営担なし）のうち連絡先情報なし（`hasInfo === false`）の売主をカウントするカテゴリー
- **filteredTodayCallSellers**: `todayCallBaseSellers`（`追客中` かつ `next_call_date <= today`、または `他決→追客` かつ `next_call_date <= today`）から営担あり（`hasValidVisitAssignee`）を除外したもの
- **buildRowHash_()**: GASの差分検知用ハッシュ生成関数。`次電日` を含む複数フィールドの値を `|` 区切りで連結してハッシュ文字列を生成する
- **_seller_hashes**: GASがハッシュキャッシュを保存するスプレッドシートの隠しシート
- **SellerSidebarCountsUpdateService**: `backend/src/services/SellerSidebarCountsUpdateService.ts` - サイドバーカウントを計算してDBに保存するサービス

## Bug Details

### Bug Condition

**バグ1: サイドバーカテゴリー重複**

`todayCallNotStarted` の条件は `filteredTodayCallSellers` を起点として計算される。`filteredTodayCallSellers` は `todayCall` の母集団でもある。`todayCall`（`todayCallNoInfoCount`）は `filteredTodayCallSellers` のうち `hasInfo === false` の全件をカウントするが、その中には `todayCallNotStarted` の条件（`status === '追客中'` かつ `unreachable_status` なし かつ `inquiry_date >= '2026-01-01'`）を満たす売主も含まれる。結果として、「未着手」売主が `todayCall` にも重複カウントされる。

**Formal Specification:**
```
FUNCTION isBugCondition_sidebar(seller)
  INPUT: seller of type SellerRecord
  OUTPUT: boolean

  hasInfo := seller.phone_contact_person != '' OR
             seller.preferred_contact_time != '' OR
             seller.contact_method != ''
  hasValidAssignee := seller.visit_assignee != null AND
                      seller.visit_assignee != '' AND
                      seller.visit_assignee != '外す'
  isNotStarted := seller.status == '追客中' AND
                  seller.next_call_date <= today AND
                  NOT hasInfo AND
                  NOT seller.unreachable_status AND
                  seller.confidence_level NOT IN ['ダブり', 'D', 'AI査定'] AND
                  seller.inquiry_date >= '2026-01-01'

  RETURN NOT hasValidAssignee AND
         NOT hasInfo AND
         isNotStarted
         -- この売主は todayCall にも todayCallNotStarted にも両方カウントされている（バグ）
END FUNCTION
```

**バグ2: GAS次電日未反映**

`buildRowHash_()` 関数は `次電日` フィールドを含む40以上のフィールドを `|` 区切りで連結してハッシュを生成する。しかし `_seller_hashes` シートのキャッシュが何らかの理由で古い状態のまま残っている場合、スプレッドシートで `次電日` を更新しても `buildRowHash_()` が生成する新ハッシュと保存済みハッシュが一致してしまい、差分なしと判定されてSupabaseへのPATCHがスキップされる。

**Formal Specification:**
```
FUNCTION isBugCondition_gas(sellerNumber, sheetNextCallDate)
  INPUT: sellerNumber of type string, sheetNextCallDate of type string
  OUTPUT: boolean

  cachedHash := loadHashesFromSheet_()[sellerNumber]
  currentHash := buildRowHash_(getSheetRow(sellerNumber))
  dbNextCallDate := getSupabaseNextCallDate(sellerNumber)

  RETURN cachedHash == currentHash AND
         sheetNextCallDate != dbNextCallDate
         -- ハッシュが一致（差分なし判定）しているが、実際にはDBと乖離している（バグ）
END FUNCTION
```

### Examples

**バグ1:**
- **例1（バグ発生）**: AA13950が `status='追客中'`, `next_call_date='2026-04-12'`, 連絡先情報なし, `unreachable_status=null`, `inquiry_date='2026-02-01'` → `todayCall` と `todayCallNotStarted` の両方にカウントされる（正しくは `todayCallNotStarted` のみ）
- **例2（バグ発生）**: 「未着手」条件を満たす売主が10人いる場合、`todayCall` のカウントが10人分多くなる
- **例3（バグなし）**: `unreachable_status='不通'` の売主 → `todayCallNotStarted` の条件を満たさないため `todayCall` のみにカウントされる（正常）
- **エッジケース**: `inquiry_date='2025-12-31'` の売主 → `todayCallNotStarted` の条件を満たさないため `todayCall` のみにカウントされる（正常）

**バグ2:**
- **例1（バグ発生）**: AA13950の次電日をスプレッドシートで4/12→4/14に更新 → `_seller_hashes` のキャッシュが古いため差分なしと判定され、DBは4/12のまま
- **例2（バグなし）**: `resetRowHashCache()` を手動実行後の次回同期 → 全件差分ありと判定され、正しくDBに反映される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `unreachable_status` が設定されている売主は引き続き `todayCall` にカウントされる（`todayCallNotStarted` には含まれない）
- `inquiry_date < '2026-01-01'` の売主は引き続き `todayCall` にカウントされる（`todayCallNotStarted` には含まれない）
- `他決→追客` ステータスの売主は引き続き `todayCall` にカウントされる（`todayCallNotStarted` には含まれない）
- スプレッドシートの行データに変更がない場合、引き続き差分なしと判定してSupabaseへのPATCHをスキップする
- GASの `onEditTrigger` による即時同期は引き続き正しく動作する
- `todayCallWithInfo`、`pinrichEmpty`、`unvaluated` 等の他カテゴリーのカウントは変更されない

**Scope:**
バグ1の修正は `SellerSidebarCountsUpdateService.ts` の `todayCallNoInfoCount` 計算ロジックのみに影響する。バグ2の修正は `gas/seller-sync-clean.gs` の `buildRowHash_()` またはハッシュキャッシュ管理ロジックのみに影響する。

## Hypothesized Root Cause

### バグ1の根本原因

1. **todayCallNoInfoCount の計算に除外ロジックがない**: 現在の実装では `todayCallNoInfoCount` は `filteredTodayCallSellers` のうち `hasInfo === false` の全件をカウントする。`todayCallNotStarted` の条件を満たす売主を除外する処理が存在しない。

2. **カテゴリー優先順位の未実装**: 「未着手」が最高優先順位を持つという仕様が `SellerSidebarCountsUpdateService` に実装されていない。各カテゴリーが独立して計算されており、排他制御がない。

3. **同一母集団からの派生計算**: `todayCall` と `todayCallNotStarted` は同じ `filteredTodayCallSellers` を起点として計算されるため、条件が重複する売主が両方にカウントされる。

### バグ2の根本原因

1. **ハッシュキャッシュの陳腐化**: `_seller_hashes` シートのキャッシュが何らかの理由（GASエラー、タイムアウト中断、手動編集等）で古い状態のまま残っている。スプレッドシートの実際の値と `buildRowHash_()` が生成するハッシュが一致してしまい、変更が検知されない。

2. **buildRowHash_() のフィールド漏れの可能性**: `buildRowHash_()` が参照するフィールドキーと、スプレッドシートの実際のヘッダー名に不一致がある可能性。`次電日` のキーが正しく参照されていない場合、次電日の変更がハッシュに反映されない。

3. **GAS実行中断によるキャッシュ不整合**: `syncUpdatesToSupabase_()` が時間制限（240秒）で中断された場合、処理済み分のハッシュのみ保存される。しかし中断前後でキャッシュの整合性が崩れる可能性がある。

## Correctness Properties

Property 1: Bug Condition - 未着手売主の排他カウント

_For any_ 売主において「未着手（todayCallNotStarted）」の条件が成立する（isBugCondition_sidebar returns true）場合、修正後の `SellerSidebarCountsUpdateService` は当該売主を `todayCallNotStarted` のみにカウントし、`todayCall`（`todayCallNoInfoCount`）からは除外する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非未着手売主のtodayCallカウント維持

_For any_ 売主において「未着手」の条件が成立しない（isBugCondition_sidebar returns false）場合、修正後のコードは修正前のコードと同一の結果を返し、`todayCall` カウントへの算入ロジックが変更されないことを保証する。

**Validates: Requirements 3.1, 3.2, 3.5**

Property 3: Bug Condition - GAS次電日変更の検知と反映

_For any_ スプレッドシートの次電日が変更された売主において（isBugCondition_gas returns true）、修正後のGASは次回10分トリガー実行時に当該変更を正しく検知し、Supabaseの `next_call_date` を更新する。

**Validates: Requirements 2.4, 2.5**

Property 4: Preservation - GAS差分なし時のスキップ維持

_For any_ スプレッドシートの行データに変更がない売主において（isBugCondition_gas returns false）、修正後のGASは修正前と同様に差分なしと判定してSupabaseへのPATCHをスキップする。

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を実施する：

---

**バグ1の修正**

**File**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**Function**: `updateSellerSidebarCounts()`

**Specific Changes**:

1. **todayCallNoInfoCount から未着手売主を除外**: `todayCallNoInfoCount` の計算において、`todayCallNotStarted` の条件を満たす売主を除外するフィルターを追加する。

   ```typescript
   // 修正前
   const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
     const hasInfo = ...;
     return !hasInfo;
   }).length;

   // 修正後
   const todayCallNoInfoCount = filteredTodayCallSellers.filter(s => {
     const hasInfo = ...;
     if (hasInfo) return false;
     // 未着手条件を満たす売主は todayCall から除外（todayCallNotStarted に含まれるため）
     const status = (s as any).status || '';
     const unreachable = (s as any).unreachable_status || '';
     const confidence = (s as any).confidence_level || '';
     const inquiryDate = (s as any).inquiry_date || '';
     const isNotStarted = status === '追客中' &&
       !unreachable &&
       confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
       inquiryDate >= '2026-01-01';
     return !isNotStarted;
   }).length;
   ```

---

**バグ2の修正**

**File**: `gas/seller-sync-clean.gs`

**Function**: `buildRowHash_()` および `syncUpdatesToSupabase_()`

**Specific Changes**:

2. **buildRowHash_() のフィールドキー確認**: `buildRowHash_()` の `keys` 配列に `'次電日'` が含まれていることを確認する（現在は含まれているが、スプレッドシートのヘッダー名と完全一致しているか検証）。

3. **ハッシュキャッシュ強制リセット（即時対応）**: `resetRowHashCache()` を手動実行して `_seller_hashes` シートをクリアし、次回同期で全件再同期させる。これにより AA13950 を含む全売主の次電日が正しくDBに反映される。

4. **キャッシュ不整合の根本対策（恒久対応）**: `syncUpdatesToSupabase_()` において、ハッシュが一致していてもSupabaseのDBと実際に乖離している場合を検知する仕組みを検討する。ただし全件DBチェックはパフォーマンス上の問題があるため、まずはキャッシュリセットによる即時対応を優先する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず修正前のコードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `SellerSidebarCountsUpdateService` のカウント計算ロジックをユニットテストで再現し、「未着手」条件を満たす売主が `todayCall` にも重複カウントされることを確認する。修正前のコードで実行してバグを観察する。

**Test Cases**:
1. **未着手売主の重複カウントテスト**: `status='追客中'`, `next_call_date <= today`, 連絡先情報なし, `unreachable_status=null`, `inquiry_date >= '2026-01-01'` の売主が `todayCall` と `todayCallNotStarted` の両方にカウントされることを確認（修正前は重複する）
2. **不通売主の単独カウントテスト**: `unreachable_status='不通'` の売主が `todayCall` のみにカウントされ `todayCallNotStarted` には含まれないことを確認（修正前後で変わらない）
3. **古い反響日付売主のテスト**: `inquiry_date='2025-12-31'` の売主が `todayCall` のみにカウントされることを確認（修正前後で変わらない）
4. **GASハッシュ検知テスト**: `buildRowHash_()` が `次電日` フィールドの変更を正しくハッシュに反映することを確認

**Expected Counterexamples**:
- 「未着手」条件を満たす売主が `todayCall` にも重複してカウントされる
- 可能性のある原因: `todayCallNoInfoCount` に除外ロジックがない、カテゴリー優先順位が未実装

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition_sidebar(seller) DO
  counts := updateSellerSidebarCounts_fixed(sellers)
  ASSERT seller IS IN counts.todayCallNotStarted
  ASSERT seller IS NOT IN counts.todayCall
END FOR

FOR ALL seller WHERE isBugCondition_gas(seller) DO
  syncUpdatesToSupabase_fixed(sheetRows)
  ASSERT supabase.next_call_date(seller) == sheet.next_call_date(seller)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して修正前と同一の結果が返されることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition_sidebar(seller) DO
  ASSERT updateSellerSidebarCounts_original(seller) = updateSellerSidebarCounts_fixed(seller)
END FOR

FOR ALL seller WHERE NOT isBugCondition_gas(seller) DO
  ASSERT syncUpdatesToSupabase_original(seller) = syncUpdatesToSupabase_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な売主データ（`status`, `unreachable_status`, `inquiry_date` の組み合わせ）を自動生成して検証できる
- 手動テストでは見落としがちなエッジケース（`inquiry_date` の境界値、`confidence_level` の各値等）を網羅できる
- 修正が非対象売主のカウントに影響しないことを強く保証できる

**Test Plan**: 修正前のコードで「未着手」条件を満たさない売主の `todayCall` カウント動作を観察し、修正後も同一動作であることをプロパティベーステストで検証する。

**Test Cases**:
1. **不通売主のtodayCallカウント保存テスト**: `unreachable_status` が設定された売主が修正後も `todayCall` にカウントされることを確認
2. **他決→追客売主のtodayCallカウント保存テスト**: `status='他決→追客'` の売主が修正後も `todayCall` にカウントされることを確認
3. **古い反響日付売主のtodayCallカウント保存テスト**: `inquiry_date < '2026-01-01'` の売主が修正後も `todayCall` にカウントされることを確認
4. **GAS差分なしスキップ保存テスト**: スプレッドシートに変更がない売主は修正後もPATCHがスキップされることを確認

### Unit Tests

- `todayCallNoInfoCount` の計算で「未着手」売主が除外されることを確認
- `todayCallNotStartedCount` の計算が修正後も正しい値を返すことを確認
- `buildRowHash_()` が `次電日` フィールドの変更を正しくハッシュに反映することを確認
- 「未着手」条件の境界値（`inquiry_date='2026-01-01'` vs `'2025-12-31'`）でカウントが正しく分岐することを確認

### Property-Based Tests

- ランダムな売主データを生成し、「未着手」条件を満たす売主が `todayCall` と `todayCallNotStarted` の両方にカウントされないことを検証（排他性）
- ランダムな売主データを生成し、全売主のカウント合計が修正前後で整合することを検証
- ランダムなスプレッドシート行データを生成し、`buildRowHash_()` が変更を正しく検知することを検証

### Integration Tests

- 修正後の `SellerSidebarCountsUpdateService` を実際のDBデータで実行し、`todayCall` と `todayCallNotStarted` の合計が修正前の `todayCall` と一致することを確認
- AA13950の次電日をスプレッドシートで更新後、`resetRowHashCache()` 実行 → `syncSellerList()` 実行 → DBの `next_call_date` が正しく更新されることを確認
- サイドバーのUIで「未着手」カウントと「当日TEL」カウントが正しく表示されることを確認
