# 要件ドキュメント

## はじめに

買主リストのサイドバーカテゴリーに「次電日空欄」サブカテゴリーを追加する機能。
「担当（）」カテゴリーの配下に、既存の「当日TEL（）」と並列で表示される。

対象買主の条件は以下のAND条件：
- ★最新状況が「A」または「B」で始まるが、「AZ」「BZ」は除外
- ★次電日（next_call_date）が空欄（NULL）
- 業者問合せ（broker_inquiry）が空欄
- 後続担当（follow_up_assignee）が入力済み（空欄でない）

## 用語集

- **BuyerStatusSidebar**: 買主リストページの左側に表示されるサイドバーコンポーネント（`frontend/frontend/src/components/BuyerStatusSidebar.tsx`）
- **SidebarCountsUpdateService**: 買主サイドバーカウントを差分更新するサービス（`backend/src/services/SidebarCountsUpdateService.ts`）
- **BuyerService**: 買主データの取得・更新を担当するサービス（`backend/src/services/BuyerService.ts`）
- **buyer_sidebar_counts**: サイドバーカウントを高速取得するためのキャッシュテーブル
- **nextCallDateBlank**: 本機能で追加する新カテゴリーのキー名
- **follow_up_assignee**: 後続担当フィールド（DBカラム名）
- **next_call_date**: 次電日フィールド（DBカラム名）
- **broker_inquiry**: 業者問合せフィールド（DBカラム名）
- **latest_status**: ★最新状況フィールド（DBカラム名）
- **ステータスA**: `A:この物件を気に入っている（こちらからの一押しが必要）`
- **ステータスB**: `B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。`
- **ステータスAZ**: `AZ:Aだが次電日不要`（除外対象）
- **ステータスBZ**: `BZ：Bだが次電日不要`（除外対象）

## 要件

### 要件1: 次電日空欄カテゴリーのフィルター条件

**ユーザーストーリー:** 担当者として、次電日が未設定のA/B状況の買主を一覧で確認したい。そうすることで、フォローアップが必要な買主を見落とさずに対応できる。

#### 受け入れ基準

1. THE System SHALL 以下の全条件を満たす買主を「次電日空欄」カテゴリーの対象とする：
   - `latest_status` が `A:この物件を気に入っている（こちらからの一押しが必要）` または `B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。` のいずれかに完全一致する（`AZ:Aだが次電日不要` および `BZ：Bだが次電日不要` は含まない）
   - `next_call_date` が NULL（空欄）である
   - `broker_inquiry` が NULL または空文字（空欄）である
   - `follow_up_assignee` が NULL でも空文字でもない（入力済みである）

2. WHEN `latest_status` が ステータスA でも ステータスB でもない場合、THE System SHALL その買主を「次電日空欄」カテゴリーの対象から除外する

2a. WHEN `latest_status` が `AZ:Aだが次電日不要` または `BZ：Bだが次電日不要` の場合、THE System SHALL その買主を「次電日空欄」カテゴリーの対象から除外する（次電日不要と明示されているため）

3. WHEN `next_call_date` に値が設定されている場合、THE System SHALL その買主を「次電日空欄」カテゴリーの対象から除外する

4. WHEN `broker_inquiry` に値が設定されている場合、THE System SHALL その買主を「次電日空欄」カテゴリーの対象から除外する

5. WHEN `follow_up_assignee` が NULL または空文字の場合、THE System SHALL その買主を「次電日空欄」カテゴリーの対象から除外する

### 要件2: サイドバーUIへの表示

**ユーザーストーリー:** 担当者として、サイドバーの「担当（）」カテゴリー配下に「次電日空欄」サブカテゴリーを確認したい。そうすることで、担当別に次電日未設定の買主数を把握できる。

#### 受け入れ基準

1. THE BuyerStatusSidebar SHALL 「次電日空欄」カテゴリーを「担当（イニシャル）」のサブカテゴリーとして表示する

2. WHEN 「次電日空欄」カテゴリーの対象件数が1件以上の場合、THE BuyerStatusSidebar SHALL 「担当（イニシャル）」の直下に「↳ 次電日空欄(イニシャル)」として表示する

3. WHEN 「次電日空欄」カテゴリーの対象件数が0件の場合、THE BuyerStatusSidebar SHALL そのイニシャルの「次電日空欄」サブカテゴリーを表示しない

4. THE BuyerStatusSidebar SHALL 「次電日空欄」サブカテゴリーを「当日TEL(イニシャル)」サブカテゴリーの直後に表示する

5. THE BuyerStatusSidebar SHALL 「次電日空欄」サブカテゴリーのバッジに対象件数を表示する

6. THE BuyerStatusSidebar SHALL 「次電日空欄」サブカテゴリーを赤字（`#d32f2f`）で表示する

### 要件3: サイドバーカウントのキャッシュ管理

**ユーザーストーリー:** システム管理者として、「次電日空欄」カテゴリーのカウントが `buyer_sidebar_counts` テーブルに正しく保存・更新されることを確認したい。そうすることで、サイドバーの高速表示が維持される。

#### 受け入れ基準

1. THE SidebarCountsUpdateService SHALL `determineBuyerCategories()` メソッドで「次電日空欄」条件を判定し、`nextCallDateBlank` カテゴリーを返す

2. WHEN 買主データが更新され `latest_status`、`next_call_date`、`broker_inquiry`、または `follow_up_assignee` が変更された場合、THE SidebarCountsUpdateService SHALL `buyer_sidebar_counts` テーブルの `nextCallDateBlank` カテゴリーのカウントを差分更新する

3. THE BuyerService SHALL `getSidebarCounts()` メソッドで `buyer_sidebar_counts` テーブルから `nextCallDateBlank` カテゴリーのカウントを読み込み、`categoryCounts.nextCallDateBlankCounts` として返す

4. THE BuyerService SHALL `shouldUpdateBuyerSidebarCounts()` メソッドのトリガーフィールドに `latest_status` を追加する

5. IF `buyer_sidebar_counts` テーブルが空の場合、THEN THE BuyerService SHALL フォールバック計算で `nextCallDateBlank` カテゴリーのカウントを計算する

### 要件4: 一覧フィルタリング機能

**ユーザーストーリー:** 担当者として、「次電日空欄」カテゴリーをクリックしたとき、条件に合致する買主のみが一覧に表示されることを確認したい。そうすることで、対象買主に絞って作業できる。

#### 受け入れ基準

1. WHEN ユーザーが「次電日空欄(イニシャル)」カテゴリーをクリックした場合、THE BuyerService SHALL `follow_up_assignee` が指定イニシャルに一致し、かつ要件1の全条件を満たす買主のみを返す

2. THE BuyerService SHALL `statusCategory` パラメーターとして `nextCallDateBlank:イニシャル` 形式の動的カテゴリーを処理できる

3. WHEN `nextCallDateBlank:イニシャル` カテゴリーでフィルタリングする場合、THE BuyerService SHALL `latest_status` の完全一致チェック（ステータスA または ステータスB）を適用する

4. WHEN `nextCallDateBlank:イニシャル` カテゴリーでフィルタリングする場合、THE BuyerService SHALL `next_call_date` が NULL であることを確認する

5. WHEN `nextCallDateBlank:イニシャル` カテゴリーでフィルタリングする場合、THE BuyerService SHALL `broker_inquiry` が NULL または空文字であることを確認する
