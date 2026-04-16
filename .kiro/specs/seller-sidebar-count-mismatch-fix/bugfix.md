# Bugfix Requirements Document

## Introduction

物件リスト（売主管理システム）のサイドバーにおいて、「未報告林」カテゴリのカウントが **3件** と表示されているにもかかわらず、クリックして表示されるリストには **4件**（AA9729、AA13020、AA13122、AA12853）が表示されるという不一致が発生している。

調査の結果、根本原因は `frontend/frontend/src/utils/propertyListingStatusUtils.ts` の `getAssigneeInitial()` 関数内の `initialMap` に「林田」のマッピングが存在しないことである。

- **サイドバーカウント計算時**（`PropertySidebarStatus.tsx`）：`calculatePropertyStatus()` を呼び出し、`computed.label.replace(/\s+/g, '')` でスペースを除去してカウントする。`report_assignee === '林田'` の場合、`initialMap` にマッピングがないため `getAssigneeInitial('林田')` は `'林田'` をそのまま返し、ラベルは `'未報告林田'` となる。スペース除去後も `'未報告林田'` のままカウントされる。
- **リストフィルタリング時**（`PropertyListingsPage.tsx`）：`sidebarStatus.startsWith('未報告')` の条件で `calculatePropertyStatus()` を呼び出し、`normalizedStatusLabel === normalizedSidebarStatus` で比較する。サイドバーのキーが `'未報告林'`（スペース除去後）であるのに対し、フィルター側のラベルは `'未報告林田'` となるため、**本来マッチすべき物件がマッチしない**、または逆に余分な物件がマッチするという不整合が生じる。

つまり、カウントとフィルターで異なるラベル文字列が生成されることにより、表示件数の不一致が発生している。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `report_assignee` が `'林田'` の物件が存在する THEN `getAssigneeInitial('林田')` は `initialMap` にマッピングがないため `'林田'` をそのまま返し、ラベルが `'未報告林田'` となる

1.2 WHEN サイドバーカウント計算時に `'未報告林田'` ラベルの物件をカウントする THEN スペース除去後も `'未報告林田'` のままカウントされ、サイドバーには `'未報告林'` ではなく `'未報告林田'` として集計される（または `'未報告林'` と `'未報告林田'` が別カテゴリとして混在する）

1.3 WHEN ユーザーがサイドバーの `'未報告林'` をクリックしてリストをフィルタリングする THEN フィルター側のラベル `'未報告林田'` とサイドバーキー `'未報告林'` が一致せず、カウントと表示件数が異なる

### Expected Behavior (Correct)

2.1 WHEN `report_assignee` が `'林田'` の物件が存在する THEN `getAssigneeInitial('林田')` は `'林'` を返し、ラベルが `'未報告林'` となる

2.2 WHEN サイドバーカウント計算時に `'未報告林'` ラベルの物件をカウントする THEN スペース除去後 `'未報告林'` としてカウントされ、サイドバーに正しい件数が表示される

2.3 WHEN ユーザーがサイドバーの `'未報告林'` をクリックしてリストをフィルタリングする THEN フィルター側のラベル `'未報告林'` とサイドバーキー `'未報告林'` が一致し、カウントと表示件数が一致する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `report_assignee` が `'山本'`、`'生野'`、`'久'`、`'裏'`、`'林'`、`'国広'`、`'木村'`、`'角井'` のいずれかである THEN システムは SHALL CONTINUE TO 既存のイニシャル変換（Y、生、久、U、林、K、R、I）を正しく行う

3.2 WHEN `report_assignee` が `null` または空文字列である THEN システムは SHALL CONTINUE TO イニシャルなしの `'未報告'` ラベルを返す

3.3 WHEN `report_assignee` が `initialMap` に存在しない未知の担当者名である THEN システムは SHALL CONTINUE TO 担当者名をそのまま返す（フォールバック動作）

3.4 WHEN 「未報告林」以外のサイドバーカテゴリ（要値下げ、未完了、非公開予定、買付申込み、公開前情報、非公開、一般公開中物件など）をクリックする THEN システムは SHALL CONTINUE TO 正しい件数のリストを表示する

---

## Bug Condition（バグ条件の定式化）

**バグ条件関数**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListing
  OUTPUT: boolean

  RETURN X.report_assignee = '林田'
    AND X.report_date IS NOT NULL
    AND X.report_date <= today
END FUNCTION
```

**修正チェックプロパティ**:
```pascal
// Property: Fix Checking - 林田担当者の未報告ラベル正規化
FOR ALL X WHERE isBugCondition(X) DO
  result ← calculatePropertyStatus'(X)
  ASSERT result.key = 'unreported'
    AND result.label.replace(/\s+/g, '') = '未報告林'
END FOR
```

**保存プロパティ**:
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT calculatePropertyStatus(X) = calculatePropertyStatus'(X)
END FOR
```
