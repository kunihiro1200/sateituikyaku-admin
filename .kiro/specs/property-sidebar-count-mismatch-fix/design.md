# property-sidebar-count-mismatch-fix Bugfix Design

## Overview

物件リストの「未報告林」サイドバーカウント（3件）とリスト表示（4件）が一致しないバグの修正設計。

`PropertySidebarStatus.tsx` のカウント計算と `PropertyListingsPage.tsx` のフィルタリングで、
`calculatePropertyStatus` に渡す `workTaskMap` の有無・タイミングの違い、および
DBの `sidebar_status` カラムに残存する古い形式（`'未報告 林田'` スペースあり・フルネーム）の
二重カウント問題が原因で件数が食い違う。

修正方針：サイドバーカウントとリストフィルタリングで**完全に同一のロジック**を使用する。

## Glossary

- **Bug_Condition (C)**: `PropertySidebarStatus.tsx` のカウントと `PropertyListingsPage.tsx` のフィルタリング件数が一致しない状態
- **Property (P)**: サイドバーカウントをクリックしたとき、リスト表示件数がカウントと一致すること
- **Preservation**: 「未報告林」以外のカテゴリー（未完了・要値下げ・本日公開予定・専任公開中など）のカウントとフィルタリングが引き続き正しく動作すること
- **calculatePropertyStatus**: `propertyListingStatusUtils.ts` 内の関数。物件データと `workTaskMap` を受け取り、ステータスキーとラベルを返す
- **workTaskMap**: `work_tasks` テーブルから生成される `Map<string, Date | null>`。公開予定日の判定に使用
- **sidebar_status**: DBの `property_listings` テーブルのカラム。バックエンドで保存される文字列値
- **unreported**: `calculatePropertyStatus` が返すステータスキー。`report_date` が今日以前の物件

## Bug Details

### Bug Condition

バグは以下の3つの条件のいずれかが成立するときに発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(listing, workTaskMap_sidebar, workTaskMap_filter)
  INPUT: listing of type PropertyListing
         workTaskMap_sidebar: Map used in PropertySidebarStatus (may be undefined)
         workTaskMap_filter: Map used in PropertyListingsPage (always defined after load)
  OUTPUT: boolean

  // 条件1: workTaskMapの有無による判定差異
  IF workTaskMap_sidebar is undefined
     AND calculatePropertyStatus(listing, undefined).key == 'unreported'
     AND calculatePropertyStatus(listing, workTaskMap_filter).key == 'today_publish'
  THEN RETURN true

  // 条件2: sidebar_statusの古い形式による二重カウント
  IF listing.sidebar_status matches /^未報告\s+\S+/  // スペースあり・フルネーム形式
     AND calculatePropertyStatus(listing, workTaskMap_sidebar).key == 'unreported'
  THEN RETURN true

  // 条件3: sidebar_statusが'未報告林'形式でDBに保存済みだが
  //        calculatePropertyStatusでも'unreported'と判定される物件が
  //        PropertySidebarStatusでは1回しかカウントされないのに
  //        PropertyListingsPageでは別の条件でフィルタリングされる
  IF normalizedSidebarStatus(listing) != normalizedLabel(calculatePropertyStatus(listing, workTaskMap_filter))
     AND listing is counted in sidebar as '未報告林'
     AND listing is NOT matched in filter for '未報告林'
  THEN RETURN true

  RETURN false
END FUNCTION
```

### 具体的な不整合の発生箇所

**PropertySidebarStatus.tsx（カウント側）の処理フロー:**

```
listings.forEach(listing => {
  // ① sidebar_status === '専任・公開中' → 早期return（OK）
  
  // ② calculatePropertyStatus(listing, workTaskMap) を呼ぶ
  //    workTaskMapが空（業務依頼未取得）の場合:
  //    - today_publish判定がスキップされる
  //    - 本来'today_publish'になるべき物件が'unreported'として誤カウント
  
  // ③ computed.key === 'unreported' の場合:
  //    label = computed.label.replace(/\s+/g, '')  // 例: '未報告林'
  //    counts['未報告林']++
  //    return  ← ここで終了
  
  // ④ sidebar_statusが'未報告 林田'（古い形式）の物件:
  //    normalizedStatus.startsWith('未報告') → true → カウントされない（除外）
  //    しかし②でcalculatePropertyStatusが'unreported'を返せばカウントされる
  //    → 二重カウントの可能性あり
})
```

**PropertyListingsPage.tsx（フィルター側）の処理フロー:**

```
// sidebarStatus === '未報告林' の場合:
listings.filter(l => {
  const status = calculatePropertyStatus(l, workTaskMap);  // workTaskMapは常に渡す
  const normalizedLabel = status.label.replace(/\s+/g, '');
  const normalizedSidebar = '未報告林';
  return normalizedLabel === normalizedSidebar;
})
```

### Examples

- **例1（workTaskMap差異）**: `report_date = 今日`、`atbb_status = '一般・公開前'`、`publish_scheduled_date = 今日` の物件
  - サイドバー（workTaskMap未取得時）: `calculatePropertyStatus(listing, undefined)` → `unreported`（`today_publish`判定がスキップ）→「未報告林」にカウント
  - フィルター（workTaskMap取得後）: `calculatePropertyStatus(listing, workTaskMap)` → `today_publish`（優先度が高い）→「未報告林」にマッチしない
  - 結果: サイドバーは1件多くカウント

- **例2（古い形式のsidebar_status）**: `sidebar_status = '未報告 林田'`（スペースあり・フルネーム）の物件
  - サイドバー: `normalizedStatus.startsWith('未報告')` → true → sidebar_statusベースのカウントはスキップ
  - `calculatePropertyStatus` が `unreported` を返す場合 → `counts['未報告林']++`（カウントされる）
  - フィルター: `calculatePropertyStatus(l, workTaskMap).label.replace(/\s+/g, '')` → `'未報告林'` → マッチする
  - 結果: この例では一致するが、`report_date` が将来日付の場合は `calculatePropertyStatus` が `unreported` を返さず、サイドバーはカウントしないがフィルターも除外するため一致する

- **例3（最も重要なケース）**: `sidebar_status = '未報告林'`（正しい形式）かつ `report_date = null` の物件
  - サイドバー: `calculatePropertyStatus` → `report_date = null` なので `unreported` を返さない → `sidebar_status = '未報告林'` でカウント（`normalizedStatus.startsWith('未報告')` → true → **除外される！**）
  - フィルター: `calculatePropertyStatus(l, workTaskMap).label` → `unreported` でない → マッチしない
  - 結果: サイドバーはカウントしない、フィルターもマッチしない → 一致するが、**sidebar_statusが'未報告林'でreport_dateがnullの物件は永遠にどこにも表示されない**

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「未完了」カテゴリー（`confirmation === '未'`）のカウントとフィルタリングは引き続き正しく動作する
- 「要値下げ」カテゴリーのカウントとフィルタリングは引き続き正しく動作する
- 「本日公開予定」カテゴリーのカウントとフィルタリングは引き続き正しく動作する
- 担当者別専任公開中（`'Y専任公開中'`、`'林・専任公開中'` など）のカウントとフィルタリングは引き続き正しく動作する
- 「未報告」カテゴリーの物件行をクリックすると報告ページへ直接遷移する動作は変わらない
- `sidebar_status` が正しい形式（`'未報告林'` スペースなし・イニシャル）で保存されている物件は引き続き正しくカウントされる

**Scope:**
「未報告」系カテゴリー以外のすべての入力はこの修正の影響を受けない。具体的には：
- マウスクリックによるボタン操作
- 検索クエリによるフィルタリング
- ページネーション
- 物件詳細モーダルの表示

## Hypothesized Root Cause

コードを詳細に分析した結果、以下の根本原因を特定した：

1. **workTaskMapのタイミング差異（最有力）**: `PropertySidebarStatus.tsx` は `workTaskMap` を props として受け取るが、`PropertyListingsPage.tsx` では `workTasks` の取得が `allListings` の取得より後に行われる（`fetchAllData` 内で `allListings` を先に取得し、その後 `workTasksRes` を取得）。そのため、最初のレンダリング時に `PropertySidebarStatus` に渡される `workTaskMap` が空の状態で `statusCounts` が計算される。一方、フィルタリングは `workTaskMap` が揃った後に実行されるため、`today_publish` 判定の結果が異なる。
   - `PropertyListingsPage.tsx` の `fetchAllData` を確認すると、`workTasksRes` の取得は `while (hasMore)` ループの**後**に行われている
   - つまり、物件データが全件取得された後に業務依頼データが取得される
   - この間、`workTaskMap` は空の `Map` であり、`today_publish` 判定がスキップされる

2. **PropertySidebarStatusのstatusCountsロジックの複雑さ**: `PropertySidebarStatus.tsx` の `statusCounts` 計算は、`calculatePropertyStatus` の結果と `sidebar_status` の値を組み合わせた複雑なロジックになっている。特に「未報告」系の処理で、`calculatePropertyStatus` が `unreported` を返した場合は `return` で早期終了するが、`sidebar_status` が `'未報告林'` の物件で `calculatePropertyStatus` が `unreported` を返さない場合（`report_date` が null など）は `normalizedStatus.startsWith('未報告')` チェックで除外されてカウントされない。

3. **DBの sidebar_status に古い形式が残存している可能性**: バックエンドの `PropertyListingService.ts` の `update` メソッドを確認すると、`report_date` 更新時に `sidebar_status` を `'未報告${assigneeInitial}'` 形式（スペースなし・イニシャル）で保存している。しかし、過去に `'未報告 林田'`（スペースあり・フルネーム）で保存されたデータが残っている可能性がある。このデータは `calculatePropertyStatus` では `report_date` が null または将来日付の場合 `unreported` を返さないため、サイドバーカウントに含まれない。

## Correctness Properties

Property 1: Bug Condition - 未報告カテゴリーのカウントとフィルタリングの一致

_For any_ 物件リストと `workTaskMap` の組み合わせにおいて、バグ条件が成立する（サイドバーカウントとフィルタリング件数が一致しない）場合、修正後の `PropertySidebarStatus.tsx` の `statusCounts['未報告林']` は `PropertyListingsPage.tsx` の `filteredListings.length`（`sidebarStatus === '未報告林'` 時）と**完全に一致する**。

**Validates: Requirements 2.3, 2.4**

Property 2: Preservation - 未報告以外のカテゴリーの動作保持

_For any_ 物件リストと `workTaskMap` の組み合わせにおいて、バグ条件が成立しない（「未報告林」以外のカテゴリーを操作する）場合、修正後のコードは修正前のコードと**完全に同一の結果**を返し、「未完了」「要値下げ」「本日公開予定」「専任公開中」などのカテゴリーのカウントとフィルタリングが変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を行う：

**File**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**Function**: `statusCounts` useMemo

**Specific Changes**:

1. **「未報告」カウントロジックの統一**: `PropertyListingsPage.tsx` のフィルタリングと完全に同一のロジックを使用する。具体的には、`calculatePropertyStatus(listing, workTaskMap)` の結果のみを使用し、`sidebar_status` の値に依存しない。

   ```typescript
   // 変更前（複雑なロジック）
   const computed = calculatePropertyStatus(listing as any, workTaskMap);
   if (computed.key === 'unreported') {
     const label = computed.label.replace(/\s+/g, '');
     counts[label] = (counts[label] || 0) + 1;
     return;
   }
   // ...
   if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
     counts[status] = (counts[status] || 0) + 1;
   }
   
   // 変更後（シンプルなロジック）
   const computed = calculatePropertyStatus(listing as any, workTaskMap);
   if (computed.key === 'unreported') {
     const label = computed.label.replace(/\s+/g, '');
     counts[label] = (counts[label] || 0) + 1;
     return;
   }
   // sidebar_statusが'未報告'系の場合はcalculatePropertyStatusで判定済みなのでスキップ
   // （calculatePropertyStatusがunreportedを返さなかった場合は未報告ではない）
   if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
     counts[status] = (counts[status] || 0) + 1;
   }
   // ← このロジック自体は変わらないが、workTaskMapが正しく渡されることで
   //   today_publishが正しく判定されるようになる
   ```

2. **workTaskMapの依存関係の明確化**: `statusCounts` の useMemo の依存配列に `workTaskMap` が含まれていることを確認する（現在は含まれているが、`workTaskMap` が空の状態で計算されることが問題）。

3. **isLoadingAll フラグの活用**: `PropertyListingsPage.tsx` では `isLoadingAll` フラグで全件取得完了を管理している。`workTaskMap` が空の間はサイドバーカウントの「未報告」系を暫定表示するか、`workTasks` の取得完了を待ってから計算する。

   **推奨アプローチ**: `PropertySidebarStatus` に `isWorkTaskMapReady` prop を追加し、`workTaskMap.size > 0` または `workTasks` 取得完了フラグを渡す。ただし、これは大きな変更になるため、より小さな修正として以下を検討：

4. **workTasksの取得タイミングの改善（代替案）**: `PropertyListingsPage.tsx` の `fetchAllData` で、`workTasks` の取得を `allListings` の最初のバッチ取得直後に移動する。これにより、サイドバーが最初にレンダリングされる時点で `workTaskMap` が利用可能になる。

   ```typescript
   // 変更前: while ループの後に workTasks を取得
   while (hasMore) { ... }
   const workTasksRes = await api.get('/api/work-tasks');
   
   // 変更後: 最初のバッチ取得後すぐに workTasks を取得
   // 最初のバッチを取得
   const firstBatchRes = await api.get('/api/property-listings', { params: { limit, offset: 0 } });
   setAllListings(firstBatchRes.data.data);
   setLoading(false);
   
   // workTasksを並行して取得（残りの物件データと同時）
   const [remainingListings, workTasksRes] = await Promise.all([
     fetchRemainingListings(),
     api.get('/api/work-tasks')
   ]);
   ```

**File**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Function**: `fetchAllData`

**Specific Changes**:

5. **workTasksの取得を早期化**: 最初のバッチ取得後、残りの物件データと並行して `workTasks` を取得する。これにより、サイドバーが最初にレンダリングされる時点で `workTaskMap` が利用可能になる可能性が高まる。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: `workTaskMap` が空の状態と取得済みの状態で `calculatePropertyStatus` を呼び出し、結果の差異を確認する。

**Test Cases**:
1. **workTaskMap空でのtoday_publish物件テスト**: `report_date = 今日`、`atbb_status = '一般・公開前'`、`publish_scheduled_date = 今日` の物件に対して `calculatePropertyStatus(listing, undefined)` と `calculatePropertyStatus(listing, workTaskMap)` を呼び出し、結果が異なることを確認（未修正コードで失敗するはず）
2. **サイドバーカウントとフィルタリングの不一致テスト**: 上記の物件を含むリストで `PropertySidebarStatus` のカウントと `PropertyListingsPage` のフィルタリング件数を比較（未修正コードで失敗するはず）
3. **古い形式のsidebar_statusテスト**: `sidebar_status = '未報告 林田'`（スペースあり）の物件がカウントとフィルタリングで同一に扱われることを確認
4. **report_date=nullのsidebar_status='未報告林'テスト**: このような物件がカウントもフィルタリングもされないことを確認（エッジケース）

**Expected Counterexamples**:
- `workTaskMap` が空の状態でサイドバーカウントが計算されると、`today_publish` になるべき物件が `unreported` としてカウントされる
- 可能性のある原因: `fetchAllData` での `workTasks` 取得タイミング、`workTaskMap` の初期値が空の `Map`

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE isBugCondition(listing, workTaskMap_empty, workTaskMap_full) DO
  sidebarCount := countUnreported_fixed(listings, workTaskMap_full)
  filterCount := filterUnreported_fixed(listings, workTaskMap_full)
  ASSERT sidebarCount == filterCount
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE NOT isBugCondition(listing, workTaskMap, workTaskMap) DO
  ASSERT countStatus_original(listing, workTaskMap) == countStatus_fixed(listing, workTaskMap)
  ASSERT filterStatus_original(listing, workTaskMap) == filterStatus_fixed(listing, workTaskMap)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な `report_date`、`atbb_status`、`sidebar_status` の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケース（`report_date = null`、`workTaskMap` に存在しない物件番号など）を網羅できる
- 修正前後の動作が一致することを強力に保証できる

**Test Plan**: 未修正コードで「未完了」「要値下げ」「専任公開中」などのカテゴリーの動作を観察し、修正後も同一であることを確認する。

**Test Cases**:
1. **未完了カテゴリー保持テスト**: `confirmation === '未'` の物件のカウントとフィルタリングが修正前後で一致することを確認
2. **要値下げカテゴリー保持テスト**: `price_reduction_scheduled_date <= 今日` の物件のカウントとフィルタリングが修正前後で一致することを確認
3. **専任公開中カテゴリー保持テスト**: `sidebar_status === '専任・公開中'` の物件の担当者別カウントが修正前後で一致することを確認
4. **本日公開予定カテゴリー保持テスト**: `workTaskMap` が正常に取得されている状態での `today_publish` 判定が修正前後で一致することを確認

### Unit Tests

- `calculatePropertyStatus` に `workTaskMap = undefined` と `workTaskMap = new Map(...)` を渡した場合の結果差異テスト
- `PropertySidebarStatus` の `statusCounts` 計算で `workTaskMap` が空の場合と取得済みの場合の差異テスト
- `sidebar_status = '未報告 林田'`（古い形式）の物件のカウント処理テスト
- `report_date = null` かつ `sidebar_status = '未報告林'` の物件の処理テスト

### Property-Based Tests

- ランダムな `report_date`（null、過去、今日、未来）と `workTaskMap` の組み合わせで、サイドバーカウントとフィルタリング件数が常に一致することを検証
- ランダムな `sidebar_status`（正しい形式・古い形式・null）の物件リストで、「未報告」系カテゴリーのカウントとフィルタリングが一致することを検証
- 「未報告」以外のカテゴリー（未完了・要値下げ・専任公開中）について、修正前後でカウントとフィルタリングが変わらないことを検証

### Integration Tests

- `PropertyListingsPage` の初期ロード時（`workTasks` 未取得）から取得完了後にかけて、サイドバーカウントが正しく更新されることを確認
- 「未報告林」をクリックしてリスト表示に切り替えたとき、件数がサイドバーカウントと一致することを確認
- 「未報告林」カテゴリーの物件行をクリックすると報告ページへ遷移することを確認
