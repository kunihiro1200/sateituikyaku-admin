# 実装計画: 売主サイドバー担当者階層表示

## 概要

`SellerStatusSidebar.tsx` の `renderAssigneeCategories()` を修正し、担当者別カテゴリを階層構造（親カテゴリ：緑バッジ、サブアイテム：オレンジバッジ＋インデント）で表示する。

## タスク

- [x] 1. `renderAssigneeCategories()` の表示ロジックを変更する
  - `visitAssigned:${assignee}` の親カテゴリボタンのバッジ色を `#ff5722` から `#4caf50`（緑）に変更する
  - 親カテゴリのラベルを `担当（${assignee}）` から `担当(${assignee})` に統一する（要件1.1）
  - サブアイテムのラベルを `当日TEL(${assignee})` から `↳ 当日TEL(${assignee})` に変更する（要件2.1）
  - サブアイテムの `Box` に `pl: 2` のインデントを付与する（要件2.2）
  - サブアイテムのバッジ色は `#ff5722`（オレンジ）のまま維持する（要件2.3）
  - `getCategoryColor()` の `visitAssigned:` ケースを `#4caf50` に変更する
  - `getCategoryLabel()` の `visitAssigned:` ケースのラベルを `担当(${...})` に統一する
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [ ]* 1.1 `renderAssigneeCategories()` のユニットテストを書く
    - 親カテゴリのバッジ色が `#4caf50` であることを確認
    - サブアイテムのラベルが `↳ 当日TEL(${assignee})` 形式であることを確認
    - サブアイテムに左インデント（`pl: 2`）が付いていることを確認
    - 既存カテゴリ（`visitDayBefore`、`todayCall` など）の表示が変わらないことを確認
    - 担当者別セクションが区切り線付きで既存カテゴリの下部に表示されることを確認
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.1, 4.2_

- [ ] 2. プロパティベーステストを実装する
  - [ ]* 2.1 Property 1 のプロパティテストを書く
    - **Property 1: 両カウントが0の担当者は非表示**
    - **Validates: Requirements 1.3**

  - [ ]* 2.2 Property 2 のプロパティテストを書く
    - **Property 2: todayCallAssignedCounts とサブアイテム表示の双方向性**
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 2.3 Property 3 のプロパティテストを書く
    - **Property 3: クリック時のカテゴリキー正確性**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 2.4 Property 4 のプロパティテストを書く
    - **Property 4: assigneeInitials の順序保持**
    - **Validates: Requirements 1.4**

  - [ ]* 2.5 Property 5 のプロパティテストを書く
    - **Property 5: assigneeInitials 空時のフォールバック**
    - **Validates: Requirements 4.3**

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- 変更対象は `frontend/frontend/src/components/SellerStatusSidebar.tsx` のみ
- `sellerStatusFilters.ts` は変更しない
- カテゴリキー（`visitAssigned:${assignee}` / `todayCallAssigned:${assignee}`）は変更しない
- デプロイは `git push origin main` で自動デプロイされる
