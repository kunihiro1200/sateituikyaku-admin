# Requirements Document

## Introduction

買主リストのサイドバーに5つの新しいカテゴリを追加し、条件式に基づいて買主をフィルタリングできるようにします。全てのカテゴリは赤字で表示され、既存のサイドバーカテゴリと同様の動作（クリックでフィルタリング）を実現します。

## Glossary

- **Buyer_System**: 買主管理システム
- **Sidebar**: 買主リスト画面の左側に表示されるステータスカテゴリ一覧
- **GAS**: Google Apps Script（スプレッドシートとデータベース間の同期を担当）
- **Category_Count**: 各カテゴリに該当する買主の件数
- **Filter**: サイドバーのカテゴリをクリックした際に、該当する買主のみを表示する機能

## Requirements

### Requirement 1: 問合メール未対応カテゴリの追加

**User Story:** As a 営業担当者, I want to see 問合メール未対応の買主を一覧表示できるカテゴリ, so that 対応漏れを防ぐことができる

#### Acceptance Criteria

1. WHEN サイドバーに「問合メール未対応」カテゴリが表示される, THE Buyer_System SHALL 赤字で表示する
2. WHEN 買主が以下の条件のいずれかを満たす, THE Buyer_System SHALL 「問合メール未対応」カテゴリにカウントする:
   - 【問合メール】電話対応 = "未"
   - 【問合メール】メール返信 = "未"
   - (●内覧日(最新）が空 AND (【問合メール】電話対応="不要" OR 【問合メール】電話対応="不要") AND (【問合メール】メール返信 = "未" OR 【問合メール】メール返信が空))
3. WHEN ユーザーが「問合メール未対応」カテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
4. THE GAS SHALL 10分ごとに「問合メール未対応」カテゴリのカウントを計算してデータベースに保存する

### Requirement 2: 業者問合せありカテゴリの追加

**User Story:** As a 営業担当者, I want to see 業者向けアンケート未対応の買主を一覧表示できるカテゴリ, so that アンケート対応漏れを防ぐことができる

#### Acceptance Criteria

1. WHEN サイドバーに「業者問合せあり」カテゴリが表示される, THE Buyer_System SHALL 赤字で表示する
2. WHEN 買主の業者向けアンケート = "未", THE Buyer_System SHALL 「業者問合せあり」カテゴリにカウントする
3. WHEN ユーザーが「業者問合せあり」カテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
4. THE GAS SHALL 10分ごとに「業者問合せあり」カテゴリのカウントを計算してデータベースに保存する

### Requirement 3: 一般媒介_内覧後売主連絡未カテゴリの追加

**User Story:** As a 営業担当者, I want to see 一般媒介物件の内覧後に売主連絡が未対応の買主を一覧表示できるカテゴリ, so that 売主への連絡漏れを防ぐことができる

#### Acceptance Criteria

1. WHEN サイドバーに「一般媒介_内覧後売主連絡未」カテゴリが表示される, THE Buyer_System SHALL 赤字で表示する
2. WHEN 買主が以下の条件のいずれかを満たす, THE Buyer_System SHALL 「一般媒介_内覧後売主連絡未」カテゴリにカウントする:
   - (●内覧日(最新） >= 2026/3/20 AND ●内覧日(最新） < 今日 AND 内覧形態_一般媒介が空でない AND (内覧後売主連絡="未" OR 内覧後売主連絡が空))
   - 内覧後売主連絡 = "未"
3. WHEN ユーザーが「一般媒介_内覧後売主連絡未」カテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
4. THE GAS SHALL 10分ごとに「一般媒介_内覧後売主連絡未」カテゴリのカウントを計算してデータベースに保存する

### Requirement 4: 要内覧促進客カテゴリの追加

**User Story:** As a 営業担当者, I want to see 内覧促進が必要な買主を一覧表示できるカテゴリ, so that 内覧促進メールの送信漏れを防ぐことができる

#### Acceptance Criteria

1. WHEN サイドバーに「要内覧促進客」カテゴリが表示される, THE Buyer_System SHALL 赤字で表示する
2. WHEN 買主が以下の全ての条件を満たす, THE Buyer_System SHALL 「要内覧促進客」カテゴリにカウントする:
   - 受付日 >= 今日 - 14日
   - 受付日 <= 今日 - 4日
   - ●内覧日(最新）が空
   - 後続担当が空
   - ★最新状況が空
   - 内覧促進メール不要 ≠ "不要"
   - 内覧促進メール送信者が空
   - 業者問合せが空
   - ●問合せ元 ≠ "配信希望アンケート"
   - ●問合せ元に"ピンリッチ"が含まれない
   - ●問合時確度 ≠ "e（買付物件の問合せ）"
   - ●問合時確度 ≠ "d（資料送付不要、条件不適合など）"
   - ●問合時確度 ≠ "b（内覧検討）"
3. WHEN ユーザーが「要内覧促進客」カテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
4. THE GAS SHALL 10分ごとに「要内覧促進客」カテゴリのカウントを計算してデータベースに保存する

### Requirement 5: ピンリッチ未登録カテゴリの追加

**User Story:** As a 営業担当者, I want to see ピンリッチ未登録の買主を一覧表示できるカテゴリ, so that ピンリッチ登録漏れを防ぐことができる

#### Acceptance Criteria

1. WHEN サイドバーに「ピンリッチ未登録」カテゴリが表示される, THE Buyer_System SHALL 赤字で表示する
2. WHEN 買主が以下の条件のいずれかを満たす, THE Buyer_System SHALL 「ピンリッチ未登録」カテゴリにカウントする:
   - (Pinrichが空 AND ●メアドが空でない AND 業者問合せが空)
   - (Pinrich = "登録無し" AND ●メアドが空でない AND 業者問合せが空)
3. WHEN ユーザーが「ピンリッチ未登録」カテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
4. THE GAS SHALL 10分ごとに「ピンリッチ未登録」カテゴリのカウントを計算してデータベースに保存する

### Requirement 6: GASでのカウント計算

**User Story:** As a システム, I want to 10分ごとに全カテゴリのカウントを計算してデータベースに保存する, so that サイドバーに最新のカウントを表示できる

#### Acceptance Criteria

1. THE GAS SHALL 10分ごとに全買主データを読み取る
2. THE GAS SHALL 各カテゴリの条件式に基づいて該当する買主をカウントする
3. THE GAS SHALL カウント結果を`buyer_sidebar_counts`テーブルに保存する
4. WHEN カウント計算が失敗した場合, THE GAS SHALL エラーログを出力して次回の実行を継続する

### Requirement 7: フロントエンドでの表示

**User Story:** As a ユーザー, I want to サイドバーに新しいカテゴリが赤字で表示される, so that 重要なカテゴリを視覚的に識別できる

#### Acceptance Criteria

1. THE Buyer_System SHALL 全ての新カテゴリを赤字（#d32f2f）で表示する
2. THE Buyer_System SHALL カテゴリ名の横にカウント数をバッジで表示する
3. WHEN カウントが0の場合, THE Buyer_System SHALL そのカテゴリを非表示にする
4. THE Buyer_System SHALL 既存のカテゴリと同じスタイル（ホバー効果、選択状態）を適用する

### Requirement 8: フィルタリング機能

**User Story:** As a ユーザー, I want to カテゴリをクリックすると該当する買主のみが表示される, so that 効率的に買主を管理できる

#### Acceptance Criteria

1. WHEN ユーザーがカテゴリをクリックする, THE Buyer_System SHALL 該当する買主のみを一覧表示する
2. THE Buyer_System SHALL フィルタリング条件をURLパラメータに保存する
3. WHEN ページをリロードした場合, THE Buyer_System SHALL URLパラメータからフィルタリング条件を復元する
4. THE Buyer_System SHALL フィルタリング中のカテゴリを選択状態（ハイライト）で表示する
