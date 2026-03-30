# 要件ドキュメント

## はじめに

売主リストのサイドバーにある「当日TEL（担当）」カテゴリの表示を、買主リストと同様の階層表示に変更する機能です。

現在は「当日TEL(I)」「当日TEL(T)」「当日TEL(U)」「当日TEL(Y)」「当日TEL(林)」が独立したカテゴリとして並んでいますが、担当者ごとの親カテゴリ（緑色バッジ）の下に当日TELをサブアイテム（オレンジ色バッジ）として表示する階層構造に変更します。

## 用語集

- **SellerStatusSidebar**: 売主リストページのサイドバーコンポーネント（`SellerStatusSidebar.tsx`）
- **visitAssignee**: 営担（営業担当者）のイニシャル。売主データの `visitAssigneeInitials` / `visit_assignee` フィールド
- **visitAssignedCounts**: APIから取得した担当者別の全件カウント（`CategoryCounts.visitAssignedCounts`）
- **todayCallAssignedCounts**: APIから取得した担当者別の当日TELカウント（`CategoryCounts.todayCallAssignedCounts`）
- **親カテゴリ**: 担当者ごとの「担当(Y)」「担当(I)」などのカテゴリ行
- **サブアイテム**: 親カテゴリの下に表示される「↳ 当日TEL(Y)」などのインデント付き行
- **assigneeInitials**: スタッフイニシャル一覧（`SellerStatusSidebarProps.assigneeInitials`）

## 要件

### 要件1: 担当者別親カテゴリの表示

**ユーザーストーリー:** 売主リストの担当者として、自分の担当売主数を一目で確認したい。そのため、担当者ごとの親カテゴリを緑色バッジ付きで表示してほしい。

#### 受け入れ基準

1. THE SellerStatusSidebar SHALL 担当者別セクションに各担当者の「担当(イニシャル)」形式の親カテゴリを表示する
2. WHEN `visitAssignedCounts` に担当者のカウントが存在する場合、THE SellerStatusSidebar SHALL 緑色（`#4caf50`）のバッジで件数を表示する
3. WHEN 担当者の `visitAssignedCounts` と `todayCallAssignedCounts` が両方0の場合、THE SellerStatusSidebar SHALL その担当者の親カテゴリを表示しない
4. THE SellerStatusSidebar SHALL `assigneeInitials` プロパティに含まれるイニシャルの順序で担当者を表示する

### 要件2: 当日TELサブアイテムの表示

**ユーザーストーリー:** 担当者として、自分の当日TEL対象の売主数を担当全体の中で確認したい。そのため、担当カテゴリの下に当日TELをサブアイテムとして表示してほしい。

#### 受け入れ基準

1. WHEN 担当者の `todayCallAssignedCounts` が1以上の場合、THE SellerStatusSidebar SHALL 親カテゴリの下に「↳ 当日TEL(イニシャル)」形式のサブアイテムを表示する
2. THE SellerStatusSidebar SHALL サブアイテムをインデント（左パディング）付きで表示する
3. THE SellerStatusSidebar SHALL サブアイテムのバッジをオレンジ色（`#ff5722`）で表示する
4. WHEN 担当者の `todayCallAssignedCounts` が0の場合、THE SellerStatusSidebar SHALL その担当者のサブアイテムを表示しない

### 要件3: フィルタリング動作

**ユーザーストーリー:** 担当者として、親カテゴリまたはサブアイテムをクリックして売主リストを絞り込みたい。

#### 受け入れ基準

1. WHEN ユーザーが親カテゴリ「担当(Y)」をクリックした場合、THE SellerStatusSidebar SHALL `visitAssigned:Y` カテゴリキーで `onCategorySelect` を呼び出す
2. WHEN ユーザーがサブアイテム「↳ 当日TEL(Y)」をクリックした場合、THE SellerStatusSidebar SHALL `todayCallAssigned:Y` カテゴリキーで `onCategorySelect` を呼び出す
3. THE SellerStatusSidebar SHALL 既存の `visitAssigned:` および `todayCallAssigned:` カテゴリキーの動作を変更しない

### 要件4: 既存カテゴリとの共存

**ユーザーストーリー:** 管理者として、既存のサイドバーカテゴリ（訪問日前日、当日TEL分など）が引き続き正常に動作することを確認したい。

#### 受け入れ基準

1. THE SellerStatusSidebar SHALL 担当者別セクション以外の既存カテゴリ（`visitDayBefore`、`todayCall`、`todayCallWithInfo` など）の表示と動作を変更しない
2. THE SellerStatusSidebar SHALL 担当者別セクションを既存カテゴリの下部に区切り線付きで表示する
3. WHEN `assigneeInitials` が空の場合、THE SellerStatusSidebar SHALL `sellers` データから動的に担当者イニシャルを取得してフォールバック表示する
