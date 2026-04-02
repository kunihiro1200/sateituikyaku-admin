# Requirements Document

## Introduction

売主リストの通話モードページにおいて、査定計算セクションのUI改善を実施します。具体的には、「路線価を確認」リンクの配置変更と、査定担当フィールドのスプレッドシート同期追加の2つの改善を行います。

## Glossary

- **System**: 売主管理システム（社内管理システム）
- **CallModePage**: 通話モードページ（`/sellers/:id/call`）
- **ValuationSection**: 査定計算セクション（査定額を入力・表示するUI領域）
- **RoadPriceLink**: 路線価を確認するための外部リンク（https://www.chikamap.jp/chikamap/Portal?mid=216）
- **PropertyAddressField**: 物件住所（コピー用）フィールド
- **ValuationAssignee**: 査定担当（査定額を入力したユーザー）
- **SpreadsheetSync**: スプレッドシート同期サービス（データベース ⇔ スプレッドシート間のデータ同期）
- **BZ列**: スプレッドシートの「査定担当」列（列番号78、0-indexed）

## Requirements

### Requirement 1: 路線価リンクの配置変更

**User Story:** As a 営業担当者, I want 路線価リンクが物件住所の右隣に配置されている, so that 査定計算時に物件住所と路線価を素早く確認できる

#### Acceptance Criteria

1. WHEN 通話モードページの査定計算セクションを表示する, THE System SHALL 「路線価を確認」リンクを「物件住所（コピー用）」フィールドの右隣に配置する
2. THE System SHALL 「路線価を確認」リンクを査定計算セクションの2箇所（編集モードと表示モード）の両方で同じ配置にする
3. WHEN ユーザーが「路線価を確認」リンクをクリックする, THE System SHALL 新しいタブで路線価サイト（https://www.chikamap.jp/chikamap/Portal?mid=216）を開く
4. THE System SHALL 「路線価を確認」リンクのボタンサイズを「small」に設定する
5. THE System SHALL 「物件住所（コピー用）」フィールドと「路線価を確認」リンクを横並びに配置する（flexレイアウト）

### Requirement 2: 査定担当のスプレッドシート同期

**User Story:** As a 管理者, I want 査定担当がスプレッドシートのBZ列に同期される, so that スプレッドシートで査定担当を確認できる

#### Acceptance Criteria

1. WHEN ユーザーが査定額を入力して保存する, THE System SHALL 査定担当（現在のユーザー名）をデータベースの`valuation_assignee`カラムに保存する
2. WHEN データベースの`valuation_assignee`カラムが更新される, THE System SHALL スプレッドシートのBZ列「査定担当」に同期する
3. THE System SHALL `column-mapping.json`の`databaseToSpreadsheet`セクションに`valuation_assignee`のマッピングが存在することを確認する
4. WHEN スプレッドシートからデータベースへの同期が実行される, THE System SHALL スプレッドシートのBZ列「査定担当」の値を`valuation_assignee`カラムに同期する
5. THE System SHALL 査定担当の同期が双方向（データベース → スプレッドシート、スプレッドシート → データベース）で動作することを保証する

### Requirement 3: 既存機能の保持

**User Story:** As a 営業担当者, I want 既存の査定計算機能が正常に動作する, so that 査定業務に支障が出ない

#### Acceptance Criteria

1. THE System SHALL 査定額の自動計算機能を保持する
2. THE System SHALL 査定額の手動入力機能を保持する
3. THE System SHALL 査定方法の選択機能を保持する
4. THE System SHALL 査定担当の表示機能を保持する
5. THE System SHALL 物件住所のコピー機能を保持する
6. WHEN 査定額をクリアする, THE System SHALL 査定担当もクリアする

