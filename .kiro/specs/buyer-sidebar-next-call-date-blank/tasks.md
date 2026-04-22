# 実装計画: 買主リストサイドバー「次電日空欄」カテゴリー追加

## 概要

既存の `todayCallAssigned` カテゴリーと同じパターンで `nextCallDateBlank` カテゴリーを追加する。
変更対象は3ファイル（SidebarCountsUpdateService.ts、BuyerService.ts、BuyerStatusSidebar.tsx）。

## タスク

- [x] 1. SidebarCountsUpdateService.ts の更新
  - [x] 1.1 `determineBuyerCategories()` に `nextCallDateBlank` 条件判定を追加
    - `todayCallAssigned` 判定の直後に追加
    - 条件: `latest_status` がステータスA/Bに完全一致（AZ・BZ除外）AND `next_call_date` NULL AND `broker_inquiry` NULL/空文字 AND `follow_up_assignee` 入力済み
    - 条件を満たす場合 `{ category: 'nextCallDateBlank', assignee: buyer.follow_up_assignee }` を `categories` に追加
    - _Requirements: 1.1, 1.2, 1.2a, 1.3, 1.4, 1.5, 3.1_

  - [ ]* 1.2 `determineBuyerCategories()` のプロパティテストを作成
    - **Property 1: nextCallDateBlank 条件判定の正確性**
    - fast-check を使用し、任意の買主データに対して `nextCallDateBlank` カテゴリーが返るのは4条件全てを満たす場合に限ることを検証
    - **Validates: Requirements 1.1, 1.2, 1.2a, 1.3, 1.4, 1.5, 3.1**

- [-] 2. BuyerService.ts の更新
  - [x] 2.1 `shouldUpdateBuyerSidebarCounts()` に `latest_status`・`broker_inquiry` を追加
    - `sidebarFields` 配列に `'latest_status'` と `'broker_inquiry'` を追加
    - _Requirements: 3.2, 3.4_

  - [x] 2.2 `getSidebarCounts()` に `nextCallDateBlankCounts` の読み込みを追加
    - `categoryCounts` 初期化に `nextCallDateBlankCounts: {} as Record<string, number>` を追加
    - `for (const row of data)` ループに `row.category === 'nextCallDateBlank'` の分岐を追加
    - _Requirements: 3.3_

  - [x] 2.3 `getSidebarCountsFallback()` に `nextCallDateBlank` の動的計算を追加
    - `result` 初期化に `nextCallDateBlankCounts: {} as Record<string, number>` を追加
    - `allBuyers.forEach` ループ内に4条件チェックと `follow_up_assignee` キーでのカウント集計を追加
    - _Requirements: 3.5_

  - [ ]* 2.4 `getSidebarCountsFallback()` のプロパティテストを作成
    - **Property 2: フォールバック計算の一貫性**
    - 任意の買主データセットに対して `nextCallDateBlankCounts` の各イニシャルのカウントが条件を満たす買主数と等しいことを検証
    - **Validates: Requirements 3.5**

  - [x] 2.5 `getAll()` に `nextCallDateBlank:イニシャル` フィルタリングを追加
    - `default` ブロック内の動的カテゴリー処理に `dynamicCategory.startsWith('nextCallDateBlank:')` の分岐を追加
    - `follow_up_assignee` 完全一致、`latest_status` IN チェック（ステータスA/B）、`next_call_date` IS NULL、`broker_inquiry` IS NULL OR 空文字 のクエリを構築
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. チェックポイント — 全テストが通ることを確認
  - バックエンドのビルドエラーがないことを確認し、疑問点があればユーザーに確認する。

- [-] 4. BuyerStatusSidebar.tsx の更新
  - [x] 4.1 `CategoryCounts` インターフェースに `nextCallDateBlankCounts` を追加
    - `nextCallDateBlankCounts?: Record<string, number>` を追加
    - _Requirements: 2.1_

  - [x] 4.2 `getCategoryColor()` に `nextCallDateBlank` ケースを追加
    - `case 'nextCallDateBlank':` で `'#d32f2f'` を返す
    - `category.startsWith('nextCallDateBlank:')` の場合も `'#d32f2f'` を返す
    - _Requirements: 2.6_

  - [x] 4.3 `getCategoryLabel()` に `nextCallDateBlank` ケースを追加
    - `case 'nextCallDateBlank':` で `'次電日空欄'` を返す
    - `category.startsWith('nextCallDateBlank:')` の場合は `次電日空欄(${イニシャル})` を返す
    - _Requirements: 2.1, 2.2_

  - [x] 4.4 担当別ループ内で `todayCallAssigned` の直後に「次電日空欄」サブカテゴリーを追加
    - `categoryCounts.nextCallDateBlankCounts?.[assignee] ?? 0` でカウントを取得
    - カウントが1以上の場合のみ `categoryList` に `{ key: 'nextCallDateBlank:${assignee}', label: '次電日空欄(${assignee})', count, color: '#d32f2f', isSubCategory: true, parentKey: key }` を追加
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 4.5 `renderCategoryItem` で `nextCallDateBlank:` カテゴリーの赤字・太字表示を適用
    - `isNextCallDateBlankCategory` 変数を追加（`category.key.startsWith('nextCallDateBlank:')` で判定）
    - `primaryTypographyProps` の `color` と `fontWeight` の判定に `isNextCallDateBlankCategory` を追加
    - _Requirements: 2.6_

  - [ ]* 4.6 サイドバー表示順序のプロパティテストを作成
    - **Property 3: サイドバー表示順序の保証**
    - 任意のイニシャルに対して `nextCallDateBlank:イニシャル` が `todayCallAssigned:イニシャル` の直後に配置されることを検証
    - **Validates: Requirements 2.2, 2.4**

- [x] 5. 最終チェックポイント — 全テストが通ることを確認
  - フロントエンド・バックエンド両方のビルドエラーがないことを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きタスクはオプション（スキップ可能）
- 各タスクは要件番号でトレーサビリティを確保
- プロパティテストには fast-check（TypeScript）を使用
- デプロイ（git commit & push、Vercel確認）はこのタスクリストの対象外
