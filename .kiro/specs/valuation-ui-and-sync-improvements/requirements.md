# Requirements Document

## Introduction

売主リストの通話モードページにおいて、査定計算セクションのUI改善とデータ同期の修正を実施します。具体的には、「路線価を確認」リンクの配置変更と、査定担当フィールドのスプレッドシート同期修正の2つの改善を行います。

## Glossary

- **System**: 売主管理システム（社内管理システム）
- **CallModePage**: 通話モードページ（`/sellers/:id/call`）
- **ValuationSection**: 査定計算セクション（査定額を入力・表示するUI領域）
- **RoadPriceLink**: 路線価を確認するための外部リンク（https://www.chikamap.jp/chikamap/Portal?mid=216）
- **PropertyAddressField**: 物件住所（コピー用）フィールド
- **ValuationAssignee**: 査定担当（査定額を入力したユーザー）
- **SpreadsheetSync**: スプレッドシート同期サービス（データベース ⇔ スプレッドシート間のデータ同期）
- **BZ列**: スプレッドシートの「査定担当」列（列番号78、0-indexed）
- **Initials**: イニシャル（ユーザー名の頭文字、例：「山田太郎」→「Y」）

## Requirements

### Requirement 1: 路線価リンクの配置変更

**User Story:** As a 営業担当者, I want 路線価リンクが物件住所の右隣に配置されている, so that 査定計算時に物件住所と路線価を素早く確認できる

#### Acceptance Criteria

1. WHEN 通話モードページの査定計算セクションを表示する, THE System SHALL 「路線価を確認」リンクを「物件住所（コピー用）」フィールドの右隣に配置する
2. THE System SHALL 「路線価を確認」リンクを査定計算セクションの2箇所（上部と下部）の両方で同じ配置にする
3. WHEN ユーザーが「路線価を確認」リンクをクリックする, THE System SHALL 新しいタブで路線価サイト（https://www.chikamap.jp/chikamap/Portal?mid=216）を開く
4. THE System SHALL 「路線価を確認」リンクのボタンサイズを「small」に設定する
5. THE System SHALL 「物件住所（コピー用）」フィールドと「路線価を確認」リンクを横並びに配置する（flexレイアウト）

### Requirement 2: 査定担当のイニシャル変換とスプレッドシート同期

**User Story:** As a 管理者, I want 査定担当がイニシャルに変換されてスプレッドシートのBZ列に同期される, so that スプレッドシートで査定担当をコンパクトに確認できる

#### Acceptance Criteria

1. WHEN ユーザーが査定額を入力して保存する, THE System SHALL 査定担当（現在のユーザーのフルネーム）をデータベースの`valuation_assignee`カラムに保存する
2. WHEN データベースの`valuation_assignee`カラムが更新される, THE System SHALL フルネームをイニシャルに変換してからスプレッドシートのBZ列「査定担当」に同期する
3. THE System SHALL イニシャル変換ロジックを実装する（例：「山田太郎」→「Y」、「Yamada Taro」→「Y」）
4. THE System SHALL `column-mapping.json`の`databaseToSpreadsheet`セクションに`valuation_assignee`のマッピングが存在することを確認する
5. WHEN スプレッドシートからデータベースへの同期が実行される, THE System SHALL スプレッドシートのBZ列「査定担当」の値（イニシャル）をそのまま`valuation_assignee`カラムに同期する
6. THE System SHALL 査定担当の同期が双方向（データベース → スプレッドシート、スプレッドシート → データベース）で動作することを保証する

### Requirement 3: イニシャル変換ロジック

**User Story:** As a システム, I want フルネームをイニシャルに正確に変換する, so that スプレッドシートに正しいイニシャルが保存される

#### Acceptance Criteria

1. WHEN フルネームが日本語（漢字・ひらがな・カタカナ）の場合, THE System SHALL 姓の最初の1文字をローマ字に変換してイニシャルとする
2. WHEN フルネームが英語（アルファベット）の場合, THE System SHALL 姓の最初の1文字を大文字にしてイニシャルとする
3. WHEN フルネームにスペースが含まれる場合, THE System SHALL スペースの前の部分を姓として扱う
4. WHEN フルネームにスペースが含まれない場合, THE System SHALL 最初の1文字をイニシャルとする
5. IF フルネームが空またはnullの場合, THEN THE System SHALL 空文字列を返す

### Requirement 4: 既存機能の保持

**User Story:** As a 営業担当者, I want 既存の査定計算機能が正常に動作する, so that 査定業務に支障が出ない

#### Acceptance Criteria

1. THE System SHALL 査定額の自動計算機能を保持する
2. THE System SHALL 査定額の手動入力機能を保持する
3. THE System SHALL 査定方法の選択機能を保持する
4. THE System SHALL 査定担当の表示機能を保持する
5. THE System SHALL 物件住所のコピー機能を保持する
6. WHEN 査定額をクリアする, THE System SHALL 査定担当もクリアする
