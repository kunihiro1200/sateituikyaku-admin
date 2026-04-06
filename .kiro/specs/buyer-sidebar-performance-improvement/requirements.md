# Requirements Document

## Introduction

買主リストページのサイドバー表示が初回アクセス時に15秒かかる問題を解決し、5秒以内に短縮する。一覧表はすぐに表示されるが、サイドバーのカテゴリカウント（「内覧日前日」「当日TEL」など）の計算に時間がかかっている。

## Glossary

- **Buyer_Sidebar**: 買主リストページの左側に表示されるステータスカテゴリ一覧とカウント表示
- **Category_Count**: 各ステータスカテゴリに該当する買主の件数（例: 内覧日前日: 5件）
- **Status_Calculation**: 買主データから calculated_status を計算する処理
- **Database_Query**: Supabase の buyers テーブルからデータを取得するクエリ
- **Cache**: Redis または Node.js メモリ上に保存される一時データ
- **Initial_Load**: ユーザーが買主リストページに初めてアクセスした時の読み込み処理

## Requirements

### Requirement 1: サイドバー初回表示時間の短縮

**User Story:** As a ユーザー, I want サイドバーが5秒以内に表示される, so that ページ遷移後すぐに作業を開始できる

#### Acceptance Criteria

1. WHEN ユーザーが買主リストページに初めてアクセスする, THE Buyer_Sidebar SHALL 5秒以内にカテゴリカウントを表示する
2. WHEN サイドバーカウントを計算する, THE System SHALL 全買主データの取得とステータス計算を並列実行する
3. WHEN Database_Query を実行する, THE System SHALL 必要最小限のカラムのみを SELECT する
4. WHEN Status_Calculation を実行する, THE System SHALL バッチ処理で複数買主のステータスを一度に計算する

### Requirement 2: キャッシュ戦略の最適化

**User Story:** As a システム, I want サイドバーカウントを効率的にキャッシュする, so that 2回目以降のアクセスが高速になる

#### Acceptance Criteria

1. WHEN サイドバーカウントを計算する, THE System SHALL 計算結果を10分間キャッシュする
2. WHEN 買主データが更新される, THE Cache SHALL 自動的に無効化される
3. WHEN キャッシュが存在する, THE System SHALL Database_Query を実行せずにキャッシュから返す
4. WHEN キャッシュが期限切れの場合, THE System SHALL バックグラウンドで再計算してキャッシュを更新する

### Requirement 3: プログレッシブローディングの実装

**User Story:** As a ユーザー, I want サイドバーが段階的に表示される, so that 待ち時間を感じにくくなる

#### Acceptance Criteria

1. WHEN ページが読み込まれる, THE Buyer_Sidebar SHALL まず「読み込み中」インジケーターを表示する
2. WHEN カテゴリカウントが計算される, THE Buyer_Sidebar SHALL 計算完了したカテゴリから順次表示する
3. WHEN 一覧表が表示される, THE System SHALL サイドバーの計算完了を待たずに一覧表を表示する
4. WHEN サイドバー計算が5秒を超える, THE System SHALL タイムアウトエラーを表示する

### Requirement 4: データベースクエリの最適化

**User Story:** As a システム, I want 買主データ取得クエリを最適化する, so that データベース負荷を削減できる

#### Acceptance Criteria

1. WHEN 全買主データを取得する, THE Database_Query SHALL ステータス計算に必要なカラムのみを SELECT する
2. WHEN 買主データをフィルタリングする, THE Database_Query SHALL deleted_at IS NULL 条件をインデックスで高速化する
3. WHEN 複数のカテゴリカウントを計算する, THE System SHALL 1回のクエリで全カテゴリのカウントを取得する
4. WHEN データベース接続が遅い, THE System SHALL 接続プールを使用して接続を再利用する

### Requirement 5: パフォーマンス監視とロギング

**User Story:** As a 開発者, I want サイドバー表示時間を監視する, so that パフォーマンス劣化を早期に検知できる

#### Acceptance Criteria

1. WHEN サイドバーカウントを計算する, THE System SHALL 処理時間をログに記録する
2. WHEN 処理時間が5秒を超える, THE System SHALL 警告ログを出力する
3. WHEN エラーが発生する, THE System SHALL エラー内容とスタックトレースをログに記録する
4. WHEN パフォーマンス測定を実行する, THE System SHALL 各処理ステップの所要時間を記録する

### Requirement 6: 後方互換性の維持

**User Story:** As a システム, I want 既存の機能を壊さない, so that 他のページに影響を与えない

#### Acceptance Criteria

1. WHEN サイドバーカウントAPIを変更する, THE System SHALL 既存のレスポンス形式を維持する
2. WHEN キャッシュ戦略を変更する, THE System SHALL 既存のキャッシュキーと互換性を保つ
3. WHEN ステータス計算ロジックを変更する, THE System SHALL 計算結果が既存と一致することを確認する
4. WHEN 買主データ更新時, THE System SHALL サイドバーカウントが即座に反映されることを確認する
