# Requirements Document

## Introduction

売主リスト一覧のサイドバーにおいて、営業担当別カテゴリ（担当(I)、担当(K)、担当(M)等）の表示から「状況（当社）」が「他社買取」になっている売主を除外する機能を追加します。これにより、実際に追客が必要な売主のみが担当別に表示され、営業担当者の業務効率が向上します。

## Glossary

- **Sidebar**: 売主リスト一覧画面の左側に表示されるステータスカテゴリ一覧
- **営業担当別カテゴリ**: サイドバーに表示される「担当(I)」「担当(K)」等のカテゴリ
- **visitAssignee**: 営業担当者のイニシャルを格納するフィールド
- **status**: 「状況（当社）」フィールド（例: 追客中、他社買取、専任等）
- **Filter_Function**: 売主データをフィルタリングする関数
- **Category_Count**: 各カテゴリに該当する売主の件数

## Requirements

### Requirement 1: 営業担当別カテゴリから「他社買取」売主を除外

**User Story:** As a 営業担当者, I want 「他社買取」の売主を担当別カテゴリから除外したい, so that 実際に追客が必要な売主のみに集中できる

#### Acceptance Criteria

1. WHEN visitAssigneeに値が入っている売主を取得する際、THE Filter_Function SHALL statusフィールドが「他社買取」を含む売主を除外する
2. WHEN 営業担当別カテゴリのカウントを計算する際、THE System SHALL 「他社買取」を含む売主をカウントから除外する
3. WHEN サイドバーの営業担当別カテゴリを展開する際、THE System SHALL 「他社買取」を含む売主をリストに表示しない
4. WHEN statusフィールドが「他社買取」以外の値の場合、THE System SHALL 従来通り営業担当別カテゴリに表示する
5. WHEN statusフィールドが空の場合、THE System SHALL 従来通り営業担当別カテゴリに表示する

### Requirement 2: バックエンドAPIでの除外処理

**User Story:** As a システム, I want バックエンドAPIで「他社買取」売主を除外したい, so that フロントエンドに不要なデータを送信しない

#### Acceptance Criteria

1. WHEN `/api/sellers/category-counts` エンドポイントが呼び出される際、THE Backend SHALL visitAssignedCountsの計算時に「他社買取」売主を除外する
2. WHEN `/api/sellers` エンドポイントで営業担当別フィルタが指定される際、THE Backend SHALL 「他社買取」売主を除外したデータを返す
3. WHEN statusフィールドに「他社買取」という文字列が含まれる場合、THE Backend SHALL その売主を営業担当別カウントから除外する
4. WHEN statusフィールドが「他社買取→追客」のように「他社買取」を含む場合、THE Backend SHALL その売主を除外する

### Requirement 3: フロントエンドフィルタリング関数の更新

**User Story:** As a フロントエンド開発者, I want フィルタリング関数を更新したい, so that 「他社買取」売主が営業担当別カテゴリに表示されない

#### Acceptance Criteria

1. WHEN `isVisitAssignedTo()` 関数が呼び出される際、THE Function SHALL statusフィールドが「他社買取」を含む売主に対してfalseを返す
2. WHEN `getUniqueAssignees()` 関数が呼び出される際、THE Function SHALL 「他社買取」売主を除外した担当者リストを返す
3. WHEN 営業担当別カテゴリのフィルタリングが実行される際、THE System SHALL 「他社買取」を含む売主を結果から除外する
4. FOR ALL 営業担当別カテゴリ（担当(I)、担当(K)等）、THE System SHALL 同じ除外ルールを適用する

### Requirement 4: 他のカテゴリへの影響なし

**User Story:** As a ユーザー, I want 他のカテゴリは従来通り動作してほしい, so that 既存の機能が壊れない

#### Acceptance Criteria

1. WHEN 「当日TEL分」カテゴリを表示する際、THE System SHALL 「他社買取」売主の除外ルールを適用しない
2. WHEN 「未査定」カテゴリを表示する際、THE System SHALL 「他社買取」売主の除外ルールを適用しない
3. WHEN 「訪問日前日」カテゴリを表示する際、THE System SHALL 従来通りの条件のみで判定する
4. WHEN 「All」カテゴリを表示する際、THE System SHALL 全ての売主を表示する（除外なし）

### Requirement 5: 既存のステータス定義との整合性

**User Story:** As a システム管理者, I want 既存のステータス定義と矛盾しない実装にしたい, so that システム全体の一貫性が保たれる

#### Acceptance Criteria

1. THE System SHALL `.kiro/steering/sidebar-status-definition.md` に定義された営業担当別カテゴリの条件を維持する
2. WHEN 「他社買取」除外ルールを適用する際、THE System SHALL 既存の営業担当判定ロジック（visitAssigneeの確認）を変更しない
3. WHEN statusフィールドの値を判定する際、THE System SHALL 部分一致（includes）で「他社買取」を検出する
4. THE System SHALL 「他社買取」以外のステータス値（「追客中」「専任」等）には影響を与えない

