# タスクリスト: business-list-sidebar-category-ui

## タスク

- [ ] 1. workTaskStatusUtils.ts の修正
  - [x] 1.1 `CATEGORY_GROUP_COLORS` 定数を追加する（プレフィックス→背景色マッピング）
  - [x] 1.2 `getCategoryGroupColor` 関数を追加・エクスポートする
  - [x] 1.3 `calculateTaskStatus` の「サイト依頼済み納品待ち」返却値に `site_registration_deadline` の M/D 形式日付を付加する

- [ ] 2. WorkTasksPage.tsx のサイドバーUI修正
  - [x] 2.1 `getCategoryGroupColor` を `workTaskStatusUtils` からインポートする
  - [x] 2.2 `ListItemButton` の `sx.bgcolor` を `getCategoryGroupColor(cat.label)` に変更する
  - [x] 2.3 締日超過（`isDeadlinePast`）の表現を背景色からテキスト色（`error.main`）に変更する

- [ ] 3. ユニットテストの作成
  - [x] 3.1 `getCategoryGroupColor` の各プレフィックスに対する期待色のテスト（example-based）
  - [x] 3.2 `getCategoryGroupColor('All')` が `undefined` を返すテスト
  - [x] 3.3 `calculateTaskStatus` が「サイト依頼済み納品待ち」条件で有効な締日付き文字列を返すテスト
  - [x] 3.4 `calculateTaskStatus` が「サイト依頼済み納品待ち」条件で無効な締日の場合に日付なし文字列を返すテスト
  - [x] 3.5 異なる締日を持つ複数タスクで `getStatusCategories` が複数エントリーを返すテスト

- [ ] 4. プロパティベーステストの作成（fast-check）
  - [x] 4.1 Property 1: 同じプレフィックスで始まる任意の文字列に対して `getCategoryGroupColor` が同じ色を返す（Feature: business-list-sidebar-category-ui, Property 1: グループ背景色の一貫性）
  - [x] 4.2 Property 2: 異なるカテゴリープレフィックスのペアに対して `getCategoryGroupColor` が異なる色を返す（Feature: business-list-sidebar-category-ui, Property 2: 異なるグループは異なる色）
  - [x] 4.3 Property 3: 有効な `site_registration_deadline` を持つ「サイト依頼済み納品待ち」条件タスクで返却値が `"サイト依頼済み納品待ち M/D"` フォーマットに一致する（Feature: business-list-sidebar-category-ui, Property 3: サイト依頼済み納品待ちの締日付きステータス文字列）
  - [x] 4.4 Property 4: 無効な `site_registration_deadline` を持つタスクで返却値が `"サイト依頼済み納品待ち"` のみになる（Feature: business-list-sidebar-category-ui, Property 4: 無効な締日の場合は日付なし）
  - [x] 4.5 Property 5: 過去日付を含むステータス文字列に対して `isDeadlinePast` が `true` になる（Feature: business-list-sidebar-category-ui, Property 5: 締日超過フラグの正確性）
