# Requirements Document

## Introduction

買主リストの「他社物件新着配信」機能を改善し、エリア選択をボタン形式からテキスト入力形式に変更します。ユーザーが住所を手入力すると、その半径3km圏内で条件に合致する買主を自動的に検索・表示します。

## Glossary

- **Buyer_List_System**: 買主リストを管理するシステム
- **Other_Company_Distribution_Feature**: 他社物件新着配信機能
- **Area_Input_Field**: エリア入力フィールド（住所を入力するテキストボックス）
- **Radius_Search**: 半径検索機能（指定住所から半径3km圏内を検索）
- **Latest_Status**: 買主の最新状況フィールド
- **Property_Type**: 物件種別（マンション、戸建て等）
- **Price_Range**: 価格帯

## Requirements

### Requirement 1: エリア入力フィールドの変更

**User Story:** As a ユーザー, I want エリアフィールドをテキスト入力形式に変更したい, so that 住所を自由に手入力できる

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 「他社物件新着配信」画面のエリアフィールドをボタン選択形式からテキストボックス形式に変更する
2. THE Area_Input_Field SHALL 日本語の住所文字列を受け付ける
3. THE Area_Input_Field SHALL 入力された住所をリアルタイムで検証する
4. WHEN 無効な住所が入力された場合, THEN THE Buyer_List_System SHALL エラーメッセージを表示する

### Requirement 2: 住所の地理座標変換

**User Story:** As a システム, I want 入力された住所を地理座標に変換したい, so that 半径検索を実行できる

#### Acceptance Criteria

1. WHEN 有効な住所が入力された場合, THE Buyer_List_System SHALL その住所を緯度経度に変換する
2. THE Buyer_List_System SHALL 地理座標変換にGoogle Maps APIまたは同等のジオコーディングサービスを使用する
3. WHEN 地理座標変換が失敗した場合, THEN THE Buyer_List_System SHALL ユーザーにエラーメッセージを表示する
4. THE Buyer_List_System SHALL 変換された地理座標を検索条件として保持する

### Requirement 3: 半径3km圏内の買主検索

**User Story:** As a ユーザー, I want 入力した住所の半径3km圏内の買主を検索したい, so that 該当する買主リストを取得できる

#### Acceptance Criteria

1. WHEN 住所が地理座標に変換された場合, THE Radius_Search SHALL 指定座標から半径3km圏内で問い合わせてきた買主を検索する
2. THE Radius_Search SHALL 買主の希望エリア情報を基に距離計算を実行する
3. THE Radius_Search SHALL Haversine公式または同等の地理距離計算アルゴリズムを使用する
4. THE Radius_Search SHALL 検索結果を距離の近い順にソートする

### Requirement 4: 最新状況による買主フィルタリング

**User Story:** As a ユーザー, I want 最新状況に"買"が含まれていない買主のみを表示したい, so that 購入済みの買主を除外できる

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 最新状況フィールドに"買"という文字が含まれる買主を検索結果から除外する
2. THE Buyer_List_System SHALL 最新状況が"D"の買主を検索結果から除外する
3. THE Buyer_List_System SHALL 最新状況が空白またはnullの買主を検索結果に含める
4. THE Buyer_List_System SHALL フィルタリング条件を検索実行前に適用する

### Requirement 5: 物件種別による買主フィルタリング

**User Story:** As a ユーザー, I want 物件種別で買主を絞り込みたい, so that 該当する物件種別を希望する買主のみを表示できる

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 物件種別選択UIを提供する
2. THE Buyer_List_System SHALL 複数の物件種別を同時に選択可能にする
3. WHEN 物件種別が選択された場合, THE Buyer_List_System SHALL 選択された種別を希望する買主のみを検索結果に含める
4. WHEN 物件種別が選択されていない場合, THE Buyer_List_System SHALL 全ての物件種別の買主を検索結果に含める

### Requirement 6: 価格帯による買主フィルタリング

**User Story:** As a ユーザー, I want 価格帯で買主を絞り込みたい, so that 該当する価格帯を希望する買主のみを表示できる

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 価格帯選択UIを提供する
2. THE Buyer_List_System SHALL 最小価格と最大価格の範囲指定を受け付ける
3. WHEN 価格帯が指定された場合, THE Buyer_List_System SHALL 指定範囲内の価格を希望する買主のみを検索結果に含める
4. WHEN 価格帯が指定されていない場合, THE Buyer_List_System SHALL 全ての価格帯の買主を検索結果に含める
5. THE Buyer_List_System SHALL 買主の希望価格範囲と指定価格帯が重複する場合に該当とみなす

### Requirement 7: 検索結果の表示

**User Story:** As a ユーザー, I want 検索結果を一覧形式で表示したい, so that 該当する買主を確認できる

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 検索結果を買主リスト形式で表示する
2. THE Buyer_List_System SHALL 各買主の基本情報（買主番号、氏名、希望エリア、希望価格、物件種別）を表示する
3. THE Buyer_List_System SHALL 各買主と検索地点との距離を表示する
4. WHEN 検索結果が0件の場合, THE Buyer_List_System SHALL 「該当する買主が見つかりませんでした」というメッセージを表示する
5. THE Buyer_List_System SHALL 検索結果の件数を表示する

### Requirement 8: 検索条件の保持

**User Story:** As a ユーザー, I want 検索条件を保持したい, so that 再検索時に条件を再入力する必要がない

#### Acceptance Criteria

1. THE Buyer_List_System SHALL 入力された住所をセッション中保持する
2. THE Buyer_List_System SHALL 選択された物件種別をセッション中保持する
3. THE Buyer_List_System SHALL 指定された価格帯をセッション中保持する
4. WHEN ユーザーが画面を再表示した場合, THE Buyer_List_System SHALL 保持された検索条件を復元する

### Requirement 9: パフォーマンス要件

**User Story:** As a ユーザー, I want 検索が高速に実行されることを期待する, so that ストレスなく機能を使用できる

#### Acceptance Criteria

1. WHEN 検索が実行された場合, THE Buyer_List_System SHALL 3秒以内に検索結果を表示する
2. THE Buyer_List_System SHALL 買主データベースに地理座標インデックスを作成する
3. THE Buyer_List_System SHALL 検索クエリを最適化する
4. WHEN 検索に3秒以上かかる場合, THE Buyer_List_System SHALL ローディングインジケーターを表示する

### Requirement 10: エラーハンドリング

**User Story:** As a ユーザー, I want エラーが発生した場合に適切なメッセージを表示してほしい, so that 問題を理解して対処できる

#### Acceptance Criteria

1. WHEN ジオコーディングAPIがエラーを返した場合, THEN THE Buyer_List_System SHALL 「住所を地理座標に変換できませんでした」というエラーメッセージを表示する
2. WHEN データベース接続エラーが発生した場合, THEN THE Buyer_List_System SHALL 「データベース接続エラーが発生しました」というエラーメッセージを表示する
3. WHEN ネットワークエラーが発生した場合, THEN THE Buyer_List_System SHALL 「ネットワークエラーが発生しました」というエラーメッセージを表示する
4. THE Buyer_List_System SHALL 全てのエラーをログに記録する
