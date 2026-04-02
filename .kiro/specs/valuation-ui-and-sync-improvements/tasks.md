# Tasks

## Phase 1: フロントエンド実装

### 1.1 路線価リンクの配置変更

- [x] 1.1.1 CallModePage.tsxの査定計算セクション（上部）のレイアウトを変更
  - 物件住所フィールドを先に配置
  - 路線価リンクを物件住所の右隣に配置
  - flexレイアウトで横並びに配置
- [x] 1.1.2 CallModePage.tsxの査定計算セクション（下部）のレイアウトを変更
  - 上部と同じレイアウトを適用
- [x] 1.1.3 路線価リンクのボタンサイズを「small」に設定
- [x] 1.1.4 物件住所が存在しない場合の条件分岐を確認

## Phase 2: バックエンド実装

### 2.1 イニシャル変換ロジックの実装

- [x] 2.1.1 SpreadsheetSyncService.tsに`convertToInitials()`メソッドを追加
  - フルネームをイニシャルに変換
  - 日本語（漢字・ひらがな・カタカナ）の処理
  - 英語（アルファベット）の処理
  - スペースあり/なしの処理
  - 空文字列/nullの処理
- [x] 2.1.2 SpreadsheetSyncService.tsに`convertKanaToRomaji()`メソッドを追加
  - 日本語の文字をローマ字に変換
  - 主要な姓の漢字マッピングを定義

### 2.2 スプレッドシート同期の修正

- [x] 2.2.1 SpreadsheetSyncService.tsの`syncToSpreadsheet()`メソッドを修正
  - `valuation_assignee`をイニシャルに変換してからスプレッドシートに書き込み
- [x] 2.2.2 column-mapping.jsonの`valuation_assignee`マッピングを確認
  - `spreadsheetToDatabase`: 「査定担当」→ `valuation_assignee`
  - `databaseToSpreadsheet`: `valuation_assignee` → 「査定担当」

## Phase 3: テスト実装

### 3.1 ユニットテスト

- [ ] 3.1.1 フロントエンドのユニットテストを作成
  - `CallModePage-valuation-ui.test.tsx`
  - 路線価リンクの配置確認
  - 物件住所が存在しない場合の動作確認
  - 査定額保存時の査定担当設定確認
  - 査定額クリア時の査定担当クリア確認
- [ ] 3.1.2 バックエンドのユニットテストを作成
  - `SpreadsheetSyncService-initials.test.ts`
  - イニシャル変換（日本語）のテスト
  - イニシャル変換（英語）のテスト
  - イニシャル変換（スペースなし）のテスト
  - イニシャル変換（空文字列）のテスト
  - スプレッドシート同期のテスト

### 3.2 プロパティテスト

- [ ] 3.2.1 Property 1のテストを作成
  - `initials-conversion.property.test.ts`
  - イニシャル変換の正確性を検証
- [ ] 3.2.2 Property 2のテストを作成
  - `db-to-spreadsheet-sync.property.test.ts`
  - データベース → スプレッドシート同期時のイニシャル変換を検証
- [ ] 3.2.3 Property 3のテストを作成
  - `spreadsheet-to-db-sync.property.test.ts`
  - スプレッドシート → データベース同期時のイニシャル保持を検証

## Phase 4: 統合テスト

### 4.1 手動テスト

- [ ] 4.1.1 ローカル環境で動作確認
  - 通話モードページを開く
  - 路線価リンクの配置を確認
  - 査定額を入力して保存
  - データベースの`valuation_assignee`を確認（フルネーム）
  - スプレッドシートのBZ列を確認（イニシャル）
- [ ] 4.1.2 スプレッドシート → データベース同期を確認
  - スプレッドシートのBZ列にイニシャルを入力
  - GAS syncSellerList()を実行
  - データベースの`valuation_assignee`を確認（イニシャル）

### 4.2 本番環境デプロイ

- [-] 4.2.1 フロントエンドをデプロイ
  - git push origin main
  - Vercelで自動デプロイ確認
- [ ] 4.2.2 バックエンドをデプロイ
  - git push origin main
  - Vercelで自動デプロイ確認
- [ ] 4.2.3 本番環境で動作確認
  - 通話モードページを開く
  - 路線価リンクの配置を確認
  - 査定額を入力して保存
  - スプレッドシートのBZ列を確認（イニシャル）

## Phase 5: ドキュメント更新

### 5.1 ステアリングドキュメント更新

- [ ] 5.1.1 seller-spreadsheet-column-mapping.mdに査定担当のイニシャル変換ルールを追加
- [ ] 5.1.2 backend-architecture.mdに新しいメソッド（convertToInitials）を追加

### 5.2 ユーザードキュメント更新

- [ ] 5.2.1 通話モードページの使い方ガイドを更新
  - 路線価リンクの新しい配置を説明
  - 査定担当のイニシャル表示を説明
