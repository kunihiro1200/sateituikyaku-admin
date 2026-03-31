# Requirements Document

## Introduction

売主リストページのサイドバーに、専任媒介・一般媒介・訪問後他決の3つの新しいステータスカテゴリーを追加します。これにより、営業担当者が専任他決打合せが必要な売主を効率的に把握し、適切なフォローアップを行えるようにします。

## Glossary

- **Seller_Sidebar**: 売主リストページの左側に表示されるステータスカテゴリー一覧
- **Exclusive_Category**: 専任媒介関連の売主を表示するカテゴリー
- **General_Category**: 一般媒介関連の売主を表示するカテゴリー
- **Visit_Other_Decision_Category**: 訪問後に他決となった売主を表示するカテゴリー
- **Exclusive_Other_Decision_Meeting**: 専任他決打合せフィールド（値: "完了" または空）
- **Next_Call_Date**: 次電日フィールド
- **Status_Company**: 状況（当社）フィールド
- **Contract_Year_Month**: 契約年月 他決は分かった時点フィールド
- **Visit_Assignee**: 営担フィールド

## Requirements

### Requirement 1: 専任カテゴリーの表示

**User Story:** As a 営業担当者, I want to 専任媒介関連の売主を一覧で確認できる, so that 専任他決打合せが必要な売主を効率的に把握できる

#### Acceptance Criteria

1. WHEN Seller_Sidebarが表示される, THE System SHALL 「専任」カテゴリーを表示する
2. THE System SHALL 以下の条件を全て満たす売主を「専任」カテゴリーに分類する:
   - Exclusive_Other_Decision_Meeting <> "完了"
   - Next_Call_Date <> TODAY()
   - Status_Company IN ("専任媒介", "他決→専任", "リースバック（専任）")
3. THE System SHALL 「専任」カテゴリーに該当する売主の件数を表示する
4. WHEN ユーザーが「専任」カテゴリーをクリックする, THE System SHALL 該当する売主のリストを展開表示する
5. THE System SHALL 「専任」カテゴリーを緑色（#2e7d32）で表示する

### Requirement 2: 一般カテゴリーの表示

**User Story:** As a 営業担当者, I want to 一般媒介関連の売主を一覧で確認できる, so that 契約年月が2025/6/23以降の一般媒介売主を把握できる

#### Acceptance Criteria

1. WHEN Seller_Sidebarが表示される, THE System SHALL 「一般」カテゴリーを表示する
2. THE System SHALL 以下の条件を全て満たす売主を「一般」カテゴリーに分類する:
   - Exclusive_Other_Decision_Meeting <> "完了"
   - Next_Call_Date <> TODAY()
   - Status_Company = "一般媒介"
   - Contract_Year_Month >= "2025/6/23"
3. THE System SHALL 「一般」カテゴリーに該当する売主の件数を表示する
4. WHEN ユーザーが「一般」カテゴリーをクリックする, THE System SHALL 該当する売主のリストを展開表示する
5. THE System SHALL 「一般」カテゴリーを青色（#1565c0）で表示する

### Requirement 3: 訪問後他決カテゴリーの表示

**User Story:** As a 営業担当者, I want to 訪問後に他決となった売主を一覧で確認できる, so that 営担が設定されている他決売主を把握できる

#### Acceptance Criteria

1. WHEN Seller_Sidebarが表示される, THE System SHALL 「訪問後他決」カテゴリーを表示する
2. THE System SHALL 以下の条件を全て満たす売主を「訪問後他決」カテゴリーに分類する:
   - Exclusive_Other_Decision_Meeting <> "完了"
   - Next_Call_Date <> TODAY()
   - Status_Company IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
   - Visit_Assignee <> ""
3. THE System SHALL 「訪問後他決」カテゴリーに該当する売主の件数を表示する
4. WHEN ユーザーが「訪問後他決」カテゴリーをクリックする, THE System SHALL 該当する売主のリストを展開表示する
5. THE System SHALL 「訪問後他決」カテゴリーをオレンジ色（#ff9800）で表示する

### Requirement 4: カテゴリーの表示順序

**User Story:** As a 営業担当者, I want to 新しいカテゴリーが既存のカテゴリーと統一された順序で表示される, so that サイドバーを効率的に使用できる

#### Acceptance Criteria

1. THE System SHALL 新しい3つのカテゴリーを既存のカテゴリーの後に表示する
2. THE System SHALL 以下の順序でカテゴリーを表示する:
   - All
   - ①訪問日前日
   - ②訪問済み
   - ③当日TEL分
   - ④当日TEL（内容）
   - ⑤未査定
   - ⑥査定（郵送）
   - ⑦当日TEL_未着手
   - ⑧Pinrich空欄
   - 担当者別カテゴリー
   - **専任**（新規）
   - **一般**（新規）
   - **訪問後他決**（新規）

### Requirement 5: フィルタリング機能

**User Story:** As a 営業担当者, I want to 新しいカテゴリーをクリックして売主リストをフィルタリングできる, so that 該当する売主のみを表示できる

#### Acceptance Criteria

1. WHEN ユーザーが「専任」カテゴリーをクリックする, THE System SHALL 専任カテゴリーの条件を満たす売主のみを売主リストに表示する
2. WHEN ユーザーが「一般」カテゴリーをクリックする, THE System SHALL 一般カテゴリーの条件を満たす売主のみを売主リストに表示する
3. WHEN ユーザーが「訪問後他決」カテゴリーをクリックする, THE System SHALL 訪問後他決カテゴリーの条件を満たす売主のみを売主リストに表示する
4. WHEN ユーザーが別のカテゴリーをクリックする, THE System SHALL 選択されたカテゴリーの条件を満たす売主のみを表示する
5. THE System SHALL 選択中のカテゴリーをハイライト表示する

### Requirement 6: カウント表示

**User Story:** As a 営業担当者, I want to 各カテゴリーの売主件数を確認できる, so that 作業量を把握できる

#### Acceptance Criteria

1. THE System SHALL 「専任」カテゴリーに該当する売主の件数をバッジで表示する
2. THE System SHALL 「一般」カテゴリーに該当する売主の件数をバッジで表示する
3. THE System SHALL 「訪問後他決」カテゴリーに該当する売主の件数をバッジで表示する
4. WHEN 売主データが更新される, THE System SHALL カウントを自動的に再計算する
5. WHEN カテゴリーに該当する売主が0件の場合, THE System SHALL カテゴリーを表示しない

### Requirement 7: 展開リスト表示

**User Story:** As a 営業担当者, I want to カテゴリーをクリックして該当する売主のリストを展開表示できる, so that 詳細情報を確認できる

#### Acceptance Criteria

1. WHEN ユーザーがカテゴリーをクリックする, THE System SHALL 該当する売主のリストを展開表示する
2. THE System SHALL 展開リストに以下の情報を表示する:
   - 売主番号
   - 売主名
   - 状況（当社）
   - 物件住所
   - 次電日
3. WHEN ユーザーが展開中のカテゴリーを再度クリックする, THE System SHALL リストを折りたたむ
4. WHEN ユーザーが売主をクリックする, THE System SHALL 通話モードページに遷移する
5. THE System SHALL 展開リストをスクロール可能にする（最大高さ400px）

### Requirement 8: バックエンドAPI対応

**User Story:** As a システム, I want to バックエンドAPIが新しいカテゴリーのカウントを返す, so that フロントエンドが正確な件数を表示できる

#### Acceptance Criteria

1. THE Backend_API SHALL `/api/sellers/category-counts` エンドポイントに以下のフィールドを追加する:
   - `exclusive`: 専任カテゴリーの件数
   - `general`: 一般カテゴリーの件数
   - `visitOtherDecision`: 訪問後他決カテゴリーの件数
2. THE Backend_API SHALL 各カテゴリーの条件に基づいて正確な件数を計算する
3. THE Backend_API SHALL カウント計算時にデータベースインデックスを活用する
4. WHEN APIリクエストが失敗する, THE Backend_API SHALL 適切なエラーメッセージを返す
5. THE Backend_API SHALL レスポンスタイムを500ms以内に保つ

### Requirement 9: データベースフィールド対応

**User Story:** As a システム, I want to 必要なデータベースフィールドが正しくマッピングされる, so that フィルタリング条件が正確に動作する

#### Acceptance Criteria

1. THE System SHALL `exclusive_other_decision_meeting` フィールドを使用して専任他決打合せの状態を判定する
2. THE System SHALL `next_call_date` フィールドを使用して次電日を判定する
3. THE System SHALL `status` フィールドを使用して状況（当社）を判定する
4. THE System SHALL `contract_year_month` フィールドを使用して契約年月を判定する
5. THE System SHALL `visit_assignee` フィールドを使用して営担の有無を判定する
6. THE System SHALL 日付比較時にJST（日本標準時）を使用する
7. THE System SHALL 空文字列と null を同等に扱う

### Requirement 10: パフォーマンス要件

**User Story:** As a ユーザー, I want to サイドバーが高速に表示される, so that ストレスなく作業できる

#### Acceptance Criteria

1. THE System SHALL サイドバーの初期表示を1秒以内に完了する
2. THE System SHALL カテゴリーのカウント計算を並列実行する
3. THE System SHALL カテゴリー展開時のリスト取得を2秒以内に完了する
4. THE System SHALL 売主データのキャッシュを活用する
5. THE System SHALL 不要なAPIリクエストを削減する
