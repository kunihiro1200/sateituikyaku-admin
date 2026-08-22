# Requirements Document

## Introduction

売主リストページのサイドバー（`SellerStatusSidebar`）には、既に福岡（FI売主）専用のセクション見出し「── 福岡 ──」がサイドバー下部に表示されている。一方、トップレベルの通常カテゴリ（①訪問日前日、③当日TEL分、④当日TEL（内容）、⑤未査定、⑥査定（郵送）、⑦当日TEL_未着手など）は、内部的にFI売主を除外した残りの売主（実質的にほぼ全てAA＝大分の売主）の件数を表示している。

この機能は、既存のトップレベルカテゴリの集計ロジック・データ構造を一切変更せず、表示上のグルーピングのみを行う。「ALL」ボタンの直下、既存のトップレベルカテゴリ群の直前に「── 大分 ──」というセクション見出しラベルを追加し、視覚的に「大分」セクションであることを示す。既存の「福岡」セクションはそのまま維持し、大分セクションが上、福岡セクションが下という並びにする。

## Glossary

- **Sidebar**: 売主リストページおよび通話モードページで使用される `SellerStatusSidebar` コンポーネント
- **All_Button**: サイドバー上部に表示される「All」ボタン（全売主件数を表示）
- **Oita_Section_Header**: 「── 大分 ──」という文字列を表示するセクション見出し要素（新規追加対象）
- **Fukuoka_Section_Header**: 「── 福岡 ──」という文字列を表示する既存のセクション見出し要素（`renderFukuokaSection()` 内）
- **Top_Level_Category**: ①訪問日前日、③当日TEL分、④当日TEL（内容）、⑤未査定、⑥査定（郵送）、⑦当日TEL_未着手、⑧Pinrich空欄、Pinrich要変更など、既存のトップレベルカテゴリボタン群
- **Category_Counts**: サイドバーに表示される件数データ（`categoryCounts` prop、バックエンドAPIから取得）
- **Call_Mode_Page**: `isCallMode` が true の場合に表示される通話モードページ用のサイドバー表示

## Requirements

### Requirement 1: 大分セクション見出しの表示

**User Story:** As a 社内スタッフ, I want サイドバーの「All」表示の下に「大分」という見出しが表示されること, so that 現在表示されているトップレベルカテゴリの件数が大分（AA売主）のものであることを一目で把握できる

#### Acceptance Criteria

1. WHEN 売主リストページのサイドバーが全カテゴリ表示モードで表示される, THE Sidebar SHALL All_Button の直下かつ Top_Level_Category 群の直前に Oita_Section_Header を表示する
2. THE Oita_Section_Header SHALL Fukuoka_Section_Header と同様の見出しスタイル（テキスト装飾）で「── 大分 ──」という文字列を表示する
3. WHEN 売主リストページのサイドバーが全カテゴリ表示モードで表示される, THE Sidebar SHALL Oita_Section_Header を Fukuoka_Section_Header よりも表示順序で先に配置する

### Requirement 2: 既存トップレベルカテゴリの動作維持

**User Story:** As a 社内スタッフ, I want 既存のトップレベルカテゴリボタンの件数表示・クリック展開動作が変更されないこと, so that 今までの操作方法のまま業務を継続できる

#### Acceptance Criteria

1. WHEN Oita_Section_Header が追加された後にサイドバーが表示される, THE Sidebar SHALL Top_Level_Category それぞれについて追加前と同一の件数を表示する
2. WHEN ユーザーが Top_Level_Category のいずれかをクリックする, THE Sidebar SHALL 追加前と同一の展開・選択動作を実行する
3. THE Sidebar SHALL Top_Level_Category の集計に使用する Category_Counts の計算ロジックを変更しない

### Requirement 3: 福岡セクションの表示維持

**User Story:** As a 社内スタッフ, I want 既存の福岡セクションがそのまま維持されること, so that 福岡（FI売主）の件数確認に影響が出ない

#### Acceptance Criteria

1. WHEN Oita_Section_Header が追加された後にサイドバーが表示される, THE Sidebar SHALL Fukuoka_Section_Header 以下の内容（当日TEL_未着手・当日TEL分・未査定・査定（郵送）・当日TEL（内容）の各ボタンと件数）を追加前と同一に表示する
2. THE Sidebar SHALL Fukuoka_Section_Header の表示条件（FI売主の合計件数が0件の場合は非表示）を変更しない

### Requirement 4: 通話モードページへの影響なし

**User Story:** As a 社内スタッフ, I want 通話モードページのサイドバー表示が今回の変更によって崩れないこと, so that 通話モード利用時の業務に支障が出ない

#### Acceptance Criteria

1. WHILE Call_Mode_Page が表示されている, THE Sidebar SHALL 現在の売主のカテゴリが自動展開された状態を今回の変更前と同一に維持する
2. WHERE サイドバーが全カテゴリ表示モード（カテゴリ未展開状態）である, THE Sidebar SHALL 売主リストページ・Call_Mode_Page のいずれで表示されている場合でも Oita_Section_Header を Top_Level_Category 群の直前に表示する

### Requirement 5: バックエンドへの変更なし

**User Story:** As a 開発者, I want この機能がフロントエンドの表示グルーピングのみで実現されること, so that バックエンドAPIやデータ集計ロジックに影響を与えず安全に変更できる

#### Acceptance Criteria

1. THE Sidebar SHALL Oita_Section_Header の表示のためにバックエンドAPIへの新規リクエストを発生させない
2. THE Sidebar SHALL Oita_Section_Header の表示のために新規のカウント項目（例: aa_todayCall 等）を Category_Counts に追加することなく実装される
